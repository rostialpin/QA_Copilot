import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class PlaywrightService {
  constructor() {
    this.cacheDir = path.join(process.env.HOME, '.qa-copilot', 'playwright-cache');
    this.patterns = new Map();
  }

  /**
   * Validate if the provided path is a valid Playwright/JavaScript/TypeScript repository
   */
  async validateRepository(repoPath) {
    try {
      const stats = await fs.stat(repoPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }

      // Check for common JavaScript/TypeScript project indicators
      const indicators = [
        'package.json',
        'playwright.config.js',
        'playwright.config.ts',
        'tests',
        'e2e',
        'test',
        '__tests__'
      ];

      for (const indicator of indicators) {
        try {
          await fs.access(path.join(repoPath, indicator));
          logger.info(`Found project indicator: ${indicator}`);
          
          // Check if it's a Playwright project specifically
          if (indicator.includes('playwright')) {
            return { valid: true, type: 'playwright', path: repoPath };
          }
        } catch (e) {
          // Continue checking
        }
      }

      // Check for package.json to determine if it's a JS/TS project
      try {
        const packageJsonPath = path.join(repoPath, 'package.json');
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        
        // Check if Playwright is installed
        const hasPlaywright = 
          (packageJson.dependencies && packageJson.dependencies['@playwright/test']) ||
          (packageJson.devDependencies && packageJson.devDependencies['@playwright/test']);
        
        if (hasPlaywright) {
          return { valid: true, type: 'playwright', path: repoPath };
        }
        
        // Still valid JS/TS project even without Playwright
        return { valid: true, type: 'javascript', path: repoPath };
      } catch (e) {
        // No package.json or invalid
      }

      // Check for JS/TS files
      const hasJsFiles = await this.hasJavaScriptFiles(repoPath);
      if (hasJsFiles) {
        return { valid: true, type: 'javascript', path: repoPath };
      }

      return {
        valid: false,
        error: 'No JavaScript/TypeScript project indicators found'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check if directory contains JavaScript/TypeScript files
   */
  async hasJavaScriptFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && 
            (entry.name.endsWith('.js') || 
             entry.name.endsWith('.ts') || 
             entry.name.endsWith('.jsx') || 
             entry.name.endsWith('.tsx'))) {
          return true;
        }
        if (entry.isDirectory() && 
            !entry.name.startsWith('.') && 
            entry.name !== 'node_modules' &&
            entry.name !== 'dist' &&
            entry.name !== 'build') {
          const subPath = path.join(dirPath, entry.name);
          if (await this.hasJavaScriptFiles(subPath)) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get directory tree structure for UI display
   */
  async getDirectoryTree(repoPath, relativePath = '', maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const fullPath = path.join(repoPath, relativePath);
    const tree = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files, build directories, and node_modules
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === 'coverage' ||
            entry.name === '.git') {
          continue;
        }

        const entryPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          const children = await this.getDirectoryTree(repoPath, entryPath, maxDepth, currentDepth + 1);
          tree.push({
            name: entry.name,
            path: entryPath,
            type: 'directory',
            children,
            hasTests: await this.hasTestFiles(path.join(repoPath, entryPath))
          });
        } else if (entry.name.match(/\.(js|ts|jsx|tsx)$/)) {
          const isTest = entry.name.includes('.spec.') || 
                        entry.name.includes('.test.') ||
                        entry.name.includes('test');
          tree.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
            isTest
          });
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${fullPath}: ${error.message}`);
    }

    return tree;
  }

  /**
   * Check if directory contains test files
   */
  async hasTestFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.some(file => 
        file.includes('.spec.') || file.includes('.test.') || file.includes('test')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Learn patterns from test files in a directory
   */
  async learnPatterns(repoPath, testDirectory) {
    const patterns = {
      imports: new Set(),
      testStructures: [],
      selectors: [],
      assertions: [],
      pageObjects: [],
      helpers: [],
      fixtures: [],
      config: null
    };

    try {
      // Read Playwright config if exists
      const configPaths = [
        path.join(repoPath, 'playwright.config.js'),
        path.join(repoPath, 'playwright.config.ts')
      ];
      
      for (const configPath of configPaths) {
        try {
          const configContent = await fs.readFile(configPath, 'utf8');
          patterns.config = this.extractPlaywrightConfig(configContent);
          break;
        } catch (e) {
          // Config not found, continue
        }
      }

      // Find and analyze test files
      const testFiles = await this.findTestFiles(repoPath, testDirectory);
      
      for (const testFile of testFiles) {
        const content = await fs.readFile(testFile, 'utf8');
        this.extractTestPatterns(content, patterns);
      }

      // Find Page Object Models
      const pageObjectFiles = await this.findPageObjects(repoPath);
      for (const poFile of pageObjectFiles) {
        const content = await fs.readFile(poFile, 'utf8');
        patterns.pageObjects.push(this.extractPageObjectPattern(content));
      }

    } catch (error) {
      logger.error(`Error learning patterns: ${error.message}`);
    }

    // Convert Sets to Arrays
    patterns.imports = Array.from(patterns.imports);
    patterns.importsCount = patterns.imports.length;
    patterns.selectorsCount = patterns.selectors.length;
    patterns.assertionsCount = patterns.assertions.length;

    // Store patterns
    this.patterns.set(repoPath, patterns);
    
    return patterns;
  }

  /**
   * Find test files in repository
   */
  async findTestFiles(repoPath, testDirectory, files = []) {
    const searchPath = testDirectory ? path.join(repoPath, testDirectory) : repoPath;
    
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(searchPath, entry.name);
        
        if (entry.isDirectory() && 
            !entry.name.startsWith('.') && 
            entry.name !== 'node_modules') {
          await this.findTestFiles(repoPath, path.relative(repoPath, fullPath), files);
        } else if (entry.isFile() && 
                  (entry.name.includes('.spec.') || 
                   entry.name.includes('.test.'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Error finding test files: ${error.message}`);
    }
    
    return files;
  }

  /**
   * Find Page Object files
   */
  async findPageObjects(repoPath, searchPath = repoPath, files = []) {
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(searchPath, entry.name);
        
        if (entry.isDirectory() && 
            !entry.name.startsWith('.') && 
            entry.name !== 'node_modules' &&
            entry.name !== 'dist') {
          await this.findPageObjects(repoPath, fullPath, files);
        } else if (entry.isFile() && 
                  (entry.name.toLowerCase().includes('page') ||
                   entry.name.toLowerCase().includes('component')) &&
                  entry.name.match(/\.(js|ts)$/)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Error finding page objects: ${error.message}`);
    }
    
    return files;
  }

  /**
   * Extract patterns from test content
   */
  extractTestPatterns(content, patterns) {
    // Extract imports
    const importMatches = content.match(/import .+ from ['"].+['"]/g) || [];
    const requireMatches = content.match(/const .+ = require\(['"].+['"]\)/g) || [];
    [...importMatches, ...requireMatches].forEach(imp => patterns.imports.add(imp));

    // Extract test structures
    const testMatches = content.match(/test\(['"`].*['"`]/g) || [];
    const describeMatches = content.match(/describe\(['"`].*['"`]/g) || [];
    patterns.testStructures.push(...testMatches, ...describeMatches);

    // Extract selectors
    const selectorPatterns = [
      /page\.locator\(['"`]([^'"`]+)['"`]\)/g,
      /page\.getBy\w+\(['"`]([^'"`]+)['"`]\)/g,
      /\$\(['"`]([^'"`]+)['"`]\)/g,
      /page\.click\(['"`]([^'"`]+)['"`]\)/g,
      /page\.fill\(['"`]([^'"`]+)['"`]\)/g
    ];

    selectorPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        patterns.selectors.push(match[1]);
      }
    });

    // Extract assertions
    const assertionPatterns = [
      /expect\([^)]+\)\.\w+/g,
      /assert\.\w+/g,
      /toHaveText/g,
      /toBeVisible/g,
      /toHaveURL/g
    ];

    assertionPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      patterns.assertions.push(...matches);
    });
  }

  /**
   * Extract Page Object pattern
   */
  extractPageObjectPattern(content) {
    const className = content.match(/class\s+(\w+)/)?.[1] || 'PageObject';
    const methods = [];
    const methodMatches = content.match(/async\s+(\w+)\s*\(/g) || [];
    
    methodMatches.forEach(match => {
      const methodName = match.match(/async\s+(\w+)/)?.[1];
      if (methodName && !methodName.startsWith('_')) {
        methods.push(methodName);
      }
    });

    return { className, methods };
  }

  /**
   * Extract Playwright config
   */
  extractPlaywrightConfig(content) {
    const config = {
      browsers: [],
      baseURL: null,
      timeout: null
    };

    // Extract browsers
    if (content.includes('chromium')) config.browsers.push('chromium');
    if (content.includes('firefox')) config.browsers.push('firefox');
    if (content.includes('webkit')) config.browsers.push('webkit');

    // Extract baseURL
    const baseURLMatch = content.match(/baseURL:\s*['"`]([^'"`]+)['"`]/);
    if (baseURLMatch) config.baseURL = baseURLMatch[1];

    // Extract timeout
    const timeoutMatch = content.match(/timeout:\s*(\d+)/);
    if (timeoutMatch) config.timeout = parseInt(timeoutMatch[1]);

    return config;
  }

  /**
   * Generate Playwright test based on manual test and learned patterns
   */
  async generatePlaywrightTest(manualTest, repoPath, testDirectory, options = {}) {
    const patterns = this.patterns.get(repoPath) || 
                    await this.learnPatterns(repoPath, testDirectory);

    const {
      framework = 'playwright',
      language = 'typescript',
      usePageObjects = false,
      browsers = ['chromium'],
      selfHealing = false
    } = options;

    const fileName = this.generateFileName(manualTest.title, language);
    const testName = this.generateTestName(manualTest.title);

    let testCode = '';

    // Generate imports
    testCode += this.generateImports(patterns, language, usePageObjects) + '\n\n';

    // Generate test structure
    if (usePageObjects) {
      testCode += this.generatePageObjectTest(manualTest, testName, patterns);
    } else {
      testCode += this.generateDirectTest(manualTest, testName, selfHealing);
    }

    // Add additional test scenarios if needed
    if (options.dataTypes && options.dataTypes.includes('boundary')) {
      testCode += '\n' + this.generateBoundaryTests(manualTest, testName);
    }

    if (options.dataTypes && options.dataTypes.includes('negative')) {
      testCode += '\n' + this.generateNegativeTests(manualTest, testName);
    }

    return {
      code: testCode,
      fileName,
      testName,
      framework: 'playwright',
      language
    };
  }

  /**
   * Generate imports based on patterns and options
   */
  generateImports(patterns, language, usePageObjects) {
    const imports = [];
    
    if (language === 'typescript') {
      imports.push("import { test, expect, Page } from '@playwright/test';");
    } else {
      imports.push("const { test, expect } = require('@playwright/test');");
    }

    // Add common imports from patterns
    const commonImports = patterns.imports
      .filter(imp => imp.includes('playwright') || imp.includes('test'))
      .slice(0, 3);
    
    imports.push(...commonImports);

    if (usePageObjects) {
      imports.push("// Import your page objects here");
      imports.push("// import { LoginPage } from '../pages/LoginPage';");
    }

    return imports.join('\n');
  }

  /**
   * Generate direct test (without Page Objects)
   */
  generateDirectTest(manualTest, testName, selfHealing) {
    let code = `test('${testName}', async ({ page }) => {\n`;
    
    // Add test description as comment
    if (manualTest.objective) {
      code += `  // Objective: ${manualTest.objective}\n\n`;
    }

    // Add preconditions
    if (manualTest.preconditions) {
      code += `  // Preconditions: ${manualTest.preconditions}\n`;
      code += `  // TODO: Setup preconditions\n\n`;
    }

    // Convert manual steps to Playwright commands
    for (const step of manualTest.steps || []) {
      code += `  // Step: ${step.action}\n`;
      code += this.convertStepToPlaywright(step, selfHealing) + '\n';
      
      if (step.expected) {
        code += `  // Verify: ${step.expected}\n`;
        code += this.generateAssertion(step.expected) + '\n';
      }
      code += '\n';
    }

    code += '});\n';
    return code;
  }

  /**
   * Generate test with Page Objects
   */
  generatePageObjectTest(manualTest, testName, patterns) {
    let code = `test('${testName}', async ({ page }) => {\n`;
    code += '  // Initialize page objects\n';
    code += '  // const loginPage = new LoginPage(page);\n\n';
    
    if (manualTest.objective) {
      code += `  // Objective: ${manualTest.objective}\n\n`;
    }

    // Generate page object style steps
    for (const step of manualTest.steps || []) {
      code += `  // ${step.action}\n`;
      code += `  // await pageObject.performAction();\n`;
      
      if (step.expected) {
        code += `  // await pageObject.verifyResult();\n`;
      }
      code += '\n';
    }

    code += '});\n';
    return code;
  }

  /**
   * Convert manual test step to Playwright code
   */
  convertStepToPlaywright(step, selfHealing = false) {
    const action = step.action.toLowerCase();
    let code = '';

    // Navigation actions
    if (action.includes('navigate') || action.includes('go to') || action.includes('open')) {
      code = "  await page.goto('https://example.com');";
    }
    // Click actions
    else if (action.includes('click')) {
      if (selfHealing) {
        code = `  // Self-healing selector\n`;
        code += `  await page.locator('[data-testid="button"]').or(page.locator('button:has-text("Submit")')).click();`;
      } else {
        code = `  await page.click('button');`;
      }
    }
    // Input actions
    else if (action.includes('enter') || action.includes('type') || action.includes('input')) {
      code = `  await page.fill('input[name="field"]', 'value');`;
    }
    // Select actions
    else if (action.includes('select') || action.includes('choose')) {
      code = `  await page.selectOption('select', 'option-value');`;
    }
    // Wait actions
    else if (action.includes('wait')) {
      code = `  await page.waitForTimeout(1000); // Consider using waitForSelector instead`;
    }
    // Hover actions
    else if (action.includes('hover') || action.includes('mouse over')) {
      code = `  await page.hover('element');`;
    }
    // Default
    else {
      code = `  // TODO: Implement - ${step.action}`;
    }

    return code;
  }

  /**
   * Generate assertion based on expected result
   */
  generateAssertion(expected) {
    const expectation = expected.toLowerCase();
    
    if (expectation.includes('visible') || expectation.includes('display')) {
      return `  await expect(page.locator('element')).toBeVisible();`;
    }
    if (expectation.includes('text') || expectation.includes('contain')) {
      return `  await expect(page.locator('element')).toHaveText('expected text');`;
    }
    if (expectation.includes('url') || expectation.includes('redirect')) {
      return `  await expect(page).toHaveURL(/.*expected-url.*/);`;
    }
    if (expectation.includes('disabled')) {
      return `  await expect(page.locator('button')).toBeDisabled();`;
    }
    if (expectation.includes('enabled')) {
      return `  await expect(page.locator('button')).toBeEnabled();`;
    }
    
    return `  // TODO: Add assertion for - ${expected}`;
  }

  /**
   * Generate boundary test cases
   */
  generateBoundaryTests(manualTest, testName) {
    let code = `\ntest('${testName} - Boundary Testing', async ({ page }) => {\n`;
    code += '  // Test minimum values\n';
    code += `  await page.fill('input', '0');\n`;
    code += `  await page.click('button[type="submit"]');\n`;
    code += `  await expect(page.locator('.error')).not.toBeVisible();\n\n`;
    
    code += '  // Test maximum values\n';
    code += `  await page.fill('input', '999999');\n`;
    code += `  await page.click('button[type="submit"]');\n`;
    code += `  await expect(page.locator('.error')).not.toBeVisible();\n`;
    code += '});\n';
    
    return code;
  }

  /**
   * Generate negative test cases
   */
  generateNegativeTests(manualTest, testName) {
    let code = `\ntest('${testName} - Negative Testing', async ({ page }) => {\n`;
    code += '  // Test with invalid input\n';
    code += `  await page.fill('input', 'invalid-data');\n`;
    code += `  await page.click('button[type="submit"]');\n`;
    code += `  await expect(page.locator('.error')).toBeVisible();\n\n`;
    
    code += '  // Test with empty input\n';
    code += `  await page.fill('input', '');\n`;
    code += `  await page.click('button[type="submit"]');\n`;
    code += `  await expect(page.locator('.error')).toBeVisible();\n`;
    code += '});\n';
    
    return code;
  }

  /**
   * Generate valid file name from title
   */
  generateFileName(title, language) {
    const baseName = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    
    const extension = language === 'typescript' ? '.spec.ts' : '.spec.js';
    return baseName + extension;
  }

  /**
   * Generate test name from title
   */
  generateTestName(title) {
    return title.replace(/['"]/g, '');
  }

  /**
   * Save generated test to repository
   */
  async saveTestToRepository(repoPath, testDirectory, generatedTest, options = {}) {
    const targetDir = testDirectory ? 
      path.join(repoPath, testDirectory) : 
      path.join(repoPath, 'tests');
    
    const filePath = path.join(targetDir, generatedTest.fileName);

    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(filePath);
      // File exists, create a numbered version
      const timestamp = Date.now();
      const newFileName = generatedTest.fileName.replace(/\.spec\.(js|ts)/, `_${timestamp}.spec.$1`);
      const newFilePath = path.join(targetDir, newFileName);
      await fs.writeFile(newFilePath, generatedTest.code);
      
      // Create git branch if requested
      if (options.createBranch && options.ticketId) {
        await this.createGitBranch(repoPath, options.ticketId);
      }
      
      return {
        success: true,
        path: newFilePath,
        message: `Test saved as ${newFileName} (original file already existed)`
      };
    } catch (error) {
      // File doesn't exist, save normally
      await fs.writeFile(filePath, generatedTest.code);
      
      // Create git branch if requested
      if (options.createBranch && options.ticketId) {
        const branch = await this.createGitBranch(repoPath, options.ticketId);
        return {
          success: true,
          path: filePath,
          message: `Test saved successfully to ${generatedTest.fileName}`,
          branch
        };
      }
      
      return {
        success: true,
        path: filePath,
        message: `Test saved successfully to ${generatedTest.fileName}`
      };
    }
  }

  /**
   * Create git branch for generated test
   */
  async createGitBranch(repoPath, ticketId) {
    try {
      const branchName = `qa-copilot/${ticketId.toLowerCase()}`;
      
      // Check if we're in a git repository
      await execAsync('git status', { cwd: repoPath });
      
      // Create and checkout new branch
      await execAsync(`git checkout -b ${branchName}`, { cwd: repoPath });
      
      logger.info(`Created git branch: ${branchName}`);
      return { success: true, branchName };
    } catch (error) {
      logger.warn(`Could not create git branch: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Open file in VS Code
   */
  async openInVSCode(filePath) {
    try {
      await execAsync(`code "${filePath}"`);
      logger.info(`Opened ${filePath} in VS Code`);
      return { success: true };
    } catch (error) {
      logger.warn(`Could not open in VS Code: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const playwrightService = new PlaywrightService();
export default playwrightService;