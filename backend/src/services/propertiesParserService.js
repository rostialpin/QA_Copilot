import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

class PropertiesParserService {
  constructor() {
    this.propertiesCache = new Map();
    this.navigationPatterns = new Map();
    this.pageObjects = new Map();
    this.locatorPatterns = null; // Will store learned patterns
  }

  /**
   * Parse properties files from a directory
   * @param {string} dirPath - Path to properties directory
   * @param {string} primaryPage - Optional: specific page to focus on (e.g., 'ContainerScreen')
   */
  async parsePropertiesDirectory(dirPath, primaryPage = null) {
    try {
      const result = {
        pages: {},
        navigationMethods: [],
        commonPatterns: {},
        primaryPageElements: {}
      };

      // Scan for all .properties files
      const files = await this.scanForPropertiesFiles(dirPath);
      
      // Parse each properties file
      for (const file of files) {
        const pageName = path.basename(file, '.properties');
        const properties = await this.parsePropertiesFile(file);
        
        result.pages[pageName] = properties;
        
        // If this is the primary page, extract its elements separately
        if (primaryPage && pageName.toLowerCase().includes(primaryPage.toLowerCase())) {
          result.primaryPageElements = properties;
          logger.info(`Found primary page properties: ${pageName} with ${Object.keys(properties).length} elements`);
        }
      }

      // Scan for test files to learn navigation patterns
      const testFiles = await this.scanForTestFiles(path.dirname(dirPath));
      result.navigationMethods = await this.extractNavigationPatterns(testFiles);

      // Extract common patterns
      result.commonPatterns = this.extractCommonPatterns(result.pages);

      return result;
    } catch (error) {
      logger.error('Error parsing properties directory:', error);
      throw error;
    }
  }

  /**
   * Parse a single properties file
   */
  async parsePropertiesFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const properties = {};
      
      const lines = content.split('\n');
      for (const line of lines) {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || line.trim() === '') continue;
        
        // Parse property lines (key=value)
        const match = line.match(/^([^=]+)=(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          
          // Parse the locator strategy and value
          properties[key] = this.parseLocator(value);
        }
      }
      
