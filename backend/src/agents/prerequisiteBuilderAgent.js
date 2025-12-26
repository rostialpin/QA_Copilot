/**
 * Prerequisite Builder Agent
 *
 * Builds navigation paths and setup sequences for test execution:
 * - Determines navigation path to target screen
 * - Collects required imports
 * - Identifies test data requirements
 * - Generates @BeforeMethod setup code
 *
 * @see /docs/architecture/multi-agent-test-generation-architecture.md
 */

import { actionKnowledgeBaseService } from '../services/actionKnowledgeBaseService.js';
import { logger } from '../utils/logger.js';

class PrerequisiteBuilderAgent {
  constructor() {
    this.knowledgeBase = actionKnowledgeBaseService;

    // Screen navigation graph - defines possible paths between screens
    this.screenGraph = {
      'app_launch': ['splash', 'login', 'home'],
      'splash': ['login', 'home'],
      'login': ['home', 'profile', 'onboarding'],
      'onboarding': ['home'],
      'home': ['search', 'browse', 'profile', 'settings', 'content', 'live'],
      'browse': ['content', 'category', 'home'],
      'search': ['content', 'search_results', 'home'],
      'search_results': ['content', 'search'],
      'content': ['player', 'series', 'episode_picker', 'home'],
      'series': ['episode_picker', 'player', 'content'],
      'episode_picker': ['player', 'series'],
      'player': ['home', 'content', 'series'],
      'live': ['player', 'channel_guide', 'home'],
      'channel_guide': ['live', 'player'],
      'profile': ['settings', 'home', 'account'],
      'settings': ['profile', 'home', 'account'],
      'account': ['settings', 'login']
    };

    // Common prerequisite patterns
    this.prerequisitePatterns = {
      login: {
        method: 'login',
        class: 'LoginScreen',
        params: ['testData.getValidUser()'],
        description: 'Login with valid credentials'
      },
      launch_app: {
        method: 'launchApp',
        class: 'BaseTest',
        params: [],
        description: 'Launch the application'
      },
      wait_home: {
        method: 'waitForHomeScreen',
        class: 'HomeScreen',
        params: [],
        description: 'Wait for home screen to load'
      }
    };

    // MQE-specific content navigation patterns
    this.mqeContentPatterns = {
      // Navigate to episode and start playback
      play_episode: {
        testDataSetup: 'TestData data = TestUtils.getDataWithSkip(TestDataProvider::getThreadSafeEpisodeWithoutContinuousPlayback);',
        itemSetup: 'Item item = TestDataProvider.getBrandFeedEpisodeItem(data);',
        steps: [
          { method: 'launchAppAndNavigateToHomeScreen', class: 'BaseTest' },
          { method: 'openShowFromBrandFeedSection', class: 'HomeScreen', params: ['data', 'item'] },
          { method: 'selectEpisode', class: 'ContainerScreen', params: ['item', 'data.getEpisodeIndex()', 'data.getSeasonIndex()'] },
          { method: 'waitForVideoLoaded', class: 'PlayerScreen' }
        ],
        cleanup: 'TestDataProvider.removeThreadSafeEpisode(data);',
        imports: ['TestData', 'Item', 'TestDataProvider', 'TestUtils']
      },
      // Navigate to player (content is playing)
      player_screen: {
        testDataSetup: 'TestData data = TestUtils.getDataWithSkip(TestDataProvider::getThreadSafeEpisodeWithoutContinuousPlayback);',
        itemSetup: 'Item item = TestDataProvider.getBrandFeedEpisodeItem(data);',
        steps: [
          { method: 'launchAppAndNavigateToHomeScreen', class: 'BaseTest' },
          { method: 'openShowFromBrandFeedSection', class: 'HomeScreen', params: ['data', 'item'] },
          { method: 'selectEpisode', class: 'ContainerScreen', params: ['item', 'data.getEpisodeIndex()', 'data.getSeasonIndex()'] },
          { method: 'waitForVideoLoaded', class: 'PlayerScreen' }
        ],
        cleanup: 'TestDataProvider.removeThreadSafeEpisode(data);',
        imports: ['TestData', 'Item', 'TestDataProvider', 'TestUtils']
      },
      // Navigate to player with watch progress (for restart/resume tests)
      // Seek forward to simulate having watched content
      player_with_progress: {
        testDataSetup: 'TestData data = TestUtils.getDataWithSkip(TestDataProvider::getThreadSafeEpisodeWithoutContinuousPlayback);',
        itemSetup: 'Item item = TestDataProvider.getBrandFeedEpisodeItem(data);',
        steps: [
          { method: 'launchAppAndNavigateToHomeScreen', class: 'BaseTest' },
          { method: 'openShowFromBrandFeedSection', class: 'HomeScreen', params: ['data', 'item'] },
          { method: 'selectEpisode', class: 'ContainerScreen', params: ['item', 'data.getEpisodeIndex()', 'data.getSeasonIndex()'] },
          { method: 'waitForVideoLoaded', class: 'PlayerScreen' },
          { method: 'seekForwardToPosition', class: 'PlayerScreen', params: ['10'], comment: '// Adjust seek time as needed for test requirements' }
        ],
        cleanup: 'TestDataProvider.removeThreadSafeEpisode(data);',
        imports: ['TestData', 'Item', 'TestDataProvider', 'TestUtils']
      },
      // Navigate to container screen (show details page)
      container_screen: {
        testDataSetup: 'TestData data = TestUtils.getDataWithSkip(TestDataProvider::getThreadSafeEpisodeWithoutContinuousPlayback);',
        itemSetup: 'Item item = TestDataProvider.getBrandFeedEpisodeItem(data);',
        steps: [
          { method: 'launchAppAndNavigateToHomeScreen', class: 'BaseTest' },
          { method: 'openShowFromBrandFeedSection', class: 'HomeScreen', params: ['data', 'item'] }
        ],
        cleanup: 'TestDataProvider.removeThreadSafeEpisode(data);',
        imports: ['TestData', 'Item', 'TestDataProvider', 'TestUtils']
      }
    };

    // Screen to class mapping
    this.screenClassMap = {
      'login': 'LoginScreen',
      'home': 'HomeScreen',
      'browse': 'BrowseScreen',
      'search': 'SearchScreen',
      'content': 'ContentScreen',
      'player': 'PlayerScreen',
      'series': 'SeriesScreen',
      'episode_picker': 'EpisodePickerScreen',
      'live': 'LiveScreen',
      'channel_guide': 'ChannelGuideScreen',
      'profile': 'ProfileScreen',
      'settings': 'SettingsScreen',
      'account': 'AccountScreen',
      'onboarding': 'OnboardingScreen',
      'splash': 'SplashScreen'
    };
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    logger.info('PrerequisiteBuilderAgent initialized');
  }

