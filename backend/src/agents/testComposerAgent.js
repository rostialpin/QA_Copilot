/**
 * Test Composer Agent
 *
 * Assembles all pieces from the pipeline into a complete, runnable test class:
 * - Combines scenario, prerequisites, and method mappings
 * - Generates proper Java/TestNG structure matching mqe-unified-oao-tests format
 * - Uses @Factory pattern with TestParams
 * - Adds platform/brand/locale annotations
 * - Uses screen accessor methods (homeScreen(), playerScreen(), etc.)
 * - Implements SoftAssert with assertAll() pattern
 * - Adds dual step annotations (Allure + ReportPortal)
 *
 * @see /docs/architecture/multi-agent-test-generation-architecture.md
 */

import { logger } from '../utils/logger.js';

class TestComposerAgent {
  constructor() {
    // Package structure matching mqe-unified-oao-tests
    this.basePackage = 'com.viacom.unified.tests';

    // Feature to subpackage mapping
    this.featurePackageMap = {
      'playback': 'player.playback',
      'player': 'player.controls',
      'search': 'search',
      'navigation': 'navigation',
      'settings': 'settings',
      'login': 'account.authentication',
      'authentication': 'account.authentication',
      'account': 'account.accountsettings',
      'livetv': 'livetv',
      'live': 'livetv',
      'container': 'container',
      'accessibility': 'accessibility',
      'deeplink': 'deeplink',
      'ads': 'ars.advertisement',
      'tve': 'tve',
      'home': 'home',
      'browse': 'browse'
    };

    // Platform type mappings
    this.platformTypes = {
      'ctv': ['PlatformType.ANDROID_TV', 'PlatformType.FIRE_TV', 'PlatformType.ROKU', 'PlatformType.APPLE_TV'],
      'android_tv': ['PlatformType.ANDROID_TV'],
      'fire_tv': ['PlatformType.FIRE_TV'],
      'roku': ['PlatformType.ROKU'],
      'apple_tv': ['PlatformType.APPLE_TV'],
      'mobile': ['PlatformType.ANDROID', 'PlatformType.IOS'],
      'android': ['PlatformType.ANDROID'],
      'ios': ['PlatformType.IOS'],
      'web': ['PlatformType.TIZEN_TV', 'PlatformType.LG_WEBOS', 'PlatformType.VIZIO', 'PlatformType.HISENSE_TV'],
      'all': ['PlatformType.ANDROID_TV', 'PlatformType.FIRE_TV', 'PlatformType.ROKU', 'PlatformType.APPLE_TV', 'PlatformType.TIZEN_TV', 'PlatformType.LG_WEBOS', 'PlatformType.VIZIO', 'PlatformType.HISENSE_TV']
    };

    // Brand mappings
    this.brandTypes = {
      'bet_plus': 'Brand.BET_PLUS',
      'betplus': 'Brand.BET_PLUS',
      'vh1': 'Brand.VH1',
      'bet': 'Brand.BET',
      'mtv': 'Brand.MTV',
      'cmt': 'Brand.CMT',
      'paramount': 'Brand.PARAMOUNT_PLUS',
      'pplus': 'Brand.PARAMOUNT_PLUS'
    };

    // Screen accessor method mappings
    this.screenAccessors = {
      'HomeScreen': 'homeScreen()',
      'PlayerScreen': 'playerScreen()',
      'SearchScreen': 'searchScreen()',
      'ContainerScreen': 'containerScreen()',
      'SettingsScreen': 'settingsScreen()',
      'LoginScreen': 'signInScreen()',
      'SignInScreen': 'signInScreen()',
      'ProfileScreen': 'profileScreen()',
      'LiveTVScreen': 'liveTVScreen()',
      'BrowseScreen': 'browseScreen()',
      'WelcomeScreen': 'welcomeScreen()',
      'AccountScreen': 'accountScreen()',
      'TvProviderScreen': 'tvProviderScreen()',
      'LegalScreen': 'legalScreen()',
      'AccessibilityScreen': 'accessibilityScreen()'
    };

    // Test group constants
    this.groupConstants = {
      'functional': ['GroupConstants.FULL', 'GroupConstants.REGRESSION'],
      'smoke': ['GroupConstants.SMOKE', 'GroupConstants.PIPELINE'],
      'e2e': ['GroupConstants.FULL', 'GroupConstants.E2E'],
      'playback': ['GroupConstants.PLAYBACK', 'GroupConstants.ITEM_PLAYBACK'],
      'search': ['GroupConstants.SEARCH'],
      'navigation': ['GroupConstants.NAVIGATION'],
      'accessibility': ['GroupConstants.ACCESSIBILITY']
    };

    // Feature constants
    this.featureConstants = {
      'playback': 'FeatureConstants.PLAYBACK',
      'search': 'FeatureConstants.SEARCH',
      'navigation': 'FeatureConstants.NAVIGATION',
      'settings': 'FeatureConstants.SETTINGS',
      'login': 'FeatureConstants.AUTHENTICATION',
      'livetv': 'FeatureConstants.LIVE_TV',
      'container': 'FeatureConstants.CONTAINER',
      'player': 'FeatureConstants.PLAYER',
      'home': 'FeatureConstants.HOME',
      'browse': 'FeatureConstants.BROWSE'
    };

    // Code style settings
    this.codeStyle = {
      indent: '    ', // 4 spaces
      lineWidth: 120,
      addJavadoc: false, // mqe-unified doesn't use javadoc on methods
      addCopyright: true,
      copyrightYear: new Date().getFullYear()
    };

    // TestData provider methods mapping based on content type
    // Pattern: TestUtils.getDataWithSkip(TestDataProvider::{method})
    this.dataProviderMethods = {
      'episode': {
        getData: 'getThreadSafeEpisodeWithoutContinuousPlayback',
        getItem: 'getBrandFeedEpisodeItem',
        cleanup: 'removeThreadSafeEpisode'
      },
      'movie': {
        getData: 'getThreadSafeMovieWithoutContinuousPlayback',
        getItem: 'getBrandFeedMovieItem',
        cleanup: 'removeThreadSafeMovie'
      },
      'show': {
        getData: 'getThreadSafeEpisodeWithoutContinuousPlayback',
        getItem: 'getBrandFeedEpisodeItem',
        cleanup: 'removeThreadSafeEpisode'
      },
      'live': {
        getData: 'getThreadSafeLiveStream',
        getItem: 'getLiveStreamItem',
        cleanup: 'removeThreadSafeLiveStream'
      },
      'clip': {
        getData: 'getThreadSafeClip',
        getItem: 'getClipItem',
        cleanup: 'removeThreadSafeClip'
      },
      'default': {
        getData: 'getThreadSafeEpisodeWithoutContinuousPlayback',
        getItem: 'getBrandFeedEpisodeItem',
        cleanup: 'removeThreadSafeEpisode'
      }
    };
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    logger.info('TestComposerAgent initialized (mqe-unified-oao-tests format)');
  }

