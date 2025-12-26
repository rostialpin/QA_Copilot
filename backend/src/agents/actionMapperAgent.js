/**
 * Action-to-Method Mapper Agent
 *
 * Maps decomposed test steps to actual methods in the codebase.
 * Uses a multi-layered lookup strategy:
 * 1. Direct Knowledge Base lookup (learned patterns)
 * 2. Semantic search in atomic actions
 * 3. Fallback to Hybrid RAG (ChromaDB methods collection)
 * 4. Mark as unmapped for Component Generator
 *
 * @see /docs/architecture/multi-agent-test-generation-architecture.md
 */

import { actionKnowledgeBaseService } from '../services/actionKnowledgeBaseService.js';
import { hybridRAGService } from '../services/hybridRAGService.js';
import { llmActionMapperService } from '../services/llmActionMapperService.js';
import { intelligentMethodSelector } from '../services/intelligentMethodSelector.js';
import { logger } from '../utils/logger.js';

class ActionMapperAgent {
  constructor() {
    this.knowledgeBase = actionKnowledgeBaseService;
    this.ragService = hybridRAGService;
    this.confidenceThreshold = 0.2; // Lowered for semantic embedding distance

    // Action synonyms for query expansion
    this.actionSynonyms = {
      'play': ['open', 'start', 'launch', 'watch', 'stream', 'play video', 'play content'],
      'login': ['sign in', 'authenticate', 'perform authentication', 'user login', 'login user'],
      'navigate': ['go to', 'open', 'switch to', 'move to', 'access'],
      'verify': ['check', 'assert', 'validate', 'confirm', 'is displayed', 'is visible'],
      'click': ['tap', 'press', 'select', 'focus', 'activate'],
      'search': ['find', 'look for', 'search for', 'query'],
      'scroll': ['swipe', 'navigate list', 'browse', 'scroll down', 'scroll up'],
      'select': ['choose', 'pick', 'click on', 'tap on', 'focus on'],
      'enter': ['type', 'input', 'fill', 'set text', 'enter text'],
      'wait': ['pause', 'sleep', 'delay', 'wait for'],
      'dismiss': ['close', 'cancel', 'exit', 'back', 'go back']
    };

    // Target synonyms for domain-specific terms
    this.targetSynonyms = {
      'episode': ['show', 'video', 'content', 'series episode', 'tv episode', 'brand feed episode'],
      'movie': ['film', 'video', 'content', 'brand feed movie'],
      'application': ['app', 'home', 'main screen', 'landing'],
      'player': ['video player', 'playback', 'player screen', 'media player'],
      'captions': ['subtitles', 'closed captions', 'cc', 'caption', 'subtitle'],
      'settings': ['preferences', 'options', 'configuration'],
      'search': ['search bar', 'search field', 'search input', 'search screen'],
      'home_screen': ['home', 'landing page', 'main screen', 'home page'],
      'details': ['detail screen', 'info screen', 'show details', 'content details'],
      'progress_bar': ['scrubber', 'timeline', 'playback progress', 'seek bar']
    };

    // Method naming patterns for the codebase
    this.methodPatterns = {
      'play episode': ['openShowFromBrandFeedSection', 'playEpisode', 'startEpisodePlayback'],
      'play movie': ['openMovieFromBrandFeedSection', 'playMovie', 'startMoviePlayback'],
      'login application': ['navigateFromLaunchToHome', 'signInAsAuthorizedUser', 'launchAppAndNavigateToHomeScreen'],
      'verify player': ['verifyVideoIsPlaying', 'assertPlayerDisplayed', 'checkPlaybackStarted'],
      'enable captions': ['enableClosedCaptions', 'toggleCaptions', 'turnOnSubtitles'],
      'search show': ['navigateFromHomeToSearch', 'searchForContent', 'performSearch'],
      'navigate home': ['navigateFromSettingsToHome', 'navigateFromContainerToHome', 'navigateToMainMenu'],
      'navigate home screen': ['navigateFromLaunchToHome', 'navigateFromSettingsToHome', 'launchAppAndNavigateToHomeScreen'],
      'navigate search': ['navigateFromHomeToSearch', 'openSearchScreen'],
      'navigate settings': ['navigateFromHomeToSettings', 'navigateToSettingsPage'],
      'navigate profile': ['navigateToProfilesScreen', 'navigateFromHomeToSwitchProfile'],
      'navigate my list': ['navigateFromHomeToMyList']
    };
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    // Ensure knowledge base is ready
    if (!this.knowledgeBase.isInitialized) {
      await this.knowledgeBase.initialize();
    }

    // Ensure Hybrid RAG is ready for method queries
    if (this.ragService && !this.ragService.isInitialized) {
      await this.ragService.initialize();
    }

    // Initialize LLM mapper for AI-based mapping
    if (!llmActionMapperService.isInitialized) {
      await llmActionMapperService.initialize();
    }

    // Initialize Intelligent Method Selector (the new intelligence layer)
    if (!intelligentMethodSelector.isInitialized) {
      await intelligentMethodSelector.initialize();
    }

    logger.info('ActionMapperAgent initialized with intelligent selection');
  }