  /**
   * Build prerequisites for a test based on mappings and target screen
   *
   * @param {Object} mappingResult - Output from ActionMapperAgent
   * @param {Object} options - Additional options
   * @returns {Object} Prerequisites with imports, setup, and navigation
   */
  async buildPrerequisites(mappingResult, options = {}) {
    const {
      platform = null,
      brand = null,
      includeLogin = true,
      targetScreen = null,
      fastSeekSeconds = null
    } = options;

    // Store for use in pattern building
    this.fastSeekSeconds = fastSeekSeconds;

    // Determine target screen from mappings if not provided
    const target = targetScreen || this.inferTargetScreen(mappingResult.mappings) || 'home';

    logger.info(`Building prerequisites for target screen: ${target}, platform: ${platform}`);

    // Check if we should use MQE-specific patterns (CTV platform)
    const useMqePatterns = platform === 'ctv' || platform === 'CTV';

    if (useMqePatterns) {
      // Check if test needs content navigation (player, container, restart, etc.)
      const needsContentNav = this.needsContentNavigation(target, mappingResult.mappings);

      if (needsContentNav) {
        logger.info(`[MQE Pattern] Using content navigation pattern for target: ${target}`);
        return this.buildMqeContentPrerequisites(target, mappingResult, options);
      }
    }

    // Standard navigation path
    const navigationPath = this.findNavigationPath('app_launch', target);

    // Collect imports from mappings and navigation
    const imports = this.collectImports(mappingResult.mappings, navigationPath);

    // Build setup sequence
    const setupSequence = this.buildSetupSequence(navigationPath, includeLogin);

    // Build navigation to target
    const navigationToTarget = this.buildNavigationSteps(navigationPath);

    // Identify test data requirements
    const testDataRequirements = this.identifyTestDataNeeds(mappingResult.mappings, setupSequence);

    // Generate screen chain
    const screenChain = navigationPath.map(screen => this.screenClassMap[screen] || screen);

    return {
      success: true,
      targetScreen: target,
      prerequisites: {
        imports: Array.from(imports),
        setupSequence,
        navigationToTarget,
        testDataRequirements
      },
      screenChain,
      platform,
      brand
    };
  }

