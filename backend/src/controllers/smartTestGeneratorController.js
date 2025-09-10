import { endpointDiscoveryService } from '../services/endpointDiscoveryService.js';
import { platformDomAnalyzer } from '../services/platformDomAnalyzerService.js';
import { domAnalyzerService } from '../services/domAnalyzerService.js';
import { geminiService } from '../services/geminiService.js';
import javaSeleniumService from '../services/javaSeleniumService.js';
import { logger } from '../utils/logger.js';

export class SmartTestGeneratorController {
  /**
   * Discover endpoints from repository
   */
  async discoverEndpoints(req, res, next) {
    try {
      const { repoPath } = req.body;
      
      if (!repoPath) {
        return res.status(400).json({ 
          error: 'Repository path is required' 
        });
      }

      logger.info(`Discovering endpoints in: ${repoPath}`);
      const discoveries = await endpointDiscoveryService.discoverEndpoints(repoPath);
      const suggestions = endpointDiscoveryService.generateTestSuggestions(discoveries);
      
      res.json({
        success: true,
        discoveries,
        suggestions,
        summary: {
          urlsFound: discoveries.urls.length,
          endpointsFound: discoveries.endpoints.length,
          configsFound: Object.keys(discoveries.configs).length,
          environmentsFound: Object.keys(discoveries.environments).length
        }
      });
    } catch (error) {
      logger.error('Error discovering endpoints:', error);
      next(error);
    }
  }

  /**
   * Generate test with automatic endpoint discovery and DOM analysis
   */
  async generateSmartTest(req, res, next) {
    try {
      const { 
        manualTest, 
        repoPath, 
        testDirectory,
        platform = 'web',
        url,  // Optional - will auto-discover if not provided
        appPackage,  // For Android
        bundleId     // For iOS
      } = req.body;
      
      if (!manualTest) {
        return res.status(400).json({ 
          error: 'Manual test is required' 
        });
      }

      let targetUrl = url;
      let discoveries = null;

      // Step 1: Auto-discover endpoints if URL not provided
      if (!url && repoPath) {
        logger.info('No URL provided, discovering from repository...');
        discoveries = await endpointDiscoveryService.discoverEndpoints(repoPath);
        const suggestions = endpointDiscoveryService.generateTestSuggestions(discoveries);
        
        // Use the first suggested URL
        if (suggestions.webURLs.length > 0) {
          targetUrl = suggestions.webURLs[0];
          logger.info(`Auto-discovered URL: ${targetUrl}`);
        } else if (suggestions.environments.length > 0 && suggestions.environments[0].urls.length > 0) {
          targetUrl = suggestions.environments[0].urls[0];
          logger.info(`Using environment URL: ${targetUrl}`);
        }
      }

      // Step 2: Connect to platform and analyze DOM/UI
      let domAnalysis = null;
      let platformConnection = null;
      
      if (platform === 'web' && targetUrl) {
        logger.info(`Analyzing DOM for: ${targetUrl}`);
        domAnalysis = await domAnalyzerService.analyzePage(targetUrl);
      } else {
        // Connect to other platforms
        platformConnection = await platformDomAnalyzer.connectToPlatform({
          platform,
          url: targetUrl,
          appPackage,
          bundleId
        });
        domAnalysis = {
          elements: await platformDomAnalyzer.getUIHierarchy(),
          platform
        };
      }

      // Step 3: Generate locator map from actual DOM
      const locatorMap = this.generateLocatorMap(domAnalysis);
      
      // Step 4: Enhance test steps with real locators
      const enhancedTest = this.enhanceTestWithLocators(manualTest, locatorMap, platform);
      
      // Step 5: Build prompt with real DOM data
      const prompt = await this.buildSmartTestPrompt(
        enhancedTest, 
        locatorMap, 
        platform,
        repoPath,
        testDirectory
      );
      
      // Step 6: Generate test with Gemini
      const generatedTest = await geminiService.generateAutomationCode(prompt, {
        domAnalysis,
        locatorMap,
        platform,
        discoveries
      });
      
      res.json({
        success: true,
        test: generatedTest,
        metadata: {
          platform,
          urlUsed: targetUrl,
          domElementsFound: domAnalysis.elements?.length || 0,
          locatorsGenerated: Object.keys(locatorMap).length,
          autoDiscovered: !url && !!targetUrl
        }
      });
    } catch (error) {
      logger.error('Error generating smart test:', error);
      next(error);
    } finally {
      // Clean up connections
      await domAnalyzerService.close().catch(() => {});
      await platformDomAnalyzer.disconnect().catch(() => {});
    }
  }

  /**
   * Generate locator map from DOM analysis
   */
  generateLocatorMap(domAnalysis) {
    const locatorMap = {};
    const elements = domAnalysis.elements || [];
    
    elements.forEach(element => {
      // Create multiple keys for each element
      const keys = new Set();
      
      // Use text content as key
      if (element.text) {
        keys.add(element.text.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30));
        keys.add(element.text.substring(0, 20)); // Also store partial text
      }
      
      // Use various attributes as keys
      ['id', 'name', 'data-testid', 'data-qa', 'aria-label'].forEach(attr => {
        const value = element.attributes?.[attr] || element[attr];
        if (value) {
          keys.add(value);
          keys.add(value.toLowerCase());
        }
      });
      
      // Store under all keys
      keys.forEach(key => {
        if (key && !locatorMap[key]) {
          locatorMap[key] = {
            element,
            locators: element.locators || [],
            bestLocator: element.locators?.[0],
            tagName: element.tagName,
            attributes: element.attributes || {}
          };
        }
      });
    });
    