  /**
   * Compose a complete test class from pipeline outputs
   *
   * @param {Object} scenario - Original scenario with title and description
   * @param {Object} decomposition - Output from ScenarioDecomposerAgent
   * @param {Object} mappingResult - Output from ActionMapperAgent
   * @param {Object} prerequisites - Output from PrerequisiteBuilderAgent
   * @param {Object} options - Generation options
   * @returns {Object} Complete test class code and metadata
   */
  async composeTest(scenario, decomposition, mappingResult, prerequisites, options = {}) {
    const {
      className = null,
      packageName = null,
      platform = 'ctv',
      brand = null,
      testType = 'functional',
      tmsLinks = [],
      feature = null
    } = options;

    // Infer feature from scenario or decomposition
    const inferredFeature = feature || this.inferFeature(scenario.title, decomposition);

    // Generate package name based on feature
    const finalPackage = packageName || this.generatePackageName(inferredFeature);

    // Generate class name if not provided
    const finalClassName = className || this.generateClassName(scenario.title, testType);

    // Build the test code
    const code = this.buildTestClass({
      packageName: finalPackage,
      className: finalClassName,
      scenario,
      decomposition,
      mappingResult,
      prerequisites,
      platform,
      brand,
      testType,
      tmsLinks,
      feature: inferredFeature
    });

    // Generate metadata
    const metadata = this.generateMetadata({
      className: finalClassName,
      scenario,
      mappingResult,
      prerequisites,
      testType,
      platform,
      brand,
      feature: inferredFeature
    });

    return {
      success: true,
      code,
      metadata,
      className: finalClassName,
      packageName: finalPackage,
      fullClassName: `${finalPackage}.${finalClassName}`,
      unmappedActions: mappingResult.unmapped || [],
      warnings: this.generateWarnings(mappingResult, prerequisites)
    };
  }

  /**
   * Infer feature from scenario title
   */
  inferFeature(title, decomposition) {
    const titleLower = title.toLowerCase();

    // Check for feature keywords
    const featureKeywords = {
      'playback': ['play', 'video', 'episode', 'movie', 'stream', 'watch'],
      'search': ['search', 'find', 'query'],
      'navigation': ['navigate', 'menu', 'browse', 'scroll'],
      'settings': ['settings', 'preferences', 'config'],
      'login': ['login', 'sign in', 'authenticate', 'credentials'],
      'player': ['player', 'controls', 'pause', 'resume', 'seek'],
      'livetv': ['live', 'channel', 'tv guide'],
      'container': ['container', 'show', 'series', 'season'],
      'home': ['home', 'landing', 'main screen']
    };

    for (const [feature, keywords] of Object.entries(featureKeywords)) {
      if (keywords.some(kw => titleLower.includes(kw))) {
        return feature;
      }
    }

    // Check decomposition primary screen
    const primaryScreen = decomposition?.primary_screen || decomposition?.primaryScreen;
    if (primaryScreen) {
      const screenLower = primaryScreen.toLowerCase();
      if (screenLower.includes('player')) return 'playback';
      if (screenLower.includes('search')) return 'search';
      if (screenLower.includes('home')) return 'home';
      if (screenLower.includes('container')) return 'container';
    }

    return 'functional'; // default
  }

  /**
   * Generate package name based on feature
   */
  generatePackageName(feature) {
    const subPackage = this.featurePackageMap[feature] || feature;
    return `${this.basePackage}.${subPackage}`;
  }

  /**
   * Generate class name from scenario title
   */
  generateClassName(title, testType) {
    // Clean and convert to PascalCase
    const cleaned = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    // Add Test suffix if not present
    if (cleaned.endsWith('Test')) {
      return cleaned;
    }
    return `${cleaned}Test`;
  }

