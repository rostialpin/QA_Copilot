/**
 * Context-Aware Code Generation Agent
 *
 * A multi-file generation agent that:
 * 1. Analyzes existing tests, Page Objects, and Property files
 * 2. Identifies reusable methods and elements
 * 3. Creates NEW methods in Page Objects when needed
 * 4. Creates NEW locators in Property files when needed
 * 5. Generates complete test class for new scenarios
 *
 * Input Categories:
 * - Category 1: Existing test files (for pattern learning)
 * - Category 2: Page Object files (for method reuse/extension)
 * - Category 3: Property files (for element locator reuse/extension)
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import javaMethodExtractor from './javaMethodExtractor.js';
import propertiesParser from './propertiesParserService.js';
import { getOpenRouterService } from './openrouterService.js';
import { hybridRAGService } from './hybridRAGService.js';

class ContextAwareCodeGenerationAgent {
  constructor() {
    this.openRouterService = null;
    this.analysisCache = new Map();
    this.useRAG = false;
  }

  /**
   * Initialize the agent with AI service and optionally RAG
   */
  async initialize(options = {}) {
    this.openRouterService = getOpenRouterService();
    if (!this.openRouterService.isConfigured()) {
      logger.warn('OpenRouter not configured - agent will use template-based generation');
    }

    // Initialize RAG if requested
    if (options.enableRAG !== false) {
      try {
        const ragInitialized = await hybridRAGService.initialize();
        this.useRAG = ragInitialized;
        if (ragInitialized) {
          logger.info('Hybrid RAG enabled for context-aware generation');
        }
      } catch (e) {
        logger.warn('RAG initialization failed, using manual mode only');
        this.useRAG = false;
      }
    }

    return this;
  }

  /**
   * Main entry point: Generate multi-file output for a test scenario
   *
   * @param {Object} params
   * @param {Object} params.testScenario - The test scenario/requirement to implement
   * @param {Array} params.existingTestPaths - Paths to existing test files for pattern learning
   * @param {Array} params.pageObjectPaths - Paths to Page Object files
   * @param {Array} params.propertyFilePaths - Paths to property files
   * @param {string} params.repositoryPath - Base repository path
   * @param {Object} params.hints - Optional user hints for RAG (similarTest, primaryScreen, template)
   * @param {boolean} params.useRAG - Enable RAG auto-retrieval (default: true if no files provided)
   * @returns {Object} Generated files: { testClass, pageObjectUpdates, propertyUpdates }
   */
  async generateMultiFileOutput(params) {
    let {
      testScenario,
      existingTestPaths = [],
      pageObjectPaths = [],
      propertyFilePaths = [],
      repositoryPath,
      hints = {},
      useRAG
    } = params;

    logger.info('='.repeat(60));
    logger.info('Context-Aware Code Generation Agent Started');
    logger.info('='.repeat(60));

    // Determine if RAG should be used
    const noManualFiles = existingTestPaths.length === 0 &&
                          pageObjectPaths.length === 0 &&
                          propertyFilePaths.length === 0;

    const shouldUseRAG = (useRAG === true) || (useRAG !== false && noManualFiles && this.useRAG);

    // Step 0: Use Hybrid RAG to auto-retrieve context if applicable
    let ragContext = null;
    if (shouldUseRAG) {
      logger.info('Using Hybrid RAG for automatic context retrieval');

      const scenarioText = typeof testScenario === 'string'
        ? testScenario
        : `${testScenario.title || ''} ${testScenario.description || ''} ${(testScenario.steps || []).join(' ')}`;

      ragContext = await hybridRAGService.retrieveContext({
        testScenario: scenarioText,
        hints,
        topK: 5
      });

      // Convert RAG results to file paths
      if (ragContext.pageObjects.length > 0) {
        pageObjectPaths = ragContext.pageObjects
          .filter(po => po.metadata?.filePath)
          .map(po => po.metadata.filePath);
        logger.info(`RAG retrieved ${pageObjectPaths.length} Page Objects`);
      }

      if (ragContext.properties.length > 0) {
        propertyFilePaths = ragContext.properties
          .filter(p => p.metadata?.filePath)
          .map(p => p.metadata.filePath);
        logger.info(`RAG retrieved ${propertyFilePaths.length} Property files`);
      }

      if (ragContext.tests.length > 0) {
        existingTestPaths = ragContext.tests
          .filter(t => t.metadata?.filePath)
          .map(t => t.metadata.filePath);
        logger.info(`RAG retrieved ${existingTestPaths.length} similar Tests`);
      }
    }

    // Step 1: Analyze all input files (manual or RAG-retrieved)
    const analysis = await this.analyzeInputFiles({
      existingTestPaths,
      pageObjectPaths,
      propertyFilePaths,
      repositoryPath
    });

    // Add RAG context to analysis for confidence reporting
    if (ragContext) {
      analysis.ragUsed = true;
      analysis.ragConfidence = ragContext.confidence;
      analysis.ragHints = hints;
    }

    logger.info(`Analysis complete: ${analysis.existingMethods.length} methods, ${analysis.existingElements.length} elements`);

    // Step 2: Determine what's needed for the new test
    const requirements = await this.analyzeRequirements(testScenario, analysis);

    logger.info(`Requirements: ${requirements.reusableMethods.length} reusable, ${requirements.newMethods.length} new methods needed`);
    logger.info(`Elements: ${requirements.reusableElements.length} reusable, ${requirements.newElements.length} new elements needed`);

    // Step 3: Generate new Page Object methods if needed
    const pageObjectUpdates = await this.generatePageObjectUpdates(requirements, analysis);

    // Step 4: Generate new Property file entries if needed
    const propertyUpdates = await this.generatePropertyUpdates(requirements, analysis);

    // Step 5: Generate the complete test class
    const testClass = await this.generateTestClass(testScenario, requirements, analysis);

    // Step 6: Validate generated code
    const validation = this.validateGeneratedCode(testClass, pageObjectUpdates, propertyUpdates, analysis);

    return {
      success: true,
      testClass,
      pageObjectUpdates,
      propertyUpdates,
      analysis: {
        reusedMethods: requirements.reusableMethods,
        newMethods: requirements.newMethods,
        reusedElements: requirements.reusableElements,
        newElements: requirements.newElements
      },
      validation
    };
  }

  /**
   * Analyze all input files to extract patterns, methods, and elements
   */
  async analyzeInputFiles({ existingTestPaths, pageObjectPaths, propertyFilePaths, repositoryPath }) {
    const analysis = {
      // From Page Objects
      existingMethods: [],
      methodsByScreen: {},

      // From Property Files
      existingElements: [],
      elementsByScreen: {},

      // From Existing Tests
      testPatterns: [],
      navigationPatterns: [],
      assertionPatterns: [],

      // Inferred patterns
      namingConventions: {},
      commonImports: new Set(),
      baseClasses: new Set(),
      annotations: new Set()
    };

    // Analyze Page Objects
    for (const filePath of pageObjectPaths) {
      try {
        const absolutePath = this.resolvePath(filePath, repositoryPath);
        const content = await fs.readFile(absolutePath, 'utf8');
        const className = javaMethodExtractor.extractClassName(content);
        const methods = javaMethodExtractor.extractMethods(content);

        if (className) {
          const accessor = javaMethodExtractor.getAccessorName(className);
          analysis.methodsByScreen[accessor] = {
            className,
            methods: methods.map(m => ({
              ...m,
              sourceFile: filePath
            })),
            filePath: absolutePath
          };

          methods.forEach(m => {
            analysis.existingMethods.push({
              ...m,
              screen: accessor,
              className,
              filePath
            });
          });
        }

        // Extract imports and base class
        this.extractJavaMetadata(content, analysis);

      } catch (error) {
        logger.warn(`Could not read Page Object file: ${filePath}`, error.message);
      }
    }

    // Analyze Property Files
    for (const filePath of propertyFilePaths) {
      try {
        const absolutePath = this.resolvePath(filePath, repositoryPath);
        const content = await fs.readFile(absolutePath, 'utf8');
        const screenName = path.basename(filePath, '.properties');
        const elements = this.parsePropertyFile(content);

        analysis.elementsByScreen[screenName] = {
          elements,
          filePath: absolutePath
        };

        Object.entries(elements).forEach(([key, value]) => {
          analysis.existingElements.push({
            key,
            value,
            screen: screenName,
            filePath
          });
        });

      } catch (error) {
        logger.warn(`Could not read Property file: ${filePath}`, error.message);
      }
    }

    // Analyze Existing Tests for patterns
    for (const filePath of existingTestPaths) {
      try {
        const absolutePath = this.resolvePath(filePath, repositoryPath);
        const content = await fs.readFile(absolutePath, 'utf8');

        // Extract test patterns
        const patterns = this.extractTestPatterns(content);
        analysis.testPatterns.push(...patterns.testMethods);
        analysis.navigationPatterns.push(...patterns.navigation);
        analysis.assertionPatterns.push(...patterns.assertions);

        // Extract imports
        this.extractJavaMetadata(content, analysis);

      } catch (error) {
        logger.warn(`Could not read Test file: ${filePath}`, error.message);
      }
    }

    return analysis;
  }

  /**
   * Resolve file path - handle both absolute and relative paths
   */
  resolvePath(filePath, repositoryPath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(repositoryPath, filePath);
  }

  /**
   * Parse a properties file content
   */
  parsePropertyFile(content) {
    const elements = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.+)$/);
      if (match) {
        elements[match[1].trim()] = match[2].trim();
      }
    }

    return elements;
  }

  /**
   * Extract Java metadata (imports, base class, annotations)
   */
  extractJavaMetadata(content, analysis) {
    // Extract imports
    const importRegex = /import\s+([\w.]+);/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      analysis.commonImports.add(match[1]);
    }

    // Extract base class
    const extendsMatch = content.match(/class\s+\w+\s+extends\s+(\w+)/);
    if (extendsMatch) {
      analysis.baseClasses.add(extendsMatch[1]);
    }

    // Extract annotations
    const annotationRegex = /@(\w+)(?:\([^)]*\))?/g;
    while ((match = annotationRegex.exec(content)) !== null) {
      if (['Test', 'BeforeMethod', 'AfterMethod', 'BeforeClass', 'AfterClass', 'DataProvider'].includes(match[1])) {
        analysis.annotations.add(match[1]);
      }
    }
  }

  /**
   * Extract test patterns from existing test file
   */
  extractTestPatterns(content) {
    const patterns = {
      testMethods: [],
      navigation: [],
      assertions: []
    };

    // Extract test method patterns
    const testMethodRegex = /@Test[^}]+\{([^}]+)\}/gs;
    let match;
    while ((match = testMethodRegex.exec(content)) !== null) {
      patterns.testMethods.push(match[1].trim());
    }

    // Extract navigation patterns (screen().method() calls)
    const navRegex = /(\w+Screen|\w+Page)\(\)\.(\w+)\([^)]*\)/g;
    while ((match = navRegex.exec(content)) !== null) {
      patterns.navigation.push({
        screen: match[1],
        method: match[2],
        full: match[0]
      });
    }

    // Extract assertion patterns
    const assertRegex = /(Assert\.\w+|assertThat|verify\w+)\([^;]+;/g;
    while ((match = assertRegex.exec(content)) !== null) {
      patterns.assertions.push(match[0]);
    }

    return patterns;
  }

  /**
   * Analyze what the new test scenario requires
   */
  async analyzeRequirements(testScenario, analysis) {
    const requirements = {
      reusableMethods: [],
      newMethods: [],
      reusableElements: [],
      newElements: [],
      screens: new Set(),
      actions: []
    };

    // Extract actions from test scenario
    const actions = this.extractActionsFromScenario(testScenario);
    requirements.actions = actions;

    // For each action, check if we have existing methods
    for (const action of actions) {
      const matchingMethod = this.findMatchingMethod(action, analysis.existingMethods);

      if (matchingMethod) {
        requirements.reusableMethods.push({
          action,
          method: matchingMethod,
          screen: matchingMethod.screen
        });
        requirements.screens.add(matchingMethod.screen);
      } else {
        // Need to create a new method
        const suggestedScreen = this.suggestScreen(action, analysis);
        requirements.newMethods.push({
          action,
          suggestedName: this.generateMethodName(action),
          suggestedScreen,
          returnType: this.inferReturnType(action),
          description: action.description
        });
        requirements.screens.add(suggestedScreen);
      }
    }

    // Check for element requirements
    for (const action of actions) {
      if (action.element) {
        const matchingElement = this.findMatchingElement(action.element, analysis.existingElements);

        if (matchingElement) {
          requirements.reusableElements.push({
            action,
            element: matchingElement
          });
        } else {
          requirements.newElements.push({
            action,
            elementName: this.generateElementKey(action.element),
            suggestedLocator: this.generateLocatorSuggestion(action.element),
            screen: this.suggestScreen(action, analysis)
          });
        }
      }
    }

    return requirements;
  }

  /**
   * Extract actions from a test scenario
   */
  extractActionsFromScenario(testScenario) {
    const actions = [];

    // Parse from test scenario steps
    if (testScenario.steps && Array.isArray(testScenario.steps)) {
      for (const step of testScenario.steps) {
        const action = this.parseStepToAction(step);
        if (action) {
          actions.push(action);
        }
      }
    }

    // Parse from test scenario description
    if (testScenario.description) {
      const descActions = this.parseDescriptionToActions(testScenario.description);
      actions.push(...descActions);
    }

    return actions;
  }

  /**
   * Parse a test step into an action object
   */
  parseStepToAction(step) {
    const stepText = typeof step === 'string' ? step : (step.action || step.description || '');

    const action = {
      type: 'unknown',
      element: null,
      value: null,
      description: stepText,
      original: step
    };

    // Detect action type
    const lowerStep = stepText.toLowerCase();

    if (lowerStep.includes('click') || lowerStep.includes('tap') || lowerStep.includes('press')) {
      action.type = 'click';
    } else if (lowerStep.includes('verify') || lowerStep.includes('check') || lowerStep.includes('assert') || lowerStep.includes('should')) {
      action.type = 'verify';
    } else if (lowerStep.includes('enter') || lowerStep.includes('type') || lowerStep.includes('input')) {
      action.type = 'input';
    } else if (lowerStep.includes('navigate') || lowerStep.includes('go to') || lowerStep.includes('open')) {
      action.type = 'navigate';
    } else if (lowerStep.includes('wait')) {
      action.type = 'wait';
    } else if (lowerStep.includes('scroll')) {
      action.type = 'scroll';
    } else if (lowerStep.includes('visible') || lowerStep.includes('displayed') || lowerStep.includes('present')) {
      action.type = 'visibility';
    }

    // Extract element from step
    const elementPatterns = [
      /(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?["']?([^"']+?)["']?\s*(?:button|link|icon|element)/i,
      /(?:verify|check|assert)\s+(?:that\s+)?(?:the\s+)?["']?([^"']+?)["']?\s*(?:is|should|button|text)/i,
      /"([^"]+)"\s*(?:button|link|icon|text)/i,
      /(?:button|link|icon|element)\s*["']([^"']+)["']/i
    ];

    for (const pattern of elementPatterns) {
      const match = stepText.match(pattern);
      if (match) {
        action.element = match[1].trim();
        break;
      }
    }

    return action;
  }

  /**
   * Parse description text to extract actions
   */
  parseDescriptionToActions(description) {
    const actions = [];
    const sentences = description.split(/[.!?;]/);

    for (const sentence of sentences) {
      const action = this.parseStepToAction(sentence.trim());
      if (action.type !== 'unknown' || action.element) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Find matching method in existing methods
   */
  findMatchingMethod(action, existingMethods) {
    const actionKeywords = this.extractKeywords(action.description);

    for (const method of existingMethods) {
      const methodKeywords = this.extractKeywords(method.name);
      const overlap = actionKeywords.filter(k => methodKeywords.includes(k));

      // If significant overlap, consider it a match
      if (overlap.length >= 2 || (overlap.length === 1 && overlap[0].length > 5)) {
        return method;
      }

      // Check for specific matches
      if (action.type === 'click' && method.returnType === 'void' &&
          (method.name.startsWith('click') || method.name.startsWith('tap'))) {
        if (action.element && method.name.toLowerCase().includes(action.element.toLowerCase())) {
          return method;
        }
      }

      if (action.type === 'verify' && method.returnType === 'boolean' &&
          (method.name.startsWith('is') || method.name.startsWith('verify') || method.name.startsWith('has'))) {
        if (action.element && method.name.toLowerCase().includes(action.element.toLowerCase())) {
          return method;
        }
      }
    }

    return null;
  }

  /**
   * Find matching element in existing elements
   */
  findMatchingElement(elementName, existingElements) {
    const normalizedName = elementName.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const element of existingElements) {
      const normalizedKey = element.key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (normalizedKey.includes(normalizedName) || normalizedName.includes(normalizedKey)) {
        return element;
      }
    }

    return null;
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    // Split camelCase and extract words
    const words = text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(w => w.length > 2);

    return words;
  }

  /**
   * Suggest which screen a method should belong to
   */
  suggestScreen(action, analysis) {
    const actionText = action.description.toLowerCase();

    // Check for screen mentions in action
    const screenKeywords = {
      'home': 'homeScreen',
      'player': 'playerScreen',
      'container': 'containerScreen',
      'movie': 'moviesScreen',
      'series': 'seriesScreen',
      'show': 'seriesScreen',
      'navigation': 'baseUnifiedScreen',
      'setting': 'settingsScreen',
      'profile': 'profileScreen',
      'search': 'searchScreen'
    };

    for (const [keyword, screen] of Object.entries(screenKeywords)) {
      if (actionText.includes(keyword)) {
        // Verify this screen exists in analysis
        if (analysis.methodsByScreen[screen]) {
          return screen;
        }
      }
    }

    // Default to playerScreen for playback-related actions
    if (actionText.includes('play') || actionText.includes('pause') ||
        actionText.includes('restart') || actionText.includes('video')) {
      return 'playerScreen';
    }

    // Default to containerScreen for content-related actions
    if (actionText.includes('episode') || actionText.includes('content') ||
        actionText.includes('detail')) {
      return 'containerScreen';
    }

    return 'baseUnifiedScreen';
  }

  /**
   * Generate method name from action
   */
  generateMethodName(action) {
    const type = action.type;
    const element = action.element || '';

    // Convert element to camelCase
    const elementCamel = element
      .split(/\s+/)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    switch (type) {
      case 'click':
        return `click${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}`;
      case 'verify':
      case 'visibility':
        return `is${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}Displayed`;
      case 'input':
        return `enter${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}`;
      case 'navigate':
        return `navigateTo${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}`;
      case 'wait':
        return `waitFor${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}`;
      case 'scroll':
        return `scrollTo${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}`;
      default:
        return `handle${elementCamel.charAt(0).toUpperCase() + elementCamel.slice(1)}`;
    }
  }

  /**
   * Infer return type based on action
   */
  inferReturnType(action) {
    if (action.type === 'verify' || action.type === 'visibility') {
      return 'boolean';
    }
    return 'void';
  }

  /**
   * Generate element key for properties file
   */
  generateElementKey(elementName) {
    return elementName
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Element';
  }

  /**
   * Generate locator suggestion for new element
   */
  generateLocatorSuggestion(elementName) {
    const normalized = elementName.toLowerCase();

    return {
      primary: `xpath://*[contains(@text, '${elementName}') or contains(@content-desc, '${elementName}')]`,
      alternatives: [
        `xpath://android.widget.Button[contains(@text, '${elementName}')]`,
        `id:${normalized.replace(/\s+/g, '_')}_button`,
        `accessibility id:${elementName}`
      ]
    };
  }

  /**
   * Generate Page Object updates (new methods)
   */
  async generatePageObjectUpdates(requirements, analysis) {
    const updates = {};

    for (const newMethod of requirements.newMethods) {
      const screen = newMethod.suggestedScreen;

      if (!updates[screen]) {
        updates[screen] = {
          screen,
          filePath: analysis.methodsByScreen[screen]?.filePath || null,
          newMethods: []
        };
      }

      // Generate method code
      const methodCode = this.generateMethodCode(newMethod);
      updates[screen].newMethods.push({
        name: newMethod.suggestedName,
        code: methodCode,
        description: newMethod.description
      });
    }

    return updates;
  }

  /**
   * Generate method code for a new method
   */
  generateMethodCode(methodDef) {
    const { suggestedName, returnType, description, action } = methodDef;

    let code = `    /**\n`;
    code += `     * ${description}\n`;
    code += `     * @generated by Context-Aware Code Generation Agent\n`;
    code += `     */\n`;
    code += `    public ${returnType} ${suggestedName}() {\n`;

    if (returnType === 'boolean') {
      code += `        try {\n`;
      code += `            // TODO: Implement visibility check for ${action?.element || 'element'}\n`;
      code += `            return findElement(${suggestedName}Element).isDisplayed();\n`;
      code += `        } catch (Exception e) {\n`;
      code += `            return false;\n`;
      code += `        }\n`;
    } else {
      code += `        // TODO: Implement action for ${action?.element || 'element'}\n`;
      if (action?.type === 'click') {
        code += `        click(${suggestedName.replace('click', '').toLowerCase()}Element);\n`;
      } else if (action?.type === 'wait') {
        code += `        waitForElement(${action?.element?.toLowerCase() || 'target'}Element);\n`;
      } else {
        code += `        // Action: ${action?.type || 'unknown'}\n`;
      }
    }

    code += `    }\n`;

    return code;
  }

  /**
   * Generate Property file updates (new elements)
   */
  async generatePropertyUpdates(requirements, analysis) {
    const updates = {};

    for (const newElement of requirements.newElements) {
      const screen = newElement.screen + 'Screen';
      const screenName = screen.replace('Screen', '').charAt(0).toUpperCase() +
                         screen.replace('Screen', '').slice(1) + 'Screen';

      if (!updates[screenName]) {
        updates[screenName] = {
          screen: screenName,
          filePath: analysis.elementsByScreen[screenName]?.filePath || null,
          newElements: []
        };
      }

      updates[screenName].newElements.push({
        key: newElement.elementName,
        value: newElement.suggestedLocator.primary,
        alternatives: newElement.suggestedLocator.alternatives,
        description: `Element for: ${newElement.action?.description || 'Unknown action'}`
      });
    }

    return updates;
  }

  /**
   * Generate the complete test class
   */
  async generateTestClass(testScenario, requirements, analysis) {
    // Try AI-based generation first
    if (this.openRouterService && this.openRouterService.isConfigured()) {
      try {
        return await this.generateTestClassWithAI(testScenario, requirements, analysis);
      } catch (error) {
        logger.warn('AI generation failed, falling back to template', error.message);
      }
    }

    // Fallback to template-based generation
    return this.generateTestClassFromTemplate(testScenario, requirements, analysis);
  }

  /**
   * Generate test class using AI
   */
  async generateTestClassWithAI(testScenario, requirements, analysis) {
    const prompt = this.buildTestGenerationPrompt(testScenario, requirements, analysis);

    const response = await this.openRouterService.chat({
      systemPrompt: `You are an expert Java test automation engineer. Generate test code that:
1. Uses ONLY the methods listed in the Available Methods section
2. Follows the exact patterns from the Example Test Patterns section
3. Uses the correct screen accessors (e.g., playerScreen().methodName())
4. Includes proper TestNG annotations
5. Handles exceptions appropriately
6. Does NOT invent new methods that don't exist

IMPORTANT: Generate compilable Java code that will work with the existing codebase.`,
      userPrompt: prompt,
      maxTokens: 4000
    });

    // Extract and validate the code
    const code = this.extractCodeFromResponse(response.content);

    return {
      className: this.generateTestClassName(testScenario),
      code,
      generatedBy: 'ai',
      model: this.openRouterService.getCurrentModel()
    };
  }

  /**
   * Build the prompt for test generation
   */
  buildTestGenerationPrompt(testScenario, requirements, analysis) {
    let prompt = `Generate a Java Selenium test class for the following scenario:\n\n`;

    // Test scenario details
    prompt += `## Test Scenario\n`;
    prompt += `Title: ${testScenario.title || 'Test'}\n`;
    prompt += `Description: ${testScenario.description || ''}\n`;
    if (testScenario.steps) {
      prompt += `Steps:\n`;
      testScenario.steps.forEach((step, i) => {
        const stepText = typeof step === 'string' ? step : (step.action || step.description);
        prompt += `${i + 1}. ${stepText}\n`;
      });
    }
    prompt += `\n`;

    // Available methods
    prompt += `## Available Methods (USE ONLY THESE)\n`;
    for (const [screen, info] of Object.entries(analysis.methodsByScreen)) {
      prompt += `\n### ${screen}() methods:\n`;
      info.methods.forEach(m => {
        prompt += `- ${screen}().${m.name}(${m.parameters.map(p => p.type + ' ' + p.name).join(', ')}) → ${m.returnType}\n`;
      });
    }
    prompt += `\n`;

    // Methods to reuse
    if (requirements.reusableMethods.length > 0) {
      prompt += `## Methods to Reuse:\n`;
      requirements.reusableMethods.forEach(rm => {
        prompt += `- For "${rm.action.description}": use ${rm.screen}().${rm.method.name}()\n`;
      });
      prompt += `\n`;
    }

    // Example patterns from existing tests
    if (analysis.testPatterns.length > 0) {
      prompt += `## Example Test Patterns from Codebase:\n`;
      prompt += `\`\`\`java\n`;
      prompt += analysis.testPatterns.slice(0, 3).join('\n\n');
      prompt += `\n\`\`\`\n\n`;
    }

    // Common base class
    const baseClass = Array.from(analysis.baseClasses)[0] || 'BaseTest';
    prompt += `## Base Class: extends ${baseClass}\n\n`;

    // Generate request
    prompt += `## Generate:\n`;
    prompt += `1. A complete test class that extends ${baseClass}\n`;
    prompt += `2. Use @Test annotation\n`;
    prompt += `3. Include proper assertions\n`;
    prompt += `4. Only use methods from the "Available Methods" section\n`;
    prompt += `5. Follow the patterns shown in "Example Test Patterns"\n`;

    return prompt;
  }

  /**
   * Extract code from AI response
   */
  extractCodeFromResponse(response) {
    // Try to extract from code block
    const codeBlockMatch = response.match(/```java\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find class definition
    const classMatch = response.match(/(package[\s\S]*?class[\s\S]*)/);
    if (classMatch) {
      return classMatch[1].trim();
    }

    return response.trim();
  }

  /**
   * Generate test class from template (fallback)
   */
  generateTestClassFromTemplate(testScenario, requirements, analysis) {
    const className = this.generateTestClassName(testScenario);
    const baseClass = Array.from(analysis.baseClasses)[0] || 'BaseTest';

    let code = `package com.viacom.unified.tests.generated;\n\n`;

    // Add common imports
    const imports = Array.from(analysis.commonImports).slice(0, 20);
    imports.forEach(imp => {
      code += `import ${imp};\n`;
    });
    code += `import org.testng.annotations.Test;\n`;
    code += `import org.testng.Assert;\n\n`;

    // Class definition
    code += `/**\n`;
    code += ` * ${testScenario.title || 'Generated Test'}\n`;
    code += ` * Generated by Context-Aware Code Generation Agent\n`;
    code += ` */\n`;
    code += `public class ${className} extends ${baseClass} {\n\n`;

    // Test method
    code += `    @Test(description = "${testScenario.description || testScenario.title || 'Test'}")\n`;
    code += `    public void ${this.generateTestMethodName(testScenario)}() {\n`;

    // Generate test body from reusable methods
    for (const rm of requirements.reusableMethods) {
      code += `        // ${rm.action.description}\n`;
      if (rm.method.returnType === 'boolean') {
        code += `        Assert.assertTrue(${rm.screen}().${rm.method.name}(), "Expected ${rm.method.name} to return true");\n`;
      } else {
        code += `        ${rm.screen}().${rm.method.name}();\n`;
      }
    }

    // Add TODOs for new methods
    for (const nm of requirements.newMethods) {
      code += `        // TODO: New method needed - ${nm.suggestedName}()\n`;
      code += `        // ${nm.description}\n`;
    }

    code += `    }\n`;
    code += `}\n`;

    return {
      className,
      code,
      generatedBy: 'template'
    };
  }

  /**
   * Generate test class name
   */
  generateTestClassName(testScenario) {
    const title = testScenario.title || testScenario.name || 'Generated';
    const words = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
    const camelCase = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    return camelCase + 'Test';
  }

  /**
   * Generate test method name
   */
  generateTestMethodName(testScenario) {
    const title = testScenario.title || testScenario.name || 'test';
    const words = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
    const camelCase = words.map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join('');
    return 'test' + camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  /**
   * Validate generated code
   */
  validateGeneratedCode(testClass, pageObjectUpdates, propertyUpdates, analysis) {
    const issues = [];
    const warnings = [];

    // Check for invented methods
    const usedMethods = this.extractUsedMethods(testClass.code);
    for (const used of usedMethods) {
      const exists = analysis.existingMethods.some(
        m => m.name === used.method && m.screen === used.screen
      );

      if (!exists) {
        // Check if it's a new method we're creating
        const isNew = Object.values(pageObjectUpdates).some(
          update => update.newMethods.some(nm => nm.name === used.method)
        );

        if (!isNew) {
          issues.push({
            type: 'missing_method',
            screen: used.screen,
            method: used.method,
            message: `Method ${used.screen}().${used.method}() does not exist and is not being created`
          });
        }
      }
    }

    // Check for valid screen references
    const screenPattern = /(\w+Screen|\w+Page)\(\)/g;
    let match;
    while ((match = screenPattern.exec(testClass.code)) !== null) {
      const screenName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
      if (!analysis.methodsByScreen[screenName] && !analysis.methodsByScreen[match[1]]) {
        warnings.push({
          type: 'unknown_screen',
          screen: match[1],
          message: `Screen ${match[1]} not found in analyzed Page Objects`
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Extract method calls from generated code
   */
  extractUsedMethods(code) {
    const methods = [];
    const pattern = /(\w+)\(\)\.(\w+)\(/g;
    let match;

    while ((match = pattern.exec(code)) !== null) {
      methods.push({
        screen: match[1],
        method: match[2]
      });
    }

    return methods;
  }
}

// Export singleton instance
export const contextAwareCodeGenerationAgent = new ContextAwareCodeGenerationAgent();
export default contextAwareCodeGenerationAgent;
