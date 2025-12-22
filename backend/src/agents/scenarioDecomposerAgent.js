/**
 * Scenario Decomposer Agent
 *
 * Part of the Multi-Agent Test Generation Pipeline (Agent 1)
 *
 * Purpose: Break down complex test scenarios into atomic, sequential steps.
 *
 * Features:
 * - Parses natural language test descriptions
 * - Identifies implicit prerequisites (login, navigation)
 * - Detects test type (functional, smoke, regression, e2e)
 * - Identifies primary screen for the test
 *
 * @see /docs/architecture/multi-agent-test-generation-architecture.md
 */

import { logger } from '../utils/logger.js';
import { getOpenRouterService } from '../services/openrouterService.js';
import { actionKnowledgeBaseService } from '../services/actionKnowledgeBaseService.js';

class ScenarioDecomposerAgent {
  constructor() {
    this.openRouterService = null;
    this.model = 'google/gemini-2.0-flash-001';

    // Standard action verbs recognized by the system
    this.standardActions = [
      'login', 'logout', 'navigate', 'verify', 'select', 'click',
      'wait', 'enter', 'scroll', 'swipe', 'play', 'pause', 'stop',
      'search', 'filter', 'open', 'close', 'dismiss', 'confirm',
      'skip', 'watch', 'download', 'upload', 'refresh', 'back'
    ];

    // Prerequisites that should be added if missing
    this.implicitPrerequisites = {
      requiresLogin: ['play', 'watch', 'download', 'my_list', 'profile', 'settings', 'account'],
      requiresNavigation: ['verify', 'select', 'click', 'scroll', 'enter']
    };

    // Test type detection keywords
    this.testTypeKeywords = {
      smoke: ['basic', 'sanity', 'quick', 'critical path', 'main flow'],
      regression: ['after update', 'still works', 'unchanged', 'backward compatible'],
      e2e: ['end to end', 'full flow', 'complete journey', 'from start to finish'],
      functional: [] // Default if no other match
    };

    this.systemPrompt = `You are a test scenario decomposition expert for mobile and CTV app testing.

Your job is to break down high-level test scenarios into atomic, sequential steps.

RULES:
1. Each step should represent ONE action only
2. Include implicit prerequisites (login, navigation to screen)
3. Identify the target element/screen for each action
4. Use standard action verbs: ${this.standardActions.join(', ')}
5. Add verification steps after important actions
6. Consider the platform context (mobile, CTV, web)

OUTPUT FORMAT (JSON only, no markdown):
{
  "steps": [
    { "id": 1, "action": "string", "target": "string", "details": "string or null", "isPrerequisite": boolean }
  ],
  "test_type": "functional|smoke|regression|e2e",
  "primary_screen": "string",
  "requires_login": boolean,
  "estimated_duration_seconds": number,
  "platforms": ["ctv", "mobile", "web"]
}

EXAMPLE INPUT: "Verify user can play a movie and see progress bar"

EXAMPLE OUTPUT:
{
  "steps": [
    { "id": 1, "action": "login", "target": "application", "details": "with valid credentials", "isPrerequisite": true },
    { "id": 2, "action": "navigate", "target": "home_screen", "details": null, "isPrerequisite": true },
    { "id": 3, "action": "verify", "target": "home_screen", "details": "is displayed", "isPrerequisite": false },
    { "id": 4, "action": "select", "target": "movie", "details": "any available movie", "isPrerequisite": false },
    { "id": 5, "action": "click", "target": "play_button", "details": null, "isPrerequisite": false },
    { "id": 6, "action": "verify", "target": "player_screen", "details": "video is playing", "isPrerequisite": false },
    { "id": 7, "action": "verify", "target": "progress_bar", "details": "is visible and updating", "isPrerequisite": false }
  ],
  "test_type": "functional",
  "primary_screen": "player",
  "requires_login": true,
  "estimated_duration_seconds": 45,
  "platforms": ["ctv", "mobile"]
}`;
  }

  /**
   * Initialize the agent with AI service
   */
  async initialize() {
    this.openRouterService = getOpenRouterService();
    if (!this.openRouterService?.isConfigured()) {
      logger.warn('ScenarioDecomposerAgent: OpenRouter not configured, will use rule-based decomposition');
    }
    return this;
  }

