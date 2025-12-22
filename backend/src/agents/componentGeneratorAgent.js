/**
 * Component Generator Agent
 *
 * Generates new Page Object methods, property entries, and locators
 * for unmapped actions. Uses existing code patterns from the repository
 * to ensure consistency.
 *
 * Key features:
 * - Generate new methods following existing patterns
 * - Smart locator generation (Android/iOS/Web)
 * - Property file entry generation
 * - Pattern learning from existing codebase
 *
 * @see /docs/architecture/multi-agent-test-generation-architecture.md
 */

import { hybridRAGService } from '../services/hybridRAGService.js';
import { openrouterService } from '../services/openrouterService.js';
import { logger } from '../utils/logger.js';

class ComponentGeneratorAgent {
  constructor() {
    this.ragService = hybridRAGService;
    this.openRouterService = null;
    this.model = 'google/gemini-2.0-flash-001';

    // Common action patterns for method generation
    this.actionPatterns = {
      'click': { prefix: 'click', returnType: 'void', template: 'clickElement({element});' },
      'tap': { prefix: 'tap', returnType: 'void', template: 'tapElement({element});' },
      'verify': { prefix: 'verify', returnType: 'void', template: 'verifyElementDisplayed({element});' },
      'wait': { prefix: 'waitFor', returnType: 'void', template: 'waitForElement({element}, {timeout});' },
      'enter': { prefix: 'enter', returnType: 'void', template: 'enterText({element}, {text});' },
      'scroll': { prefix: 'scroll', returnType: 'void', template: 'scrollTo({element});' },
      'navigate': { prefix: 'navigateTo', returnType: 'void', template: 'navigateTo{Screen}();' },
      'select': { prefix: 'select', returnType: 'void', template: 'selectElement({element});' },
      'get': { prefix: 'get', returnType: 'String', template: 'return getElementText({element});' },
      'is': { prefix: 'is', returnType: 'boolean', template: 'return isElementDisplayed({element});' }
    };

    // Locator strategies by platform
    this.locatorStrategies = {
      android: {
        primary: 'resource-id',
        fallback: ['content-desc', 'text', 'class'],
        template: '//android.widget.{class}[@resource-id="{resourceId}"]'
      },
      ios: {
        primary: 'accessibility-id',
        fallback: ['name', 'label', 'value'],
        template: '//XCUIElementType{class}[@name="{accessibilityId}"]'
      },
      web: {
        primary: 'data-testid',
        fallback: ['id', 'class', 'name'],
        template: '//*[@data-testid="{testId}"]'
      },
      ctv: {
        primary: 'resource-id',
        fallback: ['content-desc', 'text'],
        template: '//android.widget.{class}[@resource-id="{resourceId}"]'
      }
    };

    // Screen class suffix
    this.screenSuffix = 'Screen';
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    this.openRouterService = openrouterService;
    // OpenRouter service initializes in constructor, no need to call initialize()
    logger.info('ComponentGeneratorAgent initialized');
  }

  /**
   * Generate components for all unmapped actions
   *
   * @param {Array} unmappedActions - Actions that couldn't be mapped
   * @param {Object} context - Platform, brand, screen context
   * @returns {Object} Generated methods, properties, and locators
   */
  async generateComponents(unmappedActions, context = {}) {
    const { platform = 'android', brand = null, targetScreen = 'GenericScreen' } = context;

    if (!unmappedActions || unmappedActions.length === 0) {
      return {
        success: true,
        newMethods: [],
        newProperties: [],
        newLocators: [],
        message: 'No unmapped actions to process'
      };
    }

    logger.info(`Generating components for ${unmappedActions.length} unmapped actions`);

    // Learn existing patterns from the codebase
    const existingPatterns = await this.learnExistingPatterns(targetScreen, platform);

    const newMethods = [];
    const newProperties = [];
    const newLocators = [];

    for (const action of unmappedActions) {
      try {
        // Generate method
        const method = await this.generateMethod(action, existingPatterns, context);
        if (method) {
          newMethods.push(method);
        }

        // Generate locator and property if needed
        if (method?.needsLocator) {
          const locator = this.generateLocator(action, platform, existingPatterns);
          const property = this.generatePropertyEntry(action, locator, platform);

          newLocators.push(locator);
          newProperties.push(property);
        }
      } catch (error) {
        logger.warn(`Failed to generate component for action: ${action.action}`, error);
      }
    }

    return {
      success: true,
      newMethods,
      newProperties,
      newLocators,
      statistics: {
        unmappedCount: unmappedActions.length,
        methodsGenerated: newMethods.length,
        propertiesGenerated: newProperties.length,
        locatorsGenerated: newLocators.length
      },
      context
    };
  }