  /**
   * Map all steps from a decomposition result to actual methods
   *
   * @param {Object} decomposition - Output from ScenarioDecomposerAgent
   * @param {Object} options - Platform, brand, screenPathTracker, etc.
   * @returns {Object} Mapping results with found/unmapped actions
   */
  async mapSteps(decomposition, options = {}) {
    const { platform = null, brand = null, screenPathTracker = null, fastSeekSeconds = null, seekRatio = 6 } = options;
    const steps = decomposition.steps || [];

    // Store seek options for use in duration action handling
    // seekRatio: Playback-to-seek ratio (default 6:1, e.g., 10 min playback = 100s seek)
    this.fastSeekSeconds = fastSeekSeconds;
    this.seekRatio = seekRatio;

    // Store tracker for use in mapSingleStep
    this.screenPathTracker = screenPathTracker;

    if (steps.length === 0) {
      return {
        success: false,
        error: 'No steps to map',
        mappings: [],
        unmapped: []
      };
    }

    const mappings = [];
    const unmapped = [];
    const imports = new Set();
    let totalConfidence = 0;

    for (const step of steps) {
      const mapping = await this.mapSingleStep(step, { platform, brand });

      if (mapping.status === 'found') {
        mappings.push(mapping);
        totalConfidence += mapping.confidence;

        // Collect imports
        if (mapping.class) {
          imports.add(mapping.class);
        }
      } else {
        // Track as missing action with clear details for KB addition
        const missingAction = {
          ...step,
          status: 'missing',
          reason: mapping.reason || 'No matching method found in knowledge base',
          searchQuery: mapping.searchQuery,
          // Suggestions for what to add to KB
          suggestedAction: {
            actionName: this.generateActionName(step.action, step.target),
            description: `${step.action} ${step.target || ''}`.trim(),
            targetScreen: this.inferTargetScreen(step.target),
            suggestedClass: mapping.suggestedClass || this.inferClassName(step.target),
            suggestedMethod: mapping.suggestedMethod || this.generateMethodName(step.action, step.target)
          }
        };
        unmapped.push(missingAction);
        logger.info(`[Missing Action] "${step.action} ${step.target || ''}" - needs to be added to KB`);
      }
    }

    const avgConfidence = mappings.length > 0 ? totalConfidence / mappings.length : 0;

    return {
      success: true,
      mappings,
      unmapped,
      // New: Clear list of missing actions for easy KB addition
      missingActions: unmapped.map(u => ({
        action: `${u.action} ${u.target || ''}`.trim(),
        details: u.details,
        searchQuery: u.searchQuery,
        suggestion: u.suggestedAction,
        reason: u.reason
      })),
      statistics: {
        total: steps.length,
        mapped: mappings.length,
        unmapped: unmapped.length,
        averageConfidence: avgConfidence.toFixed(2),
        mappingRate: ((mappings.length / steps.length) * 100).toFixed(1) + '%'
      },
      imports: Array.from(imports),
      platform,
      brand
    };
  }