    return locatorMap;
  }

  /**
   * Enhance test steps with real locators
   */
  enhanceTestWithLocators(manualTest, locatorMap, platform) {
    const enhanced = { ...manualTest };
    
    enhanced.steps = manualTest.steps.map(step => {
      const enhancedStep = { ...step };
      
      // Extract potential element references from the step
      const references = this.extractElementReferences(step.action);
      
      enhancedStep.locators = {};
      references.forEach(ref => {
        // Try multiple variations of the reference
        const variations = [
          ref,
          ref.toLowerCase(),
          ref.replace(/[^a-z0-9]/gi, '_'),
          ref.substring(0, 20)
        ];
        
        for (const variant of variations) {
          if (locatorMap[variant]) {
            enhancedStep.locators[ref] = locatorMap[variant];
            break;
          }
        }
      });
      
      return enhancedStep;
    });
    
    enhanced.platform = platform;
    return enhanced;
  }

  /**
   * Extract element references from action text
   */
  extractElementReferences(action) {
    const references = new Set();
    
    // Extract quoted text
    const quotedMatches = action.match(/['"]([^'"]+)['"]/g) || [];
    quotedMatches.forEach(match => {
      references.add(match.replace(/['"]/g, ''));
    });
    
    // Extract button/link/field names
    const patterns = [
      /(?:click|tap|press|select)\s+(?:on\s+)?(?:the\s+)?['"]?([^'",.\s]+)/gi,
      /(?:button|link|field|input|dropdown)\s+(?:named\s+|called\s+)?['"]?([^'",.\s]+)/gi,
      /(?:enter|type|input)\s+.*?\s+(?:in|into)\s+(?:the\s+)?['"]?([^'",.\s]+)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = [...action.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) references.add(match[1]);
      });
    });
    
    return Array.from(references);
  }

  /**
   * Build smart test prompt with real DOM data
   */
  async buildSmartTestPrompt(enhancedTest, locatorMap, platform, repoPath, testDirectory) {
    let prompt = `Generate a ${platform} automation test using REAL element locators from DOM analysis.

PLATFORM: ${platform.toUpperCase()}
TEST FRAMEWORK: ${platform === 'web' ? 'Selenium WebDriver' : platform === 'android' ? 'Appium/UIAutomator' : 'Platform-specific'}

MANUAL TEST:
============
Title: ${enhancedTest.title}
Objective: ${enhancedTest.objective}

ENHANCED STEPS WITH REAL LOCATORS:
===================================`;

    enhancedTest.steps.forEach((step, index) => {
      prompt += `

Step ${index + 1}: ${step.action}
Expected: ${step.expectedResult || 'Verify action completes'}`;
      
      if (Object.keys(step.locators).length > 0) {
        prompt += `
ACTUAL ELEMENT LOCATORS (from DOM):`;
        
        Object.entries(step.locators).forEach(([elementRef, locatorInfo]) => {
          prompt += `
  "${elementRef}":`;
          
          // Show up to 3 best locator strategies
          const strategies = locatorInfo.locators?.slice(0, 3) || [];
          strategies.forEach(loc => {
            if (platform === 'web') {
              if (loc.strategy === 'data-testid') {
                prompt += `
    By.cssSelector("[data-testid='${loc.value}']")  // BEST`;
              } else if (loc.strategy === 'id') {
                prompt += `
    By.id("${loc.value}")`;
              } else if (loc.xpath) {
                prompt += `
    By.xpath("${loc.xpath}")`;
              }
            } else if (platform === 'android') {
              if (loc.strategy === 'resource-id') {
                prompt += `
    By.id("${loc.value}")  // Android resource-id`;
              } else if (loc.uiautomator) {
                prompt += `
    ${loc.uiautomator}`;
              }
            }
          });
        });
      }
    });

    // Add available elements summary
    prompt += `

AVAILABLE DOM ELEMENTS (${Object.keys(locatorMap).length} found):
=================================================================`;

    // Group elements by type
    const buttons = Object.values(locatorMap).filter(l => 
      l.tagName === 'button' || l.element.attributes?.role === 'button'
    );
    const inputs = Object.values(locatorMap).filter(l => 
      l.tagName === 'input' || l.tagName === 'textarea'
    );
    const links = Object.values(locatorMap).filter(l => l.tagName === 'a');

    if (buttons.length > 0) {
      prompt += `

Buttons (${buttons.length} found):`;
      buttons.slice(0, 5).forEach(btn => {
        const text = btn.element.text || btn.element.attributes?.['aria-label'] || 'unnamed';
        const bestLoc = btn.bestLocator;
        prompt += `
  "${text}" -> ${bestLoc?.selector || bestLoc?.value || 'no locator'}`;
      });
    }

    if (inputs.length > 0) {
      prompt += `

Input Fields (${inputs.length} found):`;
      inputs.slice(0, 5).forEach(input => {
        const name = input.element.attributes?.name || input.element.attributes?.id || 'unnamed';
        const type = input.element.attributes?.type || 'text';
        const bestLoc = input.bestLocator;
        prompt += `
  "${name}" (${type}) -> ${bestLoc?.selector || bestLoc?.value || 'no locator'}`;
      });
    }

    prompt += `

REQUIREMENTS:
=============
1. Use ONLY the real locators provided above - these are from actual DOM analysis
2. Implement smart element finders with multiple fallback strategies
3. Each element should try the provided locators in order of priority
4. Include proper error handling and logging
5. Generate complete, runnable test code
6. DO NOT generate generic locators - use the exact ones provided

Generate the complete test class.`;

    return prompt;
  }
}

// Export singleton
export const smartTestGeneratorController = new SmartTestGeneratorController();