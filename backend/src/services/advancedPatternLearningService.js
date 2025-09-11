import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
// import * as javaParser from 'java-parser'; // Optional dependency - install if needed for Java parsing
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Advanced Pattern Learning Service with AST-based code analysis
 * Provides semantic understanding of test code patterns across multiple frameworks
 */
export class AdvancedPatternLearningService {
  constructor() {
    this.patterns = {
      semantic: new Map(),      // AST-based patterns
      behavioral: new Map(),     // Action-result patterns
      structural: new Map(),     // Test structure patterns
      dataFlow: new Map(),      // Data usage patterns
      assertions: new Map(),    // Assertion patterns by context
      selectors: new Map(),     // Element selector strategies
      waits: new Map()         // Wait/sync patterns
    };
    
    this.frameworkPatterns = {
      selenium: new Map(),
      playwright: new Map(),
      cypress: new Map(),
      restAssured: new Map(),
      testNG: new Map(),
      junit5: new Map()
    };
    
    this.learningMetrics = {
      totalPatternsLearned: 0,
      patternAccuracy: new Map(),
      patternUsageFrequency: new Map(),
      lastModelUpdate: null
    };
    
    this.initializeDefaultPatterns();
  }

  initializeDefaultPatterns() {
    // Advanced Selenium patterns with self-healing capabilities
    this.frameworkPatterns.selenium.set('element-location', {
      strategies: [
        { priority: 1, type: 'id', pattern: 'By.id("%s")', reliability: 0.95 },
        { priority: 2, type: 'data-testid', pattern: 'By.cssSelector("[data-testid=\'%s\']")', reliability: 0.9 },
        { priority: 3, type: 'css', pattern: 'By.cssSelector("%s")', reliability: 0.7 },
        { priority: 4, type: 'xpath', pattern: 'By.xpath("%s")', reliability: 0.6 },
        { priority: 5, type: 'text', pattern: 'By.linkText("%s")', reliability: 0.5 }
      ],
      selfHealing: {
        fallbackStrategy: 'multiple-selectors',
        retryCount: 3,
        waitStrategy: 'dynamic'
      }
    });

    // Playwright patterns for modern web testing
    this.frameworkPatterns.playwright.set('core-patterns', {
      setup: `
import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

test.describe('[Feature]', () => {
  let page: Page;
  
  test.beforeEach(async ({ page }) => {
    await page.goto('[URL]');
    await page.waitForLoadState('networkidle');
  });
`,
      elementInteraction: {
        click: "await page.locator('[selector]').click();",
        fill: "await page.locator('[selector]').fill('[value]');",
        select: "await page.selectOption('[selector]', '[value]');",
        check: "await page.locator('[selector]').check();",
        hover: "await page.locator('[selector]').hover();"
      },
      assertions: {
        visibility: "await expect(page.locator('[selector]')).toBeVisible();",
        text: "await expect(page.locator('[selector]')).toHaveText('[expected]');",
        value: "await expect(page.locator('[selector]')).toHaveValue('[expected]');",
        count: "await expect(page.locator('[selector]')).toHaveCount([count]);",
        url: "await expect(page).toHaveURL('[url]');"
      },
      advanced: {
        networkInterception: `
await page.route('**/api/**', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([data])
  });
});`,
        screenshot: "await page.screenshot({ path: '[filename]', fullPage: true });",
        trace: "await page.tracing.start({ screenshots: true, snapshots: true });"
      }
    });

    // Rest Assured API testing patterns
    this.frameworkPatterns.restAssured.set('api-patterns', {
      setup: `
import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

public class [TestClass] {
    @BeforeEach
    public void setup() {
        RestAssured.baseURI = "[BASE_URL]";
        RestAssured.basePath = "[BASE_PATH]";
    }
`,
      requests: {
        get: `
Response response = given()
    .header("Authorization", "Bearer " + token)
    .queryParam("[param]", "[value]")
    .when()
    .get("[endpoint]")
    .then()
    .statusCode(200)
    .extract().response();`,
        post: `
Response response = given()
    .header("Content-Type", "application/json")
    .body([requestBody])
    .when()
    .post("[endpoint]")
    .then()
    .statusCode(201)
    .extract().response();`,
        put: `
given()
    .header("Content-Type", "application/json")
    .body([updateBody])
    .when()
    .put("[endpoint]/{id}", [id])
    .then()
    .statusCode(200)
    .body("[field]", equalTo("[expected]"));`,
        delete: `
given()
    .when()
    .delete("[endpoint]/{id}", [id])
    .then()
    .statusCode(204);`
      },
      validations: {
        jsonPath: '.body("$.data[0].id", equalTo([expected]))',
        schema: '.body(matchesJsonSchemaInClasspath("[schema].json"))',
        headers: '.header("[headerName]", "[expectedValue]")',
        responseTime: '.time(lessThan([milliseconds]L))'
      }
    });

    // Behavioral patterns for intelligent test generation
    this.patterns.behavioral.set('user-actions', {
      navigation: ['click', 'navigate', 'scroll', 'swipe'],
      input: ['type', 'fill', 'select', 'upload', 'clear'],
      verification: ['assert', 'verify', 'check', 'validate'],
      waiting: ['wait', 'pause', 'sleep', 'poll']
    });

    // Self-healing selector patterns
    this.patterns.selectors.set('self-healing', {
      strategies: [
        { name: 'id-fallback', pattern: /id=["']([^"']+)["']/ },
        { name: 'class-fallback', pattern: /class=["']([^"']+)["']/ },
        { name: 'text-content', pattern: />([^<]+)</ },
        { name: 'parent-child', pattern: /parent::child/ },
        { name: 'sibling-relation', pattern: /following-sibling|preceding-sibling/ }
      ]
    });

    this.learningMetrics.lastModelUpdate = new Date();
  }