  /**
   * Generate action name for KB from step
   */
  generateActionName(action, target) {
    const parts = [action, target].filter(Boolean).join('_');
    return parts.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Infer target screen from target
   */
  inferTargetScreen(target) {
    if (!target) return 'unknown';
    const t = target.toLowerCase();
    if (t.includes('player') || t.includes('video') || t.includes('playback')) return 'player';
    if (t.includes('home')) return 'home';
    if (t.includes('search')) return 'search';
    if (t.includes('container') || t.includes('show') || t.includes('episode')) return 'container';
    if (t.includes('settings')) return 'settings';
    return 'unknown';
  }

  /**
   * Infer class name from target
   */
  inferClassName(target) {
    if (!target) return 'BaseScreen';
    const t = target.toLowerCase();
    if (t.includes('player') || t.includes('video') || t.includes('playback')) return 'PlayerScreen';
    if (t.includes('home')) return 'HomeScreen';
    if (t.includes('search')) return 'SearchScreen';
    if (t.includes('container') || t.includes('show') || t.includes('episode')) return 'ContainerScreen';
    if (t.includes('settings')) return 'SettingsScreen';
    return 'BaseScreen';
  }

  /**
   * Generate method name from action and target
   */
  generateMethodName(action, target) {
    const actionMap = { 'verify': 'verify', 'click': 'click', 'navigate': 'navigateTo', 'check': 'is', 'wait': 'waitFor' };
    const prefix = actionMap[action?.toLowerCase()] || action?.toLowerCase() || 'perform';
    const targetCamel = (target || 'Action').split(/[\s_-]+/)
      .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
    return prefix + targetCamel.charAt(0).toUpperCase() + targetCamel.slice(1);
  }

  /**
   * Map a single step to a method
   *
   * @param {Object} step - Single decomposed step
   * @param {Object} context - Platform, brand context
   * @returns {Object} Mapping result
   */
  async mapSingleStep(step, context = {}) {
    const { action, target, details, source: originalSource } = step;
    const { platform, brand } = context;

    // Preserve if this step came from a precondition
    const isPreconditionStep = originalSource === 'precondition';

    // Build search query from step components
    const searchQuery = this.buildSearchQuery(action, target, details);

    logger.debug(`Mapping step: "${action}" target: "${target || 'none'}"`);

    // Helper to add originalSource for precondition tracking
    const addOriginalSource = (result) => ({
      ...result,
      originalSource: isPreconditionStep ? 'precondition' : originalSource
    });

    // SPECIAL CASE: Watch/play with duration -> seek forward
    // Handles preconditions like "User has watched 10 minutes of content" or "Watch for 35 seconds"
    // SEEK_RATIO: Playback duration to seek time ratio (default 6:1)
    // Formula: seekSeconds = playbackDuration / SEEK_RATIO
    // Example: 10 min playback (600s) / 6 = 100s seek time
    if ((action === 'watch' || action === 'play') && step.duration) {
      // Calculate actual duration in seconds from the step's duration
      let actualDurationSeconds = step.duration.value;
      const unit = (step.duration.unit || '').toLowerCase();

      if (unit.includes('minute') || unit === 'min' || unit === 'm') {
        actualDurationSeconds = step.duration.value * 60; // Convert minutes to seconds
      } else if (unit.includes('hour') || unit === 'hr' || unit === 'h') {
        actualDurationSeconds = step.duration.value * 3600; // Convert hours to seconds
      }
      // If unit is seconds or unspecified, keep as-is

      // Calculate seek time using ratio formula
      // SEEK_RATIO configurable: lower = faster seek, higher = more realistic
      const SEEK_RATIO = this.seekRatio || 6;
      let seekSeconds;

      if (this.fastSeekSeconds !== null && this.fastSeekSeconds !== undefined) {
        // Direct override from API takes precedence
        seekSeconds = this.fastSeekSeconds;
        logger.info(`[Duration Action] Using direct fastSeekSeconds: ${seekSeconds}s`);
      } else {
        // Apply ratio formula
        seekSeconds = Math.round(actualDurationSeconds / SEEK_RATIO);
        seekSeconds = Math.max(seekSeconds, 10); // minimum 10 seconds
        logger.info(`[Duration Action] Calculated seek: ${seekSeconds}s from ${actualDurationSeconds}s playback (ratio 1:${SEEK_RATIO})`);
      }

      return addOriginalSource({
        ...step,
        status: 'found',
        source: 'duration_action',
        className: 'PlayerScreen',
        methodName: 'seekForwardToPosition',
        parameters: ['int seconds'],
        durationSeconds: seekSeconds,
        actualDurationSeconds: actualDurationSeconds,
        seekRatio: SEEK_RATIO,
        confidence: 0.95,
        description: `Seek ${seekSeconds}s to simulate ${actualDurationSeconds}s watch progress (ratio 1:${SEEK_RATIO})`
      });
    }

    // SCREEN PATH CONTEXT: Check if this is backward navigation
    // If step has screenContext from ScreenPathTracker, use it for smarter navigation
    if (step.screenContext && step.screenContext.isBackNavigation && this.screenPathTracker) {
      const navMethod = this.screenPathTracker.getNavigationMethod(step.screenContext.currentScreen);
      if (navMethod && navMethod.isBack) {
        logger.info(`[Screen Path] Detected BACKWARD navigation from ${step.screenContext.previousScreen} to ${step.screenContext.currentScreen} - using ${navMethod.className}.${navMethod.method}()`);
        return addOriginalSource({
          ...step,
          status: 'found',
          source: 'screen_path_tracker',
          className: navMethod.className,
          methodName: navMethod.method,
          parameters: [],
          confidence: 0.95,
          isBackNavigation: true,
          description: navMethod.reason
        });
      }
    }

    // Use screen context to prefer methods from current screen class
    // Pass the step's screenContext to use the correct screen for each step
    const preferredScreenClass = this.screenPathTracker
      ? this.screenPathTracker.getPreferredScreenClass(action, target, step.screenContext)
      : null;

    // STRATEGY 1: Check learned patterns first (if already mapped before)
    // BUT: For main test steps (non-prerequisites), prefer intelligent selection
    // This ensures the LLM can reason about the actual test action
    const isMainTestStep = !isPreconditionStep && !step.isPrerequisite;

    if (!isMainTestStep) {
      // For prerequisites, use learned patterns (faster, cheaper)
      const learnedResult = await this.checkLearnedPatterns(searchQuery, context);
      if (learnedResult.found && learnedResult.confidence >= this.confidenceThreshold) {
        logger.debug(`Found in learned patterns: ${learnedResult.methodName}`);
        return addOriginalSource({
          ...step,
          status: 'found',
          source: 'learned_pattern',
          ...learnedResult
        });
      }
    } else {
      logger.info(`[Main Test Step] Skipping learned patterns for: "${searchQuery}" - using intelligent selection`);
    }

    // STRATEGY 2: INTELLIGENT SELECTION - Gather candidates then let LLM decide
    // This is the new approach: semantic search retrieves, LLM selects intelligently
    if (intelligentMethodSelector.isInitialized) {
      logger.info(`[Intelligent Selection] Gathering candidates for: "${searchQuery}"`);

      // Gather ALL candidates from multiple sources
      const candidates = await this.gatherAllCandidates(step, { ...context, preferredScreenClass });

      if (candidates.length > 0) {
        // Let LLM intelligently select the best method(s)
        const intelligentResult = await intelligentMethodSelector.selectBestMethod(
          step,
          candidates,
          {
            platform,
            brand,
            fullScenario: context.fullScenario || searchQuery,
            // Pass screen path context for smarter selection
            screenContext: step.screenContext || null,
            preferredScreenClass,
            currentScreen: this.screenPathTracker?.getCurrentContext()
          }
        );

        if (intelligentResult.found) {
          logger.info(`[Intelligent Selection] Selected: ${intelligentResult.methodName} (${intelligentResult.source})`);
          return addOriginalSource({
            ...step,
            status: 'found',
            ...intelligentResult
          });
        }

        // LLM returned CREATE_NEW - mark as missing action
        if (intelligentResult.createNew) {
          logger.info(`[Intelligent Selection] CREATE_NEW - marking as MISSING: ${searchQuery}`);
          return addOriginalSource({
            ...step,
            status: 'not_found',
            reason: intelligentResult.reasoning || 'No suitable method found in candidates',
            suggestedClass: this.inferClassName(step.target),
            suggestedMethod: intelligentResult.suggestedMethod || this.generateMethodName(step.action, step.target),
            searchQuery: searchQuery
          });
        }
      } else {
        // No candidates - mark as missing (don't auto-create)
        // User should add the action to KB, then it will be found next time
        logger.info(`[Intelligent Selection] No candidates found - marking as MISSING`);
        return addOriginalSource({
          ...step,
          status: 'not_found',
          reason: 'No matching methods found in knowledge base',
          suggestedClass: this.inferClassName(step.target),
          suggestedMethod: this.generateMethodName(step.action, step.target),
          searchQuery: this.buildSearchQuery(step.action, step.target, step.details)
        });
      }
    }

    // FALLBACK: Old strategies if intelligent selection not available or failed

    // STRATEGY 3: Check composite actions
    const compositeResult = await this.searchCompositeActions(searchQuery);
    if (compositeResult.found && compositeResult.confidence >= 0.6) {
      logger.info(`[Composite Action] Matched: "${searchQuery}" → ${compositeResult.actionName} (${(compositeResult.confidence * 100).toFixed(0)}%)`);
      return addOriginalSource({
        ...step,
        status: 'found',
        source: 'composite_action',
        isComposite: true,
        ...compositeResult
      });
    }

    // STRATEGY 4: Direct lookup in atomic actions (Knowledge Base)
    const atomicResult = await this.searchAtomicActions(searchQuery, null, null, null);
    if (atomicResult.found && atomicResult.confidence >= this.confidenceThreshold) {
      logger.info(`[Atomic Actions] Matched: "${searchQuery}" → ${atomicResult.methodName} (${(atomicResult.confidence * 100).toFixed(0)}%)`);
      return addOriginalSource({
        ...step,
        status: 'found',
        source: 'atomic_action',
        ...atomicResult
      });
    }

    // STRATEGY 5: Semantic search in Hybrid RAG with query expansion
    const ragResult = await this.searchHybridRAG(searchQuery, target, platform, step);
    if (ragResult.found && ragResult.confidence >= this.confidenceThreshold) {
      logger.info(`Found in Hybrid RAG: ${ragResult.methodName} via query expansion (${ragResult.querySource})`);
      await this.learnNewMapping(step, ragResult, context);
      return addOriginalSource({
        ...step,
        status: 'found',
        source: 'hybrid_rag',
        ...ragResult
      });
    }

    // STRATEGY 6: LLM-based mapping (legacy fallback)
    const llmResult = await this.mapWithLLM(step, context);
    if (llmResult.found) {
      logger.info(`Found via LLM: ${llmResult.methodName} (${llmResult.source})`);
      return addOriginalSource({
        ...step,
        status: 'found',
        source: llmResult.source,
        ...llmResult
      });
    }

    // STRATEGY 7: Mark as unmapped
    logger.debug(`No mapping found for: "${action}"`);
    return addOriginalSource({
      ...step,
      status: 'unmapped',
      reason: 'No matching method found with sufficient confidence',
      searchQuery,
      bestMatch: ragResult.bestMatch || atomicResult.bestMatch || null
    });
  }

  /**
   * Gather ALL candidates from multiple sources for intelligent selection
   * This is the key change: instead of picking by score, we gather all and let LLM decide
   */
  async gatherAllCandidates(step, context) {
    const { action, target, details } = step;
    const { platform, preferredScreenClass } = context;
    const searchQuery = this.buildSearchQuery(action, target, details);

    const candidates = [];
    const seen = new Set();

    // Helper to add unique candidates
    const addCandidate = (result, source) => {
      const key = result.methodName?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        candidates.push({
          methodName: result.methodName,
          className: result.className,
          file: result.file || result.filePath,
          parameters: result.parameters || [],
          javadoc: result.javadoc || result.documentation,
          keywords: result.keywords || [],
          confidence: result.confidence || result.score || 0.5,
          source
        });
      }
    };

    // 1. Get composite action candidates - add them as COMPOSITE options, not individual steps
    // Try multiple query variations to find relevant composite actions
    const compositeQueries = [searchQuery];
    // Also try individual important words from the query
    const words = searchQuery.split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      if (!compositeQueries.includes(word)) {
        compositeQueries.push(word);
      }
    }

