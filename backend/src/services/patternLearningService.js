import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Pattern Learning Service
 * Learns from existing Cypress tests and TestRail patterns to generate better tests
 */
export class PatternLearningService {
  constructor() {
    this.patterns = {
      cypress: new Map(),
      testRail: new Map(),
      naming: new Map()
    };
    
    this.statistics = {
      totalPatterns: 0,
      cypressPatterns: 0,
      testRailPatterns: 0,
      lastUpdated: null
    };
    
    // Initialize with default patterns
    this.initializeDefaultPatterns();
  }

  initializeDefaultPatterns() {
    // Common Cypress patterns from Unified OAO
    this.patterns.cypress.set('video-player', {
      structure: `
describe('[Feature] - Video Player', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/video/:videoId');
    cy.waitForVideoLoad();
  });

  it('should [action] when [condition]', () => {
    // Arrange
    cy.get('[data-testid="video-player"]').should('be.visible');
    
    // Act
    cy.get('[data-testid="[button]"]').click();
    
    // Assert
    cy.get('[data-testid="[result]"]').should('[assertion]');
  });
});`,
      selectors: {
        pattern: 'data-testid',
        common: [
          'video-player',
          'play-button',
          'pause-button',
          'skip-intro-button',
          'volume-control',
          'seek-bar'
        ]
      },
      customCommands: [
        'cy.login()',
        'cy.waitForVideoLoad()',
        'cy.skipToTimestamp(seconds)',
        'cy.verifyVideoState(state)'
      ],
      platformHandling: `
// Platform-specific handling
if (Cypress.env('platform') === 'roku') {
  cy.remoteControl('OK');
} else {
  cy.get('[data-testid="button"]').click();
}`
    });

    // Navigation patterns
    this.patterns.cypress.set('navigation', {
      structure: `
describe('[Feature] - Navigation', () => {
  it('should navigate using remote control', () => {
    cy.navigateWithRemote('DOWN', 3);
    cy.navigateWithRemote('RIGHT', 1);
    cy.remoteControl('OK');
  });
});`,
      customCommands: [
        'cy.navigateWithRemote(direction, count)',
        'cy.remoteControl(button)',
        'cy.verifyFocus(element)'
      ]
    });

    // TestRail naming patterns
    this.patterns.naming.set('unified-oao', {
      testCase: '[Component] - [Feature] - [Scenario]',
      examples: [
        'Video Player - Skip Intro - Button Display Timing',
        'Video Player - Skip Intro - Remote Navigation',
        'Navigation - Browse Content - Category Selection'
      ]
    });

    this.statistics.totalPatterns = this.patterns.cypress.size + this.patterns.naming.size;
    this.statistics.lastUpdated = new Date();
  }

  /**
   * Learn patterns from a Cypress test file
   */
  async learnFromCypressFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const patterns = this.extractCypressPatterns(content);
      
      // Store learned patterns
      const fileName = path.basename(filePath, '.cy.js');
      this.patterns.cypress.set(fileName, patterns);
      
      this.statistics.cypressPatterns++;
      logger.info(`Learned patterns from ${fileName}`);
      