  /**
   * Learn existing patterns from the codebase
   */
  async learnExistingPatterns(screenName, platform) {
    const patterns = {
      methodNaming: 'camelCase',
      locatorPattern: null,
      commonImports: [],
      verifyMethods: [],
      clickMethods: [],
      waitMethods: []
    };

    try {
      // Query RAG for existing screen methods
      if (this.ragService?.isInitialized) {
        const methods = await this.ragService.queryMethods(`${screenName} methods`, {
          topK: 20,
          platform
        });

        if (methods && methods.length > 0) {
          // Extract patterns from existing methods
          for (const method of methods) {
            const name = method.methodName || method.name;
            if (name?.startsWith('verify')) patterns.verifyMethods.push(name);
            if (name?.startsWith('click') || name?.startsWith('tap')) patterns.clickMethods.push(name);
            if (name?.startsWith('wait')) patterns.waitMethods.push(name);
          }

          // Learn locator pattern from existing properties
          const firstMethod = methods[0];
          if (firstMethod?.locatorPattern) {
            patterns.locatorPattern = firstMethod.locatorPattern;
          }
        }
      }
    } catch (error) {
      logger.debug(`Could not learn patterns: ${error.message}`);
    }

    return patterns;
  }

  /**
   * Generate a method for an unmapped action
   */
  async generateMethod(action, existingPatterns, context) {
    const { action: actionType, target, details } = action;
    const { platform, targetScreen } = context;

    // Determine method characteristics from action type
    const pattern = this.findActionPattern(actionType);
    const elementName = this.generateElementName(target, details);
    const methodName = this.generateMethodName(actionType, elementName, pattern);

    // Determine if this method needs a locator
    const needsLocator = this.actionNeedsLocator(actionType);

    // Build method body
    const methodBody = this.generateMethodBody(actionType, elementName, pattern, details);

    // Generate JavaDoc
    const javadoc = this.generateJavadoc(action);

    return {
      class: targetScreen || 'GenericScreen',
      platform,
      method: {
        name: methodName,
        returnType: pattern?.returnType || 'void',
        parameters: this.inferParameters(actionType, details),
        body: methodBody,
        javadoc
      },
      needsLocator,
      elementName,
      generatedFrom: action
    };
  }

  /**
   * Find matching action pattern
   */
  findActionPattern(actionType) {
    const normalized = actionType.toLowerCase();

    // Direct match
    if (this.actionPatterns[normalized]) {
      return this.actionPatterns[normalized];
    }

    // Partial match
    for (const [key, pattern] of Object.entries(this.actionPatterns)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return pattern;
      }
    }