    const addCompositeToCandidate = (match) => {
      if (match.steps && match.steps.length > 0) {
        const firstStep = match.steps[0];
        const compositeKey = `composite_${match.actionName}`;
        const normalKey = match.actionName.toLowerCase();
        if (!seen.has(compositeKey)) {
          seen.add(compositeKey);
          seen.add(normalKey);  // Also mark the normal key to prevent atomic action with same name from being added
          candidates.push({
            methodName: match.actionName,
            className: firstStep.className || 'CompositeAction',
            isComposite: true,
            compositeSteps: match.steps.map(s => ({
              methodName: s.methodName || s.atomicAction,
              className: s.className,
              parameters: s.parameters || [],
              description: s.description
            })),
            description: match.description,
            confidence: match.confidence || 0.85,
            source: 'composite_action'
          });
          logger.info(`[GatherCandidates] Added composite action: ${match.actionName} with ${match.steps.length} steps`);
          return true;
        }
      }
      return false;
    };

    try {
      for (const query of compositeQueries) {
        const compositeResult = await this.knowledgeBase.findCompositeAction(query, 5);
        // Include even lower confidence matches for composite actions
        // since LLM will make final decision
        const allMatches = compositeResult.allMatches ||
          (compositeResult.closestMatch ? [compositeResult.closestMatch] : []);
        for (const match of allMatches) {
          addCompositeToCandidate(match);
        }
      }
    } catch (error) {
      logger.debug(`Composite action search failed: ${error.message}`);
    }

