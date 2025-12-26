/**
 * Intelligent Method Selector Service
 *
 * Uses LLM to intelligently select the best method(s) from semantic search candidates.
 * This is the "intelligence layer" - instead of picking by distance score,
 * the LLM reasons about which method(s) actually match the test scenario intent.
 *
 * Key Capabilities:
 * 1. Takes ALL candidates from semantic search
 * 2. LLM selects best match based on scenario context + method signatures
 * 3. Understands framework patterns (e.g., scroll→select for CTV)
 * 4. If no match exists, generates new method with element locator
 */

import { getOpenRouterService } from './openrouterService.js';
import { hybridRAGService } from './hybridRAGService.js';
import { actionKnowledgeBaseService } from './actionKnowledgeBaseService.js';
import { logger } from '../utils/logger.js';

class IntelligentMethodSelector {
  constructor() {
    this.openRouterService = null;
    this.isInitialized = false;
    // Use a smarter model for intelligent selection - requires better reasoning
    this.selectionModel = 'anthropic/claude-sonnet-4';
  }

  async initialize() {
    this.openRouterService = getOpenRouterService();

    if (!this.openRouterService?.isConfigured()) {
      logger.warn('IntelligentMethodSelector: OpenRouter not configured');
      return false;
    }

    this.isInitialized = true;
    logger.info(`IntelligentMethodSelector initialized, using model: ${this.selectionModel} for intelligent selection`);
    return true;
  }

  /**
   * Intelligently select the best method(s) for a test step
   *
   * @param {Object} step - The decomposed test step {action, target, details}
   * @param {Array} candidates - All candidates from semantic search
   * @param {Object} context - Platform, scenario context
   * @returns {Object} Selection result with method(s) or new method definition
   */
  async selectBestMethod(step, candidates, context = {}) {
    const { action, target, details } = step;
    const { platform, fullScenario } = context;

    // Store current step and context for use in parsing
    this.currentStep = step;
    this.currentContext = context;

    logger.info(`[IntelligentSelector] Selecting for: "${action} ${target || ''}" from ${candidates?.length || 0} candidates`);

    // If no candidates, go straight to method creation
    if (!candidates || candidates.length === 0) {
      logger.info('[IntelligentSelector] No candidates - will create new method');
      return this.createNewMethod(step, context);
    }

    // Build the selection prompt
    const prompt = this.buildSelectionPrompt(step, candidates, context);

    try {
      const response = await this.openRouterService.chat({
        systemPrompt: this.getSystemPrompt(platform),
        userPrompt: prompt,
        temperature: 0.1,
        maxTokens: 800,
        model: this.selectionModel
      });

      if (!response?.content) {
        logger.warn('[IntelligentSelector] Empty LLM response');
        return { found: false, reason: 'Empty LLM response' };
      }

      // Parse the LLM's selection
      const selection = this.parseSelectionResponse(response.content, candidates);

      if (selection.found) {
        logger.info(`[IntelligentSelector] Selected: ${selection.methodName} (confidence: ${selection.confidence})`);

        // Learn this mapping for future use
        await this.learnMapping(step, selection, context);

        return selection;
      }

      // LLM said no match - return as missing (don't auto-create)
      // Let the user/system add the action to KB
      if (selection.needsNewMethod) {
        logger.info('[IntelligentSelector] LLM determined no match - marking as MISSING');
        return {
          found: false,
          createNew: true,
          suggestedMethod: this.generateMethodName(step.action, step.target),
          reasoning: selection.reasoning || 'No suitable method found in candidates'
        };
      }

      return { found: false, reason: selection.reason };

    } catch (error) {
      logger.error(`[IntelligentSelector] Selection failed: ${error.message}`);
      return { found: false, reason: error.message };
    }
  }

