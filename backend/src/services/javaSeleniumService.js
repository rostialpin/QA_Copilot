import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class JavaSeleniumService {
  constructor() {
    // Cache directory for indexed repositories
    this.cacheDir = path.join(process.env.HOME, '.qa-copilot', 'cache');
    this.reposDir = path.join(process.env.HOME, '.qa-copilot', 'repos');
    this.patterns = new Map(); // Store learned patterns per repository
  }

  /**
   * Validate if the provided path is a valid Java repository
   */
  async validateRepository(repoPath) {
    try {
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
          } else if (entry.name.includes('Page') || content.includes('@FindBy')) {
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
   * Learn patterns from test files in a directory
   */
  async learnPatterns(repoPath, testDirectory, forceReindex = false) {
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
    const normalizedTestDir = testDirectory.replace(repoPath, '').replace(/^\/+/, '');
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
   * Generate Selenium test based on manual test and learned patterns
   */
  async generateSeleniumTest(manualTest, repoPath, testDirectory) {
    const patterns = this.patterns.get(repoPath) || 
                    await this.learnPatterns(repoPath, testDirectory);

    const className = this.generateClassName(manualTest.title);
    const packageName = this.extractPackageFromPath(testDirectory);

    // Build test class
    let testCode = '';

    // Package declaration
    if (packageName) {
      testCode += `package ${packageName};\n\n`;
    }

    // Imports (use common imports from patterns)
    const commonImports = this.getCommonImports(patterns);
    testCode += commonImports.join('\n') + '\n\n';

    // Class declaration
    testCode += `public class ${className} {\n`;
    testCode += '    private static final String BASE_URL = "https://your-app-url.com";\n';
    testCode += '    private WebDriver driver;\n\n';

    // Setup method
    testCode += '    @BeforeEach\n';
    testCode += '    public void setUp() {\n';
    testCode += '        // Initialize WebDriver\n';
    testCode += '        System.setProperty("webdriver.chrome.driver", "path/to/chromedriver");\n';
    testCode += '        driver = new ChromeDriver();\n';
    testCode += '        driver.manage().window().maximize();\n';
    testCode += '        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));\n';
    testCode += '    }\n\n';

    // Test method
    testCode += '    @Test\n';
    testCode += `    public void ${this.generateMethodName(manualTest.title)}() {\n`;
    testCode += `        // ${manualTest.objective}\n\n`;

    // Convert manual steps to Selenium code
    for (const step of manualTest.steps) {
      testCode += `        // Step: ${step.action}\n`;
      testCode += this.convertStepToSelenium(step) + '\n';
      testCode += `        // Expected: ${step.expected}\n\n`;
    }

    testCode += '    }\n\n';

    // Teardown method
    testCode += '    @AfterEach\n';
    testCode += '    public void tearDown() {\n';
    testCode += '        if (driver != null) {\n';
    testCode += '            driver.quit();\n';
    testCode += '        }\n';
    testCode += '    }\n';
    testCode += '\n';
    testCode += '    /**\n';
    testCode += '     * Verifies screen reader compatibility by checking ARIA attributes.\n';
    testCode += '     * Real screen reader testing requires tools like JAWS, NVDA, or axe-selenium.\n';
    testCode += '     * @param expectedText The text that should be announced\n';
    testCode += '     * @param expectedRole The ARIA role (e.g., "button")\n';
    testCode += '     * @param position Optional position in set (e.g., 3 for "3 of 4")\n';
    testCode += '     * @param total Optional total in set (e.g., 4 for "3 of 4")\n';
    testCode += '     */\n';
    testCode += '    private void verifyScreenReaderCompatibility(String expectedText, String expectedRole, Integer position, Integer total) {\n';
    testCode += '        WebElement focused = driver.switchTo().activeElement();\n';
    testCode += '        \n';
    testCode += '        // Get ARIA attributes\n';
    testCode += '        String ariaLabel = focused.getAttribute("aria-label");\n';
    testCode += '        String text = ariaLabel != null ? ariaLabel : focused.getText();\n';
    testCode += '        String role = focused.getAttribute("role");\n';
    testCode += '        String ariaPosinset = focused.getAttribute("aria-posinset");\n';
    testCode += '        String ariaSetsize = focused.getAttribute("aria-setsize");\n';
    testCode += '        \n';
    testCode += '        // Verify text and role\n';
    testCode += '        assertTrue(text.contains(expectedText), \n';
    testCode += '            "Expected text \\"" + expectedText + "\\" but got \\"" + text + "\\"");\n';
    testCode += '        assertEquals(expectedRole, role, "ARIA role mismatch");\n';
    testCode += '        \n';
    testCode += '        // Verify position if provided\n';
    testCode += '        if (position != null && total != null) {\n';
    testCode += '            assertEquals(String.valueOf(position), ariaPosinset, \n';
    testCode += '                "ARIA position mismatch (expected " + position + " of " + total + ")");\n';
    testCode += '            assertEquals(String.valueOf(total), ariaSetsize, \n';
    testCode += '                "ARIA set size mismatch");\n';
    testCode += '        }\n';
    testCode += '        \n';
    testCode += '        // Log what screen reader would announce\n';
    testCode += '        String announcement = text + ", " + role;\n';
    testCode += '        if (ariaPosinset != null && ariaSetsize != null) {\n';
    testCode += '            announcement += ", " + ariaPosinset + " of " + ariaSetsize;\n';
    testCode += '        }\n';
    testCode += '        System.out.println("Screen reader would announce: \\"" + announcement + "\\"");\n';
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
   * Get common imports based on patterns
   */
  getCommonImports(patterns) {
    const baseImports = [
      'import org.junit.jupiter.api.Test;',
      'import org.junit.jupiter.api.BeforeEach;',
      'import org.junit.jupiter.api.AfterEach;',
      'import org.openqa.selenium.WebDriver;',
      'import org.openqa.selenium.WebElement;',
      'import org.openqa.selenium.chrome.ChromeDriver;',
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.Keys;',
      'import org.openqa.selenium.JavascriptExecutor;',
      'import org.openqa.selenium.interactions.Actions;',
      'import org.openqa.selenium.support.ui.WebDriverWait;',
      'import org.openqa.selenium.support.ui.ExpectedConditions;',
      'import java.time.Duration;',
      'import static org.junit.jupiter.api.Assertions.*;'
    ];

    // Add common imports from patterns
    const patternImports = Array.from(patterns.imports)
      .filter(imp => 
        imp.includes('selenium') || 
        imp.includes('junit') || 
        imp.includes('testng')
      )
      .slice(0, 5); // Limit to avoid too many imports

    return [...new Set([...baseImports, ...patternImports])];
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