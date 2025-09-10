import { domAnalyzerService } from '../services/domAnalyzerService.js';
import { geminiService } from '../services/geminiService.js';
import { logger } from '../utils/logger.js';

export class DomAnalyzerController {
  /**
   * Analyze DOM structure of a page
   */
  async analyzePage(req, res, next) {
    try {
      const { url, waitForSelector } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          error: 'URL is required' 
        });
      }

      logger.info(`Analyzing DOM for URL: ${url}`);
      const analysis = await domAnalyzerService.analyzePage(url, { waitForSelector });
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      logger.error('Error analyzing page:', error);
      next(error);
    } finally {
      // Clean up browser instance
      await domAnalyzerService.close();
    }
  }

  /**
   * Generate test with actual DOM locators
   */
  async generateTestWithDom(req, res, next) {
    try {
      const { url, manualTest, repoPath, testDirectory } = req.body;
      
      if (!url || !manualTest) {
        return res.status(400).json({ 
          error: 'URL and manual test are required' 
        });
      }

      // Step 1: Analyze the actual DOM
      logger.info('Analyzing DOM structure...');
      const domAnalysis = await domAnalyzerService.analyzePage(url);
      
      // Step 2: Generate smart locator map from actual DOM
      const locatorMap = this.generateLocatorMap(domAnalysis);
      
      // Step 3: Enhance manual test steps with actual locators
      const enhancedTest = this.enhanceTestWithLocators(manualTest, locatorMap);
      
      // Step 4: Generate automation code with Gemini using actual locators
      const prompt = this.buildEnhancedAutomationPrompt(enhancedTest, locatorMap, repoPath, testDirectory);
      
      const generatedTest = await geminiService.generateAutomationCode(prompt, {
        domAnalysis,
        locatorMap
      });
      
      res.json({
        success: true,
        test: generatedTest,
        domElementsFound: domAnalysis.elementCount,
        locatorsGenerated: Object.keys(locatorMap).length
      });
    } catch (error) {
      logger.error('Error generating test with DOM:', error);
      next(error);
    } finally {
      await domAnalyzerService.close();
    }
  }

  /**
   * Generate locator map from DOM analysis
   */
  generateLocatorMap(domAnalysis) {
    const locatorMap = {};
    
    // Process all elements and create a map of element names to locators
    domAnalysis.elements.forEach(element => {
      // Generate a key based on element characteristics
      const keys = [];
      
      // Use text content as primary key if available
      if (element.text) {
        keys.push(element.text.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      }
      
      // Also use data-testid if available
      if (element.attributes['data-testid']) {
        keys.push(element.attributes['data-testid']);
      }
      
      // Use id as key
      if (element.attributes.id) {
        keys.push(element.attributes.id);
      }
      
      // Store locators for each key
      keys.forEach(key => {
        if (key && !locatorMap[key]) {
          locatorMap[key] = {
            element,
            locators: element.locators,
            bestLocator: element.locators[0], // First one is highest priority
            tagName: element.tagName,
            attributes: element.attributes
          };
        }
      });
    });
    
    return locatorMap;
  }

  /**
   * Enhance test steps with actual locators
   */
  enhanceTestWithLocators(manualTest, locatorMap) {
    const enhanced = { ...manualTest };
    
    enhanced.steps = manualTest.steps.map(step => {
      const enhancedStep = { ...step };
      
      // Extract element references from the step action
      const elementRefs = this.extractElementReferences(step.action);
      
      // Find matching locators for each reference
      enhancedStep.locators = {};
      elementRefs.forEach(ref => {
        const key = ref.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (locatorMap[key]) {
          enhancedStep.locators[ref] = locatorMap[key];
        }
      });
      
      return enhancedStep;
    });
    
    return enhanced;
  }

  /**
   * Extract element references from step action text
   */
  extractElementReferences(action) {
    const references = [];
    
    // Look for quoted text
    const quotedMatches = action.match(/['"]([^'"]+)['"]/g);
    if (quotedMatches) {
      quotedMatches.forEach(match => {
        references.push(match.replace(/['"]/g, ''));
      });
    }
    
    // Look for button/link/field references
    const elementMatches = action.match(/(?:button|link|field|input|dropdown|checkbox)\s+(?:named\s+|called\s+)?['"]?([^'",.\s]+)['"]?/gi);
    if (elementMatches) {
      elementMatches.forEach(match => {
        const parts = match.split(/\s+/);
        if (parts.length > 1) {
          references.push(parts[parts.length - 1].replace(/['"]/g, ''));
        }
      });
    }
    
    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Build enhanced automation prompt with actual locators
   */
  buildEnhancedAutomationPrompt(enhancedTest, locatorMap, repoPath, testDirectory) {
    const className = this.generateClassName(enhancedTest.title);
    const packageName = testDirectory ? 
      testDirectory.replace(/\//g, '.').replace(/^\.+|\.+$/g, '') : 
      'com.example.tests';
    
    let prompt = `Generate a Java Selenium test class using ACTUAL DOM locators from the analyzed page.

PROJECT CONTEXT:
================
Package: ${packageName}
Class Name: ${className}

MANUAL TEST CASE:
=================
Title: ${enhancedTest.title}
Objective: ${enhancedTest.objective}

TEST STEPS WITH ACTUAL LOCATORS:
=================================`;

    enhancedTest.steps.forEach((step, index) => {
      prompt += `
Step ${index + 1}:
  Action: ${step.action}
  Expected: ${step.expectedResult || 'Verify action completes'}`;
      
      if (step.locators && Object.keys(step.locators).length > 0) {
        prompt += `
  Actual DOM Locators Found:`;
        Object.entries(step.locators).forEach(([elementName, locatorInfo]) => {
          prompt += `
    ${elementName}:`;
          locatorInfo.locators.slice(0, 3).forEach(loc => {
            if (loc.strategy === 'xpath') {
              prompt += `
      - By.xpath("${loc.value}")`;
            } else if (loc.strategy === 'id') {
              prompt += `
      - By.id("${loc.value}")`;
            } else if (loc.strategy === 'data-testid') {
              prompt += `
      - By.cssSelector("[data-testid='${loc.value}']")`;
            } else if (loc.strategy === 'name') {
              prompt += `
      - By.name("${loc.value}")`;
            } else {
              prompt += `
      - By.cssSelector("${loc.selector}")`;
            }
          });
        });
      }
    });

    prompt += `

AVAILABLE DOM ELEMENTS:
=======================
The following elements were found on the actual page:
`;

    // Add summary of available elements
    const buttons = Object.values(locatorMap).filter(l => l.tagName === 'button');
    const inputs = Object.values(locatorMap).filter(l => l.tagName === 'input');
    const links = Object.values(locatorMap).filter(l => l.tagName === 'a');

    if (buttons.length > 0) {
      prompt += `
Buttons (${buttons.length}):`;
      buttons.slice(0, 5).forEach(btn => {
        const text = btn.element.text || btn.element.attributes['aria-label'] || 'unnamed';
        prompt += `
  - "${text}" -> ${btn.bestLocator.selector || btn.bestLocator.value}`;
      });
    }

    if (inputs.length > 0) {
      prompt += `
Input Fields (${inputs.length}):`;
      inputs.slice(0, 5).forEach(input => {
        const name = input.element.attributes.name || input.element.attributes.id || 'unnamed';
        prompt += `
  - "${name}" (type: ${input.element.attributes.type || 'text'}) -> ${input.bestLocator.selector || input.bestLocator.value}`;
      });
    }

    prompt += `

REQUIREMENTS:
=============
1. Use the ACTUAL locators provided above - do not generate generic locators
2. For each element, implement a smart finder that tries multiple strategies:
   - First try the exact locator from DOM analysis
   - Then fallback to alternative locators if needed
3. Include proper error handling and logging
4. Use the actual element attributes found in the DOM
5. Generate helper methods like findElement_ButtonName() using the real locators

IMPORTANT: This is based on REAL DOM analysis, not guesswork. Use the exact locators provided.

Generate the complete Java test class.`;

    return prompt;
  }

  /**
   * Generate class name from title
   */
  generateClassName(title) {
    return title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Test';
  }

  /**
   * Capture and analyze current browser state
   */
  async capturePageState(req, res, next) {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          error: 'URL is required' 
        });
      }

      await domAnalyzerService.analyzePage(url);
      const state = await domAnalyzerService.extractPageState();
      
      res.json({
        success: true,
        state
      });
    } catch (error) {
      logger.error('Error capturing page state:', error);
      next(error);
    } finally {
      await domAnalyzerService.close();
    }
  }
}

// Export singleton instance
export const domAnalyzerController = new DomAnalyzerController();