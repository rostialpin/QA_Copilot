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
import { logger } from '../utils/logger.js';

class ActionMapperAgent {
  constructor() {
    this.knowledgeBase = actionKnowledgeBaseService;
    this.ragService = hybridRAGService;
    this.confidenceThreshold = 0.6;
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    // Ensure knowledge base is ready
    if (!this.knowledgeBase.isInitialized) {
      await this.knowledgeBase.initialize();
    }
    logger.info('ActionMapperAgent initialized');
  }

  /**
   * Map all steps from a decomposition result to actual methods
   *
   * @param {Object} decomposition - Output from ScenarioDecomposerAgent
   * @param {Object} options - Platform, brand, etc.
   * @returns {Object} Mapping results with found/unmapped actions
   */
  async mapSteps(decomposition, options = {}) {
    const { platform = null, brand = null } = options;
    const steps = decomposition.steps || [];

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
        unmapped.push({
          ...step,
          reason: mapping.reason || 'No matching method found',
          searchQuery: mapping.searchQuery
        });
      }
    }

    const avgConfidence = mappings.length > 0 ? totalConfidence / mappings.length : 0;

    return {
      success: true,
      mappings,
      unmapped,
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
   * Map a single step to a method
   *
   * @param {Object} step - Single decomposed step
   * @param {Object} context - Platform, brand context
   * @returns {Object} Mapping result
   */
  async mapSingleStep(step, context = {}) {
    const { action, target, details, source } = step;
    const { platform, brand } = context;

    // Build search query from step components
    const searchQuery = this.buildSearchQuery(action, target, details);

    logger.debug(`Mapping step: "${action}" target: "${target || 'none'}"`);

    // STRATEGY 1: Check learned patterns first (if already mapped before)
    const learnedResult = await this.checkLearnedPatterns(searchQuery, context);
    if (learnedResult.found && learnedResult.confidence >= this.confidenceThreshold) {
      logger.debug(`Found in learned patterns: ${learnedResult.methodName}`);
      return {
        ...step,
        status: 'found',
        source: 'learned_pattern',
        ...learnedResult
      };
    }

    // STRATEGY 2: Direct lookup in atomic actions (Knowledge Base)
    const atomicResult = await this.searchAtomicActions(searchQuery, target, platform, brand);
    if (atomicResult.found && atomicResult.confidence >= this.confidenceThreshold) {
      logger.debug(`Found in atomic actions: ${atomicResult.methodName}`);
      return {
        ...step,
        status: 'found',
        source: 'atomic_action',
        ...atomicResult
      };
    }

    // STRATEGY 3: Check composite actions (for multi-step actions)
    const compositeResult = await this.searchCompositeActions(searchQuery);
    if (compositeResult.found) {
      logger.debug(`Found composite action: ${compositeResult.actionName}`);
      return {
        ...step,
        status: 'found',
        source: 'composite_action',
        isComposite: true,
        ...compositeResult
      };
    }

    // STRATEGY 4: Semantic search in Hybrid RAG (methods collection)
    const ragResult = await this.searchHybridRAG(searchQuery, target, platform);
    if (ragResult.found && ragResult.confidence >= this.confidenceThreshold) {
      logger.debug(`Found in Hybrid RAG: ${ragResult.methodName}`);

      // Learn this mapping for future use
      await this.learnNewMapping(step, ragResult, context);

      return {
        ...step,
        status: 'found',
        source: 'hybrid_rag',
        ...ragResult
      };
    }

    // STRATEGY 5: Mark as unmapped
    logger.debug(`No mapping found for: "${action}"`);
    return {
      ...step,
      status: 'unmapped',
      reason: 'No matching method found with sufficient confidence',
      searchQuery,
      bestMatch: ragResult.bestMatch || atomicResult.bestMatch || null
    };
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
      const result = await this.knowledgeBase.findAtomicAction(
        query,
        { targetScreen, platform, brand },
        5
      );

      if (result.found && result.results?.length > 0) {
        const best = result.results[0];
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

      return { found: false, bestMatch: result.results?.[0] };
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

      if (result.found && result.results?.length > 0) {
        const best = result.results[0];
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
   * Search Hybrid RAG methods collection
   */
  async searchHybridRAG(query, targetScreen, platform) {
    try {
      // Check if RAG service is available
      if (!this.ragService || !this.ragService.isInitialized) {
        logger.debug('Hybrid RAG not available');
        return { found: false };
      }

      const results = await this.ragService.queryMethods(query, {
        topK: 5,
        minConfidence: 0.3,
        screen: targetScreen,
        platform
      });

      if (results && results.length > 0) {
        const best = results[0];
        return {
          found: true,
          methodName: best.methodName || best.name,
          className: best.className || best.class,
          file: best.file || best.filePath,
          confidence: best.confidence || best.score || 0.7,
          keywordsMatched: best.keywords || [],
          parameters: best.parameters || [],
          javadoc: best.javadoc || best.documentation,
          bestMatch: best
        };
      }

      return { found: false };
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
      version: '1.0.0',
      confidenceThreshold: this.confidenceThreshold,
      strategies: [
        'learned_patterns',
        'atomic_actions',
        'composite_actions',
        'hybrid_rag'
      ]
    };
  }
}

// Export singleton instance
export const actionMapperAgent = new ActionMapperAgent();
export default actionMapperAgent;
