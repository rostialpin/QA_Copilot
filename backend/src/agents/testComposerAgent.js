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
    imports.push('import com.viacom.unified.model.TestData;');
    imports.push('import com.viacom.unified.support.DataProviderManager;');
    imports.push('import com.viacom.unified.support.TestParams;');
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

    // Check if we need test data
    const needsTestData = this.checkNeedsTestData(mappingResult, decomposition);
    if (needsTestData) {
      lines.push(`${indent}${indent}TestData data = getDefaultTestData();`);
    }

    lines.push(`${indent}${indent}try {`);

    // Setup steps
    lines.push(`${indent}${indent}${indent}launchAppAndNavigateToHomeScreen();`);

    // Test steps - combine mapped and unmapped actions
    const mappedSteps = mappingResult?.mappings || [];
    const unmappedSteps = mappingResult?.unmapped || [];
    const allSteps = [...mappedSteps, ...unmappedSteps].sort((a, b) => (a.id || 0) - (b.id || 0));

    // Fall back to decomposition steps if no mappings available
    const steps = allSteps.length > 0 ? allSteps : (decomposition?.steps || []);
    let stepNum = 1;

    for (const step of steps) {
      // Skip prerequisites (handled in setup)
      if (step.isPrerequisite) continue;

      // Add step as method call or comment
      const stepCode = this.generateStepCode(step, needsTestData);
      if (stepCode) {
        lines.push(`${indent}${indent}${indent}${stepCode}`);
        stepNum++;
      }
    }

    // Assert all at the end
    lines.push(`${indent}${indent}${indent}softAssert.assertAll();`);

    // Finally block
    lines.push(`${indent}${indent}} finally {`);
    if (needsTestData) {
      lines.push(`${indent}${indent}${indent}TestDataProvider.cleanupTestData(data);`);
    } else {
      lines.push(`${indent}${indent}${indent}// Cleanup handled by BaseTest`);
    }
    lines.push(`${indent}${indent}}`);

    // Close method
    lines.push(`${indent}}`);

    return lines;
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
    const dataKeywords = ['episode', 'movie', 'show', 'content', 'video', 'item', 'select', 'open'];

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
  generateStepCode(step, hasTestData) {
    const className = step.className || step.class;
    const methodName = step.methodName || step.method;

    if (step.status === 'found' && className && methodName) {
      // Use screen accessor pattern
      const accessor = this.screenAccessors[className] ||
        `${className.charAt(0).toLowerCase()}${className.slice(1)}()`;

      // Handle parameters
      let params = '';
      if (step.parameters && step.parameters.length > 0) {
        params = this.inferParameterValues(step, hasTestData);
      }

      return `${accessor}.${methodName}(${params});`;
    } else if (step.action) {
      // Unmapped action - generate TODO comment
      const description = step.action + (step.target ? ` ${step.target}` : '');
      return `// TODO: ${description}`;
    }

    return null;
  }

  /**
   * Infer parameter values from step context
   */
  inferParameterValues(step, hasTestData) {
    const params = [];

    for (const param of step.parameters) {
      if (param.includes('TestData') || param.includes('Item')) {
        if (hasTestData) {
          params.push('data');
        } else {
          params.push('getDefaultTestData()');
        }
      } else if (param.includes('String')) {
        if (step.details) {
          params.push(`"${this.escapeJavaString(step.details)}"`);
        } else {
          params.push('"testValue"');
        }
      } else if (param.includes('int') || param.includes('seconds')) {
        params.push('30');
      } else if (param.includes('boolean')) {
        params.push('true');
      } else if (param.includes('SoftAssert')) {
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
      version: '2.0.0',
      format: 'mqe-unified-oao-tests',
      basePackage: this.basePackage,
      supportedPlatforms: Object.keys(this.platformTypes),
      supportedBrands: Object.keys(this.brandTypes),
      supportedFeatures: Object.keys(this.featurePackageMap)
    };
  }
}

// Export singleton instance
export const testComposerAgent = new TestComposerAgent();
export default testComposerAgent;
