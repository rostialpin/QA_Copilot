import axios from 'axios';
import { logger } from '../utils/logger.js';

export class ConfluenceService {
  constructor() {
    this.baseURL = process.env.CONFLUENCE_URL || 'https://confluence.paramount.tech';
    this.email = process.env.CONFLUENCE_EMAIL || process.env.JIRA_EMAIL || process.env.ATLASSIAN_EMAIL;
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN || process.env.ATLASSIAN_TOKEN;
    
    if (!this.email || !this.apiToken) {
      logger.warn('Confluence credentials not configured. Using same as JIRA or set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN');
      this.configured = false;
    } else {
      this.configured = true;
      this.axiosInstance = axios.create({
        baseURL: `${this.baseURL}/wiki/rest/api`,
        auth: {
          username: this.email,
          password: this.apiToken
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      logger.info(`Confluence configured for ${this.baseURL}`);
    }
  }

  /**
   * Extract Confluence URLs from text
   */
  extractConfluenceUrls(text) {
    if (!text) return [];
    
    const urls = [];
    // Match Confluence URLs
    const patterns = [
      /https?:\/\/confluence\.paramount\.tech\/[^\s)}>]+/gi,
      /https?:\/\/[^\/\s]+\/wiki\/[^\s)}>]+/gi,
      /https?:\/\/[^\/\s]+\/display\/[^\s)}>]+/gi,
      /https?:\/\/[^\/\s]+\/pages\/viewpage\.action\?pageId=\d+/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        urls.push(...matches);
      }
    });
    
    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Parse page ID or space/title from Confluence URL
   */
  parseConfluenceUrl(url) {
    // Parse pageId from URL
    const pageIdMatch = url.match(/pageId=(\d+)/);
    if (pageIdMatch) {
      return { pageId: pageIdMatch[1] };
    }
    
    // Parse space and title from /display/ URL
    const displayMatch = url.match(/\/display\/([^\/]+)\/([^?#]+)/);
    if (displayMatch) {
      return { 
        spaceKey: displayMatch[1], 
        title: decodeURIComponent(displayMatch[2].replace(/\+/g, ' '))
      };
    }
    
    // Parse space and title from /wiki/spaces/ URL
    const spacesMatch = url.match(/\/wiki\/spaces\/([^\/]+)\/pages\/(\d+)/);
    if (spacesMatch) {
      return { 
        spaceKey: spacesMatch[1],
        pageId: spacesMatch[2]
      };
    }
    
    return null;
  }

  /**
   * Fetch Confluence page content
   */
  async fetchPage(url) {
    if (!this.configured) {
      logger.warn('Confluence not configured, cannot fetch page');
      return null;
    }
    
    try {
      const parsed = this.parseConfluenceUrl(url);
      if (!parsed) {
        logger.error('Could not parse Confluence URL:', url);
        return null;
      }
      
      let page;
      
      if (parsed.pageId) {
        // Fetch by page ID
        const response = await this.axiosInstance.get(`/content/${parsed.pageId}`, {
          params: {
            expand: 'body.storage,version'
          }
        });
        page = response.data;
      } else if (parsed.spaceKey && parsed.title) {
        // Fetch by space and title
        const response = await this.axiosInstance.get('/content', {
          params: {
            spaceKey: parsed.spaceKey,
            title: parsed.title,
            expand: 'body.storage,version'
          }
        });
        
        if (response.data.results && response.data.results.length > 0) {
          page = response.data.results[0];
        }
      }
      
      if (page) {
        logger.info(`Fetched Confluence page: ${page.title}`);
        return {
          id: page.id,
          title: page.title,
          url: url,
          content: page.body?.storage?.value || '',
          version: page.version?.number
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching Confluence page:', error.message);
      if (error.response?.status === 401) {
        logger.error('Confluence authentication failed. Check credentials.');
      }
      return null;
    }
  }

  /**
   * Parse Confluence HTML content to extract test scenarios
   */
  parseTestScenarios(htmlContent) {
    if (!htmlContent) return [];
    
    const scenarios = [];
    
    // Remove HTML tags but preserve structure
    const text = htmlContent
      .replace(/<style[^>]*>.*?<\/style>/gs, '') // Remove style tags
      .replace(/<script[^>]*>.*?<\/script>/gs, '') // Remove script tags
      .replace(/<ac:structured-macro[^>]*>.*?<\/ac:structured-macro>/gs, '') // Remove Confluence macros
      .replace(/<\/?(p|br|div|li)>/g, '\n') // Convert block elements to newlines
      .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n'); // Clean up excessive newlines
    
    // Look for test scenario patterns
    const patterns = [
      // Numbered scenarios
      /(?:test\s+)?scenario\s*\d+[:\.\)]\s*([^\n]+(?:\n(?!\d+[:\.\)]).*)*)/gi,
      // Test cases section
      /test\s+cases?:?\s*\n((?:[•\-\*\d]+[.\)]\s*[^\n]+\n?)+)/gi,
      // Validation section
      /validation\s+(?:steps?|scenarios?):?\s*\n((?:[•\-\*\d]+[.\)]\s*[^\n]+\n?)+)/gi,
      // QA section
      /qa\s+(?:steps?|scenarios?|validation):?\s*\n((?:[•\-\*\d]+[.\)]\s*[^\n]+\n?)+)/gi,
      // Acceptance criteria
      /acceptance\s+criteria:?\s*\n((?:[•\-\*\d]+[.\)]\s*[^\n]+\n?)+)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          // Parse individual items from the matched section
          const items = match[1].match(/[•\-\*\d]+[.\)]\s*([^\n]+)/g);
          if (items) {
            items.forEach(item => {
              const cleaned = item.replace(/^[•\-\*\d]+[.\)]\s*/, '').trim();
              if (cleaned.length > 10) { // Filter out very short items
                scenarios.push(cleaned);
              }
            });
          } else {
            // Add the whole match if no items found
            scenarios.push(match[1].trim());
          }
        }
      }
    });
    
    // Also extract any Given/When/Then scenarios
    const gwtPattern = /(?:given|when|then)[^\.]+\./gi;
    const gwtMatches = text.match(gwtPattern);
    if (gwtMatches) {
      scenarios.push(...gwtMatches.map(s => s.trim()));
    }
    
    return [...new Set(scenarios)]; // Remove duplicates
  }

  /**
   * Extract technical specifications from Confluence content
   */
  extractTechnicalSpecs(htmlContent) {
    if (!htmlContent) return {};
    
    const specs = {
      endpoints: [],
      dataFormats: [],
      uiElements: [],
      events: [],
      permissions: []
    };
    
    const text = htmlContent.replace(/<[^>]+>/g, ' ');
    
    // Extract API endpoints
    const endpointPattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-\{\}]+)/gi;
    const endpointMatches = text.matchAll(endpointPattern);
    for (const match of endpointMatches) {
      specs.endpoints.push({ method: match[0].split(/\s+/)[0], path: match[1] });
    }
    
    // Extract JSON examples
    const jsonPattern = /\{[^}]*"[^"]+"\s*:\s*[^}]+\}/g;
    const jsonMatches = text.match(jsonPattern);
    if (jsonMatches) {
      specs.dataFormats.push(...jsonMatches);
    }
    
    // Extract UI elements mentioned
    const uiPattern = /(?:button|field|dropdown|checkbox|radio|input|form|modal|dialog|tab|menu)\s+(?:named?|called?|labeled?)\s+"([^"]+)"/gi;
    const uiMatches = text.matchAll(uiPattern);
    for (const match of uiMatches) {
      specs.uiElements.push(match[1]);
    }
    
    // Extract Eden events if present
    const eventPattern = /(?:event|trigger|fire|emit)\s*[:\s]+\s*([a-z_]+(?:_[a-z]+)*)/gi;
    const eventMatches = text.matchAll(eventPattern);
    for (const match of eventMatches) {
      specs.events.push(match[1]);
    }
    
    return specs;
  }

  /**
   * Fetch and parse all Confluence links from a ticket
   */
  async fetchTicketDocumentation(ticket) {
    const allText = `${ticket.summary} ${ticket.description} ${ticket.acceptanceCriteria || ''}`;
    const urls = this.extractConfluenceUrls(allText);
    
    if (urls.length === 0) {
      return null;
    }
    
    logger.info(`Found ${urls.length} Confluence URL(s) in ticket`);
    
    const documentation = {
      pages: [],
      scenarios: [],
      technicalSpecs: {},
      rawUrls: urls
    };
    
    for (const url of urls) {
      const page = await this.fetchPage(url);
      if (page) {
        documentation.pages.push({
          title: page.title,
          url: page.url
        });
        
        // Extract test scenarios
        const scenarios = this.parseTestScenarios(page.content);
        documentation.scenarios.push(...scenarios);
        
        // Extract technical specs
        const specs = this.extractTechnicalSpecs(page.content);
        
        // Merge specs
        if (specs.endpoints.length > 0) {
          documentation.technicalSpecs.endpoints = [
            ...(documentation.technicalSpecs.endpoints || []),
            ...specs.endpoints
          ];
        }
        if (specs.uiElements.length > 0) {
          documentation.technicalSpecs.uiElements = [
            ...(documentation.technicalSpecs.uiElements || []),
            ...specs.uiElements
          ];
        }
        if (specs.events.length > 0) {
          documentation.technicalSpecs.events = [
            ...(documentation.technicalSpecs.events || []),
            ...specs.events
          ];
        }
      }
    }
    
    // Remove duplicate scenarios
    documentation.scenarios = [...new Set(documentation.scenarios)];
    
    return documentation;
  }
}

// Singleton instance
let confluenceService;

export function getConfluenceService() {
  if (!confluenceService) {
    confluenceService = new ConfluenceService();
  }
  return confluenceService;
}