    // 2. Get atomic action candidates from Knowledge Base
    try {
      const atomicResult = await this.knowledgeBase.findAtomicAction(searchQuery, {}, 15);
      const matches = atomicResult.results || atomicResult.allMatches || [];
      for (const match of matches) {
        addCandidate(match, 'knowledge_base');
      }
    } catch (error) {
      logger.debug(`Atomic action search failed: ${error.message}`);
    }

    // 3. Get candidates from Hybrid RAG with query variations
    try {
      if (this.ragService?.isInitialized) {
        const variations = this.generateQueryVariations(action, target, details);

        for (const variation of variations.slice(0, 5)) {
          const results = await this.ragService.queryMethods(variation.query, {
            topK: 10,
            minConfidence: 0.05,
            platform
          });

          for (const result of results) {
            addCandidate(result, 'hybrid_rag');
          }
        }
      }
    } catch (error) {
      logger.debug(`RAG search failed: ${error.message}`);
    }

    // Sort by confidence, but boost candidates from preferred screen class
    candidates.sort((a, b) => {
      const confA = a.confidence || 0;
      const confB = b.confidence || 0;

      // Boost candidates from preferred screen class
      const boostA = (preferredScreenClass && a.className === preferredScreenClass) ? 0.1 : 0;
      const boostB = (preferredScreenClass && b.className === preferredScreenClass) ? 0.1 : 0;

      return (confB + boostB) - (confA + boostA);
    });