  /**
   * Parse JavaScript/TypeScript test files using Babel AST
   */
  async parseJavaScriptAST(code) {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy']
    });

    const patterns = {
      imports: [],
      describes: [],
      tests: [],
      hooks: [],
      assertions: [],
      customCommands: [],
      selectors: [],
      waitStrategies: []
    };

    traverse.default(ast, {
      ImportDeclaration(path) {
        patterns.imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(spec => ({
            type: spec.type,
            name: spec.local?.name || spec.imported?.name
          }))
        });
      },

      CallExpression(path) {
        const calleeName = path.node.callee.name || path.node.callee.property?.name;
        
        // Detect describe blocks
        if (calleeName === 'describe' || calleeName === 'suite') {
          patterns.describes.push({
            name: path.node.arguments[0]?.value,
            body: this.extractBlockPatterns(path.node.arguments[1])
          });
        }
        
        // Detect test blocks
        if (calleeName === 'it' || calleeName === 'test') {
          patterns.tests.push({
            name: path.node.arguments[0]?.value,
            async: path.node.arguments[1]?.async,
            body: this.extractBlockPatterns(path.node.arguments[1])
          });
        }
        
        // Detect hooks
        if (['beforeEach', 'afterEach', 'beforeAll', 'afterAll'].includes(calleeName)) {
          patterns.hooks.push({
            type: calleeName,
            body: this.extractBlockPatterns(path.node.arguments[0])
          });
        }
        
        // Detect assertions
        if (path.node.callee.type === 'MemberExpression') {
          const object = path.node.callee.object;
          const property = path.node.callee.property;
          
          if (object?.name === 'expect' || property?.name === 'should') {
            patterns.assertions.push({
              type: property?.name,
              matcher: this.extractAssertionMatcher(path.node),
              value: this.extractAssertionValue(path.node)
            });
          }
        }

        // Detect element selectors
        if (this.isElementSelector(path.node)) {
          patterns.selectors.push({
            method: calleeName,
            selector: this.extractSelector(path.node),
            context: this.getNodeContext(path)
          });
        }

        // Detect wait strategies
        if (this.isWaitStrategy(calleeName)) {
          patterns.waitStrategies.push({
            type: calleeName,
            condition: this.extractWaitCondition(path.node),
            timeout: this.extractTimeout(path.node)
          });
        }
      }
    });

    return patterns;
  }

  /**
   * Parse Java test files using java-parser
   */
  async parseJavaAST(code) {
    try {
      // Java parsing requires java-parser package - install it for Java support
      // const ast = javaParser.parse(code);
      
      // For now, use regex-based parsing as fallback
      const ast = null;
      
      const patterns = {
        imports: [],
        annotations: [],
        testMethods: [],
        setupMethods: [],
        pageObjects: [],
        assertions: [],
        elementLocators: [],
        dataProviders: []
      };

      // Extract imports (requires javaParser to be installed)
      if (ast && ast.imports) {
        patterns.imports = ast.imports.map(imp => ({
          name: imp.name,
          static: imp.static || false
        }));
      }

      // Extract class-level annotations (requires javaParser to be installed)
      if (ast && ast.types && ast.types[0]) {
        const mainClass = ast.types[0];
        
        // Process annotations
        if (mainClass.modifiers) {
          patterns.annotations = mainClass.modifiers
            .filter(mod => mod.type === 'annotation')
            .map(ann => ({
              name: ann.name,
              values: ann.values
            }));
        }

        // Process methods
        if (mainClass.body) {
          mainClass.body.forEach(member => {
            if (member.type === 'method') {
              const annotations = member.modifiers?.filter(m => m.type === 'annotation') || [];
              const isTest = annotations.some(a => 
                a.name === 'Test' || a.name === 'ParameterizedTest'
              );
              const isSetup = annotations.some(a => 
                ['BeforeEach', 'BeforeAll', 'Before', 'BeforeClass'].includes(a.name)
              );

              if (isTest) {
                patterns.testMethods.push({
                  name: member.name,
                  annotations: annotations,
                  parameters: member.parameters,
                  body: this.analyzeJavaMethodBody(member.body)
                });
              } else if (isSetup) {
                patterns.setupMethods.push({
                  name: member.name,
                  type: annotations[0].name,
                  body: this.analyzeJavaMethodBody(member.body)
                });
              }

              // Extract assertions and element locators from method body
              if (member.body) {
                const bodyAnalysis = this.analyzeJavaMethodBody(member.body);
                patterns.assertions.push(...bodyAnalysis.assertions);
                patterns.elementLocators.push(...bodyAnalysis.locators);
              }
            }
          });
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Error parsing Java AST:', error);
      return this.fallbackJavaPatternExtraction(code);
    }
  }

  /**
   * Analyze Java method body for patterns
   */
  analyzeJavaMethodBody(body) {
    const analysis = {
      assertions: [],
      locators: [],
      actions: [],
      waits: []
    };

    // This would require deeper AST traversal
    // For now, use regex-based extraction as fallback
    const bodyStr = JSON.stringify(body);
    
    // Extract assertions
    const assertionPatterns = [
      /assertEquals\s*\(/g,
      /assertTrue\s*\(/g,
      /assertFalse\s*\(/g,
      /assertThat\s*\(/g,
      /verify\s*\(/g
    ];
    
    assertionPatterns.forEach(pattern => {
      const matches = bodyStr.matchAll(pattern);
      for (const match of matches) {
        analysis.assertions.push({
          type: match[0].replace(/\s*\(/, ''),
          position: match.index
        });
      }
    });

    // Extract locators
    const locatorPatterns = [
      /By\.id\s*\("([^"]+)"\)/g,
      /By\.xpath\s*\("([^"]+)"\)/g,
      /By\.cssSelector\s*\("([^"]+)"\)/g,
      /By\.className\s*\("([^"]+)"\)/g
    ];

    locatorPatterns.forEach(pattern => {
      const matches = bodyStr.matchAll(pattern);
      for (const match of matches) {
        analysis.locators.push({
          type: match[0].split('.')[1].split('(')[0],
          value: match[1]
        });
      }
    });

    return analysis;
  }

  /**
   * Fallback Java pattern extraction using regex
   */
  fallbackJavaPatternExtraction(code) {
    const patterns = {
      imports: [],
      annotations: [],
      testMethods: [],
      assertions: [],
      elementLocators: []
    };

    // Extract imports
    const importMatches = code.matchAll(/import\s+(static\s+)?([^;]+);/g);
    for (const match of importMatches) {
      patterns.imports.push({
        static: !!match[1],
        path: match[2]
      });
    }

    // Extract test methods
    const testMethodMatches = code.matchAll(/@Test[^{]*{/g);
    for (const match of testMethodMatches) {
      const methodStart = match.index;
      const methodEnd = this.findMatchingBrace(code, methodStart + match[0].length);
      const methodBody = code.substring(methodStart, methodEnd);
      
      patterns.testMethods.push({
        annotation: '@Test',
        body: methodBody
      });
    }

    return patterns;
  }

  /**
   * Learn patterns from a repository
   */
  async learnFromRepository(repoPath, options = {}) {
    const { 
      frameworks = ['selenium', 'cypress', 'playwright'],
      maxFiles = 100,
      useCache = true 
    } = options;

    const cacheKey = this.generateCacheKey(repoPath, frameworks);
    
    if (useCache) {
      const cached = await this.loadFromCache(cacheKey);
      if (cached) {
        logger.info('Loaded patterns from cache');
        return cached;
      }
    }

    const patterns = await this.scanRepository(repoPath, frameworks, maxFiles);
    const analyzed = await this.analyzePatterns(patterns);
    const optimized = this.optimizePatterns(analyzed);

    if (useCache) {
      await this.saveToCache(cacheKey, optimized);
    }

    return optimized;
  }

  /**
   * Scan repository for test files
   */
  async scanRepository(repoPath, frameworks, maxFiles) {
    const testFiles = [];
    const patterns = {
      byFramework: {},
      byFeature: {},
      common: {}
    };

    // Define file patterns for each framework
    const filePatterns = {
      selenium: ['**/*Test.java', '**/*Tests.java', '**/*Spec.java'],
      cypress: ['**/*.cy.js', '**/*.cy.ts', '**/cypress/**/*.js'],
      playwright: ['**/*.spec.js', '**/*.spec.ts', '**/e2e/**/*.js'],
      restAssured: ['**/*ApiTest.java', '**/*APITest.java']
    };

    for (const framework of frameworks) {
      const files = await this.findTestFiles(repoPath, filePatterns[framework], maxFiles);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const ext = path.extname(file);
        
        let ast;
        if (['.js', '.ts'].includes(ext)) {
          ast = await this.parseJavaScriptAST(content);
        } else if (ext === '.java') {
          ast = await this.parseJavaAST(content);
        }

        if (ast) {
          if (!patterns.byFramework[framework]) {
            patterns.byFramework[framework] = [];
          }
          patterns.byFramework[framework].push({
            file,
            ast,
            patterns: this.extractPatternsFromAST(ast, framework)
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Extract patterns from AST
   */
  extractPatternsFromAST(ast, framework) {
    const patterns = {
      structure: this.extractStructurePatterns(ast),
      actions: this.extractActionPatterns(ast),
      assertions: this.extractAssertionPatterns(ast),
      data: this.extractDataPatterns(ast),
      synchronization: this.extractSyncPatterns(ast)
    };

    // Framework-specific pattern extraction
    switch (framework) {
      case 'selenium':
        patterns.pageObjects = this.extractPageObjectPatterns(ast);
        patterns.webElements = this.extractWebElementPatterns(ast);
        break;
      case 'playwright':
        patterns.locators = this.extractPlaywrightLocators(ast);
        patterns.networkMocks = this.extractNetworkMocks(ast);
        break;
      case 'cypress':
        patterns.customCommands = this.extractCypressCommands(ast);
        patterns.fixtures = this.extractFixtures(ast);
        break;
    }

    return patterns;
  }

  /**
   * Generate enhanced test with self-healing capabilities
   */
  async generateEnhancedTest(ticket, framework, patterns) {
    const testStructure = await this.buildTestStructure(ticket, framework, patterns);
    const selfHealingCode = this.generateSelfHealingCode(framework);
    const assertions = this.generateSmartAssertions(ticket, patterns);
    const dataHandling = this.generateDataHandling(ticket, patterns);

    return {
      imports: this.generateImports(framework, patterns),
      setup: testStructure.setup,
      tests: testStructure.tests.map(test => ({
        ...test,
        selfHealing: selfHealingCode,
        assertions: assertions[test.name] || [],
        data: dataHandling[test.name] || {}
      })),
      teardown: testStructure.teardown,
      utilities: this.generateUtilities(framework, patterns)
    };
  }

  /**
   * Generate self-healing code for tests
   */
  generateSelfHealingCode(framework) {
    switch (framework) {
      case 'selenium':
        return `
    private WebElement findElementWithFallback(By... locators) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        List<Exception> exceptions = new ArrayList<>();
        
        for (By locator : locators) {
            try {
                return wait.until(ExpectedConditions.presenceOfElementLocated(locator));
            } catch (Exception e) {
                exceptions.add(e);
            }
        }
        
        throw new NoSuchElementException("Element not found with any fallback locator");
    }`;
      
      case 'playwright':
        return `
    async function findWithFallback(page, selectors) {
        for (const selector of selectors) {
            const element = page.locator(selector);
            if (await element.count() > 0) {
                return element;
            }
        }
        throw new Error('Element not found with any fallback selector');
    }`;
      
      case 'cypress':
        return `
    Cypress.Commands.add('getWithFallback', (selectors) => {
        let element;
        for (const selector of selectors) {
            element = cy.get(selector, { timeout: 1000 }).then(
                ($el) => $el,
                () => null
            );
            if (element) return element;
        }
        throw new Error('Element not found with any fallback selector');
    });`;
      
      default:
        return '';
    }
  }

  /**
   * Helper methods for AST analysis
   */
  extractBlockPatterns(node) {
    // Extract patterns from function/block body
    return {
      hasAsync: node?.async || false,
      parameters: node?.params?.map(p => p.name) || [],
      // Additional pattern extraction
    };
  }

  extractAssertionMatcher(node) {
    // Extract assertion matcher from call expression
    if (node.callee?.property) {
      return node.callee.property.name;
    }
    return null;
  }

  extractAssertionValue(node) {
    // Extract expected value from assertion
    if (node.arguments?.length > 0) {
      return node.arguments[0].value || node.arguments[0].name;
    }
    return null;
  }

  isElementSelector(node) {
    // Check if node represents element selection
    const selectorMethods = ['get', 'find', 'locator', 'findElement', '$', '$$'];
    const calleeName = node.callee?.name || node.callee?.property?.name;
    return selectorMethods.includes(calleeName);
  }

  extractSelector(node) {
    // Extract selector value from node
    if (node.arguments?.length > 0) {
      return node.arguments[0].value || node.arguments[0].raw;
    }
    return null;
  }

  getNodeContext(path) {
    // Get context information about where the node appears
    let context = 'unknown';
    let parent = path.parent;
    
    while (parent) {
      if (parent.type === 'BlockStatement') {
        if (parent.parent?.callee?.name === 'it' || parent.parent?.callee?.name === 'test') {
          context = 'test';
          break;
        }
        if (parent.parent?.callee?.name === 'beforeEach') {
          context = 'setup';
          break;
        }
      }
      parent = parent.parent;
    }
    
    return context;
  }

  isWaitStrategy(name) {
    const waitMethods = ['wait', 'waitFor', 'waitUntil', 'pause', 'sleep'];
    return waitMethods.includes(name);
  }

  extractWaitCondition(node) {
    // Extract wait condition from node
    if (node.arguments?.length > 0) {
      return node.arguments[0].value || 'custom';
    }
    return null;
  }

  extractTimeout(node) {
    // Extract timeout value from node
    if (node.arguments?.length > 1) {
      return node.arguments[1].value;
    }
    return null;
  }

  findMatchingBrace(code, startPos) {
    let braceCount = 1;
    let pos = startPos;
    
    while (pos < code.length && braceCount > 0) {
      if (code[pos] === '{') braceCount++;
      if (code[pos] === '}') braceCount--;
      pos++;
    }
    
    return pos;
  }

  generateCacheKey(repoPath, frameworks) {
    const hash = crypto.createHash('md5');
    hash.update(repoPath);
    hash.update(frameworks.join(','));
    return hash.digest('hex');
  }

  async loadFromCache(key) {
    try {
      const cachePath = path.join(process.env.HOME, '.qa-copilot', 'cache', `patterns_${key}.json`);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(data);
      
      // Check if cache is still valid (24 hours)
      const age = Date.now() - cached.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        return cached.patterns;
      }
    } catch (error) {
      // Cache miss or error
    }
    return null;
  }

  async saveToCache(key, patterns) {
    try {
      const cacheDir = path.join(process.env.HOME, '.qa-copilot', 'cache');
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cachePath = path.join(cacheDir, `patterns_${key}.json`);
      await fs.writeFile(cachePath, JSON.stringify({
        timestamp: Date.now(),
        patterns
      }, null, 2));
    } catch (error) {
      logger.error('Error saving patterns to cache:', error);
    }
  }

  async findTestFiles(repoPath, patterns, maxFiles) {
    // Implementation would use glob or similar to find matching files
    // For now, return empty array as placeholder
    return [];
  }

  extractStructurePatterns(ast) {
    // Extract test structure patterns from AST
    return {
      hasDescribe: ast.describes?.length > 0,
      hasHooks: ast.hooks?.length > 0,
      testNaming: ast.tests?.map(t => t.name) || []
    };
  }

  extractActionPatterns(ast) {
    // Extract user action patterns from AST
    return ast.tests?.flatMap(test => 
      test.body?.actions || []
    ) || [];
  }

  extractAssertionPatterns(ast) {
    // Extract assertion patterns from AST
    return ast.assertions || [];
  }

  extractDataPatterns(ast) {
    // Extract data usage patterns from AST
    return {
      fixtures: [],
      constants: [],
      variables: []
    };
  }

  extractSyncPatterns(ast) {
    // Extract synchronization patterns from AST
    return ast.waitStrategies || [];
  }

  extractPageObjectPatterns(ast) {
    // Extract page object patterns for Selenium
    return [];
  }

  extractWebElementPatterns(ast) {
    // Extract WebElement patterns for Selenium
    return ast.elementLocators || [];
  }

  extractPlaywrightLocators(ast) {
    // Extract Playwright-specific locator patterns
    return ast.selectors?.filter(s => 
      s.method === 'locator' || s.method === 'getByRole'
    ) || [];
  }

  extractNetworkMocks(ast) {
    // Extract network mocking patterns from Playwright tests
    return [];
  }

  extractCypressCommands(ast) {
    // Extract custom Cypress commands
    return ast.customCommands || [];
  }

  extractFixtures(ast) {
    // Extract Cypress fixture usage
    return [];
  }

  analyzePatterns(patterns) {
    // Analyze collected patterns for commonalities
    return patterns;
  }

  optimizePatterns(patterns) {
    // Optimize patterns for efficient test generation
    return patterns;
  }

  async buildTestStructure(ticket, framework, patterns) {
    // Build test structure based on framework and patterns
    return {
      setup: [],
      tests: [],
      teardown: []
    };
  }

  generateSmartAssertions(ticket, patterns) {
    // Generate intelligent assertions based on context
    return {};
  }

  generateDataHandling(ticket, patterns) {
    // Generate data handling code
    return {};
  }

  generateImports(framework, patterns) {
    // Generate required imports for the framework
    return [];
  }

  generateUtilities(framework, patterns) {
    // Generate utility functions for the test
    return [];
  }
}

export default new AdvancedPatternLearningService();