  /**
   * Check if the test needs content navigation (episode/movie playback)
   */
  needsContentNavigation(targetScreen, mappings) {
    const contentScreens = ['player', 'container', 'content', 'episode', 'series'];
    const targetLower = (targetScreen || '').toLowerCase();

    // Check target screen
    if (contentScreens.some(s => targetLower.includes(s))) {
      return true;
    }

    // Check if mappings reference player/container methods
    for (const mapping of (mappings || [])) {
      const methodLower = (mapping.methodName || '').toLowerCase();
      const classLower = (mapping.className || '').toLowerCase();

      if (methodLower.includes('player') || methodLower.includes('episode') ||
          methodLower.includes('restart') || methodLower.includes('playback') ||
          classLower.includes('player') || classLower.includes('container')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build MQE-specific content navigation prerequisites
   */
  buildMqeContentPrerequisites(target, mappingResult, options) {
    const targetLower = (target || '').toLowerCase();

    // Determine which MQE pattern to use
    let patternKey = 'container_screen'; // default

    // Check if test requires watch progress (restart/resume scenarios)
    if (this.mappingsRequireWatchProgress(mappingResult.mappings)) {
      patternKey = 'player_with_progress';
      logger.info('[MQE Pattern] Detected restart/resume scenario - using player_with_progress');
    } else if (targetLower.includes('player') || this.mappingsRequirePlayback(mappingResult.mappings)) {
      patternKey = 'player_screen';
    }

    const pattern = this.mqeContentPatterns[patternKey];
    if (!pattern) {
      logger.warn(`No MQE pattern found for: ${patternKey}`);
      return this.buildPrerequisites(mappingResult, { ...options, platform: null });
    }

    logger.info(`[MQE Pattern] Using pattern: ${patternKey}`);

    // Extract duration info from mapping result for dynamic seek time
    // SEEK_RATIO: Playback duration to seek time ratio (default 6:1)
    // Formula: seekSeconds = playbackDuration / SEEK_RATIO
    // Example: 10 min playback (600s) / 6 = 100s seek time
    // To adjust: change SEEK_RATIO (lower = faster seek, higher = more realistic)
    const SEEK_RATIO = options.seekRatio || 6;

    const durationMapping = (mappingResult.mappings || []).find(m => m.source === 'duration_action');
    let seekSeconds = 10; // default
    let seekComment = '// Adjust seek time as needed for test requirements';

    if (durationMapping) {
      // Calculate seek time from actual duration using ratio
      const actualSeconds = durationMapping.actualDurationSeconds || durationMapping.durationSeconds || 60;
      seekSeconds = Math.round(actualSeconds / SEEK_RATIO);
      seekSeconds = Math.max(seekSeconds, 10); // minimum 10 seconds

      seekComment = `// Seek ${seekSeconds}s to simulate ${actualSeconds}s watch progress (ratio 1:${SEEK_RATIO}, adjust SEEK_RATIO in prerequisiteBuilderAgent.js)`;
      logger.info(`[MQE Pattern] Calculated seek: ${seekSeconds}s from ${actualSeconds}s playback (ratio 1:${SEEK_RATIO})`);
    } else if (this.fastSeekSeconds !== null && this.fastSeekSeconds !== undefined) {
      // Direct seek time override from API
      seekSeconds = this.fastSeekSeconds;
      seekComment = `// Seek to ${seekSeconds}s watch progress`;
      logger.info(`[MQE Pattern] Using fastSeekSeconds from options: ${seekSeconds}s`);
    }

    // Build imports
    const imports = new Set([
      'BaseTest',
      'org.testng.annotations.Test',
      'org.testng.annotations.Factory',
      'SoftAssert',
      ...pattern.imports,
      'HomeScreen',
      'ContainerScreen',
      'PlayerScreen'
    ]);

    // Add imports from mappings
    for (const mapping of (mappingResult.mappings || [])) {
      if (mapping.className) {
        imports.add(mapping.className);
      }
    }

    // Build setup sequence from pattern steps with dynamic seek time
    const setupSequence = pattern.steps.map((step, i) => {
      // Override seekForwardToPosition params and comment with dynamic values
      if (step.method === 'seekForwardToPosition') {
        return {
          order: i + 1,
          method: step.method,
          class: step.class,
          params: [String(seekSeconds)],
          comment: seekComment,
          description: `${step.method} call`
        };
      }
      return {
        order: i + 1,
        method: step.method,
        class: step.class,
        params: step.params || [],
        comment: step.comment || null,
        description: `${step.method} call`
      };
    });

    return {
      success: true,
      targetScreen: target,
      useMqePattern: true,
      mqePattern: patternKey,
      prerequisites: {
        imports: Array.from(imports),
        setupSequence,
        navigationToTarget: [],  // Already included in setupSequence
        testDataRequirements: [{
          type: 'episode_data',
          setup: pattern.testDataSetup,
          itemSetup: pattern.itemSetup,
          cleanup: pattern.cleanup
        }]
      },
      screenChain: pattern.steps.map(s => s.class),
      platform: options.platform,
      brand: options.brand
    };
  }

  /**
   * Check if mappings require video playback
   */
  mappingsRequirePlayback(mappings) {
    for (const mapping of (mappings || [])) {
      const methodLower = (mapping.methodName || '').toLowerCase();
      if (methodLower.includes('video') || methodLower.includes('playback') ||
          methodLower.includes('player') || methodLower.includes('seek') ||
          methodLower.includes('restart') || methodLower.includes('pause')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if mappings require watch progress (restart/resume scenarios)
   * These tests need the video to have been "watched" for some time before the test action
   */
  mappingsRequireWatchProgress(mappings) {
    const progressKeywords = ['restart', 'resume', 'continue watching', 'watch history', 'saved position'];

    for (const mapping of (mappings || [])) {
      const methodLower = (mapping.methodName || '').toLowerCase();
      const actionLower = (mapping.action || '').toLowerCase();

      // Check method names
      if (progressKeywords.some(kw => methodLower.includes(kw.replace(' ', '')))) {
        return true;
      }

      // Check action descriptions
      if (progressKeywords.some(kw => actionLower.includes(kw))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Infer target screen from mappings
   */
  inferTargetScreen(mappings) {
    if (!mappings || mappings.length === 0) return null;

    // Count screen occurrences
    const screenCounts = {};
    for (const mapping of mappings) {
      const screen = mapping.target || mapping.className?.replace('Screen', '').toLowerCase();
      if (screen) {
        screenCounts[screen] = (screenCounts[screen] || 0) + 1;
      }
    }

    // Return most common screen
    const sorted = Object.entries(screenCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'home';
  }

  /**
   * Find shortest navigation path using BFS
   */
  findNavigationPath(from, to) {
    if (from === to) return [from];

    const normalizedFrom = from.toLowerCase();
    const normalizedTo = to.toLowerCase();

    // BFS to find shortest path
    const queue = [[normalizedFrom]];
    const visited = new Set([normalizedFrom]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      const neighbors = this.screenGraph[current] || [];

      for (const neighbor of neighbors) {
        if (neighbor === normalizedTo) {
          return [...path, neighbor];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    // If no path found, return direct path (might need intermediate screens)
    return [normalizedFrom, normalizedTo];
  }

  /**
   * Collect all required imports
   */
  collectImports(mappings, navigationPath) {
    const imports = new Set();

    // Base imports
    imports.add('BaseTest');
    imports.add('org.testng.annotations.Test');

    // From navigation path
    for (const screen of navigationPath) {
      const className = this.screenClassMap[screen];
      if (className) {
        imports.add(className);
      }
    }

    // From mappings
    for (const mapping of mappings) {
      if (mapping.className) {
        imports.add(mapping.className);
      }
    }

    return imports;
  }

  /**
   * Build setup sequence for @BeforeMethod
   */
  buildSetupSequence(navigationPath, includeLogin) {
    const sequence = [];

    // Always start with launch
    sequence.push({
      order: 1,
      method: 'launchApp',
      class: 'BaseTest',
      params: [],
      description: 'Launch the application'
    });

    // Add login if path includes it and flag is set
    if (includeLogin && navigationPath.includes('login')) {
      sequence.push({
        order: 2,
        method: 'login',
        class: 'LoginScreen',
        params: ['testData.getValidUser()'],
        description: 'Login with valid credentials'
      });
    } else if (includeLogin && navigationPath.includes('home')) {
      // If login not in path but includeLogin is true, add it before home
      sequence.push({
        order: 2,
        method: 'login',
        class: 'LoginScreen',
        params: ['testData.getValidUser()'],
        description: 'Login with valid credentials'
      });
    }

    // Wait for home screen
    if (navigationPath.includes('home')) {
      sequence.push({
        order: 3,
        method: 'waitForHomeScreen',
        class: 'HomeScreen',
        params: [],
        description: 'Wait for home screen to load'
      });
    }

    return sequence;
  }

  /**
   * Build navigation steps to reach target screen
   */
  buildNavigationSteps(navigationPath) {
    const steps = [];

    // Skip app_launch, login, home as they're in setup
    const relevantPath = navigationPath.filter(screen =>
      !['app_launch', 'splash', 'login', 'home'].includes(screen)
    );

    for (let i = 0; i < relevantPath.length; i++) {
      const screen = relevantPath[i];
      const className = this.screenClassMap[screen];

      steps.push({
        order: i + 1,
        screen,
        class: className || `${screen.charAt(0).toUpperCase() + screen.slice(1)}Screen`,
        method: `navigateTo${screen.charAt(0).toUpperCase() + screen.slice(1)}`,
        description: `Navigate to ${screen} screen`
      });
    }

    return steps;
  }

  /**
   * Identify test data requirements from mappings
   */
  identifyTestDataNeeds(mappings, setupSequence) {
    const requirements = [];

    // Check if login is needed
    const needsLogin = setupSequence.some(s => s.method === 'login');
    if (needsLogin) {
      requirements.push({
        type: 'user_credentials',
        variable: 'testData.getValidUser()',
        description: 'Valid user credentials for login'
      });
    }

    // Check mappings for parameter needs
    for (const mapping of mappings) {
      if (mapping.parameters && mapping.parameters.length > 0) {
        for (const param of mapping.parameters) {
          // Parse parameter type
          if (param.includes('String')) {
            requirements.push({
              type: 'string',
              variable: `test${mapping.action}Data`,
              description: `String data for ${mapping.action}`,
              context: mapping.action
            });
          } else if (param.includes('int') || param.includes('seconds')) {
            requirements.push({
              type: 'duration',
              variable: 'waitDuration',
              description: 'Wait duration in seconds',
              context: mapping.action
            });
          }
        }
      }

      // Special cases
      if (mapping.action?.includes('search')) {
        requirements.push({
          type: 'search_term',
          variable: 'searchQuery',
          description: 'Search query string'
        });
      }
      if (mapping.action?.includes('select') || mapping.action?.includes('content')) {
        requirements.push({
          type: 'content_data',
          variable: 'contentTitle',
          description: 'Content title or identifier'
        });
      }
    }

    // Deduplicate by type
    const seen = new Set();
    return requirements.filter(req => {
      if (seen.has(req.type)) return false;
      seen.add(req.type);
      return true;
    });
  }

  /**
   * Generate @BeforeMethod code snippet
   */
  generateBeforeMethodCode(prerequisites) {
    const lines = [];

    lines.push('@BeforeMethod');
    lines.push('public void setUp() {');

    for (const step of prerequisites.setupSequence) {
      const className = step.class;
      const varName = className.charAt(0).toLowerCase() + className.slice(1);
      const params = step.params.join(', ');

      if (step.class === 'BaseTest') {
        lines.push(`    ${step.method}();`);
      } else {
        lines.push(`    ${varName}.${step.method}(${params});`);
      }
    }

    // Add navigation steps
    for (const navStep of prerequisites.navigationToTarget) {
      const varName = navStep.class.charAt(0).toLowerCase() + navStep.class.slice(1);
      lines.push(`    ${varName}.${navStep.method}();`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Get agent statistics
   */
  getStats() {
    return {
      agent: 'PrerequisiteBuilderAgent',
      version: '1.0.0',
      screens: Object.keys(this.screenClassMap),
      graphNodes: Object.keys(this.screenGraph).length
    };
  }
}

// Export singleton instance
export const prerequisiteBuilderAgent = new PrerequisiteBuilderAgent();
export default prerequisiteBuilderAgent;