  /**
   * Get system prompt based on platform
   */
  getSystemPrompt(platform) {
    const basePrompt = `You are an expert test automation engineer. Your task is to select the BEST method(s) from candidates to implement a test step.

CRITICAL SELECTION RULES:
1. ONLY select methods that ACTUALLY match the test step intent
2. If a good match exists, use SELECT and specify the method(s)
3. If NONE of the candidates match the required action, you MUST use CREATE_NEW
4. PREFER specific screen methods over generic ones (baseScreen)
5. If multiple methods are needed, list ALL in execution order

WHEN TO USE CREATE_NEW (very important):
- The action requires functionality that NO candidate provides
- Example: "toggle picture-in-picture" but no PIP methods → CREATE_NEW
- Example: "download episode" but no download methods → CREATE_NEW
- Example: "verify timestamp is 00:00" but only generic verify methods → CREATE_NEW
- DO NOT force-select a generic method when specific functionality is needed

RESPONSE FORMAT (JSON only):
{
  "decision": "SELECT" | "CREATE_NEW",
  "selectedMethods": [
    {
      "methodName": "exactMethodName",
      "className": "ClassName",
      "reason": "why this method"
    }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    // Add platform-specific patterns
    if (platform === 'ctv' || platform === 'CTV') {
      return basePrompt + `

CTV/REMOTE CONTROL FRAMEWORK PATTERNS:

1. FOCUS-BASED INTERACTION:
   - CTV uses remote control navigation (no touch/click)
   - To interact with UI elements: first FOCUS (scroll/navigate to it), then SELECT (press OK)
   - Pattern: scrollTo*() or focus*() → then baseUnifiedScreen().select() or pressOK()
   - Any "click", "press", "tap" action needs this two-step pattern

2. SCREEN NAVIGATION:
   - To go back to previous screen: use existing back() methods (back(), backFromPlayer(), etc.)
   - Don't create new navigate*() methods when back() works

3. SCREEN-SPECIFIC METHODS:
   - Player operations (play, pause, seek, verify time): use PlayerScreen methods
   - Episode/Show selection: use ContainerScreen methods
   - Home browsing: use HomeScreen methods
   - Prefer the screen-specific method over baseScreen when available

4. VERIFICATION METHODS:
   - Use the screen where the verification happens
   - Video/playback verification → PlayerScreen (getCurrentVideoTimeText, verifyVideoIsPlaying)
   - UI element verification → the screen containing that element

5. COMPOSITE ACTIONS (multiple methods for one test step):
   - If action needs focus then select: return BOTH methods in order
   - If action needs navigation then verification: return BOTH methods in order

6. CROSS-SCREEN ACTIONS (CRITICAL):
   - Check the SCREEN CONTEXT to know which screen you're currently on
   - If the action target is on a DIFFERENT screen than current, you MUST navigate first
   - Example: Currently on PlayerScreen but need to click restart button (on ContainerScreen)
     → MUST select composite with backFromPlayer() step first, then scroll/click
   - Prefer composite actions that include navigation when screen context differs from target screen
   - Navigation Path: home → container → player, so going backward requires back() methods`;
    }

    return basePrompt;
  }

  /**
   * Build the selection prompt with candidates
   */
  buildSelectionPrompt(step, candidates, context) {
    const { action, target, details } = step;
    const { fullScenario, platform, screenContext, preferredScreenClass, currentScreen } = context;

    // Build screen context info if available
    let screenContextInfo = '';
    if (screenContext || currentScreen || preferredScreenClass) {
      const parts = [];
      if (currentScreen?.currentScreen) {
        parts.push(`Current Screen: ${currentScreen.currentScreen}`);
      }
      if (currentScreen?.path?.length > 0) {
        parts.push(`Navigation Path: ${currentScreen.path.join(' → ')}`);
      }
      if (screenContext?.isBackNavigation) {
        parts.push('NAVIGATION DIRECTION: BACKWARD (prefer back() methods)');
      }
      if (preferredScreenClass) {
        parts.push(`Preferred Class: ${preferredScreenClass}`);
      }
      if (parts.length > 0) {
        screenContextInfo = `\n\nSCREEN CONTEXT:\n${parts.join('\n')}`;
      }
    }

    // Format candidates with relevant info
    const candidateList = candidates.slice(0, 15).map((c, i) => {
      // Handle composite actions specially
      if (c.isComposite && c.compositeSteps) {
        const stepsStr = c.compositeSteps.map((s, j) =>
          `      Step ${j + 1}: ${s.className}.${s.methodName}() ${s.description ? `- ${s.description}` : ''}`
        ).join('\n');
        return `${i + 1}. [COMPOSITE] ${c.methodName}
   Class: ${c.className}
   Description: ${c.description || 'Composite action with multiple steps'}
   Steps:\n${stepsStr}
   Score: ${((c.confidence || 0.85) * 100).toFixed(0)}%`;
      }

      // Safely handle parameters (might be array, string, or undefined)
      let paramsStr = '';
      if (Array.isArray(c.parameters) && c.parameters.length > 0) {
        paramsStr = `   Params: ${c.parameters.join(', ')}`;
      } else if (typeof c.parameters === 'string' && c.parameters) {
        paramsStr = `   Params: ${c.parameters}`;
      }

      const parts = [
        `${i + 1}. ${c.methodName}`,
        c.className ? `   Class: ${c.className}` : '',
        paramsStr,
        c.javadoc ? `   Doc: ${c.javadoc.substring(0, 100)}` : '',
        c.confidence ? `   Score: ${(c.confidence * 100).toFixed(0)}%` : ''
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n');

    return `TEST STEP TO IMPLEMENT:
Action: ${action}
Target: ${target || 'none'}
Details: ${details || 'none'}
${fullScenario ? `Full Scenario: ${fullScenario}` : ''}
Platform: ${platform || 'unknown'}${screenContextInfo}

CANDIDATE METHODS FROM CODEBASE:
${candidateList}

IMPORTANT:
- If a [COMPOSITE] action matches your needs, prefer it over individual methods - it contains the correct sequence of steps.
- Consider the SCREEN CONTEXT above when selecting methods - prefer methods from the current/preferred screen class.
- For BACKWARD navigation, prefer back()/backFromPlayer() methods over navigate*() methods.

Select the best method(s) to implement this test step. If none are suitable, respond with CREATE_NEW.`;
  }

  /**
   * Parse the LLM's selection response
   */
  parseSelectionResponse(content, candidates) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr.trim());

      if (parsed.decision === 'CREATE_NEW') {
        return {
          found: false,
          needsNewMethod: true,
          reasoning: parsed.reasoning
        };
      }

      if (parsed.decision === 'SELECT' && parsed.selectedMethods?.length > 0) {
        const selected = parsed.selectedMethods[0];

        // Verify the method exists in candidates
        let matchedCandidate = candidates.find(
          c => c.methodName.toLowerCase() === selected.methodName.toLowerCase()
        );

        if (matchedCandidate) {
          // Log candidate structure for debugging composite action issues
          logger.info(`[IntelligentSelector] Matched candidate: ${matchedCandidate.methodName}, isComposite: ${matchedCandidate.isComposite}, hasSteps: ${!!matchedCandidate.compositeSteps}, stepsCount: ${matchedCandidate.compositeSteps?.length || 0}`);

          // IMPORTANT: If the methodName looks like a composite action name (snake_case with underscores),
          // check if there's a REAL composite action with that name and use it instead
          // This handles cases where an atomic action was incorrectly learned with a composite action's name
          if (!matchedCandidate.isComposite && matchedCandidate.methodName.includes('_')) {
            // Look for composite action candidate with the same name
            const compositeCandidate = candidates.find(
              c => c.isComposite && c.methodName.toLowerCase() === matchedCandidate.methodName.toLowerCase()
            );
            if (compositeCandidate) {
              logger.info(`[IntelligentSelector] Found composite version of ${matchedCandidate.methodName} - using composite instead`);
              matchedCandidate = compositeCandidate;
            }
          }

          // If the matched candidate is a composite action, return it with all its steps
          if (matchedCandidate.isComposite && matchedCandidate.compositeSteps) {
            logger.info(`[IntelligentSelector] Selected COMPOSITE action: ${matchedCandidate.methodName} with ${matchedCandidate.compositeSteps.length} steps`);
            return {
              found: true,
              methodName: matchedCandidate.methodName,
              className: matchedCandidate.className,
              isComposite: true,
              compositeSteps: matchedCandidate.compositeSteps,
              confidence: parsed.confidence || 0.9,
              reasoning: parsed.reasoning,
              source: 'intelligent_selection_composite'
            };
          }

          const result = {
            found: true,
            methodName: matchedCandidate.methodName,
            className: matchedCandidate.className,
            file: matchedCandidate.file,
            parameters: matchedCandidate.parameters,
            confidence: parsed.confidence || 0.85,
            reasoning: parsed.reasoning,
            isComposite: parsed.selectedMethods.length > 1,
            source: 'intelligent_selection'
          };

          // If LLM selected multiple methods, include them as composite steps
          if (parsed.selectedMethods.length > 1) {
            result.compositeSteps = parsed.selectedMethods.map(m => {
              const candidate = candidates.find(c => c.methodName.toLowerCase() === m.methodName.toLowerCase());
              return {
                methodName: m.methodName,
                className: candidate?.className || m.className || 'BaseScreen',
                reason: m.reason
              };
            });
            result.isComposite = true;
            logger.info(`[IntelligentSelector] Composite action: ${result.compositeSteps.map(s => s.methodName).join(' -> ')}`);
          }

          return result;
        }

        // Method not found in candidates - LLM hallucinated
        logger.warn(`[IntelligentSelector] LLM selected "${selected.methodName}" but not in candidates`);
        return {
          found: false,
          needsNewMethod: true,
          reasoning: `Suggested method "${selected.methodName}" not found in codebase`
        };
      }

      return { found: false, reason: 'Invalid LLM response format' };

    } catch (error) {
      logger.warn(`[IntelligentSelector] Failed to parse response: ${error.message}`);
      logger.debug(`Response was: ${content}`);

      // Try simple extraction as fallback
      return this.simpleParse(content, candidates);
    }
  }

  /**
   * Simple fallback parser for non-JSON responses
   */
  simpleParse(content, candidates) {
    const contentLower = content.toLowerCase();

    // Check for CREATE_NEW indicator
    if (contentLower.includes('create_new') || contentLower.includes('no suitable') ||
        contentLower.includes('none of') || contentLower.includes('no match')) {
      return { found: false, needsNewMethod: true };
    }

    // Try to find a method name mentioned in the response
    for (const candidate of candidates) {
      if (content.includes(candidate.methodName)) {
        return {
          found: true,
          methodName: candidate.methodName,
          className: candidate.className,
          file: candidate.file,
          parameters: candidate.parameters,
          confidence: 0.7,
          source: 'intelligent_selection_fallback'
        };
      }
    }

    return { found: false, reason: 'Could not parse LLM response' };
  }

  /**
   * Create a new method definition when none exists
   */
  async createNewMethod(step, context) {
    const { action, target, details } = step;
    const { platform } = context;

    logger.info(`[IntelligentSelector] Creating new method for: ${action} ${target}`);

    // Determine the appropriate page/screen class
    const screenClass = this.inferScreenClass(target, platform);

    // Generate method name following codebase conventions
    const methodName = this.generateMethodName(action, target);

    // Generate element locator suggestion
    const locatorSuggestion = this.generateLocatorSuggestion(target, platform);

    const prompt = `Generate a test automation method for:
Action: ${action}
Target: ${target || 'element'}
Details: ${details || 'none'}
Platform: ${platform || 'generic'}

The method should be added to: ${screenClass}

Respond with JSON:
{
  "methodName": "suggestedMethodName",
  "className": "${screenClass}",
  "methodSignature": "public void methodName()",
  "implementation": "// method body",
  "elementLocator": {
    "name": "elementName",
    "locatorType": "xpath|id|accessibilityId",
    "locatorValue": "the_locator"
  },
  "reasoning": "why this implementation"
}`;

    try {
      const response = await this.openRouterService.chat({
        systemPrompt: `You are a test automation expert. Generate clean, maintainable method definitions.
Follow naming conventions: camelCase for methods, UPPER_SNAKE for constants.
For CTV apps, use scroll patterns for focus before select.`,
        userPrompt: prompt,
        temperature: 0.2,
        maxTokens: 600,
        model: this.selectionModel
      });

      if (!response?.content) {
        return this.fallbackNewMethod(step, screenClass, methodName, locatorSuggestion);
      }

      const newMethod = this.parseNewMethodResponse(response.content, screenClass);

      if (newMethod) {
        // Store this new method for future use
        await this.storeNewMethod(newMethod, step, context);

        return {
          found: true,
          isNewMethod: true,
          methodName: newMethod.methodName,
          className: newMethod.className,
          methodSignature: newMethod.methodSignature,
          implementation: newMethod.implementation,
          elementLocator: newMethod.elementLocator,
          confidence: 0.9,
          source: 'generated_new',
          reasoning: newMethod.reasoning
        };
      }

      return this.fallbackNewMethod(step, screenClass, methodName, locatorSuggestion);

    } catch (error) {
      logger.error(`[IntelligentSelector] Method generation failed: ${error.message}`);
      return this.fallbackNewMethod(step, screenClass, methodName, locatorSuggestion);
    }
  }

  /**
   * Fallback method generation without LLM
   */
  fallbackNewMethod(step, screenClass, methodName, locatorSuggestion) {
    return {
      found: true,
      isNewMethod: true,
      methodName: methodName,
      className: screenClass,
      methodSignature: `public void ${methodName}()`,
      implementation: `// TODO: Implement ${step.action} for ${step.target || 'element'}`,
      elementLocator: locatorSuggestion,
      confidence: 0.6,
      source: 'generated_fallback',
      requiresManualImplementation: true
    };
  }

  /**
   * Parse new method response from LLM
   */
  parseNewMethodResponse(content, defaultClass) {
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr.trim());

      return {
        methodName: parsed.methodName,
        className: parsed.className || defaultClass,
        methodSignature: parsed.methodSignature,
        implementation: parsed.implementation,
        elementLocator: parsed.elementLocator,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      logger.debug(`Failed to parse new method response: ${error.message}`);
      return null;
    }
  }

  /**
   * Infer the screen/page class based on target
   */
  inferScreenClass(target, platform) {
    const targetLower = (target || '').toLowerCase();

    // CTV-specific screens
    if (platform === 'ctv' || platform === 'CTV') {
      if (targetLower.includes('player') || targetLower.includes('video')) return 'PlayerScreen';
      if (targetLower.includes('home') || targetLower.includes('landing')) return 'HomeScreen';
      if (targetLower.includes('search')) return 'SearchScreen';
      if (targetLower.includes('settings') || targetLower.includes('preference')) return 'SettingsScreen';
      if (targetLower.includes('profile')) return 'ProfileScreen';
      if (targetLower.includes('container') || targetLower.includes('details')) return 'ContainerScreen';
      if (targetLower.includes('episode') || targetLower.includes('show')) return 'ContentScreen';
      return 'BaseScreen';
    }

    // Web-specific pages
    if (targetLower.includes('login') || targetLower.includes('auth')) return 'LoginPage';
    if (targetLower.includes('home')) return 'HomePage';
    if (targetLower.includes('search')) return 'SearchPage';
    if (targetLower.includes('cart') || targetLower.includes('checkout')) return 'CartPage';
    if (targetLower.includes('product') || targetLower.includes('detail')) return 'ProductPage';

    return 'BasePage';
  }

  /**
   * Generate method name following conventions
   */
  generateMethodName(action, target) {
    const actionMap = {
      'click': 'click',
      'tap': 'tap',
      'verify': 'verify',
      'check': 'check',
      'assert': 'assert',
      'navigate': 'navigateTo',
      'go': 'navigateTo',
      'open': 'open',
      'enter': 'enter',
      'type': 'type',
      'select': 'select',
      'scroll': 'scrollTo',
      'wait': 'waitFor',
      'search': 'searchFor'
    };

    const actionLower = (action || '').toLowerCase();
    const prefix = actionMap[actionLower] || actionLower;

    const targetCamel = (target || 'Element')
      .split(/[\s_-]+/)
      .map((word, i) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    return prefix + targetCamel;
  }

  /**
   * Generate locator suggestion based on target
   */
  generateLocatorSuggestion(target, platform) {
    const targetLower = (target || '').toLowerCase().replace(/\s+/g, '_');

    if (platform === 'ctv' || platform === 'CTV') {
      return {
        name: targetLower.toUpperCase(),
        locatorType: 'accessibilityId',
        locatorValue: targetLower,
        note: 'Verify with actual app accessibility inspector'
      };
    }

    return {
      name: targetLower.toUpperCase(),
      locatorType: 'xpath',
      locatorValue: `//*[@data-testid="${targetLower}"]`,
      note: 'Update with actual element locator'
    };
  }

  /**
   * Learn this mapping for future use
   * NOTE: Only learn actual Java methods, NOT composite action names
   */
  async learnMapping(step, selection, context) {
    try {
      if (!actionKnowledgeBaseService?.isInitialized) {
        return;
      }

      // DON'T learn composite actions - they have their own storage
      if (selection.isComposite || selection.source === 'intelligent_selection_composite') {
        logger.debug(`[IntelligentSelector] Skipping learning for composite action: ${selection.methodName}`);
        return;
      }

      // Validate methodName looks like a real Java method (camelCase, not snake_case)
      const methodName = selection.methodName;
      if (!methodName || methodName.includes('_')) {
        logger.debug(`[IntelligentSelector] Skipping learning for non-method name: ${methodName}`);
        return;
      }

      // Method names should start with lowercase and be camelCase
      if (!/^[a-z][a-zA-Z0-9]*$/.test(methodName)) {
        logger.debug(`[IntelligentSelector] Skipping learning for invalid method name format: ${methodName}`);
        return;
      }

      const patternKey = `${step.action}_${step.target || ''}`.toLowerCase().replace(/\s+/g, '_');

      await actionKnowledgeBaseService.addAtomicAction({
        id: `intelligent_${patternKey}_${Date.now()}`,
        actionName: patternKey,
        methodName: selection.methodName,
        className: selection.className,
        file: selection.file,
        targetScreen: step.target,
        platform: context.platform,
        keywords: [step.action, step.target, selection.methodName].filter(Boolean),
        source: 'intelligent_selection',
        confidence: selection.confidence
      });

      logger.info(`[IntelligentSelector] Learned: ${step.action} ${step.target} -> ${selection.methodName}`);
    } catch (error) {
      logger.warn(`Failed to store learned mapping: ${error.message}`);
    }
  }

  /**
   * Store newly generated method for future use
   */
  async storeNewMethod(newMethod, step, context) {
    try {
      if (!actionKnowledgeBaseService?.isInitialized) {
        return;
      }

      const patternKey = `${step.action}_${step.target || ''}`.toLowerCase().replace(/\s+/g, '_');

      await actionKnowledgeBaseService.addAtomicAction({
        id: `generated_${patternKey}_${Date.now()}`,
        actionName: patternKey,
        methodName: newMethod.methodName,
        className: newMethod.className,
        targetScreen: step.target,
        platform: context.platform,
        keywords: [step.action, step.target, newMethod.methodName].filter(Boolean),
        source: 'generated_new',
        isNewMethod: true,
        implementation: newMethod.implementation,
        elementLocator: newMethod.elementLocator,
        confidence: 0.9
      });

      logger.info(`[IntelligentSelector] Stored new method: ${newMethod.methodName}`);
    } catch (error) {
      logger.warn(`Failed to store new method: ${error.message}`);
    }
  }

  /**
   * Get all candidates from multiple search sources
   */
  async gatherCandidates(step, context) {
    const { action, target, details } = step;
    const query = [action, target, details].filter(Boolean).join(' ');
    const candidates = [];
    const seen = new Set();

    // 1. Query Hybrid RAG for methods
    try {
      if (hybridRAGService?.isInitialized) {
        const ragResults = await hybridRAGService.queryMethods(query, {
          topK: 15,
          minConfidence: 0.05
        });

        for (const result of ragResults) {
          if (!seen.has(result.methodName)) {
            seen.add(result.methodName);
            candidates.push({
              ...result,
              source: 'hybrid_rag',
              confidence: result.confidence || result.score || 0.5
            });
          }
        }
      }
    } catch (error) {
      logger.debug(`RAG query failed: ${error.message}`);
    }

    // 2. Query Knowledge Base for atomic actions
    try {
      if (actionKnowledgeBaseService?.isInitialized) {
        const kbResult = await actionKnowledgeBaseService.findAtomicAction(query, {}, 15);

        if (kbResult.results) {
          for (const result of kbResult.results) {
            if (!seen.has(result.methodName)) {
              seen.add(result.methodName);
              candidates.push({
                ...result,
                source: 'knowledge_base',
                confidence: result.confidence || 0.5
              });
            }
          }
        }
      }
    } catch (error) {
      logger.debug(`KB query failed: ${error.message}`);
    }

    // Sort by confidence
    candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    logger.info(`[IntelligentSelector] Gathered ${candidates.length} candidates for: "${query}"`);
    return candidates;
  }
}

// Export singleton
export const intelligentMethodSelector = new IntelligentMethodSelector();
export default intelligentMethodSelector;