  /**
   * Main entry point: Decompose a test scenario into atomic steps
   *
   * Execution order (cost-optimized):
   * 1. Try rule-based decomposition (enhanced with learned patterns) - FREE
   * 2. Use AI only if rules not confident - COSTS TOKENS (patterns are learned for future)
   *
   * @param {string} scenario - Natural language test scenario
   * @param {Object} options - Optional configuration
   * @param {string} options.platform - Target platform (ctv, mobile, web)
   * @param {string} options.brand - Target brand (pplus, plutotv)
   * @param {boolean} options.includeLogin - Force include login step
   * @param {boolean} options.forceAI - Force AI decomposition even if rules are confident
   * @param {number} options.confidenceThreshold - Minimum confidence for rules (default: 0.7)
   * @returns {Object} Decomposed steps with metadata
   */
  async decompose(scenario, options = {}) {
    const {
      platform = null,
      brand = null,
      includeLogin = null,
      forceAI = false,
      confidenceThreshold = 0.7
    } = options;

    logger.info(`Decomposing scenario: "${scenario.substring(0, 50)}..."`);

    try {
      // STEP 1: Try rule-based decomposition (now enhanced with learned patterns - FREE)
      const ruleResult = await this.decomposeWithRules(scenario, options);
      const confidence = this.calculateConfidence(ruleResult, scenario);

      // Check how many steps came from learned patterns
      const learnedSteps = ruleResult.steps.filter(s => s.source === 'learned_pattern').length;
      const totalSteps = ruleResult.steps.filter(s => !s.isPrerequisite).length;

      logger.debug(`Rule-based confidence: ${confidence.toFixed(2)}, learned patterns: ${learnedSteps}/${totalSteps}`);

      // If rules are confident enough, use them (save AI tokens)
      if (!forceAI && confidence >= confidenceThreshold) {
        logger.info(`Using rule-based result (confidence: ${confidence.toFixed(2)}, ${learnedSteps} learned patterns)`);
        return this.postProcess({
          ...ruleResult,
          decomposition_method: learnedSteps > 0 ? 'rules_with_learning' : 'rules',
          confidence,
          learned_patterns_used: learnedSteps
        }, options);
      }

      // STEP 2: Rules not confident enough - try AI if available (COSTS TOKENS)
      if (this.openRouterService?.isConfigured()) {
        logger.info(`Rule confidence ${confidence.toFixed(2)} < ${confidenceThreshold}, using AI`);
        const aiResult = await this.decomposeWithAI(scenario, options);

        if (aiResult.success) {
          const result = this.postProcess({
            ...aiResult.result,
            decomposition_method: 'ai',
            rule_confidence: confidence
          }, options);

          // STEP 3: Learn patterns from AI for future rule-based use (PERMANENT)
          await this.learnFromAIResult(result, options);

          return result;
        }
        logger.warn('AI decomposition failed, using rule-based result');
      }

      // STEP 4: Fallback to rule-based result (even with low confidence)
      return this.postProcess({
        ...ruleResult,
        decomposition_method: 'rules_fallback',
        confidence,
        ai_attempted: this.openRouterService?.isConfigured() || false
      }, options);

    } catch (error) {
      logger.error(`Scenario decomposition failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        scenario
      };
    }
  }

  /**
   * Learn action patterns from AI result for future rule-based use
   * Each step becomes a permanent pattern that enriches the rule engine
   */
  async learnFromAIResult(result, options) {
    try {
      if (!result.steps || result.steps.length === 0) {
        return;
      }

      const learned = await actionKnowledgeBaseService.learnActionPatterns(
        result.steps,
        {
          platform: options.platform,
          brand: options.brand,
          primaryScreen: result.primary_screen
        }
      );

      if (learned.success && learned.learned.length > 0) {
        logger.info(`Learned ${learned.learned.length} patterns from AI for future use`);
      }
    } catch (error) {
      // Non-critical - log but don't fail the request
      logger.warn(`Could not learn patterns from AI: ${error.message}`);
    }
  }

  /**
   * Calculate confidence score for rule-based decomposition
   * Higher = more confident in the rule-based result
   */
  calculateConfidence(result, scenario) {
    let confidence = 0;
    const scenarioLower = scenario.toLowerCase();

    // Factor 1: Did we extract meaningful steps? (0-0.3)
    const nonPrereqSteps = result.steps.filter(s => !s.isPrerequisite);
    if (nonPrereqSteps.length >= 1) confidence += 0.1;
    if (nonPrereqSteps.length >= 2) confidence += 0.1;
    if (nonPrereqSteps.length >= 3) confidence += 0.1;

    // Factor 2: Did we identify primary screen? (0-0.2)
    if (result.primary_screen && result.primary_screen !== 'unknown') {
      confidence += 0.2;
    }

    // Factor 3: Do action verbs match standard actions? (0-0.2)
    const matchedActions = result.steps.filter(s =>
      this.standardActions.includes(s.action)
    );
    confidence += (matchedActions.length / Math.max(result.steps.length, 1)) * 0.2;

    // Factor 4: Scenario length/complexity penalty (0-0.15)
    // Short, clear scenarios are easier for rules
    const wordCount = scenario.split(/\s+/).length;
    if (wordCount <= 10) confidence += 0.15;
    else if (wordCount <= 20) confidence += 0.1;
    else if (wordCount <= 30) confidence += 0.05;

    // Factor 5: Contains explicit action keywords (0-0.15)
    const explicitKeywords = ['click', 'tap', 'verify', 'navigate', 'open', 'play', 'search', 'enter'];
    const keywordMatches = explicitKeywords.filter(kw => scenarioLower.includes(kw));
    confidence += Math.min(keywordMatches.length * 0.05, 0.15);

    return Math.min(confidence, 1.0);
  }

  /**
   * AI-based decomposition using LLM
   */
  async decomposeWithAI(scenario, options) {
    const { platform, brand } = options;

    // Add context to the prompt if platform/brand specified
    let contextPrompt = '';
    if (platform) contextPrompt += `\nTarget platform: ${platform}`;
    if (brand) contextPrompt += `\nBrand: ${brand}`;

    try {
      const response = await this.openRouterService.chat({
        systemPrompt: this.systemPrompt + contextPrompt,
        userPrompt: scenario,
        temperature: 0.3,
        maxTokens: 2000
      });

      // chat() returns { content: string } or null
      if (!response || !response.content) {
        return { success: false, error: 'Empty AI response' };
      }

      // Parse JSON from response (handle markdown code blocks)
      let jsonContent = response.content;
      if (jsonContent.includes('```')) {
        jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      const parsed = JSON.parse(jsonContent.trim());
      return { success: true, result: parsed };

    } catch (error) {
      logger.error(`AI decomposition error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rule-based decomposition (enhanced with learned patterns)
   */
  async decomposeWithRules(scenario, options) {
    const scenarioLower = scenario.toLowerCase();
    const steps = [];
    let stepId = 1;

    // Detect test type
    const testType = this.detectTestType(scenarioLower);

    // Detect if login is needed
    const requiresLogin = this.detectLoginRequirement(scenarioLower);

    // Detect primary screen
    const primaryScreen = this.detectPrimaryScreen(scenarioLower);

    // Add prerequisites
    if (requiresLogin) {
      steps.push({
        id: stepId++,
        action: 'login',
        target: 'application',
        details: 'with valid credentials',
        isPrerequisite: true
      });
    }

    // Add navigation if a specific screen is mentioned
    if (primaryScreen && primaryScreen !== 'home') {
      steps.push({
        id: stepId++,
        action: 'navigate',
        target: 'home_screen',
        details: null,
        isPrerequisite: true
      });
      steps.push({
        id: stepId++,
        action: 'navigate',
        target: `${primaryScreen}_screen`,
        details: null,
        isPrerequisite: true
      });
    }

    // Parse action keywords from scenario
    // First try learned patterns, then fall back to regex
    const actionMatches = await this.extractActionsWithLearning(scenarioLower, options);
    for (const match of actionMatches) {
      steps.push({
        id: stepId++,
        action: match.action,
        target: match.target || primaryScreen || 'screen',
        details: match.details || null,
        isPrerequisite: false,
        source: match.source || 'regex'  // Track where the match came from
      });
    }

    // Add verification step if "verify" or "check" is in scenario
    if (scenarioLower.includes('verify') || scenarioLower.includes('check') ||
        scenarioLower.includes('ensure') || scenarioLower.includes('confirm')) {
      const verifyTarget = this.extractVerificationTarget(scenarioLower);
      if (!steps.some(s => s.action === 'verify' && s.target === verifyTarget)) {
        steps.push({
          id: stepId++,
          action: 'verify',
          target: verifyTarget,
          details: 'is displayed correctly',
          isPrerequisite: false
        });
      }
    }

    return {
      steps,
      test_type: testType,
      primary_screen: primaryScreen || 'unknown',
      requires_login: requiresLogin,
      estimated_duration_seconds: steps.length * 5,
      platforms: this.detectPlatforms(scenarioLower)
    };
  }

  /**
   * Extract actions using learned patterns first, then regex fallback
   */
  async extractActionsWithLearning(text, options = {}) {
    const actions = [];
    const { platform, brand } = options;

    // Split scenario into action phrases
    const phrases = this.splitIntoActionPhrases(text);

    for (const phrase of phrases) {
      // Try learned patterns first (from previous AI decompositions)
      const learned = await actionKnowledgeBaseService.findLearnedPattern(
        phrase,
        { platform, brand }
      );

      if (learned.found && learned.bestMatch.confidence > 0.5) {
        actions.push({
          action: learned.bestMatch.action,
          target: learned.bestMatch.target,
          details: learned.bestMatch.details,
          source: 'learned_pattern',
          confidence: learned.bestMatch.confidence
        });
        continue;
      }

      // Fall back to regex extraction
      const regexMatches = this.extractActionsFromText(phrase);
      for (const match of regexMatches) {
        actions.push({
          ...match,
          source: 'regex'
        });
      }
    }

    // Deduplicate by action+target
    const seen = new Set();
    return actions.filter(a => {
      const key = `${a.action}_${a.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Split scenario text into action phrases for pattern matching
   */
  splitIntoActionPhrases(text) {
    // Split on conjunctions and punctuation
    const phrases = text
      .split(/\s*(?:,|and|then|after|before|while|when)\s*/i)
      .map(p => p.trim())
      .filter(p => p.length > 3);

    return phrases.length > 0 ? phrases : [text];
  }

  /**
   * Post-process the decomposition result
   */
  postProcess(result, options) {
    const { includeLogin, platform } = options;

    // Ensure steps array exists
    if (!result.steps || !Array.isArray(result.steps)) {
      result.steps = [];
    }

    // Force include/exclude login if specified
    if (includeLogin === true && !result.steps.some(s => s.action === 'login')) {
      result.steps.unshift({
        id: 0,
        action: 'login',
        target: 'application',
        details: 'with valid credentials',
        isPrerequisite: true
      });
    } else if (includeLogin === false) {
      result.steps = result.steps.filter(s => s.action !== 'login');
    }

    // Re-number step IDs
    result.steps = result.steps.map((step, index) => ({
      ...step,
      id: index + 1
    }));

    // Filter platforms if specified
    if (platform && result.platforms) {
      result.platforms = result.platforms.includes(platform)
        ? [platform]
        : result.platforms;
    }

    // Add metadata
    result.decomposed_at = new Date().toISOString();
    result.step_count = result.steps.length;
    result.prerequisite_count = result.steps.filter(s => s.isPrerequisite).length;

    return {
      success: true,
      ...result
    };
  }

  /**
   * Detect test type from scenario text
   */
  detectTestType(text) {
    for (const [type, keywords] of Object.entries(this.testTypeKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return type;
      }
    }
    return 'functional';
  }

  /**
   * Detect if login is required based on scenario
   */
  detectLoginRequirement(text) {
    // Check for explicit mentions
    if (text.includes('logged in') || text.includes('after login') ||
        text.includes('authenticated')) {
      return true;
    }

    // Check for actions that typically require login
    for (const action of this.implicitPrerequisites.requiresLogin) {
      if (text.includes(action.replace('_', ' '))) {
        return true;
      }
    }

    // Check for screens that require login
    const loginRequiredScreens = ['profile', 'settings', 'my list', 'downloads', 'account'];
    return loginRequiredScreens.some(screen => text.includes(screen));
  }

  /**
   * Detect primary screen from scenario text
   */
  detectPrimaryScreen(text) {
    const screenKeywords = {
      player: ['player', 'video', 'playback', 'watch', 'playing', 'stream'],
      home: ['home', 'landing', 'main screen'],
      search: ['search', 'find', 'looking for'],
      settings: ['settings', 'preferences', 'configuration'],
      profile: ['profile', 'account', 'user settings'],
      details: ['details', 'info', 'description', 'synopsis'],
      browse: ['browse', 'catalog', 'library', 'shows', 'movies'],
      live: ['live', 'live tv', 'linear', 'channel']
    };

    for (const [screen, keywords] of Object.entries(screenKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return screen;
      }
    }

    return null;
  }

  /**
   * Extract action-target pairs from text
   */
  extractActionsFromText(text) {
    const actions = [];

    // Helper to clean target - remove articles and common filler words
    const cleanTarget = (target) => {
      if (!target) return 'element';
      // Remove leading articles
      const cleaned = target.replace(/^(a|an|the|it|from|to|for)\s+/i, '').trim();
      // Skip if result is empty, too short, or just a pronoun/article
      const skipWords = ['a', 'an', 'the', 'it', 'them', 'this', 'that', 'from', 'to', 'for', 'and', 'or'];
      if (!cleaned || cleaned.length < 2 || skipWords.includes(cleaned.toLowerCase())) {
        return null;
      }
      return cleaned;
    };

    // Pattern: "action verb" + optional articles/prepositions + "target"
    // Using (?:a|an|the)\s+ to handle all articles
    const patterns = [
      { regex: /play\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'play' },
      { regex: /click\s+(?:on\s+)?(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'click' },
      { regex: /select\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'select' },
      { regex: /open\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'open' },
      { regex: /navigate\s+to\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'navigate' },
      { regex: /go\s+to\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'navigate' },
      { regex: /wait\s+(?:for\s+)?(\d+)\s*(seconds?|minutes?)/i, action: 'wait' },
      { regex: /scroll\s+(?:to\s+)?(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'scroll' },
      { regex: /verify\s+(?:that\s+)?(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'verify' },
      { regex: /check\s+(?:that\s+)?(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'verify' },
      { regex: /enter\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'enter' },
      { regex: /search\s+(?:for\s+)?(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'search' },
      { regex: /enable\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'click' },
      { regex: /see\s+(?:(?:the|a|an)\s+)?(\w+(?:\s+\w+)?)/i, action: 'verify' }
    ];

    for (const { regex, action } of patterns) {
      const match = text.match(regex);
      if (match) {
        const target = cleanTarget(match[1]);
        if (target) {
          actions.push({
            action,
            target,
            details: match[2] ? `${match[1]} ${match[2]}` : null
          });
        }
      }
    }

    // If no patterns matched, try to find any standard action verbs
    if (actions.length === 0) {
      for (const verb of this.standardActions) {
        if (text.includes(verb)) {
          actions.push({
            action: verb,
            target: 'element',
            details: null
          });
        }
      }
    }

    return actions;
  }

  /**
   * Extract what needs to be verified
   */
  extractVerificationTarget(text) {
    const verifyPatterns = [
      /verify\s+(?:that\s+)?(?:the\s+)?(.+?)(?:\s+is|\s+are|\s+has|\s+should|$)/i,
      /check\s+(?:that\s+)?(?:the\s+)?(.+?)(?:\s+is|\s+are|\s+has|\s+should|$)/i,
      /ensure\s+(?:that\s+)?(?:the\s+)?(.+?)(?:\s+is|\s+are|\s+has|\s+should|$)/i,
      /confirm\s+(?:that\s+)?(?:the\s+)?(.+?)(?:\s+is|\s+are|\s+has|\s+should|$)/i
    ];

    for (const pattern of verifyPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\s+/g, '_');
      }
    }

    return 'expected_state';
  }

  /**
   * Detect target platforms from scenario
   */
  detectPlatforms(text) {
    const platforms = [];

    if (text.includes('tv') || text.includes('remote') || text.includes('roku') ||
        text.includes('fire tv') || text.includes('apple tv') || text.includes('ctv')) {
      platforms.push('ctv');
    }

    if (text.includes('mobile') || text.includes('ios') || text.includes('android') ||
        text.includes('phone') || text.includes('tablet') || text.includes('tap')) {
      platforms.push('mobile');
    }

    if (text.includes('web') || text.includes('browser') || text.includes('desktop')) {
      platforms.push('web');
    }

    // Default to all platforms if none detected
    return platforms.length > 0 ? platforms : ['ctv', 'mobile', 'web'];
  }

  /**
   * Validate decomposed steps for logical consistency
   */
  validateSteps(steps) {
    const issues = [];

    // Check for verification before action
    let hasAction = false;
    for (const step of steps) {
      if (step.action === 'verify' && !step.isPrerequisite && !hasAction) {
        issues.push(`Step ${step.id}: Verification before any action`);
      }
      if (!['login', 'navigate', 'verify'].includes(step.action)) {
        hasAction = true;
      }
    }

    // Check for navigation to screen that wasn't opened
    const navigatedScreens = steps
      .filter(s => s.action === 'navigate')
      .map(s => s.target);

    for (const step of steps) {
      if (step.action !== 'navigate' && step.target?.includes('_screen')) {
        const screen = step.target;
        if (!navigatedScreens.includes(screen) && !step.isPrerequisite) {
          issues.push(`Step ${step.id}: Action on ${screen} without navigation`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const scenarioDecomposerAgent = new ScenarioDecomposerAgent();
export default scenarioDecomposerAgent;