      return patterns;
    } catch (error) {
      logger.error(`Error learning from file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract patterns from Cypress test content
   */
  extractCypressPatterns(content) {
    const patterns = {
      describes: [],
      its: [],
      selectors: [],
      customCommands: [],
      assertions: [],
      beforeHooks: null,
      afterHooks: null
    };

    // Extract describe blocks
    const describeMatches = content.match(/describe\(['"`](.*?)['"`]/g);
    if (describeMatches) {
      patterns.describes = describeMatches.map(m => 
        m.match(/describe\(['"`](.*?)['"`]/)[1]
      );
    }

    // Extract it blocks
    const itMatches = content.match(/it\(['"`](.*?)['"`]/g);
    if (itMatches) {
      patterns.its = itMatches.map(m => 
        m.match(/it\(['"`](.*?)['"`]/)[1]
      );
    }

    // Extract selectors
    const selectorMatches = content.match(/\[data-testid=["']([^"']+)["']\]/g);
    if (selectorMatches) {
      patterns.selectors = [...new Set(selectorMatches.map(m => 
        m.match(/\[data-testid=["']([^"']+)["']\]/)[1]
      ))];
    }

    // Extract custom commands
    const commandMatches = content.match(/cy\.(\w+)\(/g);
    if (commandMatches) {
      const customCommands = commandMatches
        .map(m => m.match(/cy\.(\w+)\(/)[1])
        .filter(cmd => !['get', 'visit', 'click', 'type', 'should', 'wait'].includes(cmd));
      patterns.customCommands = [...new Set(customCommands)];
    }

    // Extract assertions
    const assertionMatches = content.match(/\.should\(['"`](.*?)['"`]/g);
    if (assertionMatches) {
      patterns.assertions = [...new Set(assertionMatches.map(m => 
        m.match(/\.should\(['"`](.*?)['"`]/)[1]
      ))];
    }

    // Extract beforeEach
    if (content.includes('beforeEach')) {
      const beforeMatch = content.match(/beforeEach\(\(\) => \{([\s\S]*?)\}\);/);
      if (beforeMatch) {
        patterns.beforeHooks = beforeMatch[1].trim();
      }
    }

    return patterns;
  }

  /**
   * Learn from TestRail test cases
   */
  async learnFromTestRail(testCases) {
    const patterns = {
      titles: [],
      steps: [],
      expectedResults: [],
      categories: new Map()
    };

    testCases.forEach(test => {
      // Learn title patterns
      patterns.titles.push(test.title);
      
      // Learn step patterns
      if (test.custom_steps) {
        const steps = test.custom_steps.split('\n').filter(s => s.trim());
        patterns.steps.push(...steps);
      }
      
      // Categorize by feature
      const feature = this.extractFeature(test.title);
      if (!patterns.categories.has(feature)) {
        patterns.categories.set(feature, []);
      }
      patterns.categories.get(feature).push(test);
    });

    // Store learned patterns
    this.patterns.testRail.set(`suite_${Date.now()}`, patterns);
    this.statistics.testRailPatterns++;
    
    return patterns;
  }

  /**
   * Extract feature from test title
   */
  extractFeature(title) {
    // Try to extract feature from common patterns
    const patterns = [
      /^(.+?) - /,  // "Video Player - Skip Intro"
      /^Test (.+?) /,  // "Test Login Functionality"
      /^Verify (.+?) /,  // "Verify Navigation Works"
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Default: use first two words
    const words = title.split(' ');
    return words.slice(0, 2).join(' ');
  }

  /**
   * Generate test based on learned patterns
   */
  async generateWithPatterns(ticket, context = {}) {
    const feature = this.identifyFeature(ticket);
    const patterns = this.getRelevantPatterns(feature);
    
    return {
      structure: this.buildTestStructure(ticket, patterns),
      naming: this.generateTestName(ticket, patterns),
      selectors: this.suggestSelectors(ticket, patterns),
      customCommands: this.suggestCommands(ticket, patterns),
      platformSpecific: this.generatePlatformCode(ticket)
    };
  }

  /**
   * Identify feature from ticket
   */
  identifyFeature(ticket) {
    const summary = ticket.summary.toLowerCase();
    
    if (summary.includes('video') || summary.includes('player')) {
      return 'video-player';
    }
    if (summary.includes('navigation') || summary.includes('browse')) {
      return 'navigation';
    }
    if (summary.includes('search')) {
      return 'search';
    }
    
    return 'general';
  }

  /**
   * Get relevant patterns for a feature
   */
  getRelevantPatterns(feature) {
    const cypressPattern = this.patterns.cypress.get(feature) || 
                          this.patterns.cypress.get('general');
    const namingPattern = this.patterns.naming.get('unified-oao');
    
    return {
      cypress: cypressPattern,
      naming: namingPattern,
      similar: this.findSimilarPatterns(feature)
    };
  }

  /**
   * Find similar patterns
   */
  findSimilarPatterns(feature) {
    const similar = [];
    
    for (const [key, pattern] of this.patterns.cypress) {
      if (key !== feature && this.calculateSimilarity(feature, key) > 0.7) {
        similar.push({ key, pattern });
      }
    }
    
    return similar;
  }

  /**
   * Calculate similarity between features
   */
  calculateSimilarity(feature1, feature2) {
    // Simple word overlap similarity
    const words1 = feature1.split('-');
    const words2 = feature2.split('-');
    
    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Build test structure based on patterns
   */
  buildTestStructure(ticket, patterns) {
    const template = patterns.cypress?.structure || this.getDefaultStructure();
    
    // Replace placeholders
    return template
      .replace('[Feature]', this.extractFeatureName(ticket))
      .replace('[action]', this.extractAction(ticket))
      .replace('[condition]', this.extractCondition(ticket));
  }

  /**
   * Generate test name following patterns
   */
  generateTestName(ticket, patterns) {
    if (patterns.naming) {
      const template = patterns.naming.testCase;
      return template
        .replace('[Component]', this.extractComponent(ticket))
        .replace('[Feature]', this.extractFeatureName(ticket))
        .replace('[Scenario]', this.extractScenario(ticket));
    }
    
    return `${ticket.type} - ${ticket.summary}`;
  }

  /**
   * Suggest selectors based on patterns
   */
  suggestSelectors(ticket, patterns) {
    const baseSelectors = patterns.cypress?.selectors?.common || [];
    const feature = this.extractFeatureName(ticket).toLowerCase();
    
    // Add feature-specific selectors
    const suggestions = [...baseSelectors];
    
    if (feature.includes('skip')) {
      suggestions.push('skip-intro-button', 'skip-recap-button');
    }
    if (feature.includes('play')) {
      suggestions.push('play-button', 'pause-button', 'video-player');
    }
    
    return suggestions;
  }

  /**
   * Suggest custom commands based on patterns
   */
  suggestCommands(ticket, patterns) {
    const commands = patterns.cypress?.customCommands || [];
    const relevant = [];
    
    // Filter relevant commands based on ticket
    const summary = ticket.summary.toLowerCase();
    
    commands.forEach(cmd => {
      if (summary.includes('video') && cmd.includes('video')) {
        relevant.push(cmd);
      }
      if (summary.includes('navigation') && cmd.includes('navigate')) {
        relevant.push(cmd);
      }
    });
    
    return relevant.length > 0 ? relevant : commands.slice(0, 3);
  }

  /**
   * Generate platform-specific code
   */
  generatePlatformCode(ticket) {
    if (ticket.description?.includes('Roku') || 
        ticket.description?.includes('CTV')) {
      return this.patterns.cypress.get('video-player')?.platformHandling || '';
    }
    return '';
  }

  // Helper methods
  extractComponent(ticket) {
    const summary = ticket.summary;
    if (summary.includes('Video Player')) return 'Video Player';
    if (summary.includes('Navigation')) return 'Navigation';
    if (summary.includes('Search')) return 'Search';
    return 'General';
  }

  extractFeatureName(ticket) {
    // Extract main feature from summary
    const summary = ticket.summary;
    const match = summary.match(/(?:Add|Fix|Update|Implement)\s+(.+?)(?:\s+to|\s+in|\s+for|$)/i);
    return match ? match[1] : summary;
  }

  extractAction(ticket) {
    const summary = ticket.summary.toLowerCase();
    if (summary.includes('click')) return 'click';
    if (summary.includes('navigate')) return 'navigate';
    if (summary.includes('skip')) return 'skip';
    if (summary.includes('play')) return 'play';
    return 'interact with';
  }

  extractCondition(ticket) {
    // Extract condition from acceptance criteria or description
    if (ticket.acceptanceCriteria) {
      const match = ticket.acceptanceCriteria.match(/when\s+(.+?)(?:\n|$)/i);
      if (match) return match[1];
    }
    return 'user interaction occurs';
  }

  extractScenario(ticket) {
    // Extract specific scenario from ticket
    const summary = ticket.summary;
    if (ticket.type === 'Bug') return 'Bug Fix';
    if (summary.includes('Button')) return 'Button Interaction';
    if (summary.includes('Navigation')) return 'Navigation Flow';
    return 'Feature Test';
  }

  getDefaultStructure() {
    return `
describe('Test Suite', () => {
  it('should perform action', () => {
    // Test implementation
  });
});`;
  }

  /**
   * Get statistics about learned patterns
   */
  getStatistics() {
    return {
      ...this.statistics,
      cypressPatternCount: this.patterns.cypress.size,
      testRailPatternCount: this.patterns.testRail.size,
      namingPatternCount: this.patterns.naming.size
    };
  }

  /**
   * Export patterns for caching
   */
  exportPatterns() {
    return {
      cypress: Array.from(this.patterns.cypress.entries()),
      testRail: Array.from(this.patterns.testRail.entries()),
      naming: Array.from(this.patterns.naming.entries()),
      statistics: this.statistics
    };
  }

  /**
   * Import patterns from cache
   */
  importPatterns(data) {
    if (data.cypress) {
      this.patterns.cypress = new Map(data.cypress);
    }
    if (data.testRail) {
      this.patterns.testRail = new Map(data.testRail);
    }
    if (data.naming) {
      this.patterns.naming = new Map(data.naming);
    }
    if (data.statistics) {
      this.statistics = data.statistics;
    }
  }
}

export default new PatternLearningService();