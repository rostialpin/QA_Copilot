import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export class EndpointDiscoveryService {
  constructor() {
    this.endpoints = new Map();
    this.configs = new Map();
  }

  /**
   * Discover endpoints from repository
   */
  async discoverEndpoints(repoPath) {
    logger.info(`Discovering endpoints in repository: ${repoPath}`);
    
    const discoveries = {
      urls: [],
      endpoints: [],
      configs: {},
      environments: {},
      appConfigs: {}
    };

    // Search for configuration files
    await this.findConfigFiles(repoPath, discoveries);
    
    // Search for hardcoded URLs in source files
    await this.findHardcodedURLs(repoPath, discoveries);
    
    // Search for API endpoint definitions
    await this.findAPIEndpoints(repoPath, discoveries);
    
    // Search for environment-specific configs
    await this.findEnvironmentConfigs(repoPath, discoveries);
    
    // Search for app package/bundle IDs for mobile apps
    await this.findMobileAppConfigs(repoPath, discoveries);
    
    // Search for test configuration files
    await this.findTestConfigs(repoPath, discoveries);

    return discoveries;
  }

  /**
   * Find configuration files
   */
  async findConfigFiles(repoPath, discoveries) {
    const configPatterns = [
      '**/config*.json',
      '**/config*.js',
      '**/config*.ts',
      '**/.env*',
      '**/application*.properties',
      '**/application*.yml',
      '**/application*.yaml',
      '**/settings*.json',
      '**/appsettings*.json'
    ];

    for (const pattern of configPatterns) {
      const files = await this.globFiles(repoPath, pattern);
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const configs = this.parseConfigFile(content, file);
          Object.assign(discoveries.configs, configs);
        } catch (e) {
          // Skip files that can't be read
        }
      }
    }
  }

  /**
   * Parse configuration file content
   */
  parseConfigFile(content, filePath) {
    const configs = {};
    
    // Parse .env files
    if (filePath.includes('.env')) {
      const lines = content.split('\n');
      lines.forEach(line => {
        const match = line.match(/^([A-Z_]+)=(.+)$/);
        if (match) {
          const [, key, value] = match;
          if (key.includes('URL') || key.includes('HOST') || key.includes('ENDPOINT')) {
            configs[key] = value.replace(/['"]/g, '');
          }
        }
      });
    }
    
    // Parse JSON configs
    if (filePath.endsWith('.json')) {
      try {
        const json = JSON.parse(content);
        this.extractURLsFromObject(json, configs);
      } catch (e) {
        // Not valid JSON
      }
    }
    
    // Parse properties files
    if (filePath.includes('.properties')) {
      const lines = content.split('\n');
      lines.forEach(line => {
        if (line.includes('url') || line.includes('host') || line.includes('endpoint')) {
          const [key, value] = line.split('=').map(s => s.trim());
          if (value && (value.startsWith('http') || value.includes('://'))) {
            configs[key] = value;
          }
        }
      });
    }
    
    // Parse YAML files
    if (filePath.includes('.yml') || filePath.includes('.yaml')) {
      const urlMatches = content.match(/(?:url|host|endpoint):\s*(.+)/gi) || [];
      urlMatches.forEach(match => {
        const [key, value] = match.split(':').map(s => s.trim());
        if (value && !value.startsWith('#')) {
          configs[key] = value.replace(/['"]/g, '');
        }
      });
    }
    
    return configs;
  }

  /**
   * Extract URLs from nested objects
   */
  extractURLsFromObject(obj, configs, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        if (value.includes('http') || value.includes('://') || 
            key.toLowerCase().includes('url') || 
            key.toLowerCase().includes('host') ||
            key.toLowerCase().includes('endpoint')) {
          configs[fullKey] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        this.extractURLsFromObject(value, configs, fullKey);
      }
    }
  }

  /**
   * Find hardcoded URLs in source files
   */
  async findHardcodedURLs(repoPath, discoveries) {
    const sourcePatterns = [
      '**/*.js',
      '**/*.ts',
      '**/*.jsx',
      '**/*.tsx',
      '**/*.java',
      '**/*.swift',
      '**/*.kt',
      '**/*.py'
    ];

    const urlRegex = /(?:["'`])(https?:\/\/[^"'`\s]+)(?:["'`])/g;
    const localhostRegex = /(?:["'`])((?:http:\/\/)?localhost:\d+[^"'`]*)(?:["'`])/g;

    for (const pattern of sourcePatterns) {
      const files = await this.globFiles(repoPath, pattern);
      for (const file of files.slice(0, 100)) { // Limit to first 100 files
        try {
          const content = await fs.readFile(file, 'utf8');
          
          // Find URLs
          const urlMatches = content.match(urlRegex) || [];
          const localhostMatches = content.match(localhostRegex) || [];
          
          [...urlMatches, ...localhostMatches].forEach(match => {
            const url = match.replace(/["'`]/g, '');
            if (!discoveries.urls.includes(url)) {
              discoveries.urls.push(url);
            }
          });
        } catch (e) {
          // Skip files that can't be read
        }
      }
    }
  }

  /**
   * Find API endpoint definitions
   */
  async findAPIEndpoints(repoPath, discoveries) {
    const patterns = {
      // Express.js routes
      express: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)/g,
      // Spring Boot
      spring: /@(?:Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*["'`]([^"'`]+)/g,
      // FastAPI/Flask
      python: /@app\.(?:route|get|post|put|delete)\s*\(\s*["'`]([^"'`]+)/g,
      // Next.js API routes (file-based)
      nextjs: /pages\/api\/(.+)\.(js|ts)/,
      // GraphQL
      graphql: /type\s+(?:Query|Mutation)\s*{([^}]+)}/g
    };

    const files = await this.globFiles(repoPath, '**/*.{js,ts,java,py}');
    
    for (const file of files.slice(0, 100)) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        for (const [framework, regex] of Object.entries(patterns)) {
          const matches = [...content.matchAll(regex)];
          matches.forEach(match => {
            const endpoint = match[1] || match[2];
            if (endpoint && !discoveries.endpoints.includes(endpoint)) {
              discoveries.endpoints.push({
                path: endpoint,
                file: file.replace(repoPath, ''),
                framework
              });
            }
          });
        }
      } catch (e) {
        // Skip
      }
    }
  }

  /**
   * Find environment-specific configurations
   */
  async findEnvironmentConfigs(repoPath, discoveries) {
    const envFiles = await this.globFiles(repoPath, '**/.env*');
    
    discoveries.environments = {
      development: {},
      staging: {},
      production: {},
      test: {}
    };

    for (const file of envFiles) {
      const fileName = path.basename(file);
      let env = 'development';
      
      if (fileName.includes('prod')) env = 'production';
      else if (fileName.includes('stag')) env = 'staging';
      else if (fileName.includes('test')) env = 'test';
      
      try {
        const content = await fs.readFile(file, 'utf8');
        const configs = this.parseConfigFile(content, file);
        Object.assign(discoveries.environments[env], configs);
      } catch (e) {
        // Skip
      }
    }
  }

  /**
   * Find mobile app configurations
   */
  async findMobileAppConfigs(repoPath, discoveries) {
    discoveries.appConfigs = {
      android: {},
      ios: {},
      tv: {}
    };

    // Android - look for AndroidManifest.xml and build.gradle
    const androidManifests = await this.globFiles(repoPath, '**/AndroidManifest.xml');
    for (const manifest of androidManifests) {
      try {
        const content = await fs.readFile(manifest, 'utf8');
        const packageMatch = content.match(/package="([^"]+)"/);
        if (packageMatch) {
          discoveries.appConfigs.android.package = packageMatch[1];
        }
        
        // Look for deep links
        const schemeMatch = content.match(/android:scheme="([^"]+)"/);
        if (schemeMatch) {
          discoveries.appConfigs.android.deepLinkScheme = schemeMatch[1];
        }
      } catch (e) {
        // Skip
      }
    }

    // iOS - look for Info.plist
    const infoPLists = await this.globFiles(repoPath, '**/Info.plist');
    for (const plist of infoPLists) {
      try {
        const content = await fs.readFile(plist, 'utf8');
        const bundleMatch = content.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)/);
        if (bundleMatch) {
          discoveries.appConfigs.ios.bundleId = bundleMatch[1];
        }
      } catch (e) {
        // Skip
      }
    }

    // TV apps - look for specific configurations
    const tvConfigs = await this.globFiles(repoPath, '**/*tv*.{json,xml,plist}');
    for (const config of tvConfigs) {
      const content = await fs.readFile(config, 'utf8');
      if (config.includes('roku')) {
        discoveries.appConfigs.tv.roku = true;
      }
      if (config.includes('appletv') || config.includes('tvos')) {
        discoveries.appConfigs.tv.appletv = true;
      }
      if (config.includes('firetv') || config.includes('amazontv')) {
        discoveries.appConfigs.tv.firetv = true;
      }
    }
  }

  /**
   * Find test configuration files
   */
  async findTestConfigs(repoPath, discoveries) {
    const testConfigs = [
      '**/cypress.config.{js,ts}',
      '**/playwright.config.{js,ts}',
      '**/jest.config.{js,ts}',
      '**/karma.conf.{js,ts}',
      '**/protractor.conf.{js,ts}',
      '**/testng.xml',
      '**/pytest.ini',
      '**/*.testconfig.json'
    ];

    discoveries.testConfigs = {};

    for (const pattern of testConfigs) {
      const files = await this.globFiles(repoPath, pattern);
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const fileName = path.basename(file);
          
          // Extract base URLs from test configs
          const baseURLMatch = content.match(/baseURL:\s*["'`]([^"'`]+)/);
          if (baseURLMatch) {
            discoveries.testConfigs[fileName] = {
              baseURL: baseURLMatch[1]
            };
          }
          
          // Extract test environment URLs
          const envURLs = content.match(/(?:test|staging|dev).*url.*["'`]([^"'`]+)/gi) || [];
          envURLs.forEach(match => {
            const url = match.match(/["'`]([^"'`]+)/)[1];
            if (url) {
              discoveries.testConfigs[`${fileName}_env`] = url;
            }
          });
        } catch (e) {
          // Skip
        }
      }
    }
  }

  /**
   * Helper to glob files
   */
  async globFiles(basePath, pattern) {
    const { globby } = await import('globby');
    try {
      return await globby(pattern, {
        cwd: basePath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      });
    } catch (e) {
      return [];
    }
  }

  /**
   * Get smart suggestions for what to test based on discoveries
   */
  generateTestSuggestions(discoveries) {
    const suggestions = {
      webURLs: [],
      mobileApps: [],
      apiEndpoints: [],
      environments: []
    };

    // Suggest web URLs to test
    if (discoveries.urls.length > 0) {
      suggestions.webURLs = discoveries.urls
        .filter(url => !url.includes('example.com'))
        .slice(0, 5);
    }

    // Add URLs from configs
    Object.values(discoveries.configs).forEach(url => {
      if (typeof url === 'string' && url.includes('http')) {
        suggestions.webURLs.push(url);
      }
    });

    // Suggest mobile apps
    if (discoveries.appConfigs.android.package) {
      suggestions.mobileApps.push({
        platform: 'android',
        identifier: discoveries.appConfigs.android.package
      });
    }
    if (discoveries.appConfigs.ios.bundleId) {
      suggestions.mobileApps.push({
        platform: 'ios',
        identifier: discoveries.appConfigs.ios.bundleId
      });
    }

    // Suggest API endpoints to test
    if (discoveries.endpoints.length > 0) {
      suggestions.apiEndpoints = discoveries.endpoints.slice(0, 10);
    }

    // Suggest environments
    Object.entries(discoveries.environments).forEach(([env, configs]) => {
      if (Object.keys(configs).length > 0) {
        suggestions.environments.push({
          name: env,
          urls: Object.values(configs).filter(v => typeof v === 'string')
        });
      }
    });

    return suggestions;
  }
}

// Export singleton
export const endpointDiscoveryService = new EndpointDiscoveryService();