  /**
   * Build complete test class code in mqe-unified format
   */
  buildTestClass(params) {
    const {
      packageName,
      className,
      scenario,
      decomposition,
      mappingResult,
      prerequisites,
      platform,
      brand,
      testType,
      tmsLinks,
      feature
    } = params;

    const lines = [];
    const indent = this.codeStyle.indent;

    // Copyright header
    if (this.codeStyle.addCopyright) {
      lines.push('/*');
      lines.push(` * Copyright (c) ${this.codeStyle.copyrightYear} ViacomCBS MQE Automation Team as an unpublished work. Neither`);
      lines.push(' * this material nor any portion thereof may be copied or distributed');
      lines.push(' * without the express written consent of ViacomCBS MQE Automation Team.');
      lines.push(' *');
      lines.push(' * This material also contains proprietary and confidential information');
      lines.push(` * of ${this.codeStyle.copyrightYear} ViacomCBS MQE Automation Team and its suppliers, and may not be used by or`);
      lines.push(' * disclosed to any person, in whole or in part, without the prior written');
      lines.push(` * consent of ${this.codeStyle.copyrightYear} ViacomCBS MQE Automation Team.`);
      lines.push(' */');
      lines.push('');
    }

    // Package declaration
    lines.push(`package ${packageName};`);
    lines.push('');

    // Imports
    lines.push(...this.generateImports(mappingResult, prerequisites, platform, brand, feature));
    lines.push('');

    // Class declaration
    lines.push(`public class ${className} extends BaseTest {`);
    lines.push('');

    // Factory constructor
    lines.push(...this.generateFactoryConstructor(className, indent));
    lines.push('');

    // Main test method with annotations
    lines.push(...this.generateTestMethod(scenario, decomposition, mappingResult, prerequisites, {
      indent,
      platform,
      brand,
      testType,
      tmsLinks,
      feature
    }));

    // Helper methods (step methods)
    const helperMethods = this.generateHelperMethods(mappingResult, indent);
    if (helperMethods.length > 0) {
      lines.push('');
      lines.push(...helperMethods);
    }

    // Close class
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate import statements
   */
  generateImports(mappingResult, prerequisites, platform, brand, feature) {
    const imports = [];

    // Annotation imports
    imports.push('import com.viacom.unified.annotations.AppBrand;');
    imports.push('import com.viacom.unified.annotations.Locales;');
    imports.push('import com.viacom.unified.annotations.Platforms;');

    // Constants imports
    imports.push('import com.viacom.unified.constants.Brand;');
    imports.push('import com.viacom.unified.constants.FeatureConstants;');
    imports.push('import com.viacom.unified.constants.GroupConstants;');
    imports.push('import com.viacom.unified.constants.PlatformType;');

    // Data and support imports
    imports.push('import com.viacom.unified.model.Item;');
    imports.push('import com.viacom.unified.model.TestData;');
    imports.push('import com.viacom.unified.support.DataProviderManager;');
    imports.push('import com.viacom.unified.support.TestParams;');
    imports.push('import com.viacom.unified.support.TestUtils;');
    imports.push('import com.viacom.unified.support.data.TestDataProvider;');

    // Base test
    imports.push('import com.viacom.unified.tests.common.BaseTest;');

    // Logger
    imports.push('import com.viacom.unified.utils.logger.Logger;');

    // Allure imports
    imports.push('import io.qameta.allure.Description;');
    imports.push('import io.qameta.allure.Feature;');
    imports.push('import io.qameta.allure.TmsLink;');

    // TestNG imports
    imports.push('import org.testng.annotations.Factory;');
    imports.push('import org.testng.annotations.Test;');
    imports.push('import org.testng.asserts.SoftAssert;');

    // LocaleConstants static import
    imports.push('');
    imports.push('import static com.viacom.unified.constants.LocaleConstants.ALL_LOCALES;');

    return imports.sort((a, b) => {
      // Group imports: annotations, constants, model, support, tests, utils, io, org, static
      const order = (imp) => {
        if (imp.startsWith('import static')) return 9;
        if (imp.includes('.annotations.')) return 1;
        if (imp.includes('.constants.')) return 2;
        if (imp.includes('.model.')) return 3;
        if (imp.includes('.support.')) return 4;
        if (imp.includes('.tests.')) return 5;
        if (imp.includes('.utils.')) return 6;
        if (imp.includes('io.qameta')) return 7;
        if (imp.includes('org.testng')) return 8;
        return 5;
      };
      return order(a) - order(b);
    });
  }

  /**
   * Generate @Factory constructor
   */
  generateFactoryConstructor(className, indent) {
    const lines = [];

    lines.push(`${indent}@Factory(dataProvider = "defaultDataProvider", dataProviderClass = DataProviderManager.class)`);
    lines.push(`${indent}public ${className}(TestParams runParams) {`);
    lines.push(`${indent}${indent}super(runParams);`);
    lines.push(`${indent}}`);

    return lines;
  }

  /**
   * Generate main test method with all annotations
   */
  generateTestMethod(scenario, decomposition, mappingResult, prerequisites, options) {
    const { indent, platform, brand, testType, tmsLinks, feature } = options;
    const lines = [];

    // @Test annotation with groups
    const groups = this.getTestGroups(testType, feature);
    lines.push(`${indent}@Test(groups = {${groups.join(', ')}})`);

    // @TmsLink annotations
    if (tmsLinks && tmsLinks.length > 0) {
      tmsLinks.forEach(link => {
        lines.push(`${indent}@TmsLink("${link}")`);
      });
    } else {
      lines.push(`${indent}@TmsLink("TODO_ADD_TMS_LINK")`);
    }

    // @Description
    const description = this.escapeJavaString(scenario.title);
    lines.push(`${indent}@Description("${description}")`);

    // @Feature
    const featureConstant = this.featureConstants[feature] || 'FeatureConstants.FUNCTIONAL';
    lines.push(`${indent}@Feature(${featureConstant})`);

    // @Platforms
    const platforms = this.getPlatformTypes(platform);
    lines.push(`${indent}@Platforms({${platforms.join(', ')}})`);

    // @Locales
    lines.push(`${indent}@Locales({ALL_LOCALES})`);

    // @AppBrand
    const brands = this.getBrandTypes(brand);
    lines.push(`${indent}@AppBrand({${brands.join(', ')}})`);

    // Method signature
    const methodName = this.generateMethodName(scenario.title);
    lines.push(`${indent}public void ${methodName}() {`);

    // Method body
    lines.push(`${indent}${indent}SoftAssert softAssert = new SoftAssert();`);

    // Check if we're using MQE patterns from prerequisites
    const useMqePattern = prerequisites?.useMqePattern === true;
    const mqeSetupSequence = prerequisites?.prerequisites?.setupSequence || [];

    // Check if we need test data and determine content type
    const needsTestData = useMqePattern || this.checkNeedsTestData(mappingResult, decomposition);
    let dataProviderConfig = null;

    if (needsTestData) {
      const contentType = this.determineContentType(scenario, decomposition);
      dataProviderConfig = this.getDataProviderMethods(contentType);

      // TestData created BEFORE try block (following EpisodePlaybackTest pattern)
      lines.push(`${indent}${indent}TestData data = TestUtils.getDataWithSkip(TestDataProvider::${dataProviderConfig.getData});`);
    }

    lines.push(`${indent}${indent}try {`);

    // Item created INSIDE try block (following EpisodePlaybackTest pattern)
    if (needsTestData && dataProviderConfig) {
      lines.push(`${indent}${indent}${indent}Item item = TestDataProvider.${dataProviderConfig.getItem}(data);`);
    }

    // MQE Pattern: Render navigation steps from prerequisite builder
    if (useMqePattern && mqeSetupSequence.length > 0) {
      lines.push(`${indent}${indent}${indent}// Navigation to content`);
      for (const step of mqeSetupSequence) {
        const stepCode = this.generateMqeStepCode(step, indent);
        if (stepCode) {
          lines.push(`${indent}${indent}${indent}${stepCode}`);
        }
      }
      lines.push('');  // Blank line before main test steps
    } else {
      // Standard path: Check if precondition steps include login/navigate
      const mappedSteps = mappingResult?.mappings || [];
      const unmappedSteps = mappingResult?.unmapped || [];
      const allSteps = [...mappedSteps, ...unmappedSteps];

      const hasPreconditionLogin = allSteps.some(s =>
        s.originalSource === 'precondition' &&
        (s.action === 'login' || s.methodName === 'signIn')
      );
      const hasPreconditionNavigate = allSteps.some(s =>
        s.originalSource === 'precondition' &&
        s.action === 'navigate' &&
        (s.target?.includes('home') || s.methodName?.includes('Home'))
      );

      // Only add launchAppAndNavigateToHomeScreen if precondition doesn't handle it
      if (!hasPreconditionLogin && !hasPreconditionNavigate) {
        lines.push(`${indent}${indent}${indent}launchAppAndNavigateToHomeScreen();`);
      } else {
        lines.push(`${indent}${indent}${indent}// Precondition handles app launch and navigation`);
      }
    }

    // Test steps - combine mapped and unmapped actions
    const mappedSteps = mappingResult?.mappings || [];
    const unmappedSteps = mappingResult?.unmapped || [];
    const allSteps = [...mappedSteps, ...unmappedSteps].sort((a, b) => (a.id || 0) - (b.id || 0));

    // Fall back to decomposition steps if no mappings available
    const steps = allSteps.length > 0 ? allSteps : (decomposition?.steps || []);

    let stepNum = 1;

    // Track generated method calls to deduplicate
    // This prevents duplicate calls when composite actions overlap with individual actions
    const generatedMethods = new Set();

    // Helper to check if a method call would be a duplicate
    const isDuplicateMethod = (step) => {
      const methodName = step.methodName || step.method;
      if (!methodName) return false;

      const className = step.className || step.class;
      const key = `${className}_${methodName}`;

      // For generic methods like select(), check if ANY select was generated (regardless of screen)
      // These are often called after navigation and should not be duplicated
      const genericMethods = ['select', 'click', 'tap'];
      if (genericMethods.includes(methodName)) {
        const hasAnySelect = Array.from(generatedMethods).some(k => k.endsWith(`_${methodName}`));
        if (hasAnySelect) {
          logger.debug(`[TestComposer] Skipping duplicate ${methodName} call (already generated for another screen)`);
          return true;
        }
      }

      // Check exact key match
      if (generatedMethods.has(key)) {
        logger.debug(`[TestComposer] Skipping duplicate method call: ${key}`);
        return true;
      }

      return false;
    };

    // Track composite action names to prevent duplicate composite expansions
    const generatedComposites = new Set();

    // Helper to track methods from composite expansion
    const trackCompositeSteps = (step) => {
      const compositeSteps = step.steps || step.compositeSteps;
      if (step.isComposite && compositeSteps && Array.isArray(compositeSteps)) {
        // Track the composite action name itself
        const compositeName = step.methodName || step.actionName;
        if (compositeName) {
          generatedComposites.add(compositeName.toLowerCase());
        }
        for (const subStep of compositeSteps) {
          const subClassName = subStep.className || subStep.class;
          const subMethodName = subStep.methodName || subStep.method;
          if (subClassName && subMethodName) {
            generatedMethods.add(`${subClassName}_${subMethodName}`);
          }
        }
      } else {
        // Track single method
        const className = step.className || step.class;
        const methodName = step.methodName || step.method;
        if (className && methodName) {
          generatedMethods.add(`${className}_${methodName}`);
        }
      }
    };

    // Helper to check if a composite action was already generated
    const isDuplicateComposite = (step) => {
      if (!step.isComposite) return false;
      const compositeName = (step.methodName || step.actionName || '').toLowerCase();
      if (compositeName && generatedComposites.has(compositeName)) {
        logger.debug(`[TestComposer] Skipping duplicate composite action: ${compositeName}`);
        return true;
      }
      return false;
    };

    // Reorder steps: action steps should come before verification steps
    // This handles scenarios like "Verify X. Do Y." where verify comes first in text but should execute last
    const isVerifyStep = (step) => {
      const action = (step.action || '').toLowerCase();
      const methodName = (step.methodName || '').toLowerCase();
      return action.startsWith('verify') || action.startsWith('check') || action.startsWith('assert') ||
             methodName.startsWith('verify') || methodName.startsWith('check') || methodName.startsWith('assert');
    };

    // Separate into action steps and verify steps, then combine (actions first, then verifies)
    const mainSteps = steps.filter(s => !s.isPrerequisite || s.originalSource === 'precondition');
    const actionSteps = mainSteps.filter(s => !isVerifyStep(s));
    const verifySteps = mainSteps.filter(s => isVerifyStep(s));
    const reorderedSteps = [...actionSteps, ...verifySteps];

    logger.debug(`[TestComposer] Reordered steps: ${actionSteps.length} actions + ${verifySteps.length} verifications`);

    for (const step of reorderedSteps) {
      // Skip auto-added prerequisites (login/navigate handled in setup)
      // BUT include precondition steps (user-specified prerequisite actions)
      if (step.isPrerequisite && step.originalSource !== 'precondition') continue;

      // When using MQE pattern, skip precondition steps that are handled by the MQE setup sequence
      // (login, navigate to home, navigate to player, seek/watch duration)
      // Only main test steps (non-precondition) should be generated
      if (useMqePattern && step.originalSource === 'precondition') {
        logger.debug(`[TestComposer] Skipping precondition step (handled by MQE pattern): ${step.action} ${step.target || ''}`);
        continue;
      }

      // Skip if this is a duplicate composite action (same composite selected for multiple steps)
      if (isDuplicateComposite(step)) {
        continue;
      }

      // Skip if this is a duplicate method call (e.g., select after composite already has select)
      if (isDuplicateMethod(step)) {
        continue;
      }

      // Add step as method call or comment
      const stepCode = this.generateStepCode(step, needsTestData, decomposition);
      if (stepCode) {
        // Track methods for deduplication
        trackCompositeSteps(step);

        lines.push(`${indent}${indent}${indent}${stepCode}`);
        stepNum++;
      }
    }

    // Assert all at the end
    lines.push(`${indent}${indent}${indent}softAssert.assertAll();`);

    // Finally block
    lines.push(`${indent}${indent}} finally {`);
    if (needsTestData && dataProviderConfig) {
      lines.push(`${indent}${indent}${indent}TestDataProvider.${dataProviderConfig.cleanup}(data);`);
    } else {
      lines.push(`${indent}${indent}${indent}// Cleanup handled by BaseTest`);
    }
    lines.push(`${indent}${indent}}`);

    // Close method
    lines.push(`${indent}}`);

    return lines;
  }

  /**
   * Generate code for MQE prerequisite step
   */
  generateMqeStepCode(step, indent) {
    const className = step.class;
    const methodName = step.method;

    if (!methodName) return null;

    // BaseTest methods are called directly (no screen accessor)
    if (className === 'BaseTest') {
      return `${methodName}();`;
    }

    // Use screen accessor pattern
    const accessor = this.screenAccessors[className] ||
      `${className.charAt(0).toLowerCase()}${className.slice(1)}()`;

    // Handle parameters
    let params = '';
    if (step.params && step.params.length > 0) {
      params = step.params.join(', ');
    }

    // Include inline comment if present
    const comment = step.comment ? ` ${step.comment}` : '';

    return `${accessor}.${methodName}(${params});${comment}`;
  }

  /**
   * Generate helper/step methods with dual annotations
   */
  generateHelperMethods(mappingResult, indent) {
    const lines = [];
    const helperMethods = new Set();

    // Collect unique complex actions that warrant helper methods
    const mappings = mappingResult?.mappings || [];

    for (const mapping of mappings) {
      if (mapping.isComplex || (mapping.action && mapping.action.includes('verify'))) {
        const methodName = this.generateHelperMethodName(mapping.action);
        if (!helperMethods.has(methodName)) {
          helperMethods.add(methodName);

          const stepDescription = this.escapeJavaString(mapping.action || mapping.details);

          lines.push(`${indent}private static final String ${methodName.toUpperCase()}_STEP = "${stepDescription}";`);
          lines.push('');
          lines.push(`${indent}@io.qameta.allure.Step(${methodName.toUpperCase()}_STEP)`);
          lines.push(`${indent}@com.epam.reportportal.annotations.Step(${methodName.toUpperCase()}_STEP)`);
          lines.push(`${indent}private void ${methodName}(SoftAssert softAssert) {`);

          // Generate method body
          if (mapping.className && mapping.methodName) {
            const accessor = this.screenAccessors[mapping.className] || `${mapping.className.charAt(0).toLowerCase()}${mapping.className.slice(1)}()`;
            lines.push(`${indent}${indent}${accessor}.${mapping.methodName}();`);
          } else {
            lines.push(`${indent}${indent}// TODO: Implement ${mapping.action || 'action'}`);
          }

          lines.push(`${indent}}`);
          lines.push('');
        }
      }
    }

    return lines;
  }

  /**
   * Get test groups based on test type and feature
   */
  getTestGroups(testType, feature) {
    const groups = new Set();

    // Add type-based groups
    const typeGroups = this.groupConstants[testType] || ['GroupConstants.FULL'];
    typeGroups.forEach(g => groups.add(g));

    // Add feature-based groups
    const featureGroups = this.groupConstants[feature] || [];
    featureGroups.forEach(g => groups.add(g));

    return Array.from(groups);
  }

  /**
   * Get platform types
   */
  getPlatformTypes(platform) {
    if (!platform) {
      return this.platformTypes['ctv'];
    }

    const platformLower = platform.toLowerCase();
    return this.platformTypes[platformLower] || this.platformTypes['ctv'];
  }

  /**
   * Get brand types
   */
  getBrandTypes(brand) {
    if (!brand) {
      return ['Brand.BET_PLUS', 'Brand.VH1', 'Brand.BET'];
    }

    const brandLower = brand.toLowerCase().replace(/[^a-z]/g, '');
    const mappedBrand = this.brandTypes[brandLower];

    if (mappedBrand) {
      return [mappedBrand];
    }

    return ['Brand.BET_PLUS', 'Brand.VH1', 'Brand.BET'];
  }

  /**
   * Check if test needs TestData
   */
  checkNeedsTestData(mappingResult, decomposition) {
    const mappings = mappingResult?.mappings || [];
    const steps = decomposition?.steps || [];

    // Check for data-dependent actions
    const dataKeywords = ['episode', 'movie', 'show', 'content', 'video', 'item', 'select', 'open', 'play'];

    for (const mapping of mappings) {
      const action = (mapping.action || '').toLowerCase();
      const target = (mapping.target || '').toLowerCase();
      if (dataKeywords.some(kw => action.includes(kw) || target.includes(kw))) {
        return true;
      }
    }

    for (const step of steps) {
      const action = (step.action || '').toLowerCase();
      if (dataKeywords.some(kw => action.includes(kw))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine content type from scenario and decomposition
   * Used to select the appropriate TestDataProvider methods
   */
  determineContentType(scenario, decomposition) {
    const text = [
      scenario?.title || '',
      scenario?.description || '',
      ...(decomposition?.steps?.map(s => s.action || '') || [])
    ].join(' ').toLowerCase();

    // Check for specific content types
    if (text.includes('movie')) return 'movie';
    if (text.includes('live') || text.includes('channel')) return 'live';
    if (text.includes('clip') || text.includes('short')) return 'clip';
    if (text.includes('episode') || text.includes('show') || text.includes('series')) return 'episode';
    if (text.includes('play') || text.includes('video') || text.includes('content')) return 'episode';

    return 'default';
  }

  /**
   * Get data provider methods for content type
   */
  getDataProviderMethods(contentType) {
    return this.dataProviderMethods[contentType] || this.dataProviderMethods['default'];
  }

  /**
   * Generate method name from title
   */
  generateMethodName(title) {
    const cleaned = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map((word, idx) =>
        idx === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');

    // Ensure it ends with Test
    if (!cleaned.toLowerCase().endsWith('test')) {
      return `${cleaned}Test`;
    }

    return cleaned;
  }

  /**
   * Generate helper method name
   */
  generateHelperMethodName(action) {
    if (!action) return 'performAction';

    const cleaned = action
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map((word, idx) =>
        idx === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');

    return cleaned || 'performAction';
  }

  /**
   * Generate code for a test step
   */
  generateStepCode(step, hasTestData, decomposition = null) {
    // Handle composite actions - expand to multiple method calls
    // Support both `steps` array (from decomposer) and `compositeSteps` (from intelligent selector)
    const compositeSteps = step.steps || step.compositeSteps;

    // Debug: Log composite action detection
    if (step.isComposite || compositeSteps) {
      logger.debug(`[TestComposer] Step "${step.methodName || step.action}": isComposite=${step.isComposite}, hasSteps=${!!step.steps}, hasCompositeSteps=${!!step.compositeSteps}, stepsCount=${compositeSteps?.length || 0}`);
    }

    if (step.isComposite && compositeSteps && Array.isArray(compositeSteps)) {
      logger.info(`[TestComposer] Expanding composite action "${step.methodName}" to ${compositeSteps.length} steps`);
      const lines = [];
      for (const subStep of compositeSteps) {
        const subClassName = subStep.className || subStep.class;
        const subMethodName = subStep.methodName || subStep.method;
        if (subClassName && subMethodName) {
          const accessor = this.screenAccessors[subClassName] ||
            `${subClassName.charAt(0).toLowerCase()}${subClassName.slice(1)}()`;

          // Handle assertions in composite steps
          if (subStep.assertionType && subStep.assertionMessage) {
            lines.push(`softAssert.${subStep.assertionType}(${accessor}.${subMethodName}(), "${subStep.assertionMessage}");`);
          } else {
            let params = '';
            if (subStep.parameters && subStep.parameters.length > 0) {
              params = this.inferParameterValues(subStep, hasTestData, decomposition);
            }
            lines.push(`${accessor}.${subMethodName}(${params});`);
          }
        }
      }
      return lines.join('\n            ');
    }

    let className = step.className || step.class;
    const methodName = step.methodName || step.method;

    // If method is from BaseScreen, try to use a more specific screen based on context
    // BaseScreen methods are inherited, so we can call them on the appropriate screen
    if (className === 'BaseScreen' || className === 'baseScreen') {
      const inferredScreen = this.inferScreenFromContext(step, methodName);
      if (inferredScreen) {
        className = inferredScreen;
      }
    }

    if (step.status === 'found' && className && methodName) {
      // Use screen accessor pattern
      const accessor = this.screenAccessors[className] ||
        `${className.charAt(0).toLowerCase()}${className.slice(1)}()`;

      // Handle parameters
      let params = '';
      if (step.parameters && step.parameters.length > 0) {
        params = this.inferParameterValues(step, hasTestData, decomposition);
      }

      // Special handling for assertions (verify restart button displayed, etc.)
      if (step.assertionType && step.assertionMessage) {
        const comment = step.description ? ` // ${step.description}` : '';
        return `softAssert.${step.assertionType}(${accessor}.${methodName}(), "${step.assertionMessage}");${comment}`;
      }

      // Special handling for duration-based actions (seek forward)
      if (step.durationSeconds || step.source === 'duration_action') {
        const duration = step.durationSeconds || this.extractDurationFromStep(step) || 600;
        // Build comment based on seek mode (fast vs realistic)
        let comment = '';
        if (step.seekMode === 'fast' && step.actualDurationSeconds) {
          comment = ` // FAST MODE: Using ${duration}s seek (actual precondition: ${step.actualDurationSeconds}s)`;
        } else if (step.description) {
          comment = ` // ${step.description}`;
        }
        return `${accessor}.${methodName}(${duration});${comment}`;
      }

      // Special handling for wait/watch actions from preconditions
      if (step.originalSource === 'precondition' &&
          (step.action === 'watch' || methodName?.includes('wait'))) {
        // Extract duration from precondition details
        const duration = this.extractDurationFromStep(step);
        if (duration && !params) {
          params = `${duration}`;
        }
        // Add comment about precondition context
        const comment = step.details ? ` // ${step.details}` : '';
        return `${accessor}.${methodName}(${params || '/* duration */'});${comment}`;
      }

      return `${accessor}.${methodName}(${params});`;
    } else if (step.action || step.status === 'missing') {
      // Unmapped/missing action - generate clear MISSING comment for KB addition
      const description = step.action + (step.target ? ` ${step.target}` : '');
      const suggestion = step.suggestedAction || {};

      const lines = [];
      lines.push(`// MISSING ACTION: ${description}`);
      if (suggestion.suggestedClass && suggestion.suggestedMethod) {
        lines.push(`// Suggested: ${suggestion.suggestedClass}.${suggestion.suggestedMethod}()`);
      }
      lines.push(`// Add to Knowledge Base to resolve`);

      return lines.join('\n            ');
    }

    return null;
  }

  /**
   * Extract time duration from step details (e.g., "10 minutes", "45 seconds")
   */
  extractDurationFromStep(step) {
    // First check for structured duration field
    if (step.duration) {
      const { value, unit } = step.duration;
      if (unit?.includes('minute') || unit === 'min' || unit === 'm') {
        return value * 60; // Convert to seconds
      }
      return value; // Already in seconds
    }

    const details = step.details || step.target || '';

    // Match patterns like "10 minutes", "45 seconds", "30s", "5m"
    const minuteMatch = details.match(/(\d+)\s*(minute|min|m)\b/i);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1]);
      return minutes * 60; // Convert to seconds
    }

    const secondMatch = details.match(/(\d+)\s*(second|sec|s)\b/i);
    if (secondMatch) {
      return parseInt(secondMatch[1]);
    }

    return null;
  }

  /**
   * Infer the appropriate screen class based on step context
   * Used when method is from BaseScreen but should be called on a specific screen
   */
  inferScreenFromContext(step, methodName) {
    const methodLower = (methodName || '').toLowerCase();
    const action = (step.action || '').toLowerCase();
    const target = (step.target || '').toLowerCase();

    // Playback-related methods should use PlayerScreen
    if (methodLower.includes('playback') || methodLower.includes('video') ||
        methodLower.includes('seek') || methodLower.includes('time') ||
        methodLower.includes('restart') || methodLower.includes('resume') ||
        action.includes('playback') || target.includes('playback') ||
        target.includes('video') || target.includes('player')) {
      return 'PlayerScreen';
    }

    // Container/show-related methods should use ContainerScreen
    if (methodLower.includes('episode') || methodLower.includes('show') ||
        methodLower.includes('container') || methodLower.includes('season') ||
        target.includes('episode') || target.includes('show') ||
        target.includes('container') || target.includes('restart_button')) {
      return 'ContainerScreen';
    }

    // Home-related methods
    if (methodLower.includes('home') || methodLower.includes('feed') ||
        target.includes('home')) {
      return 'HomeScreen';
    }

    // Use screenContext if available from ScreenPathTracker
    if (step.screenContext?.currentScreen) {
      const screenMap = {
        'player': 'PlayerScreen',
        'container': 'ContainerScreen',
        'home': 'HomeScreen',
        'search': 'SearchScreen',
        'settings': 'SettingsScreen'
      };
      return screenMap[step.screenContext.currentScreen] || null;
    }

    return null; // Keep BaseScreen if can't determine
  }

  /**
   * Infer parameter values from step context
   * Handles the TestData + Item pattern: pass data, item, and indices correctly
   *
   * Known method signatures from EpisodePlaybackTest.java:
   * - openShowFromBrandFeedSection(data, item) - TestData first, then Item
   * - selectEpisode(item, episodeIndex, seasonIndex) - Item first, then indices
   * - signIn(username, password) - Strings
   * - navigateFromLaunchToHome() - No params or platform-specific
   */
  inferParameterValues(step, hasTestData, decomposition = null) {
    const methodName = (step.methodName || step.method || '');
    const methodNameLower = methodName.toLowerCase();
    const action = (step.action || '').toLowerCase();

    // Method-specific parameter patterns (based on real MQE tests)
    const methodParamPatterns = {
      // selectEpisode(item, episodeIndex, seasonIndex)
      'selectepisode': hasTestData ? 'item, data.getEpisodeIndex(), data.getSeasonIndex()' : '',
      // openShowFromBrandFeedSection(data, item)
      'openshowfrombrandfeedsection': hasTestData ? 'data, item' : '',
      // signIn(username, password) - usually handled by signInWithCredentials or similar
      'signin': '/* username */, /* password */',
      // navigateFromLaunchToHome() - typically no params
      'navigatefromlaunchtohome': '',
      // waitForVideoLoaded() - no params
      'waitforvideoloaded': '',
      // scrollToRestartButton() - might need data/item for context
      'scrolltorestartbutton': hasTestData ? '' : '',
      // backFromPlayer() - might need item
      'backfromplayer': '',
      // waitFor(seconds) - duration
      'waitfor': '30',
    };

    // Check for exact method match first
    if (methodParamPatterns.hasOwnProperty(methodNameLower)) {
      return methodParamPatterns[methodNameLower];
    }

    // Pattern-based inference for unknown methods
    const params = [];

    // Skip if no parameters defined
    if (!step.parameters || step.parameters.length === 0) {
      // Infer based on method name patterns
      if (hasTestData) {
        if (methodNameLower.includes('select') && methodNameLower.includes('episode')) {
          return 'item, data.getEpisodeIndex(), data.getSeasonIndex()';
        }
        if (methodNameLower.includes('open') || methodNameLower.includes('brandfeed')) {
          return 'data, item';
        }
      }
      return '';
    }

    for (const param of step.parameters) {
      const paramLower = param.toLowerCase();

      if (paramLower.includes('testdata')) {
        params.push('data');
      } else if (paramLower.includes('item')) {
        params.push('item');
      } else if (paramLower.includes('episodeindex')) {
        params.push('data.getEpisodeIndex()');
      } else if (paramLower.includes('seasonindex')) {
        params.push('data.getSeasonIndex()');
      } else if (paramLower.includes('index') || paramLower.includes('int')) {
        // Check context for which index
        if (action.includes('episode') || methodNameLower.includes('episode')) {
          params.push('data.getEpisodeIndex()');
        } else if (action.includes('season') || methodNameLower.includes('season')) {
          params.push('data.getSeasonIndex()');
        } else {
          params.push('0');
        }
      } else if (paramLower.includes('string')) {
        if (step.details) {
          params.push(`"${this.escapeJavaString(step.details)}"`);
        } else {
          params.push('"testValue"');
        }
      } else if (paramLower.includes('seconds') || paramLower.includes('timeout')) {
        // Extract duration from step if available
        const duration = this.extractDurationFromStep(step);
        params.push(duration || '30');
      } else if (paramLower.includes('boolean')) {
        params.push('true');
      } else if (paramLower.includes('softassert')) {
        params.push('softAssert');
      } else {
        params.push('/* TODO */');
      }
    }

    return params.join(', ');
  }

  /**
   * Escape string for Java
   */
  escapeJavaString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Generate test metadata
   */
  generateMetadata(params) {
    const { className, scenario, mappingResult, prerequisites, testType, platform, brand, feature } = params;

    return {
      className,
      testType,
      platform,
      brand,
      feature,
      format: 'mqe-unified-oao-tests',
      scenario: {
        title: scenario.title,
        description: scenario.description
      },
      statistics: {
        totalSteps: mappingResult?.mappings?.length || 0,
        unmappedSteps: mappingResult?.unmapped?.length || 0,
        screens: prerequisites?.screenChain?.length || 0,
        imports: 15 // Standard imports count
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate warnings for potential issues
   */
  generateWarnings(mappingResult, prerequisites) {
    const warnings = [];

    // Unmapped actions
    if (mappingResult?.unmapped?.length > 0) {
      warnings.push({
        type: 'unmapped_actions',
        message: `${mappingResult.unmapped.length} action(s) could not be mapped to existing methods`,
        actions: mappingResult.unmapped.map(a => a.action)
      });
    }

    // Low confidence mappings
    const lowConfidence = mappingResult?.mappings?.filter(m =>
      m.confidence && m.confidence < 0.7
    ) || [];

    if (lowConfidence.length > 0) {
      warnings.push({
        type: 'low_confidence',
        message: `${lowConfidence.length} mapping(s) have low confidence`,
        actions: lowConfidence.map(a => ({
          action: a.action,
          confidence: a.confidence
        }))
      });
    }

    // No navigation path
    if (!prerequisites?.prerequisites?.navigationToTarget ||
        prerequisites.prerequisites.navigationToTarget.length === 0) {
      warnings.push({
        type: 'no_navigation',
        message: 'No navigation path to target screen was generated'
      });
    }

    // Missing TMS links
    warnings.push({
      type: 'missing_tms_link',
      message: 'TMS link needs to be added manually'
    });

    return warnings;
  }

  /**
   * Get agent statistics
   */
  getStats() {
    return {
      agent: 'TestComposerAgent',
      version: '2.1.0',
      format: 'mqe-unified-oao-tests',
      features: ['TestData+Item pattern', 'content-type detection', 'proper cleanup'],
      basePackage: this.basePackage,
      supportedPlatforms: Object.keys(this.platformTypes),
      supportedBrands: Object.keys(this.brandTypes),
      supportedFeatures: Object.keys(this.featurePackageMap),
      supportedContentTypes: Object.keys(this.dataProviderMethods)
    };
  }
}

// Export singleton instance
export const testComposerAgent = new TestComposerAgent();
export default testComposerAgent;