    // Default pattern for unknown actions
    return { prefix: 'perform', returnType: 'void', template: '// TODO: Implement {action}' };
  }

  /**
   * Generate element name from target and details
   */
  generateElementName(target, details) {
    if (!target) return 'element';

    // Clean up target
    let name = target
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Convert to camelCase element name
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return 'element';

    return words
      .map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Generate method name
   */
  generateMethodName(actionType, elementName, pattern) {
    const prefix = pattern?.prefix || actionType.toLowerCase();
    const cleanElement = elementName.charAt(0).toUpperCase() + elementName.slice(1);
    return `${prefix}${cleanElement}`;
  }

  /**
   * Check if action needs a locator
   */
  actionNeedsLocator(actionType) {
    const noLocatorActions = ['navigate', 'wait', 'pause', 'sleep', 'back', 'forward'];
    return !noLocatorActions.some(a => actionType.toLowerCase().includes(a));
  }

  /**
   * Generate method body
   */
  generateMethodBody(actionType, elementName, pattern, details) {
    const template = pattern?.template || '// TODO: Implement action';

    let body = template
      .replace('{element}', elementName)
      .replace('{action}', actionType)
      .replace('{timeout}', '30')
      .replace('{text}', 'text');

    // Add screen navigation for navigate actions
    if (actionType.toLowerCase().includes('navigate')) {
      const screen = elementName.charAt(0).toUpperCase() + elementName.slice(1);
      body = `navigateTo${screen}();`;
    }

    return body;
  }

  /**
   * Infer parameters from action type and details
   */
  inferParameters(actionType, details) {
    const params = [];

    if (actionType.toLowerCase().includes('enter') || actionType.toLowerCase().includes('type')) {
      params.push({ type: 'String', name: 'text' });
    }

    if (actionType.toLowerCase().includes('wait') && details?.includes('second')) {
      params.push({ type: 'int', name: 'seconds' });
    }

    return params;
  }

  /**
   * Generate JavaDoc for method
   */
  generateJavadoc(action) {
    const lines = ['/**'];
    lines.push(` * ${action.action} ${action.target || ''}`);
    if (action.details) {
      lines.push(` * ${action.details}`);
    }
    lines.push(' * @generated by ComponentGeneratorAgent');
    lines.push(' */');
    return lines.join('\n');
  }

  /**
   * Generate locator for an action
   */
  generateLocator(action, platform, existingPatterns) {
    const elementName = this.generateElementName(action.target, action.details);
    const strategy = this.locatorStrategies[platform] || this.locatorStrategies.android;

    // Generate platform-specific locators
    const locators = {};

    if (platform === 'ctv' || platform === 'android') {
      locators.android = this.generateAndroidLocator(elementName, strategy);
    }

    if (platform === 'mobile' || platform === 'ios') {
      locators.ios = this.generateIOSLocator(elementName);
    }

    if (platform === 'web' || platform === 'html5') {
      locators.web = this.generateWebLocator(elementName);
    }

    return {
      element: elementName,
      strategies: locators,
      primary: strategy.primary,
      generatedFrom: action
    };
  }

  /**
   * Generate Android locator
   */
  generateAndroidLocator(elementName, strategy) {
    const resourceId = `com.example.app:id/${elementName}`;
    return [
      `//android.widget.TextView[@resource-id="${resourceId}"]`,
      `//android.widget.Button[@resource-id="${resourceId}"]`,
      `//android.view.View[@content-desc="${elementName}"]`
    ];
  }

  /**
   * Generate iOS locator
   */
  generateIOSLocator(elementName) {
    return [
      `//XCUIElementTypeButton[@name="${elementName}"]`,
      `//XCUIElementTypeStaticText[@name="${elementName}"]`,
      `//XCUIElementTypeOther[@label="${elementName}"]`
    ];
  }

  /**
   * Generate Web locator
   */
  generateWebLocator(elementName) {
    return [
      `//*[@data-testid="${elementName}"]`,
      `//*[@id="${elementName}"]`,
      `//button[contains(text(), "${elementName}")]`
    ];
  }

  /**
   * Generate property file entry
   */
  generatePropertyEntry(action, locator, platform) {
    const elementName = locator.element;
    const screenPrefix = action.target?.includes('screen') ? '' : 'generic';

    const entries = [];

    // Generate entries for each platform
    if (locator.strategies.android) {
      entries.push({
        key: `${screenPrefix}.${elementName}.android`,
        value: locator.strategies.android[0],
        generated: true
      });
    }

    if (locator.strategies.ios) {
      entries.push({
        key: `${screenPrefix}.${elementName}.ios`,
        value: locator.strategies.ios[0],
        generated: true
      });
    }

    if (locator.strategies.web) {
      entries.push({
        key: `${screenPrefix}.${elementName}.web`,
        value: locator.strategies.web[0],
        generated: true
      });
    }

    return {
      file: `${screenPrefix || 'generic'}.properties`,
      entries,
      generatedFrom: action
    };
  }

  /**
   * Generate complete code snippets using AI
   */
  async generateWithAI(unmappedActions, context = {}) {
    if (!this.openRouterService?.isConfigured()) {
      logger.warn('OpenRouter not configured, using rule-based generation');
      return this.generateComponents(unmappedActions, context);
    }

    const { platform, targetScreen, existingCode } = context;

    const prompt = `Generate Java Page Object methods for these unmapped test actions.
Follow TestNG/Selenium patterns.

Platform: ${platform}
Screen: ${targetScreen}

Unmapped Actions:
${unmappedActions.map(a => `- ${a.action} ${a.target || ''} ${a.details || ''}`).join('\n')}

${existingCode ? `Existing code patterns from this screen:\n${existingCode}` : ''}

Generate:
1. Method declarations with JavaDoc
2. Method implementations
3. Suggested locators (XPath for ${platform})

Return as JSON:
{
  "methods": [{ "name": "...", "returnType": "...", "body": "...", "javadoc": "..." }],
  "locators": [{ "element": "...", "xpath": "..." }]
}`;

    try {
      const response = await this.openRouterService.query(prompt, {
        model: this.model,
        maxTokens: 2000,
        temperature: 0.3
      });

      return this.parseAIResponse(response, context);
    } catch (error) {
      logger.warn(`AI generation failed: ${error.message}, falling back to rules`);
      return this.generateComponents(unmappedActions, context);
    }
  }

  /**
   * Parse AI response
   */
  parseAIResponse(response, context) {
    try {
      const content = response.content || response;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          newMethods: parsed.methods || [],
          newLocators: parsed.locators || [],
          newProperties: [],
          source: 'ai',
          context
        };
      }
    } catch (error) {
      logger.warn(`Failed to parse AI response: ${error.message}`);
    }

    return { success: false, error: 'Failed to parse AI response' };
  }

  /**
   * Format generated methods as Java code
   */
  formatAsJavaCode(generatedComponents) {
    const { newMethods, newLocators } = generatedComponents;
    const lines = [];

    // Format each method
    for (const method of newMethods) {
      const m = method.method;

      // JavaDoc
      if (m.javadoc) {
        lines.push(m.javadoc);
      }

      // Method signature
      const params = m.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
      lines.push(`public ${m.returnType} ${m.name}(${params}) {`);
      lines.push(`    ${m.body}`);
      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format generated properties
   */
  formatAsProperties(generatedComponents) {
    const { newProperties } = generatedComponents;
    const lines = ['# Generated by ComponentGeneratorAgent', ''];

    for (const prop of newProperties) {
      lines.push(`# ${prop.file}`);
      for (const entry of prop.entries) {
        lines.push(`${entry.key}=${entry.value}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get agent statistics
   */
  getStats() {
    return {
      agent: 'ComponentGeneratorAgent',
      version: '1.0.0',
      actionPatterns: Object.keys(this.actionPatterns),
      supportedPlatforms: Object.keys(this.locatorStrategies)
    };
  }
}

// Export singleton instance
export const componentGeneratorAgent = new ComponentGeneratorAgent();
export default componentGeneratorAgent;