      return properties;
    } catch (error) {
      logger.error(`Error parsing properties file ${filePath}:`, error);
      return {};
    }
  }

  /**
   * Parse locator string into structured format
   */
  parseLocator(locatorString) {
    const result = {
      raw: locatorString,
      strategy: null,
      value: null,
      alternatives: []
    };

    // Common locator patterns
    const patterns = [
      { regex: /^xpath:(.+)$/i, strategy: 'xpath' },
      { regex: /^css:(.+)$/i, strategy: 'css' },
      { regex: /^id:(.+)$/i, strategy: 'id' },
      { regex: /^name:(.+)$/i, strategy: 'name' },
      { regex: /^class:(.+)$/i, strategy: 'className' },
      { regex: /^tag:(.+)$/i, strategy: 'tagName' },
      { regex: /^\[data-testid=['"]?([^'"]+)['"]?\]$/i, strategy: 'data-testid' },
      { regex: /^\/\/(.+)$/i, strategy: 'xpath' }, // XPath shorthand
      { regex: /^#(.+)$/i, strategy: 'id' }, // CSS ID shorthand
      { regex: /^\.(.+)$/i, strategy: 'className' } // CSS class shorthand
    ];

    for (const pattern of patterns) {
      const match = locatorString.match(pattern.regex);
      if (match) {
        result.strategy = pattern.strategy;
        result.value = match[1];
        break;
      }
    }

    // If no pattern matched, try to infer
    if (!result.strategy) {
      if (locatorString.startsWith('//') || locatorString.includes('[@')) {
        result.strategy = 'xpath';
        result.value = locatorString;
      } else if (locatorString.includes('[') || locatorString.includes('.') || locatorString.includes('#')) {
        result.strategy = 'css';
        result.value = locatorString;
      } else {
        // Default to id
        result.strategy = 'id';
        result.value = locatorString;
      }
    }

    // Generate alternative locator strategies
    result.alternatives = this.generateAlternativeLocators(result);

    return result;
  }

  /**
   * Generate alternative locator strategies for fallback
   */
  generateAlternativeLocators(locator) {
    const alternatives = [];
    
    // If we have a data-testid, generate CSS and XPath alternatives
    if (locator.strategy === 'data-testid') {
      alternatives.push({
        strategy: 'css',
        value: `[data-testid="${locator.value}"]`
      });
      alternatives.push({
        strategy: 'xpath',
        value: `//*[@data-testid="${locator.value}"]`
      });
    }
    
    // If we have an ID, generate CSS alternative
    if (locator.strategy === 'id') {
      alternatives.push({
        strategy: 'css',
        value: `#${locator.value}`
      });
    }
    
    return alternatives;
  }

  /**
   * Extract navigation patterns from test files
   */
  async extractNavigationPatterns(testFiles) {
    const patterns = [];
    
    for (const file of testFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Look for navigation patterns
        const navigationRegexes = [
          /(\w+Screen)\(\)\.(\w+)\([^)]*\)/g, // pageScreen().method()
          /navigateTo(\w+)\([^)]*\)/g, // navigateToSomePage()
          /launch\w+AndNavigateTo\w+/g, // launchAppAndNavigateToHomeScreen
          /open\w+From\w+/g, // openShowFromMovieSection
          /verify\w+(Screen|Page)\(/g // verifyPageLoad(screen)
        ];
        
        for (const regex of navigationRegexes) {
          const matches = content.matchAll(regex);
          for (const match of matches) {
            patterns.push({
              pattern: match[0],
              file: path.basename(file),
              type: this.classifyNavigationPattern(match[0])
            });
          }
        }
      } catch (error) {
        logger.error(`Error extracting patterns from ${file}:`, error);
      }
    }
    
    // Deduplicate and sort by frequency
    const uniquePatterns = this.deduplicatePatterns(patterns);
    return uniquePatterns;
  }

  /**
   * Classify navigation pattern type
   */
  classifyNavigationPattern(pattern) {
    if (pattern.includes('launch')) return 'initialization';
    if (pattern.includes('navigateTo')) return 'direct-navigation';
    if (pattern.includes('open') || pattern.includes('select')) return 'interaction-navigation';
    if (pattern.includes('verify')) return 'verification';
    return 'unknown';
  }

  /**
   * Extract common patterns across all pages
   */
  extractCommonPatterns(pages) {
    const patterns = {
      buttonPatterns: [],
      inputPatterns: [],
      textPatterns: [],
      navigationPatterns: []
    };

    for (const [pageName, elements] of Object.entries(pages)) {
      for (const [elementName, locator] of Object.entries(elements)) {
        // Classify by element type
        if (elementName.includes('button') || elementName.includes('Button') || elementName.includes('btn')) {
          patterns.buttonPatterns.push({ page: pageName, name: elementName, locator });
        } else if (elementName.includes('input') || elementName.includes('field') || elementName.includes('Field')) {
          patterns.inputPatterns.push({ page: pageName, name: elementName, locator });
        } else if (elementName.includes('text') || elementName.includes('label') || elementName.includes('title')) {
          patterns.textPatterns.push({ page: pageName, name: elementName, locator });
        } else if (elementName.includes('nav') || elementName.includes('menu') || elementName.includes('tab')) {
          patterns.navigationPatterns.push({ page: pageName, name: elementName, locator });
        }
      }
    }

    return patterns;
  }

  /**
   * Scan directory for properties files
   */
  async scanForPropertiesFiles(dirPath) {
    const files = [];
    
    async function scan(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.properties')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        logger.error(`Error scanning directory ${dir}:`, error);
      }
    }
    
    await scan(dirPath);
    return files;
  }

  /**
   * Scan for test files to learn patterns
   */
  async scanForTestFiles(dirPath) {
    const files = [];
    
    async function scan(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath);
          } else if (entry.isFile() && 
                     (entry.name.includes('Test') || entry.name.includes('test')) &&
                     (entry.name.endsWith('.java') || entry.name.endsWith('.js'))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        logger.error(`Error scanning for test files in ${dir}:`, error);
      }
    }
    
    await scan(dirPath);
    return files.slice(0, 10); // Limit to 10 test files for performance
  }

  /**
   * Deduplicate patterns and count frequency
   */
  deduplicatePatterns(patterns) {
    const patternMap = new Map();
    
    for (const pattern of patterns) {
      const key = pattern.pattern;
      if (patternMap.has(key)) {
        patternMap.get(key).count++;
      } else {
        patternMap.set(key, { ...pattern, count: 1 });
      }
    }
    
    // Sort by frequency
    return Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Learn locator patterns from existing properties
   * This helps generate new element locators following the same pattern
   */
  learnLocatorPatterns(propertiesData) {
    const patterns = {
      prefixPatterns: new Set(),
      suffixPatterns: new Set(),
      strategies: {},
      namingConventions: {},
      examples: []
    };

    // Analyze all existing locators
    for (const [pageName, elements] of Object.entries(propertiesData.pages)) {
      for (const [elementName, locator] of Object.entries(elements)) {
        // Learn naming patterns
        if (elementName.includes('button') || elementName.includes('Button')) {
          patterns.namingConventions.buttons = patterns.namingConventions.buttons || [];
          patterns.namingConventions.buttons.push(elementName);
        }
        
        // Learn locator strategies
        patterns.strategies[locator.strategy] = (patterns.strategies[locator.strategy] || 0) + 1;
        
        // Learn common prefixes/suffixes in locator values
        if (locator.strategy === 'xpath' && locator.value) {
          // Extract patterns like //button[@data-testid='...']
          const attrMatch = locator.value.match(/@([\w-]+)=/);
          if (attrMatch) {
            patterns.prefixPatterns.add(attrMatch[1]);
          }
        }
        
        // Store examples for reference
        patterns.examples.push({
          page: pageName,
          element: elementName,
          locator: locator
        });
      }
    }
    
    // Determine most common strategy
    patterns.primaryStrategy = Object.entries(patterns.strategies)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'xpath';
    
    this.locatorPatterns = patterns;
    return patterns;
  }

  /**
   * Generate new element locator with multiple fallback strategies
   * @param {string} elementType - Type of element (button, input, text, etc.)
   * @param {string} elementName - Name/label of the element
   * @param {Object} domElement - Optional DOM element info from DOM analyzer
   */
  generateNewElementLocator(elementType, elementName, domElement = null) {
    // Generate element key name following naming convention
    const elementKey = this.generateElementKey(elementType, elementName);
    
    // Generate multiple locator strategies for robustness
    const locatorStrategies = [];
    
    if (domElement && domElement.attributes) {
      // Priority 1: data-testid (most reliable)
      if (domElement.attributes['data-testid']) {
        locatorStrategies.push({
          strategy: 'css',
          value: `[data-testid='${domElement.attributes['data-testid']}']`,
          priority: 1
        });
        locatorStrategies.push({
          strategy: 'xpath',
          value: `//*[@data-testid='${domElement.attributes['data-testid']}']`,
          priority: 2
        });
      }
      
      // Priority 2: ID attribute
      if (domElement.attributes.id) {
        locatorStrategies.push({
          strategy: 'id',
          value: domElement.attributes.id,
          priority: 1
        });
        locatorStrategies.push({
          strategy: 'css',
          value: `#${domElement.attributes.id}`,
          priority: 2
        });
      }
      
      // Priority 3: aria-label
      if (domElement.attributes['aria-label']) {
        locatorStrategies.push({
          strategy: 'css',
          value: `[aria-label='${domElement.attributes['aria-label']}']`,
          priority: 3
        });
        locatorStrategies.push({
          strategy: 'xpath',
          value: `//*[@aria-label='${domElement.attributes['aria-label']}']`,
          priority: 3
        });
      }
      
      // Priority 4: Class-based
      if (domElement.attributes.class) {
        const primaryClass = domElement.attributes.class.split(' ')[0];
        locatorStrategies.push({
          strategy: 'css',
          value: `.${primaryClass}`,
          priority: 4
        });
      }
    }
    
    // Always add text-based fallbacks
    if (elementType === 'button') {
      locatorStrategies.push({
        strategy: 'xpath',
        value: `//button[contains(text(), '${elementName}')]`,
        priority: 5
      });
      locatorStrategies.push({
        strategy: 'xpath',
        value: `//button[contains(., '${elementName}')]`,
        priority: 6
      });
      locatorStrategies.push({
        strategy: 'xpath',
        value: `//*[contains(@class, 'button') and contains(text(), '${elementName}')]`,
        priority: 7
      });
    } else {
      const tag = this.getTagForElementType(elementType);
      locatorStrategies.push({
        strategy: 'xpath',
        value: `//${tag}[contains(text(), '${elementName}')]`,
        priority: 5
      });
    }
    
    // Sort by priority
    locatorStrategies.sort((a, b) => a.priority - b.priority);
    
    return {
      key: elementKey,
      multipleStrategies: locatorStrategies,
      primaryLocator: locatorStrategies[0] || this.generateBasicLocator(elementType, elementName, domElement).locator
    };
  }

  /**
   * Get HTML tag for element type
   */
  getTagForElementType(elementType) {
    const tagMap = {
      'button': 'button',
      'input': 'input',
      'text': 'span',
      'link': 'a',
      'select': 'select',
      'checkbox': 'input[@type="checkbox"]',
      'radio': 'input[@type="radio"]',
      'div': 'div',
      'paragraph': 'p'
    };
    return tagMap[elementType] || '*';
  }

  /**
   * Generate element key following naming conventions
   */
  generateElementKey(elementType, elementName) {
    // Convert to camelCase
    const cleanName = elementName
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map((word, index) => 
        index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
    
    // Add type suffix if not already present
    if (elementType === 'button' && !cleanName.includes('button') && !cleanName.includes('Button')) {
      return cleanName + 'Button';
    } else if (elementType === 'input' && !cleanName.includes('input') && !cleanName.includes('Field')) {
      return cleanName + 'Field';
    } else if (elementType === 'text' && !cleanName.includes('text') && !cleanName.includes('Text')) {
      return cleanName + 'Text';
    }
    
    return cleanName;
  }

  /**
   * Generate locator from test ID
   */
  generateLocatorFromTestId(testId, strategy) {
    switch (strategy) {
      case 'xpath':
        return `//*[@data-testid='${testId}']`;
      case 'css':
        return `[data-testid='${testId}']`;
      default:
        return `[data-testid='${testId}']`;
    }
  }

  /**
   * Generate locator from ID
   */
  generateLocatorFromId(id, strategy) {
    switch (strategy) {
      case 'xpath':
        return `//*[@id='${id}']`;
      case 'css':
        return `#${id}`;
      case 'id':
        return id;
      default:
        return id;
    }
  }

  /**
   * Generate locator from aria-label
   */
  generateLocatorFromAriaLabel(ariaLabel, strategy) {
    switch (strategy) {
      case 'xpath':
        return `//*[@aria-label='${ariaLabel}']`;
      case 'css':
        return `[aria-label='${ariaLabel}']`;
      default:
        return `[aria-label='${ariaLabel}']`;
    }
  }

  /**
   * Generate locator from element type and name
   */
  generateLocatorFromElement(elementType, elementName, strategy) {
    const tagMap = {
      'button': 'button',
      'input': 'input',
      'text': 'span',
      'link': 'a',
      'select': 'select',
      'checkbox': 'input[@type="checkbox"]',
      'radio': 'input[@type="radio"]'
    };
    
    const tag = tagMap[elementType] || '*';
    
    switch (strategy) {
      case 'xpath':
        if (elementType === 'button') {
          return `//button[contains(text(), '${elementName}') or @aria-label='${elementName}']`;
        }
        return `//${tag}[contains(text(), '${elementName}')]`;
      case 'css':
        return `${tag}:contains('${elementName}')`;
      default:
        return `//button[contains(text(), '${elementName}')]`;
    }
  }

  /**
   * Generate basic locator without patterns
   */
  generateBasicLocator(elementType, elementName, domElement) {
    const elementKey = this.generateElementKey(elementType, elementName);
    
    let strategy = 'xpath';
    let value = `//button[contains(text(), '${elementName}')]`;
    
    if (domElement) {
      if (domElement.attributes?.['data-testid']) {
        strategy = 'css';
        value = `[data-testid='${domElement.attributes['data-testid']}']`;
      } else if (domElement.attributes?.id) {
        strategy = 'id';
        value = domElement.attributes.id;
      }
    }
    
    return {
      key: elementKey,
      locator: {
        raw: value,
        strategy: strategy,
        value: value,
        alternatives: []
      }
    };
  }

  /**
   * Generate locator code for test generation with multiple strategies
   */
  generateLocatorCode(elementName, locatorData, pageName = 'generated') {
    const methodName = `findElement_${elementName}`;
    
    let code = `    private WebElement ${methodName}() {\n`;
    
    // Handle both old format (single locator) and new format (multiple strategies)
    if (locatorData.multipleStrategies) {
      code += `        // Element: ${elementName} with multiple fallback strategies\n`;
      code += `        List<By> locators = Arrays.asList(\n`;
      
      // Add all strategies as fallbacks
      locatorData.multipleStrategies.forEach((loc, index) => {
        const comma = index < locatorData.multipleStrategies.length - 1 ? ',' : '';
        code += `            ${this.generateByStatement(loc.strategy, loc.value)}${comma}\n`;
      });
      
      code += `        );\n`;
    } else if (locatorData.strategy && locatorData.value) {
      // Old format - single locator with alternatives
      code += `        // Element from ${pageName}.properties\n`;
      code += `        List<By> locators = Arrays.asList(\n`;
      code += `            ${this.generateByStatement(locatorData.strategy, locatorData.value)}`;
      
      if (locatorData.alternatives && locatorData.alternatives.length > 0) {
        for (const alt of locatorData.alternatives) {
          code += `,\n            ${this.generateByStatement(alt.strategy, alt.value)}`;
        }
      }
      code += `\n        );\n`;
    } else {
      // Fallback to basic xpath
      code += `        List<By> locators = Arrays.asList(\n`;
      code += `            By.xpath("//button[contains(text(), '${elementName}')]")\n`;
      code += `        );\n`;
    }
    
    code += `        return findElementWithFallbacks("${elementName}", locators);\n`;
    code += `    }\n`;
    
    return code;
  }

  /**
   * Generate code for a new element not in properties
   */
  generateCodeForNewElement(elementType, elementName, domElement = null) {
    // Generate locator with multiple strategies
    const locatorData = this.generateNewElementLocator(elementType, elementName, domElement);
    
    // Generate the method code
    return this.generateLocatorCode(locatorData.key, locatorData);
  }

  /**
   * Generate By statement for different strategies
   */
  generateByStatement(strategy, value) {
    switch (strategy) {
      case 'xpath':
        return `By.xpath("${value}")`;
      case 'css':
        return `By.cssSelector("${value}")`;
      case 'id':
        return `By.id("${value}")`;
      case 'name':
        return `By.name("${value}")`;
      case 'className':
        return `By.className("${value}")`;
      case 'tagName':
        return `By.tagName("${value}")`;
      case 'data-testid':
        return `By.cssSelector("[data-testid='${value}']")`;
      default:
        return `By.cssSelector("${value}")`;
    }
  }
}

export default new PropertiesParserService();