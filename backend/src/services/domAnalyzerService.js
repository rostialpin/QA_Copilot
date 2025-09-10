import puppeteer from 'puppeteer';
import { logger } from '../utils/logger.js';

export class DomAnalyzerService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser instance
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    this.page = await this.browser.newPage();
  }

  /**
   * Analyze DOM structure of a given URL
   */
  async analyzePage(url, options = {}) {
    try {
      await this.initBrowser();
      
      logger.info(`Analyzing DOM structure for: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for any dynamic content to load
      if (options.waitForSelector) {
        await this.page.waitForSelector(options.waitForSelector, { timeout: 5000 });
      }
      
      // Extract element information from the page
      const elements = await this.page.evaluate(() => {
        const extractElements = () => {
          const elements = [];
          
          // Find all interactive elements
          const selectors = [
            'button',
            'a',
            'input',
            'select',
            'textarea',
            '[role="button"]',
            '[onclick]',
            '[data-testid]',
            '[data-qa]'
          ];
          
          selectors.forEach(selector => {
            const nodes = document.querySelectorAll(selector);
            nodes.forEach(node => {
              const elementInfo = {
                tagName: node.tagName.toLowerCase(),
                text: node.textContent?.trim().substring(0, 50),
                attributes: {},
                locators: [],
                xpath: getXPath(node)
              };
              
              // Extract useful attributes
              const importantAttrs = [
                'id', 'class', 'name', 'type', 'placeholder',
                'data-testid', 'data-qa', 'data-test',
                'aria-label', 'aria-describedby', 'role',
                'href', 'value', 'title', 'alt'
              ];
              
              importantAttrs.forEach(attr => {
                if (node.hasAttribute(attr)) {
                  elementInfo.attributes[attr] = node.getAttribute(attr);
                }
              });
              
              // Generate multiple locator strategies
              elementInfo.locators = generateLocators(node, elementInfo);
              
              // Only add if element has some identifying features
              if (elementInfo.locators.length > 0) {
                elements.push(elementInfo);
              }
            });
          });
          
          return elements;
        };
        
        // Helper function to generate XPath
        function getXPath(element) {
          if (element.id) {
            return `//*[@id="${element.id}"]`;
          }
          
          const parts = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = element.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && 
                  sibling.nodeName === element.nodeName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            const tagName = element.nodeName.toLowerCase();
            const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
            parts.unshift(part);
            element = element.parentNode;
          }
          return parts.length ? `/${parts.join('/')}` : null;
        }
        
        // Helper function to generate multiple locator strategies
        function generateLocators(node, elementInfo) {
          const locators = [];
          
          // Priority 1: data-testid
          if (elementInfo.attributes['data-testid']) {
            locators.push({
              strategy: 'data-testid',
              value: elementInfo.attributes['data-testid'],
              selector: `[data-testid="${elementInfo.attributes['data-testid']}"]`,
              priority: 1
            });
          }
          
          // Priority 2: ID
          if (elementInfo.attributes.id) {
            locators.push({
              strategy: 'id',
              value: elementInfo.attributes.id,
              selector: `#${elementInfo.attributes.id}`,
              priority: 2
            });
          }
          
          // Priority 3: data-qa
          if (elementInfo.attributes['data-qa']) {
            locators.push({
              strategy: 'data-qa',
              value: elementInfo.attributes['data-qa'],
              selector: `[data-qa="${elementInfo.attributes['data-qa']}"]`,
              priority: 3
            });
          }
          
          // Priority 4: Name attribute
          if (elementInfo.attributes.name) {
            locators.push({
              strategy: 'name',
              value: elementInfo.attributes.name,
              selector: `[name="${elementInfo.attributes.name}"]`,
              priority: 4
            });
          }
          
          // Priority 5: Aria-label
          if (elementInfo.attributes['aria-label']) {
            locators.push({
              strategy: 'aria-label',
              value: elementInfo.attributes['aria-label'],
              selector: `[aria-label="${elementInfo.attributes['aria-label']}"]`,
              priority: 5
            });
          }
          
          // Priority 6: Text content (for buttons and links)
          if (elementInfo.text && (node.tagName === 'BUTTON' || node.tagName === 'A')) {
            locators.push({
              strategy: 'text',
              value: elementInfo.text,
              selector: `${node.tagName.toLowerCase()}:contains("${elementInfo.text}")`,
              xpath: `//${node.tagName.toLowerCase()}[contains(text(), "${elementInfo.text}")]`,
              priority: 6
            });
          }
          
          // Priority 7: Class-based (if unique enough)
          if (elementInfo.attributes.class) {
            const classes = elementInfo.attributes.class.split(' ')
              .filter(c => c && !c.match(/^(btn|button|link|input)/i));
            if (classes.length > 0) {
              locators.push({
                strategy: 'class',
                value: classes[0],
                selector: `.${classes[0]}`,
                priority: 7
              });
            }
          }
          
          // Priority 8: XPath as fallback
          if (elementInfo.xpath) {
            locators.push({
              strategy: 'xpath',
              value: elementInfo.xpath,
              selector: elementInfo.xpath,
              priority: 8
            });
          }
          
          return locators.sort((a, b) => a.priority - b.priority);
        }
        
        return extractElements();
      });
      
      // Group elements by type for better organization
      const groupedElements = this.groupElementsByType(elements);
      
      // Generate page object mapping
      const pageObject = this.generatePageObject(groupedElements);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        elementCount: elements.length,
        elements,
        groupedElements,
        pageObject
      };
    } catch (error) {
      logger.error('Error analyzing page DOM:', error);
      throw error;
    }
  }

  /**
   * Group elements by their type/role
   */
  groupElementsByType(elements) {
    const groups = {
      buttons: [],
      links: [],
      inputs: [],
      selects: [],
      textareas: [],
      other: []
    };
    
    elements.forEach(element => {
      switch (element.tagName) {
        case 'button':
          groups.buttons.push(element);
          break;
        case 'a':
          groups.links.push(element);
          break;
        case 'input':
          groups.inputs.push(element);
          break;
        case 'select':
          groups.selects.push(element);
          break;
        case 'textarea':
          groups.textareas.push(element);
          break;
        default:
          groups.other.push(element);
      }
    });
    
    return groups;
  }

  /**
   * Generate page object pattern from DOM analysis
   */
  generatePageObject(groupedElements) {
    const pageObject = {
      buttons: {},
      inputs: {},
      links: {},
      elements: {}
    };
    
    // Process buttons
    groupedElements.buttons.forEach(button => {
      const name = this.generateElementName(button);
      pageObject.buttons[name] = {
        locators: button.locators,
        text: button.text
      };
    });
    
    // Process inputs
    groupedElements.inputs.forEach(input => {
      const name = this.generateElementName(input);
      pageObject.inputs[name] = {
        locators: input.locators,
        type: input.attributes.type || 'text',
        placeholder: input.attributes.placeholder
      };
    });
    
    // Process links
    groupedElements.links.forEach(link => {
      const name = this.generateElementName(link);
      pageObject.links[name] = {
        locators: link.locators,
        href: link.attributes.href,
        text: link.text
      };
    });
    
    return pageObject;
  }

  /**
   * Generate a meaningful name for an element
   */
  generateElementName(element) {
    // Try to use data-testid first
    if (element.attributes['data-testid']) {
      return element.attributes['data-testid'];
    }
    
    // Then try id
    if (element.attributes.id) {
      return element.attributes.id;
    }
    
    // Then try name
    if (element.attributes.name) {
      return element.attributes.name;
    }
    
    // Use text content if available
    if (element.text) {
      return element.text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
    }
    
    // Fallback to type + index
    return `${element.tagName}_element`;
  }

  /**
   * Capture screenshot of current page
   */
  async captureScreenshot(outputPath) {
    if (!this.page) {
      throw new Error('No page loaded. Call analyzePage first.');
    }
    
    await this.page.screenshot({ 
      path: outputPath, 
      fullPage: true 
    });
    
    logger.info(`Screenshot saved to: ${outputPath}`);
  }

  /**
   * Extract page state (for dynamic applications)
   */
  async extractPageState() {
    if (!this.page) {
      throw new Error('No page loaded. Call analyzePage first.');
    }
    
    return await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        cookies: document.cookie,
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });
  }

  /**
   * Analyze specific element by interacting with it
   */
  async analyzeElement(selector) {
    if (!this.page) {
      throw new Error('No page loaded. Call analyzePage first.');
    }
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      
      const elementInfo = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;
        
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        
        return {
          exists: true,
          visible: rect.width > 0 && rect.height > 0,
          position: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          },
          styles: {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex
          },
          interactive: {
            clickable: element.onclick !== null || 
                      element.tagName === 'BUTTON' || 
                      element.tagName === 'A',
            disabled: element.disabled,
            readonly: element.readOnly
          }
        };
      }, selector);
      
      return elementInfo;
    } catch (error) {
      logger.error(`Error analyzing element ${selector}:`, error);
      return { exists: false };
    }
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  // Alias methods for compatibility
  async initialize() {
    return this.initBrowser();
  }

  async cleanup() {
    return this.close();
  }
}

// Export singleton instance
export const domAnalyzerService = new DomAnalyzerService();
export default domAnalyzerService;