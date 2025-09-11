import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import propertiesParser from './propertiesParserService.js';
import { domAnalyzerService } from './domAnalyzerService.js';

const execAsync = promisify(exec);

export class JavaSeleniumService {
  constructor() {
    // Cache directory for indexed repositories
    this.cacheDir = path.join(process.env.HOME, '.qa-copilot', 'cache');
    this.reposDir = path.join(process.env.HOME, '.qa-copilot', 'repos');
    this.propertiesData = new Map();
    this.patterns = new Map(); // Store learned patterns per repository
  }

  /**
   * Validate if the provided path is a valid Java repository
   */
  async validateRepository(repoPath) {
    try {
      // Trim any whitespace from path
      repoPath = repoPath.trim();
      
      // Check if directory exists
      const stats = await fs.stat(repoPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }

      // Check for common Java project indicators
      const indicators = [
        'pom.xml',           // Maven
        'build.gradle',      // Gradle
        'build.gradle.kts',  // Gradle Kotlin
        'src/test/java',     // Standard test directory
        'src/main/java'      // Standard source directory
      ];

      for (const indicator of indicators) {
        try {
          await fs.access(path.join(repoPath, indicator));
          logger.info(`Found Java project indicator: ${indicator}`);
          return { 
            valid: true, 
            type: indicator.includes('pom') ? 'maven' : 
                  indicator.includes('gradle') ? 'gradle' : 'standard',
            path: repoPath
          };
        } catch (e) {
          // Continue checking other indicators
        }
      }

      // Even if no build file, check for Java files
      const hasJavaFiles = await this.hasJavaFiles(repoPath);
      if (hasJavaFiles) {
        return { valid: true, type: 'java', path: repoPath };
      }

      return { 
        valid: false, 
        error: 'No Java project indicators found (pom.xml, build.gradle, or Java files)' 
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  /**
   * Check if directory contains Java files
   */
  async hasJavaFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.java')) {
          return true;
        }
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subPath = path.join(dirPath, entry.name);
          if (await this.hasJavaFiles(subPath)) {
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
  async getDirectoryTree(repoPath, relativePath = '', maxDepth = 15, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const fullPath = path.join(repoPath, relativePath);
    const tree = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files, build directories, and common non-test directories
        if (entry.name.startsWith('.') || 
            entry.name === 'target' || 
            entry.name === 'build' ||
            entry.name === 'node_modules' ||
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
        } else if (entry.name.endsWith('.java')) {
          // Only include Java files
          const isTest = entry.name.includes('Test') || entry.name.includes('test');
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
        file.endsWith('.java') && (file.includes('Test') || file.includes('test'))
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Index repository for pattern learning
   */
  async indexRepository(repoPath, forceReindex = false) {
    const repoHash = this.getRepoHash(repoPath);
    const cacheFile = path.join(this.cacheDir, `${repoHash}.json`);

    if (!forceReindex) {
      try {
        // Check if cache exists and is recent (24 hours)
        const stats = await fs.stat(cacheFile);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageHours < 24) {
          logger.info('Using cached repository index');
          const cache = await fs.readFile(cacheFile, 'utf8');
          const cachedIndex = JSON.parse(cache);
          cachedIndex.usedCache = true;
          cachedIndex.cacheAge = Math.round(ageHours * 10) / 10; // Round to 1 decimal
          return cachedIndex;
        }
      } catch (error) {
        // Cache doesn't exist or is old
      }
    }

    logger.info('Indexing repository...');
    const index = {
      path: repoPath,
      timestamp: new Date().toISOString(),
      testFiles: [],
      pageObjects: [],
      utilities: [],
      dependencies: {}
    };

    // Find all Java files
    await this.scanDirectory(repoPath, repoPath, index);

    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });
    
    // Save to cache
    await fs.writeFile(cacheFile, JSON.stringify(index, null, 2));
    
    logger.info(`Indexed ${index.testFiles.length} test files, ${index.pageObjects.length} page objects`);
    return index;
  }

  /**
   * Recursively scan directory for Java files
   */
  async scanDirectory(baseDir, currentDir, index) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || 
            entry.name === 'target' || 
            entry.name === 'build') {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          await this.scanDirectory(baseDir, fullPath, index);
        } else if (entry.name.endsWith('.java')) {
          const content = await fs.readFile(fullPath, 'utf8');
          const fileInfo = {
            path: relativePath,
            name: entry.name,
            className: this.extractClassName(content),
            imports: this.extractImports(content),
            methods: this.extractMethods(content)
          };

          // Categorize file
          if (entry.name.includes('Test') || relativePath.includes('test')) {
            index.testFiles.push(fileInfo);
          } else if (entry.name.includes('Page') || entry.name.includes('Screen') || content.includes('@FindBy')) {
            // Extract public methods from Page Objects/Screens for better pattern learning
            fileInfo.publicMethods = this.extractPublicMethods(content);
            index.pageObjects.push(fileInfo);
          } else if (relativePath.includes('util') || relativePath.includes('helper')) {
            index.utilities.push(fileInfo);
          }
        }
      }
    } catch (error) {
      logger.error(`Error scanning directory ${currentDir}: ${error.message}`);
    }
  }

  /**
   * Generate Selenium test with properties and DOM enhancements
   */
  async generateSeleniumTestWithEnhancements(manualTest, repoPath, testDirectory, propertiesData, domElements) {
    // Use the existing generation as base
    const baseTest = await this.generateSeleniumTest(manualTest, repoPath, testDirectory);
    
    // If we have DOM elements, enhance the test with real locators
    if (domElements && domElements.length > 0) {
      logger.info('Enhancing test with DOM element locators');
      
      // Map test steps to DOM elements
      const enhancedSteps = manualTest.steps.map(step => {
        const elementInStep = this.findElementInStep(step, domElements);
        if (elementInStep) {
          // Generate robust locator for this element
          const locatorData = propertiesParser.generateNewElementLocator(
            elementInStep.type,
            elementInStep.text || elementInStep.label,
            elementInStep
          );
          
          // Add the locator method to test
          const locatorMethod = propertiesParser.generateCodeForNewElement(
            elementInStep.type,
            elementInStep.text || elementInStep.label,
            elementInStep
          );
          
          return {
            ...step,
            enhancedLocator: locatorData,
            locatorMethod
          };
        }
        return step;
      });
      
      // Inject enhanced locator methods into test code
      let enhancedCode = baseTest.code;
      
      // Add locator methods before the closing brace
      const locatorMethods = enhancedSteps
        .filter(s => s.locatorMethod)
        .map(s => s.locatorMethod)
        .join('\n');
      
      if (locatorMethods) {
        // Insert before the navigation helper methods
        enhancedCode = enhancedCode.replace(
          '    // --- Navigation Helper Methods ---',
          `    // --- Enhanced Element Locator Methods ---\n${locatorMethods}\n\n    // --- Navigation Helper Methods ---`
        );
      }
      
      baseTest.code = enhancedCode;
    }
    
    return baseTest;
  }

  /**
   * Find DOM element that matches a test step
   */
  findElementInStep(step, domElements) {
    const stepText = (step.action + ' ' + step.expectedResult).toLowerCase();
    
    // Look for element mentions in the step
    for (const element of domElements) {
      const elementText = (element.text || element.label || '').toLowerCase();
      if (elementText && stepText.includes(elementText)) {
        return element;
      }
      
      // Check if step mentions element type
      if (stepText.includes('button') && element.type === 'button') {
        if (stepText.includes('restart') && elementText.includes('restart')) {
          return element;
        }
        if (stepText.includes('play') && elementText.includes('play')) {
          return element;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract class name from Java file content
   */
  extractClassName(content) {
    const match = content.match(/(?:public\s+)?class\s+(\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract imports from Java file content
   */
  extractImports(content) {
    const imports = [];
    const regex = /import\s+([\w.]+);/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Extract test methods from Java file content
   */
  extractMethods(content) {
    const methods = [];
    // Match @Test annotated methods
    const regex = /@Test[\s\S]*?public\s+void\s+(\w+)\s*\(/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      methods.push(match[1]);
    }
    
    return methods;
  }

  /**
   * Extract public methods from Page Object/Screen files
   */
  extractPublicMethods(content) {
    const methods = [];
    // Match public methods (excluding constructors)
    // Pattern: public [returnType] methodName(params)
    const regex = /public\s+(?!class|interface|enum)(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const methodName = match[1];
      // Skip constructors and common Object methods
      if (!methodName.match(/^(equals|hashCode|toString|clone|finalize|getClass|notify|notifyAll|wait)$/)) {
        // Extract the full method signature for better context
        const fullMatch = match[0];
        methods.push({
          name: methodName,
          signature: fullMatch
        });
      }
    }
    
    return methods;
  }

  /**
   * Learn patterns from test files in a directory
   */
  async learnPatterns(repoPath, testDirectory, forceReindex = false) {
    // Trim any whitespace from paths
    repoPath = repoPath.trim();
    testDirectory = testDirectory ? testDirectory.trim() : '';
    
    const index = await this.indexRepository(repoPath, forceReindex);
    const patterns = {
      imports: new Set(),
      annotations: new Set(),
      assertions: [],
      pageObjectUsage: [],
      setupTeardown: [],
      commonPatterns: [],
      metadata: {
        usedCache: index.usedCache || false,
        indexedFiles: index.testFiles?.length || 0,
        timestamp: index.timestamp
      }
    };

    // Filter test files from the selected directory
    // Normalize paths for comparison
    const normalizedTestDir = testDirectory.replace(repoPath, '').replace(/^\/+/, '').trim();
    logger.info(`Filtering tests in directory: "${normalizedTestDir}" from ${index.testFiles.length} total test files`);
    
    const relevantTests = index.testFiles.filter(file => {
      // Handle both relative and absolute paths
      const filePath = file.path.replace(/^\/+/, '');
      const matches = !normalizedTestDir || 
                     filePath.startsWith(normalizedTestDir) || 
                     file.path.includes(normalizedTestDir);
      if (matches) {
        logger.debug(`Matched test file: ${file.path}`);
      }
      return matches;
    });
    
    logger.info(`Found ${relevantTests.length} relevant test files in selected directory`);

    for (const testFile of relevantTests) {
      const content = await fs.readFile(path.join(repoPath, testFile.path), 'utf8');
      
      // Extract patterns
      this.extractTestPatterns(content, patterns);
    }

    // Convert Sets to Arrays for JSON serialization
    patterns.imports = Array.from(patterns.imports);
    patterns.annotations = Array.from(patterns.annotations);

    // Store patterns for this repository
    this.patterns.set(repoPath, patterns);
    
    return patterns;
  }

  /**
   * Extract common patterns from test content
   */
  extractTestPatterns(content, patterns) {
    // Common imports - fix regex to capture full import statement
    const imports = content.match(/import\s+[\w.]+(?:\.\*)?;/g) || [];
    imports.forEach(imp => patterns.imports.add(imp));

    // Annotations - capture full annotations including parameters
    const annotations = content.match(/@\w+(?:\([^)]*\))?/g) || [];
    annotations.forEach(ann => patterns.annotations.add(ann));

    // Assertion patterns - look for various assertion types
    const assertionPatterns = [
      /assert\w+\([^;]+\);/g,  // JUnit assertions
      /\w+\.should\([^)]+\)/g,  // BDD style
      /expect\([^)]+\)/g        // Expect style
    ];
    
    assertionPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      patterns.assertions.push(...matches);
    });

    // WebDriver patterns
    const driverPatterns = content.match(/(?:driver|webDriver|browser)\.\w+\([^)]*\)/g) || [];
    patterns.pageObjectUsage.push(...driverPatterns);

    // IMPROVED: Navigation patterns - look for common navigation methods
    if (!patterns.navigationMethods) patterns.navigationMethods = [];
    const navigationPatterns = [
      /(?:navigateTo|goTo|openPage|visitPage|open)\w*\([^)]*\)/g,  // Common navigation method names
      /\.get\("[^"]+"\)/g,  // driver.get() calls
      /\.navigate\(\)\.to\([^)]+\)/g,  // driver.navigate().to() calls
      /new\s+\w+Page\([^)]*\)/g,  // Page object instantiation
      /\w+Page\s*\.\s*\w+\(\)/g  // Page object method calls
    ];
    
    navigationPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      if (matches.length > 0) {
        patterns.navigationMethods.push(...matches);
      }
    });

    // IMPROVED: Page Object patterns - look for page object usage
    if (!patterns.pageObjects) patterns.pageObjects = [];
    const pageObjectPatterns = [
      /(?:private|public|protected)?\s*(?:final)?\s*\w+Page\s+\w+/g,  // Page object declarations
      /@FindBy\([^)]+\)/g,  // FindBy annotations
      /PageFactory\.initElements/g,  // PageFactory usage
      /\w+Page\s*=\s*new\s+\w+Page/g  // Page object instantiation
    ];
    
    pageObjectPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      if (matches.length > 0) {
        patterns.pageObjects.push(...matches);
      }
    });

    // Setup/Teardown patterns - look for various annotations
    const setupAnnotations = ['@Before', '@BeforeEach', '@BeforeAll', '@BeforeClass'];
    setupAnnotations.forEach(annotation => {
      if (content.includes(annotation)) {
        const setupMatch = content.match(new RegExp(`${annotation}[\\s\\S]*?public\\s+void\\s+\\w+\\s*\\([^)]*\\)\\s*{[^}]+}`, 'm'));
        if (setupMatch) patterns.setupTeardown.push(setupMatch[0]);
      }
    });
  }

  /**
   * Learn from properties files
   */
  async learnFromProperties(propertiesPath, primaryPage = null) {
    try {
      logger.info(`Learning from properties in: ${propertiesPath}`);
      const propertiesData = await propertiesParser.parsePropertiesDirectory(propertiesPath, primaryPage);
      
      // Store properties data for later use
      this.propertiesData.set(propertiesPath, propertiesData);
      
      logger.info(`Learned ${Object.keys(propertiesData.pages).length} page objects with ${propertiesData.navigationMethods.length} navigation patterns`);
      
      return propertiesData;
    } catch (error) {
      logger.error('Error learning from properties:', error);
      return null;
    }
  }

  /**
   * Generate enhanced Selenium test with DOM analysis and properties
   */
  async generateEnhancedSeleniumTest(manualTest, options = {}) {
    const {
      repoPath = '',
      testDirectory = '',
      propertiesPath = null,
      url = null,
      primaryPage = null
    } = options;

    logger.info('Generating enhanced Selenium test with DOM and properties integration');
    
    // Step 1: Learn from properties if provided
    let propertiesData = null;
    if (propertiesPath) {
      logger.info(`Learning from properties at: ${propertiesPath}`);
      propertiesData = await this.learnFromProperties(propertiesPath, primaryPage);
      
      if (propertiesData) {
        // Learn locator patterns for generating new elements
        propertiesParser.learnLocatorPatterns(propertiesData);
      }
    }
    
    // Step 2: Analyze DOM if URL provided
    let domElements = null;
    if (url) {
      logger.info(`Analyzing DOM at URL: ${url}`);
      try {
        await domAnalyzerService.initialize();
        const domData = await domAnalyzerService.analyzePage(url);
        domElements = domData.elements;
        logger.info(`Found ${domElements.length} elements in DOM`);
        
        // Extract unique elements that might be new (not in properties)
        if (propertiesData) {
          const existingElements = new Set();
          Object.values(propertiesData.pages).forEach(page => {
            Object.keys(page).forEach(key => existingElements.add(key.toLowerCase()));
          });
          
          // Filter to new elements
          const newElements = domElements.filter(el => {
            const elementKey = propertiesParser.generateElementKey(el.type, el.text || el.label || '');
            return !existingElements.has(elementKey.toLowerCase());
          });
          
          logger.info(`Found ${newElements.length} new elements not in properties`);
        }
      } catch (error) {
        logger.error('DOM analysis failed:', error);
      } finally {
        await domAnalyzerService.cleanup();
      }
    }
    
    // Step 3: Generate test with enhanced element locators
    return this.generateSeleniumTestWithEnhancements(
      manualTest,
      repoPath,
      testDirectory,
      propertiesData,
      domElements
    );
  }

  /**
   * Generate Selenium test based on manual test and learned patterns
   */
  async generateSeleniumTest(manualTest, repoPath, testDirectory, propertiesPath = null) {
    // Trim any whitespace from paths
    repoPath = repoPath ? repoPath.trim() : '';
    testDirectory = testDirectory ? testDirectory.trim() : '';
    
    const patterns = this.patterns.get(repoPath) || 
                    await this.learnPatterns(repoPath, testDirectory);

    const className = this.generateClassName(manualTest.title);
    const packageName = this.extractPackageFromPath(testDirectory);

    // Build test class
    let testCode = '';

    // Package declaration - use framework package structure
    const frameworkPackage = packageName || 'com.viacom.unified.tests.container';
    testCode += `package ${frameworkPackage};\n\n`;

    // Imports - use comprehensive framework imports like the example
    testCode += this.getComprehensiveFrameworkImports().join('\n') + '\n\n';

    // Class declaration - extend BaseTest
    testCode += `public class ${className} extends BaseTest {\n\n`;
    
    // Add member variables like the example
    testCode += '    private final TestParams testParams;\n';
    testCode += '    private SoftAssert softAssert;\n\n';
    
    // Factory method with correct signature
    testCode += '    @Factory(dataProvider = "defaultDataProvider", dataProviderClass = BaseTest.class)\n';
    testCode += `    public static Object[] createTest(TestParams testParams) {\n`;
    testCode += `        return new Object[]{new ${className}(testParams)};\n`;
    testCode += '    }\n\n';
    
    // Constructor
    testCode += `    public ${className}(TestParams testParams) {\n`;
    testCode += '        this.testParams = testParams;\n';
    testCode += '    }\n\n';
    
    // BeforeMethod setup with navigation from preconditions
    testCode += '    @BeforeMethod(alwaysRun = true)\n';
    testCode += '    public void beforeMethod() {\n';
    testCode += '        super.setup();\n';
    testCode += '        softAssert = new SoftAssert();\n';
    testCode += '        Logger.logMessage("Starting test with parameters: Tier=" + testParams.getTier());\n';
    testCode += '        \n';
    testCode += '        // Preconditions from test case:\n';
    if (manualTest.preconditions) {
      // Add preconditions as comments for clarity
      const preconditionLines = manualTest.preconditions.split('\n');
      preconditionLines.forEach(line => {
        if (line.trim()) {
          testCode += `        // ${line.trim()}\n`;
        }
      });
      testCode += '        \n';
    }
    testCode += this.generateNavigationFromPreconditions(manualTest);
    testCode += '    }\n\n';
    
    // Add AfterMethod
    testCode += '    @AfterMethod(alwaysRun = true)\n';
    testCode += '    public void afterMethod() {\n';
    testCode += '        super.teardown();\n';
    testCode += '        Logger.logMessage("Test cleanup completed");\n';
    testCode += '    }\n\n';

    // Test method with proper annotations matching the example
    testCode += '    @Test(groups = {"happy-path", "container", "playback-controls"})\n';
    testCode += `    @Description("${manualTest.objective || manualTest.title}")\n`;
    testCode += '    @Platforms({Platform.WEB, Platform.MOBILE_WEB})\n';
    testCode += '    @AppBrand({AppBrandType.PARAMOUNT_PLUS})\n';
    testCode += '    @Locales({Locale.US})\n';
    testCode += `    public void ${this.generateMethodName(manualTest.title)}() {\n`;
    testCode += '        \n';
    testCode += `        Logger.logMessage("Starting test: ${manualTest.title}");\n`;
    testCode += '        \n';

    // Convert manual steps to framework-specific code
    for (const step of manualTest.steps) {
      testCode += `        // Step: ${step.action}\n`;
      testCode += this.convertStepToFrameworkCode(step) + '\n';
      testCode += `        // Expected: ${step.expectedResult || step.expected || 'Verify action completes successfully'}\n\n`;
    }

    testCode += '        \n';
    testCode += '        Logger.logMessage("Test execution finished. Asserting all soft assertions.");\n';
    testCode += '        softAssert.assertAll();\n';
    testCode += '    }\n';
    testCode += '    \n';
    testCode += '    // --- Element Locator Helper Methods ---\n';
    testCode += '    \n';
    
    // Add smart locator methods for common elements
    testCode += this.generateSmartLocatorMethod('resumeButton', 'Resume');
    testCode += this.generateSmartLocatorMethod('restartButton', 'Restart');
    testCode += this.generateSmartLocatorMethod('loadingSpinner', 'Loading');
    
    // Add the generic fallback finder method
    testCode += '    /**\n';
    testCode += '     * Finds an element using a prioritized list of locators, providing a fallback mechanism.\n';
    testCode += '     * @param elementName A human-readable name for the element for logging purposes.\n';
    testCode += '     * @param locators    A list of By objects representing the location strategies in order of priority.\n';
    testCode += '     * @return The located WebElement.\n';
    testCode += '     * @throws NoSuchElementException if the element cannot be found using any of the provided locators.\n';
    testCode += '     */\n';
    testCode += '    private WebElement findElementWithFallbacks(String elementName, List<By> locators) {\n';
    testCode += '        for (By locator : locators) {\n';
    testCode += '            try {\n';
    testCode += '                WebElement element = driver.findElement(locator);\n';
    testCode += '                if (element.isDisplayed()) {\n';
    testCode += '                    Logger.logMessage("Found element \'" + elementName + "\' using: " + locator);\n';
    testCode += '                    return element;\n';
    testCode += '                }\n';
    testCode += '            } catch (NoSuchElementException e) {\n';
    testCode += '                // Suppress exception and try the next locator\n';
    testCode += '            }\n';
    testCode += '        }\n';
    testCode += '        Logger.logError("Could not find element \'" + elementName + "\' with any of the provided locators.");\n';
    testCode += '        throw new NoSuchElementException("Could not find element: " + elementName);\n';
    testCode += '    }\n\n';
    
    // Add navigation helper methods
    testCode += '    // --- Navigation Helper Methods ---\n\n';
    testCode += '    /**\n';
    testCode += '     * Navigate to the specific content/property details page\n';
    testCode += '     * @param contentTitle The title of the content to navigate to\n';
    testCode += '     */\n';
    testCode += '    private void navigateToPropertyDetailsPage(String contentTitle) {\n';
    testCode += '        Logger.logMessage("Navigating to property details page for: " + contentTitle);\n';
    testCode += '        // Use the home screen to search for content\n';
    testCode += '        homeScreen().searchForContent(contentTitle);\n';
    testCode += '        searchResultsScreen().selectFirstResult();\n';
    testCode += '        // Wait for property details page to load\n';
    testCode += '        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));\n';
    testCode += '        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid=\'property-details-container\']")));\n';
    testCode += '    }\n\n';
    
    testCode += '    /**\n';
    testCode += '     * Navigate to a specific episode of a series\n';
    testCode += '     * @param seriesTitle The title of the series\n';
    testCode += '     * @param seasonNumber The season number\n';
    testCode += '     * @param episodeNumber The episode number\n';
    testCode += '     */\n';
    testCode += '    private void navigateToEpisode(String seriesTitle, int seasonNumber, int episodeNumber) {\n';
    testCode += '        Logger.logMessage(String.format("Navigating to %s - S%02dE%02d", seriesTitle, seasonNumber, episodeNumber));\n';
    testCode += '        navigateToPropertyDetailsPage(seriesTitle);\n';
    testCode += '        // Select season if needed\n';
    testCode += '        if (seasonNumber > 1) {\n';
    testCode += '            propertyDetailsScreen().selectSeason(seasonNumber);\n';
    testCode += '        }\n';
    testCode += '        // Select episode\n';
    testCode += '        propertyDetailsScreen().selectEpisode(episodeNumber);\n';
    testCode += '    }\n\n';
    
    testCode += '    /**\n';
    testCode += '     * Helper method to get login screen page object\n';
    testCode += '     */\n';
    testCode += '    private LoginScreen loginScreen() {\n';
    testCode += '        return new LoginScreen(driver);\n';
    testCode += '    }\n\n';
    
    testCode += '    /**\n';
    testCode += '     * Helper method to get home screen page object\n';
    testCode += '     */\n';
    testCode += '    private HomeScreen homeScreen() {\n';
    testCode += '        return new HomeScreen(driver);\n';
    testCode += '    }\n\n';
    
    testCode += '    /**\n';
    testCode += '     * Helper method to get search results screen page object\n';
    testCode += '     */\n';
    testCode += '    private SearchResultsScreen searchResultsScreen() {\n';
    testCode += '        return new SearchResultsScreen(driver);\n';
    testCode += '    }\n\n';
    
    testCode += '    /**\n';
    testCode += '     * Helper method to get property details screen page object\n';
    testCode += '     */\n';
    testCode += '    private PropertyDetailsScreen propertyDetailsScreen() {\n';
    testCode += '        return new PropertyDetailsScreen(driver);\n';
    testCode += '    }\n';

    testCode += '}\n';

    return {
      code: testCode,
      className,
      packageName,
      fileName: `${className}.java`
    };
  }

  /**
   * Generate navigation code from preconditions
   */
  generateNavigationFromPreconditions(manualTest) {
    let navigationCode = '';
    
    // Always start with navigating to the application URL
    navigationCode += '        // Navigate to the application\n';
    navigationCode += '        driver.get(testParams.getApplicationUrl());\n';
    navigationCode += '        \n';
    
    if (!manualTest.preconditions) {
      navigationCode += '        // No specific preconditions - starting from home page\n';
      navigationCode += '        Logger.logMessage("Starting test from home page");\n';
      navigationCode += '        homeScreen().waitForPageLoad();\n';
      return navigationCode;
    }
    
    const preconditions = manualTest.preconditions.toLowerCase();
    
    // Handle login preconditions
    if (preconditions.includes('logged in') || preconditions.includes('user is')) {
      navigationCode += '        // Ensure user is logged in with appropriate tier\n';
      navigationCode += '        if (!loginScreen().isUserLoggedIn()) {\n';
      navigationCode += '            loginScreen().loginWithTier(testParams.getTier());\n';
      navigationCode += '        }\n';
      navigationCode += '        Logger.logMessage("User authenticated with tier: " + testParams.getTier());\n';
      navigationCode += '        \n';
    }
    
    // Extract content/episode information from preconditions
    if (preconditions.includes('property details') || preconditions.includes('details page')) {
      // Try to extract series/movie name
      const contentMatch = preconditions.match(/(?:for|of|page for)\s+['"]?([^'"]+?)['"]?(?:\s*-|$|\.|,)/);
      
      if (contentMatch) {
        const contentTitle = contentMatch[1].trim();
        // Check if it's an episode
        const episodeMatch = contentTitle.match(/(.+?)\s*-\s*S(\d+)E(\d+)/);
        
        if (episodeMatch) {
          const seriesTitle = episodeMatch[1].trim();
          const season = parseInt(episodeMatch[2]);
          const episode = parseInt(episodeMatch[3]);
          
          navigationCode += '        // Navigate to specific episode\n';
          navigationCode += `        Logger.logMessage("Navigating to: ${seriesTitle} - Season ${season}, Episode ${episode}");\n`;
          navigationCode += '        homeScreen().searchForContent("' + seriesTitle + '");\n';
          navigationCode += '        searchResultsScreen().selectFirstResult();\n';
          navigationCode += `        propertyDetailsScreen().selectSeason(${season});\n`;
          navigationCode += `        propertyDetailsScreen().selectEpisode(${episode});\n`;
        } else {
          // Regular content navigation
          navigationCode += '        // Navigate to content property details\n';
          navigationCode += `        Logger.logMessage("Navigating to Property Details page for: ${contentTitle}");\n`;
          navigationCode += '        homeScreen().searchForContent("' + contentTitle + '");\n';
          navigationCode += '        searchResultsScreen().selectFirstResult();\n';
        }
      } else {
        // Generic navigation when no specific content is mentioned
        navigationCode += '        // Navigate to property details page using test data\n';
        navigationCode += '        String contentTitle = testParams.getContentTitle();\n';
        navigationCode += '        Logger.logMessage("Navigating to Property Details page for: " + contentTitle);\n';
        navigationCode += '        homeScreen().searchForContent(contentTitle);\n';
        navigationCode += '        searchResultsScreen().selectFirstResult();\n';
      }
      
      // Wait for page to load
      navigationCode += '        \n';
      navigationCode += '        // Verify navigation completed successfully\n';
      navigationCode += '        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));\n';
      navigationCode += '        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid=\'property-details-container\']")));\n';
      navigationCode += '        Logger.logMessage("Property details page loaded successfully");\n';
    } else if (preconditions.includes('home')) {
      navigationCode += '        // Ensure we are on home screen\n';
      navigationCode += '        homeScreen().waitForPageLoad();\n';
      navigationCode += '        Logger.logMessage("Home screen loaded successfully");\n';
    }
    
    // Handle watched/progress content preconditions
    if (preconditions.includes('resume point') || preconditions.includes('watched')) {
      navigationCode += '        \n';
      navigationCode += '        // Precondition: Content should have existing watch progress\n';
      navigationCode += '        // This is typically set up via API or by playing content briefly in a setup method\n';
      navigationCode += '        Logger.logMessage("Test assumes content has existing watch progress/resume point");\n';
    }
    
    return navigationCode;
  }

  /**
   * Convert manual test step to Selenium code
   */
  convertStepToSelenium(step) {
    const action = step.action.toLowerCase();
    let code = '';
    
    // Navigation actions
    if (action.includes('navigate') || action.includes('go to') || action.includes('open')) {
      // Extract URL or page name from the action
      const urlMatch = action.match(/['"]([^'"]+)['"]/);
      const pageMatch = action.match(/(?:page for|page of)\s+['"]?(.+?)['"]?(?:\.|$)/i);
      
      if (urlMatch && urlMatch[1].startsWith('http')) {
        code = `        driver.get("${urlMatch[1]}");`;
      } else if (pageMatch) {
        // Convert page description to a URL path
        const pageName = pageMatch[1].toLowerCase().replace(/\s+/g, '-');
        code = `        driver.get(BASE_URL + "/property-details/${pageName}");`;
      } else {
        code = `        driver.get(BASE_URL + "/property-details");`;
      }
    }
    // Keyboard actions (check this BEFORE click actions)
    else if (action.includes('arrow') || action.includes('key')) {
      // Check for multiple key presses (e.g., "twice", "two times", "2 times")
      const timesMatch = action.match(/(?:twice|(\d+)\s*times?|two\s*times?)/i);
      let times = 1;
      if (timesMatch) {
        if (action.includes('twice') || action.includes('two')) {
          times = 2;
        } else if (timesMatch[1]) {
          times = parseInt(timesMatch[1]);
        }
      }
      
      if (action.includes('right arrow')) {
        for (let i = 0; i < times; i++) {
          if (i > 0) code += '\n';
          code += `        driver.findElement(By.cssSelector(":focus")).sendKeys(Keys.ARROW_RIGHT);`;
        }
      } else if (action.includes('left arrow')) {
        for (let i = 0; i < times; i++) {
          if (i > 0) code += '\n';
          code += `        driver.findElement(By.cssSelector(":focus")).sendKeys(Keys.ARROW_LEFT);`;
        }
      } else if (action.includes('enter')) {
        code = `        driver.findElement(By.cssSelector(":focus")).sendKeys(Keys.ENTER);`;
      } else if (action.includes('tab')) {
        for (let i = 0; i < times; i++) {
          if (i > 0) code += '\n';
          code += `        driver.findElement(By.cssSelector(":focus")).sendKeys(Keys.TAB);`;
        }
      } else {
        code = `        // Keyboard action: ${step.action}\n`;
        code += `        driver.findElement(By.cssSelector(":focus")).sendKeys(Keys.ARROW_RIGHT);`;
      }
    }
    // Click actions (but not if it's about pressing keys)
    else if (!action.includes('press the') && !action.includes('press arrow') && 
             (action.includes('click') || action.includes('press') || action.includes('tap') || action.includes('select'))) {
      const element = this.extractElementName(action);
      // Handle OK/Select button on remote
      if (action.includes('ok') || action.includes('select') && action.includes('remote')) {
        code = `        driver.findElement(By.cssSelector(":focus")).sendKeys(Keys.ENTER);`;
      } else if (action.includes('button')) {
        code = `        driver.findElement(By.xpath("//button[contains(text(), '${element}')]")).click();`;
      } else if (action.includes('link')) {
        code = `        driver.findElement(By.linkText("${element}")).click();`;
      } else {
        code = `        driver.findElement(By.cssSelector("[data-testid='${element}']")).click();`;
      }
    }
    // Input/Type actions
    else if (action.includes('type') || action.includes('input') || (action.includes('enter') && action.includes('text'))) {
      const textMatch = action.match(/['"]([^'"]+)['"]/);
      const text = textMatch ? textMatch[1] : 'test input';
      const element = this.extractElementName(action);
      code = `        driver.findElement(By.name("${element}")).sendKeys("${text}");`;
    }
    // Focus actions
    else if (action.includes('focus') || (action.includes('ensure') && action.includes('button'))) {
      const element = this.extractElementName(action);
      if (action.includes('initial focus')) {
        code = `        // Check initial focus\n`;
        code += `        WebElement resumeButton = driver.findElement(By.xpath("//button[contains(text(), 'Resume')]"));\n`;
        code += `        WebElement activeElement = driver.switchTo().activeElement();\n`;
        code += `        assertEquals(resumeButton, activeElement, "Initial focus should be on Resume button");`;
      } else {
        code = `        WebElement focusElement = driver.findElement(By.xpath("//button[contains(text(), '${element}')]"));\n`;
        code += `        ((JavascriptExecutor) driver).executeScript("arguments[0].focus();", focusElement);`;
      }
    }
    // Verification/Assert actions
    else if (action.includes('verify') || action.includes('check') || action.includes('ensure') || action.includes('confirm')) {
      if (action.includes('visible') || action.includes('display')) {
        const element = this.extractElementName(action);
        code = `        assertTrue(driver.findElement(By.xpath("//*[contains(text(), '${element}')]")).isDisplayed());`;
      } else if (action.includes('highlight') || action.includes('focused')) {
        code = `        WebElement focusedElement = driver.switchTo().activeElement();\n`;
        code += `        assertTrue(focusedElement.getAttribute("class").contains("highlighted") || focusedElement.equals(driver.switchTo().activeElement()));`;
      } else {
        code = `        // Verify: ${step.action}\n`;
        code += `        assertTrue(driver.findElement(By.cssSelector("[data-testid='element']")).isDisplayed());`;
      }
    }
    // Wait actions
    else if (action.includes('wait') || action.includes('pause')) {
      const seconds = action.match(/\d+/) ? parseInt(action.match(/\d+/)[0]) : 2;
      code = `        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(${seconds}));\n`;
      code += `        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("body")));`;
    }
    // Screen reader / Accessibility actions
    else if (action.includes('screen reader') || action.includes('announce') || action.includes('listen')) {
      code = `        // Accessibility check: ${step.action}\n`;
      code += `        WebElement focusedElement = driver.switchTo().activeElement();\n`;
      code += `        \n`;
      code += `        // Get accessibility attributes\n`;
      code += `        String ariaLabel = focusedElement.getAttribute("aria-label");\n`;
      code += `        String ariaDescribedBy = focusedElement.getAttribute("aria-describedby");\n`;
      code += `        String role = focusedElement.getAttribute("role");\n`;
      code += `        String ariaPosition = focusedElement.getAttribute("aria-posinset");\n`;
      code += `        String ariaSetSize = focusedElement.getAttribute("aria-setsize");\n`;
      code += `        String elementText = focusedElement.getText();\n`;
      code += `        \n`;
      code += `        // Verify accessibility attributes are present\n`;
      code += `        assertNotNull(role, "Element should have a role attribute for screen readers");\n`;
      code += `        assertTrue(ariaLabel != null || elementText != null, "Element should have readable text for screen readers");\n`;
      code += `        \n`;
      code += `        // Log what a screen reader would announce (for manual verification)\n`;
      code += `        String screenReaderText = String.format("%s, %s", \n`;
      code += `            ariaLabel != null ? ariaLabel : elementText,\n`;
      code += `            role);\n`;
      code += `        if (ariaPosition != null && ariaSetSize != null) {\n`;
      code += `            screenReaderText += String.format(", %s of %s", ariaPosition, ariaSetSize);\n`;
      code += `        }\n`;
      code += `        System.out.println("Screen reader would announce: " + screenReaderText);\n`;
      code += `        \n`;
      code += `        // Note: For actual screen reader testing, consider using:\n`;
      code += `        // - Accessibility testing tools like axe-selenium or pa11y\n`;
      code += `        // - Manual testing with JAWS, NVDA, or VoiceOver\n`;
      code += `        // - Browser DevTools accessibility inspector`;
    }
    // Hover actions
    else if (action.includes('hover') || action.includes('mouse over')) {
      const element = this.extractElementName(action);
      code = `        Actions actions = new Actions(driver);\n`;
      code += `        WebElement element = driver.findElement(By.xpath("//*[contains(text(), '${element}')]"));\n`;
      code += `        actions.moveToElement(element).perform();`;
    }
    // Scroll actions
    else if (action.includes('scroll')) {
      if (action.includes('down')) {
        code = `        ((JavascriptExecutor) driver).executeScript("window.scrollBy(0, 500);");`;
      } else if (action.includes('up')) {
        code = `        ((JavascriptExecutor) driver).executeScript("window.scrollBy(0, -500);");`;
      } else {
        code = `        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView(true);", driver.findElement(By.cssSelector("element")));`;
      }
    }
    // Observe/Look actions
    else if (action.includes('observe') || action.includes('look') || action.includes('notice')) {
      code = `        // ${step.action}\n`;
      // Generate verification based on expected result
      if (step.expected) {
        const expected = step.expected.toLowerCase();
        if (expected.includes('button') && expected.includes('visible')) {
          const buttonMatch = step.expected.match(/['"]([^'"]+)['"]/);
          const buttonText = buttonMatch ? buttonMatch[1] : 'Button';
          code += `        assertTrue(driver.findElement(By.xpath("//button[contains(text(), '${buttonText}')]")).isDisplayed(), "${buttonText} button should be visible");`;
        } else if (expected.includes('visible')) {
          code += `        assertTrue(driver.findElement(By.cssSelector(".button-row")).isDisplayed(), "Button row should be visible");`;
        }
      }
    }
    // Default case - generate reasonable code instead of TODO
    else {
      // Try to generate something useful based on the step description
      code = `        // ${step.action}\n`;
      if (step.expected && step.expected.toLowerCase().includes('visible')) {
        code += `        assertTrue(driver.findElement(By.cssSelector("body")).isDisplayed());`;
      } else {
        code += `        // Manual verification needed: ${step.action}`;
      }
    }
    
    return code;
  }
  
  /**
   * Extract element name from action text
   */
  extractElementName(action) {
    // Try to extract text between quotes
    const quotedMatch = action.match(/['"]([^'"]+)['"]/);
    if (quotedMatch) return quotedMatch[1];
    
    // Try to extract button/link names
    const buttonMatch = action.match(/(?:button|link|field|input|element)\s+(?:named\s+|called\s+)?['"]?([^'".,]+)['"]?/i);
    if (buttonMatch) return buttonMatch[1];
    
    // Extract common UI elements
    const patterns = [
      /(?:click|press|tap|select)\s+(?:on\s+)?(?:the\s+)?['"]?(\w+)['"]?/i,
      /(?:the\s+)?['"]?(\w+)['"]?\s+(?:button|link|field)/i,
      /navigate\s+to\s+['"]?([^'"]+)['"]?/i
    ];
    
    for (const pattern of patterns) {
      const match = action.match(pattern);
      if (match) return match[1];
    }
    
    return 'element';
  }

  /**
   * Generate valid Java class name from title
   */
  generateClassName(title) {
    return title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Test';
  }

  /**
   * Generate valid Java method name from title
   */
  generateMethodName(title) {
    const name = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map((word, index) => 
        index === 0 ? word.toLowerCase() : 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
    
    return 'test' + name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Extract package name from directory path
   */
  extractPackageFromPath(dirPath) {
    // Convert path to package name (e.g., src/test/java/com/company/tests -> com.company.tests)
    const match = dirPath.match(/src\/(?:test|main)\/java\/(.+)/);
    if (match) {
      return match[1].replace(/\//g, '.');
    }
    return null;
  }

  /**
   * Get comprehensive framework imports matching the example
   */
  getComprehensiveFrameworkImports() {
    return [
      // Framework annotations
      'import com.viacom.unified.framework.annotations.AppBrand;',
      'import com.viacom.unified.framework.annotations.Locales;',
      'import com.viacom.unified.framework.annotations.Platforms;',
      // Framework core
      'import com.viacom.unified.framework.core.BaseTest;',
      'import com.viacom.unified.framework.core.TestParams;',
      // Framework enums
      'import com.viacom.unified.framework.enums.AppBrandType;',
      'import com.viacom.unified.framework.enums.Locale;',
      'import com.viacom.unified.framework.enums.Platform;',
      // Framework utils
      'import com.viacom.unified.framework.utils.Logger;',
      // Page objects
      'import com.viacom.unified.pageobjects.VideoPlayer;',
      // Selenium imports
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.Keys;',
      'import org.openqa.selenium.NoSuchElementException;',
      'import org.openqa.selenium.WebElement;',
      'import org.openqa.selenium.interactions.Actions;',
      'import org.openqa.selenium.support.ui.ExpectedConditions;',
      'import org.openqa.selenium.support.ui.WebDriverWait;',
      // TestNG
      'import org.testng.annotations.BeforeMethod;',
      'import org.testng.annotations.Description;',
      'import org.testng.annotations.Factory;',
      'import org.testng.annotations.Test;',
      'import org.testng.asserts.SoftAssert;',
      // Java
      'import java.time.Duration;',
      'import java.util.Arrays;',
      'import java.util.List;'
    ];
  }
  
  /**
   * Get framework-specific imports (legacy)
   */
  getFrameworkImports(patterns) {
    // Redirect to comprehensive imports
    return this.getComprehensiveFrameworkImports();

    // Add any additional imports from patterns if they match the framework
    if (patterns && patterns.imports) {
      const additionalImports = Array.from(patterns.imports)
        .filter(imp => imp.includes('com.viacom.unified'))
        .slice(0, 5);
      frameworkImports.push(...additionalImports);
    }

    return [...new Set(frameworkImports)];
  }

  /**
   * Generate smart locator method matching the example format
   */
  generateSmartLocatorMethod(elementId, elementText) {
    let method = `    private WebElement findElement_${elementId}() {\n`;
    method += '        List<By> locators = Arrays.asList(\n';
    method += `                By.cssSelector("[data-testid='${elementId.replace('Button', '-button')}']"),\n`;
    method += `                By.id("${elementId}"),\n`;
    method += `                By.xpath("//button[contains(text(), '${elementText}')]"),\n`;
    method += `                By.cssSelector("[aria-label*='${elementText}']"),\n`;
    method += `                By.xpath("//*[contains(@class, 'button') and contains(text(), '${elementText}')]")\n`;
    method += '        );\n';
    method += `        return findElementWithFallbacks("${elementText} Button", locators);\n`;
    method += '    }\n';
    method += '    \n';
    return method;
  }
  
  /**
   * Generate smart element locator with multiple strategies
   */
  generateSmartLocator(elementName, elementType = 'button') {
    const strategies = [];
    
    // Strategy 1: By data-testid (most stable)
    strategies.push(`By.cssSelector("[data-testid='${elementName}']")`);
    
    // Strategy 2: By ID (if available)
    strategies.push(`By.id("${elementName}")`);
    
    // Strategy 3: By partial text match (for buttons/links)
    if (elementType === 'button' || elementType === 'link') {
      strategies.push(`By.xpath("//button[contains(text(), '${elementName}')]")`);
      strategies.push(`By.xpath("//a[contains(text(), '${elementName}')]")`);
    }
    
    // Strategy 4: By aria-label
    strategies.push(`By.cssSelector("[aria-label*='${elementName}']")`);
    
    // Strategy 5: By class and text combination
    strategies.push(`By.xpath("//*[contains(@class, '${elementType}') and contains(text(), '${elementName}')]")`);
    
    // Generate the smart finder method
    let code = `    private WebElement findElement_${elementName.replace(/\s+/g, '_')}() {\n`;
    code += `        List<By> locators = Arrays.asList(\n`;
    strategies.forEach((strategy, index) => {
      code += `            ${strategy}${index < strategies.length - 1 ? ',' : ''}\n`;
    });
    code += `        );\n`;
    code += `        \n`;
    code += `        for (By locator : locators) {\n`;
    code += `            try {\n`;
    code += `                WebElement element = driver.findElement(locator);\n`;
    code += `                if (element != null && element.isDisplayed()) {\n`;
    code += `                    Logger.logMessage("Found element using: " + locator.toString());\n`;
    code += `                    return element;\n`;
    code += `                }\n`;
    code += `            } catch (NoSuchElementException e) {\n`;
    code += `                // Try next locator\n`;
    code += `            }\n`;
    code += `        }\n`;
    code += `        throw new NoSuchElementException("Could not find element: ${elementName}");\n`;
    code += `    }\n`;
    
    return code;
  }

  /**
   * Convert step to framework-specific code
   */
  convertStepToFrameworkCode(step) {
    const action = step.action.toLowerCase();
    let code = '';
    
    // Navigation actions using framework methods
    if (action.includes('navigate') || action.includes('go to') || action.includes('open')) {
      if (action.includes('property details') || action.includes('container')) {
        code = '        containerScreen().waitForScreenToLoad();';
      } else if (action.includes('home')) {
        code = '        launchAppAndNavigateToHomeScreen();';
      } else {
        code = '        // Navigate action: ' + step.action;
      }
    }
    // Remote control navigation (framework-specific)
    else if (action.includes('arrow') || action.includes('remote')) {
      if (action.includes('right')) {
        code = '        containerScreen().scrollRight();';
      } else if (action.includes('left')) {
        code = '        containerScreen().scrollLeft();';
      } else if (action.includes('down')) {
        code = '        containerScreen().scrollDown();';
      } else if (action.includes('up')) {
        code = '        containerScreen().scrollUp();';
      } else if (action.includes('ok') || action.includes('select')) {
        code = '        containerScreen().selectFocusedElement();';
      }
    }
    // Button actions - now with smart locators for new elements
    else if (action.includes('button')) {
      const buttonName = this.extractElementName(action);
      
      // Check if this is a known framework button
      if (action.includes('restart')) {
        code = '        containerScreen().selectRestartButton();';
      } else if (action.includes('resume')) {
        code = '        containerScreen().selectResumeButton();';
      } else if (action.includes('play')) {
        code = '        containerScreen().selectPlayButton();';
      } else {
        // For unknown buttons, use smart locator
        code = `        WebElement ${buttonName.toLowerCase()}Button = findElement_${buttonName.replace(/\s+/g, '_')}();\n`;
        code += `        ${buttonName.toLowerCase()}Button.click();`;
      }
    }
    // Verification actions
    else if (action.includes('verify') || action.includes('check') || action.includes('observe')) {
      if (action.includes('focus')) {
        code = '        softAssert.assertTrue(containerScreen().isFocusOnExpectedElement(), "Focus verification failed");';
      } else if (action.includes('display') || action.includes('visible')) {
        code = '        softAssert.assertTrue(containerScreen().isElementVisible(), "Element visibility check failed");';
      } else if (action.includes('ad') || action.includes('preroll')) {
        code = '        softAssert.assertTrue(videoPlayer().isAdPlaying(), "Ad playback verification failed");';
      } else {
        code = '        // Verification: ' + step.action;
      }
    }
    // Wait actions
    else if (action.includes('wait')) {
      if (action.includes('ad')) {
        code = '        videoPlayer().waitForAdToComplete();';
      } else if (action.includes('load')) {
        code = '        containerScreen().waitForScreenToLoad();';
      } else {
        code = '        WaitUtil.waitFor(TimeConstants.WAIT_MILLIS_3000);';
      }
    }
    // Default fallback
    else {
      code = '        // Action: ' + step.action;
    }
    
    return code;
  }

  /**
   * Get common imports based on patterns (legacy support)
   */
  getCommonImports(patterns) {
    // Redirect to framework imports for consistency
    return this.getFrameworkImports(patterns);
  }

  /**
   * Build automation prompt for Gemini AI
   */
  async buildAutomationPrompt(manualTest, repoPath, testDirectory, elementPatterns) {
    // Get existing patterns if available
    const patterns = this.patterns.get(repoPath) || 
                    await this.learnPatterns(repoPath, testDirectory);
    
    // Get indexed repository data to find Page Object methods
    const index = await this.indexRepository(repoPath);
    
    const className = this.generateClassName(manualTest.title);
    const packageName = this.extractPackageFromPath(testDirectory) || 'com.viacom.unified.tests.container';
    
    // Collect available Page Object methods
    let pageObjectMethods = [];
    if (index.pageObjects && index.pageObjects.length > 0) {
      for (const pageObj of index.pageObjects.slice(0, 5)) {
        if (pageObj.publicMethods && pageObj.publicMethods.length > 0) {
          const methodNames = pageObj.publicMethods.map(m => `  - ${pageObj.className}.${m.name}()`);
          pageObjectMethods.push(`${pageObj.className}:\n${methodNames.join('\n')}`);
        }
      }
    }
    
    let prompt = `Generate a Java Selenium test class based on the following manual test case.

PROJECT CONTEXT:
================
Package: ${packageName}
Class Name: ${className}
Framework: ${elementPatterns?.frameworks?.join(', ') || 'selenium'}
${patterns?.imports?.length > 0 ? `Common Imports: ${patterns.imports.slice(0, 10).join('\n')}` : ''}

MANUAL TEST CASE:
=================
Title: ${manualTest.title}
Objective: ${manualTest.objective}
Preconditions: ${manualTest.preconditions}
Priority: ${manualTest.priority}

TEST STEPS:
${manualTest.steps.map((step, i) => `
Step ${i + 1}:
  Action: ${step.action}
  Expected: ${step.expectedResult || step.expected || 'Verify action completes successfully'}
`).join('')}

Expected Result: ${manualTest.expectedResult}

EXISTING NAVIGATION PATTERNS:
============================
${patterns?.navigationMethods?.length > 0 ? `
The codebase uses these navigation methods - REUSE THEM:
${patterns.navigationMethods.slice(0, 5).join('\n')}

Common navigation methods to use:
- launchAppAndNavigateToHomeScreen() - for initial app launch and navigation
- homeScreen().openShowFromMovieSection(data, movieItem) - for navigating to content
- containerScreen().selectQAB() - for interacting with Quick Action Bar
- clearWatchHistory(movieItem.getMgid()) - for test cleanup
- disableAVODAds() - for test setup
` : ''}

${patterns?.pageObjects?.length > 0 ? `
Page Objects used in the codebase:
${patterns.pageObjects.slice(0, 5).join('\n')}
` : ''}

${pageObjectMethods.length > 0 ? `
AVAILABLE PAGE OBJECT METHODS:
==============================
${pageObjectMethods.join('\n\n')}

IMPORTANT: Use these existing Page Object methods instead of creating new element locators when possible.
` : ''}

REQUIREMENTS:
=============
1. Extend BaseTest class and use Factory pattern with TestParams
2. Include proper TestNG annotations (@Test, @Factory, @Description, etc.)
3. Use framework-specific annotations (@Platforms, @AppBrand, @Locales)
4. IMPORTANT: Reuse existing navigation methods like launchAppAndNavigateToHomeScreen()
5. Implement multi-strategy element location with fallback mechanisms
6. For EACH UI element, create a helper method that tries multiple locator strategies:
   - Priority 1: data-testid attribute
   - Priority 2: id attribute
   - Priority 3: xpath with text content
   - Priority 4: aria-label attribute
   - Priority 5: class and text combination
7. Use SoftAssert for multiple validations
8. Include proper error handling and logging
9. Generate methods like findElement_ButtonName() that implement the multi-strategy approach
10. Use existing page object methods when available (containerScreen(), homeScreen(), etc.)

ELEMENT LOCATION EXAMPLE:
========================
private WebElement findElement_resumeButton() {
    List<By> locators = Arrays.asList(
        By.cssSelector("[data-testid='resume-button']"),
        By.id("resumeButton"),
        By.xpath("//button[contains(text(), 'Resume')]"),
        By.cssSelector("[aria-label*='Resume']"),
        By.xpath("//*[contains(@class, 'button') and contains(text(), 'Resume')]")
    );
    
    for (By locator : locators) {
        try {
            WebElement element = driver.findElement(locator);
            if (element != null && element.isDisplayed()) {
                Logger.logMessage("Found element using: " + locator.toString());
                return element;
            }
        } catch (NoSuchElementException e) {
            // Try next locator
        }
    }
    throw new NoSuchElementException("Could not find element: Resume Button");
}

Generate the complete Java test class with all imports, annotations, and test methods.`;

    if (elementPatterns && elementPatterns.smartLocatorStrategies?.length > 0) {
      prompt += `

SMART LOCATOR STRATEGIES FROM PROJECT:
======================================
${elementPatterns.smartLocatorStrategies.map(s => `${s.priority}. ${s.type}: ${s.example}`).join('\n')}

Use these strategies in the order specified for element location.`;
    }

    return prompt;
  }

  /**
   * Save generated test to repository
   */
  async saveTestToRepository(repoPath, testDirectory, generatedTest) {
    const targetDir = path.join(repoPath, testDirectory);
    const filePath = path.join(targetDir, generatedTest.fileName);

    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(filePath);
      // File exists, create a numbered version
      const timestamp = Date.now();
      const newFileName = generatedTest.fileName.replace('.java', `_${timestamp}.java`);
      const newFilePath = path.join(targetDir, newFileName);
      await fs.writeFile(newFilePath, generatedTest.code);
      
      return {
        success: true,
        path: newFilePath,
        message: `Test saved as ${newFileName} (original file already existed)`
      };
    } catch (error) {
      // File doesn't exist, save normally
      await fs.writeFile(filePath, generatedTest.code);
      
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
   * Open file in IntelliJ IDEA
   */
  async openInIntelliJ(filePath) {
    try {
      const platform = process.platform;
      let command;
      
      if (platform === 'darwin') {
        // macOS
        command = `open -a "IntelliJ IDEA" "${filePath}"`;
      } else if (platform === 'win32') {
        // Windows
        command = `idea64.exe "${filePath}"`;
      } else {
        // Linux
        command = `idea "${filePath}"`;
      }
      
      await execAsync(command);
      logger.info(`Opened ${filePath} in IntelliJ IDEA`);
      return { success: true };
    } catch (error) {
      // Try alternative: idea command line tool
      try {
        await execAsync(`idea "${filePath}"`);
        return { success: true };
      } catch (err) {
        logger.warn(`Could not open in IntelliJ: ${error.message}`);
        return { success: false, error: error.message };
      }
    }
  }

  /**
   * Generate hash for repository path (for caching)
   */
  getRepoHash(repoPath) {
    // Simple hash based on path
    return Buffer.from(repoPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }
}

// Export singleton instance
const javaSeleniumService = new JavaSeleniumService();
export default javaSeleniumService;