    logger.info(`[GatherCandidates] Found ${candidates.length} unique candidates for: "${searchQuery}"` +
      (preferredScreenClass ? ` (preferred: ${preferredScreenClass})` : ''));
    return candidates;
  }

  /**
   * Use LLM to map action to method (with learning)
   */
  async mapWithLLM(step, context) {
    try {
      if (!llmActionMapperService.isInitialized) {
        return { found: false };
      }

      const result = await llmActionMapperService.mapAction(step, context);
      return result;
    } catch (error) {
      logger.warn(`LLM mapping failed: ${error.message}`);
      return { found: false };
    }
  }

  /**
   * Build a search query from step components
   */
  buildSearchQuery(action, target, details) {
    const parts = [];

    if (action) {
      parts.push(action.replace(/_/g, ' '));
    }
    if (target) {
      parts.push(target.replace(/_/g, ' '));
    }
    if (details) {
      parts.push(details);
    }

    return parts.join(' ').toLowerCase().trim();
  }

  /**
   * Generate expanded query variations for better semantic matching
   * Returns array of queries to try, ordered by specificity
   */
  generateQueryVariations(action, target, details) {
    const variations = [];
    const actionLower = (action || '').toLowerCase().replace(/_/g, ' ');
    const targetLower = (target || '').toLowerCase().replace(/_/g, ' ');

    // 1. Check for exact method pattern match first
    const patternKey = `${actionLower} ${targetLower}`.trim();
    if (this.methodPatterns[patternKey]) {
      for (const methodName of this.methodPatterns[patternKey]) {
        // Convert camelCase to space-separated for semantic search
        const spacedName = methodName.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        variations.push({
          query: spacedName,
          source: 'method_pattern',
          priority: 1
        });
      }
    }

    // 2. Original query
    const originalQuery = this.buildSearchQuery(action, target, details);
    variations.push({
      query: originalQuery,
      source: 'original',
      priority: 2
    });

    // 3. Action synonym variations
    const actionSynonyms = this.actionSynonyms[actionLower] || [];
    for (const synonym of actionSynonyms) {
      variations.push({
        query: `${synonym} ${targetLower}`.trim(),
        source: 'action_synonym',
        priority: 3
      });
    }

    // 4. Target synonym variations
    const targetSynonyms = this.targetSynonyms[targetLower] || [];
    for (const synonym of targetSynonyms) {
      variations.push({
        query: `${actionLower} ${synonym}`.trim(),
        source: 'target_synonym',
        priority: 3
      });
    }

    // 5. Combined action + target synonym variations
    for (const actionSyn of actionSynonyms.slice(0, 3)) {
      for (const targetSyn of targetSynonyms.slice(0, 3)) {
        variations.push({
          query: `${actionSyn} ${targetSyn}`.trim(),
          source: 'combined_synonym',
          priority: 4
        });
      }
    }

    // 6. CamelCase variations (for method name matching)
    const camelCaseQuery = actionLower.split(' ').map((w, i) =>
      i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
    ).join('') + targetLower.split(' ').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join('');
    variations.push({
      query: camelCaseQuery.replace(/([A-Z])/g, ' $1').toLowerCase().trim(),
      source: 'camel_case',
      priority: 5
    });

    // Remove duplicates while preserving order
    const seen = new Set();
    return variations.filter(v => {
      const key = v.query.toLowerCase();
      if (seen.has(key) || !key) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check learned patterns from previous mappings
   */
  async checkLearnedPatterns(query, context) {
    try {
      const result = await this.knowledgeBase.findLearnedPattern(query, context);

      if (result.found && result.bestMatch) {
        return {
          found: true,
          methodName: result.bestMatch.action,
          className: result.bestMatch.screen || result.bestMatch.target,
          confidence: result.bestMatch.confidence,
          keywordsMatched: result.bestMatch.details ? [result.bestMatch.details] : [],
          metadata: result.bestMatch
        };
      }

      return { found: false };
    } catch (error) {
      logger.warn(`Learned pattern search failed: ${error.message}`);
      return { found: false };
    }
  }

  /**
   * Search atomic actions in Knowledge Base
   */
  async searchAtomicActions(query, targetScreen, platform, brand) {
    try {
      // Use larger topK to allow keyword boost to find better matches
      const result = await this.knowledgeBase.findAtomicAction(
        query,
        { targetScreen, platform, brand },
        20
      );

      // Check for results (can be in 'results', 'allMatches', or 'bestMatch')
      const matches = result.results || result.allMatches || (result.bestMatch ? [result.bestMatch] : []);

      if (result.found && matches.length > 0) {
        const best = matches[0];
        return {
          found: true,
          methodName: best.methodName,
          className: best.className,
          file: best.file || best.relativePath,
          confidence: best.confidence || 0.8,
          keywordsMatched: best.keywords || [],
          parameters: best.parameters || [],
          bestMatch: best
        };
      }

      return { found: false, bestMatch: matches[0] };
    } catch (error) {
      logger.warn(`Atomic action search failed: ${error.message}`);
      return { found: false };
    }
  }

  /**
   * Search composite actions
   */
  async searchCompositeActions(query) {
    try {
      const result = await this.knowledgeBase.findCompositeAction(query, 3);

      if (result.found && result.bestMatch) {
        const best = result.bestMatch;
        return {
          found: true,
          actionName: best.actionName,
          description: best.description,
          steps: best.steps || [],
          confidence: best.confidence || 0.8,
          bestMatch: best
        };
      }

      return { found: false };
    } catch (error) {
      logger.warn(`Composite action search failed: ${error.message}`);
      return { found: false };
    }
  }

  /**
   * Search Hybrid RAG methods collection with query expansion
   */
  async searchHybridRAG(query, targetScreen, platform, step = null) {
    try {
      // Check if RAG service is available
      if (!this.ragService || !this.ragService.isInitialized) {
        logger.debug('Hybrid RAG not available');
        return { found: false };
      }

      // Generate query variations for better matching
      const variations = step
        ? this.generateQueryVariations(step.action, step.target, step.details)
        : [{ query, source: 'original', priority: 1 }];

      logger.info(`[RAG Search] Trying ${variations.length} query variations for: "${query}"`);

      let bestResult = null;
      let bestConfidence = 0;
      let successQuery = null;

      // Try each query variation until we find a good match
      for (const variation of variations) {
        try {
          const results = await this.ragService.queryMethods(variation.query, {
            topK: 3,
            minConfidence: 0.1,
            screen: targetScreen,
            platform
          });

          if (results && results.length > 0) {
            const topResult = results[0];
            const confidence = topResult.confidence || topResult.score || 0.5;

            logger.info(`[RAG] Query "${variation.query}" (${variation.source}): ${topResult.methodName} @ ${confidence.toFixed(3)}`);

            // Keep the best result
            if (confidence > bestConfidence) {
              bestConfidence = confidence;
              bestResult = topResult;
              successQuery = variation;
            }

            // If we found a high-confidence match, stop searching
            if (confidence >= 0.4) {
              logger.info(`[RAG] High confidence match found: ${topResult.methodName} @ ${confidence.toFixed(3)}`);
              break;
            }
          }
        } catch (err) {
          // Continue to next variation on error
          logger.warn(`[RAG] Query "${variation.query}" failed: ${err.message}`);
        }
      }

      if (bestResult && bestConfidence >= this.confidenceThreshold) {
        logger.info(`[RAG Search] Best match: ${bestResult.methodName} @ ${bestConfidence.toFixed(3)} via "${successQuery.query}" (${successQuery.source})`);
        return {
          found: true,
          methodName: bestResult.methodName || bestResult.name,
          className: bestResult.className || bestResult.class,
          file: bestResult.file || bestResult.filePath,
          confidence: bestConfidence,
          keywordsMatched: bestResult.keywords || [],
          parameters: bestResult.parameters || [],
          javadoc: bestResult.javadoc || bestResult.documentation,
          queryUsed: successQuery.query,
          querySource: successQuery.source,
          bestMatch: bestResult
        };
      }

      logger.info(`[RAG Search] No match above threshold. Best: ${bestResult?.methodName || 'none'} @ ${bestConfidence.toFixed(3)}`);
      return { found: false, bestMatch: bestResult };
    } catch (error) {
      logger.warn(`Hybrid RAG search failed: ${error.message}`);
      return { found: false };
    }
  }

  /**
   * Learn a new mapping for future use
   */
  async learnNewMapping(step, ragResult, context) {
    try {
      // Store as atomic action for future direct lookup
      const atomicAction = {
        id: `learned_${step.action}_${Date.now()}`,
        actionName: step.action,
        methodName: ragResult.methodName,
        className: ragResult.className,
        file: ragResult.file,
        targetScreen: step.target,
        platform: context.platform,
        brand: context.brand,
        keywords: [step.action, step.target, ...(step.details?.split(' ') || [])].filter(Boolean),
        description: step.details || `Maps ${step.action} to ${ragResult.methodName}`,
        source: 'learned_from_rag'
      };

      await this.knowledgeBase.addAtomicAction(atomicAction);
      logger.info(`Learned new mapping: ${step.action} → ${ragResult.methodName}`);
    } catch (error) {
      logger.warn(`Failed to learn mapping: ${error.message}`);
    }
  }

  /**
   * Expand composite actions to atomic steps
   */
  async expandCompositeSteps(compositeMapping) {
    const expanded = [];

    if (compositeMapping.steps && Array.isArray(compositeMapping.steps)) {
      for (const step of compositeMapping.steps) {
        // Each step in composite references an atomic action
        const atomicResult = await this.searchAtomicActions(
          step.atomicAction || step.action,
          null, null, null
        );

        expanded.push({
          order: step.order,
          action: step.atomicAction || step.action,
          parameters: step.parameters,
          conditional: step.conditional,
          mapping: atomicResult.found ? atomicResult : null
        });
      }
    }

    return expanded;
  }

  /**
   * Get mapping statistics
   */
  getStats() {
    return {
      agent: 'ActionMapperAgent',
      version: '3.0.0',
      confidenceThreshold: this.confidenceThreshold,
      strategies: [
        'learned_patterns',
        'intelligent_selection',  // NEW: LLM picks from candidates
        'composite_actions',
        'atomic_actions',
        'hybrid_rag',
        'llm_mapping'
      ],
      intelligentSelectionEnabled: intelligentMethodSelector.isInitialized,
      llmEnabled: llmActionMapperService.isInitialized
    };
  }
}

// Export singleton instance
export const actionMapperAgent = new ActionMapperAgent();
export default actionMapperAgent;
