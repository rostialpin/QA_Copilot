/**
 * Action Knowledge Base Service
 *
 * Three-layer system that bridges human-readable test descriptions
 * and machine-executable test code:
 *
 * Layer 1: Atomic Actions - Individual method-level mappings
 * Layer 2: Composite Actions - Action chains/sequences
 * Layer 3: User Terminology - Learned domain-specific terms
 *
 * @see /docs/architecture/multi-agent-test-generation-architecture.md
 */

import { ChromaClient } from 'chromadb';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

/**
 * Custom embedding function using OpenRouter
 * This avoids issues with the default ChromaDB embedding function on M1 Macs
 */
class OpenRouterEmbeddingFunction {
  constructor() {
    const apiKey = (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '').split(/[,;\n]/)[0]?.trim();

    if (apiKey && apiKey.startsWith('sk-or-')) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1'
      });
      this.model = 'openai/text-embedding-3-small';
      this.enabled = true;
    } else {
      this.enabled = false;
      logger.warn('OpenRouter embedding function disabled - no API key found');
    }
  }

  async generate(texts) {
    if (!this.enabled) {
      // Fallback: generate simple hash-based embeddings for testing
      return texts.map(text => this.simpleHash(text));
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error(`Embedding generation failed: ${error.message}`);
      // Fallback to simple hash
      return texts.map(text => this.simpleHash(text));
    }
  }

  // Simple fallback embedding (not semantic, just for testing)
  simpleHash(text) {
    const embedding = new Array(384).fill(0);
    const normalized = text.toLowerCase();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = (i * 31 + charCode) % 384;
      embedding[idx] += (charCode / 255);
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    return embedding.map(val => val / magnitude);
  }
}

class ActionKnowledgeBaseService {
  constructor() {
    this.chromaClient = null;
    this.embeddingFunction = null;
    this.collections = {
      atomicActions: null,
      compositeActions: null,
      userTerminology: null,
      learnedDecompositions: null  // Layer 4: AI-learned scenario patterns
    };
    this.isInitialized = false;

    // Synonym map for keyword expansion
    this.synonymMap = {
      'click': ['tap', 'press', 'select', 'hit'],
      'verify': ['check', 'assert', 'validate', 'confirm', 'ensure'],
      'wait': ['pause', 'delay', 'sleep', 'hold'],
      'navigate': ['go', 'open', 'visit', 'goto'],
      'enter': ['type', 'input', 'fill', 'write'],
      'scroll': ['swipe', 'drag', 'slide'],
      'play': ['start', 'begin', 'launch', 'initiate'],
      'stop': ['pause', 'halt', 'end', 'terminate'],
      'get': ['fetch', 'retrieve', 'obtain', 'read'],
      'set': ['update', 'modify', 'change', 'configure'],
      'login': ['signin', 'authenticate', 'logon'],
      'logout': ['signout', 'logoff', 'disconnect'],
      'search': ['find', 'lookup', 'query', 'filter'],
      'close': ['dismiss', 'hide', 'remove', 'exit']
    };
  }

  /**
   * Initialize connection to ChromaDB and create collections
   */
  async initialize(chromaHost = 'http://localhost:8000') {
    if (this.isInitialized) {
      return true;
    }

    try {
      this.chromaClient = new ChromaClient({ path: chromaHost });

      // Initialize custom embedding function
      this.embeddingFunction = new OpenRouterEmbeddingFunction();

      // Layer 1: Atomic Actions
      this.collections.atomicActions = await this.chromaClient.getOrCreateCollection({
        name: 'atomic_actions',
        metadata: { description: 'Method-level action mappings' },
        embeddingFunction: this.embeddingFunction
      });

      // Layer 2: Composite Actions
      this.collections.compositeActions = await this.chromaClient.getOrCreateCollection({
        name: 'composite_actions',
        metadata: { description: 'Action chains and sequences' },
        embeddingFunction: this.embeddingFunction
      });

      // Layer 3: User Terminology
      this.collections.userTerminology = await this.chromaClient.getOrCreateCollection({
        name: 'user_terminology',
        metadata: { description: 'Learned domain-specific terminology' },
        embeddingFunction: this.embeddingFunction
      });

      // Layer 4: Learned Decompositions (AI-generated, cached for reuse)
      this.collections.learnedDecompositions = await this.chromaClient.getOrCreateCollection({
        name: 'learned_decompositions',
        metadata: { description: 'AI-learned scenario decomposition patterns' },
        embeddingFunction: this.embeddingFunction
      });

      this.isInitialized = true;
      logger.info('ActionKnowledgeBaseService initialized with 4 collections');

      return true;
    } catch (error) {
      logger.error('Failed to initialize ActionKnowledgeBaseService:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  // ============ LAYER 1: Atomic Actions ============

  /**
   * Add an atomic action (method-level mapping)
   * @param {Object} action - Atomic action object
   */
  async addAtomicAction(action) {
    if (!this.isInitialized) await this.initialize();

    const {
      id,
      actionName,
      methodName,
      className,
      filePath,
      relativePath = filePath,  // For multi-platform repos
      platform = null,          // ctv | mobile | web | html5 | hdmi | null
      brand = null,             // pplus | plutotv | null
      returnType = 'void',
      parameters = [],
      keywords = [],
      targetScreen = null,
      confidence = 0.8
    } = action;

    // Create searchable document text (include platform/brand for better search)
    const documentText = [
      actionName,
      methodName,
      className,
      platform,
      brand,
      ...keywords,
      targetScreen
    ].filter(Boolean).join(' ');

    try {
      await this.collections.atomicActions.add({
        ids: [id],
        documents: [documentText],
        metadatas: [{
          actionName,
          methodName,
          className,
          filePath,
          relativePath,
          platform: platform || '',
          brand: brand || '',
          returnType,
          parameters: JSON.stringify(parameters),
          keywords: JSON.stringify(keywords),
          targetScreen: targetScreen || '',
          usageCount: 0,
          confidence,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString()
        }]
      });

      logger.debug(`Added atomic action: ${actionName} -> ${className}.${methodName}()`);
      return { success: true, id };
    } catch (error) {
      // Check if it's a duplicate ID error
      if (error.message?.includes('already exists')) {
        logger.debug(`Atomic action ${id} already exists, updating instead`);
        return await this.updateAtomicAction(id, action);
      }
      logger.error(`Failed to add atomic action: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find atomic action by semantic search
   * @param {string} actionQuery - Action to find (e.g., "start playback", "click play")
   * @param {Object} filters - Optional filters
   * @param {string} filters.targetScreen - Screen filter
   * @param {string} filters.platform - Platform filter (ctv, mobile, web, html5, hdmi)
   * @param {string} filters.brand - Brand filter (pplus, plutotv)
   * @param {number} topK - Number of results to return
   */
  async findAtomicAction(actionQuery, filters = {}, topK = 5) {
    if (!this.isInitialized) await this.initialize();

    const { targetScreen = null, platform = null, brand = null } =
      typeof filters === 'string' ? { targetScreen: filters } : filters;

    // Build query text with context
    const queryParts = [actionQuery];
    if (platform) queryParts.push(platform);
    if (brand) queryParts.push(brand);
    if (targetScreen) queryParts.push(targetScreen);
    const queryText = queryParts.join(' ');

    try {
      // Build where clause for filtering
      const whereConditions = [];
      if (targetScreen) whereConditions.push({ targetScreen: { $eq: targetScreen } });
      if (platform) whereConditions.push({ platform: { $eq: platform } });
      if (brand) whereConditions.push({ brand: { $eq: brand } });

      const whereClause = whereConditions.length > 1
        ? { $and: whereConditions }
        : whereConditions.length === 1
          ? whereConditions[0]
          : undefined;

      const results = await this.collections.atomicActions.query({
        queryTexts: [queryText],
        nResults: topK,
        where: whereClause
      });

      if (!results.metadatas[0] || results.metadatas[0].length === 0) {
        return { found: false, query: actionQuery };
      }

      // Parse JSON fields and add confidence from distance
      const matches = results.metadatas[0].map((meta, index) => ({
        ...meta,
        parameters: JSON.parse(meta.parameters || '[]'),
        keywords: JSON.parse(meta.keywords || '[]'),
        distance: results.distances[0][index],
        confidence: Math.max(0, 1 - results.distances[0][index])
      }));

      // Return best match
      const bestMatch = matches[0];

      return {
        found: bestMatch.confidence > 0.4,
        bestMatch,
        allMatches: matches,
        query: actionQuery
      };
    } catch (error) {
      logger.error(`Failed to find atomic action: ${error.message}`);
      return { found: false, error: error.message, query: actionQuery };
    }
  }

  /**
   * Update an existing atomic action
   */
  async updateAtomicAction(id, updates) {
    if (!this.isInitialized) await this.initialize();

    try {
      // Get existing action
      const existing = await this.collections.atomicActions.get({
        ids: [id]
      });

      if (!existing.metadatas || existing.metadatas.length === 0) {
        return { success: false, error: 'Action not found' };
      }

      const currentMeta = existing.metadatas[0];
      const updatedMeta = {
        ...currentMeta,
        ...updates,
        parameters: JSON.stringify(updates.parameters || JSON.parse(currentMeta.parameters || '[]')),
        keywords: JSON.stringify(updates.keywords || JSON.parse(currentMeta.keywords || '[]')),
        lastUsedAt: new Date().toISOString()
      };

      await this.collections.atomicActions.update({
        ids: [id],
        metadatas: [updatedMeta]
      });

      return { success: true, id };
    } catch (error) {
      logger.error(`Failed to update atomic action: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Increment usage count for an atomic action
   */
  async incrementUsageCount(collectionName, id) {
    const collection = this.collections[collectionName];
    if (!collection) return;

    try {
      const existing = await collection.get({ ids: [id] });
      if (existing.metadatas && existing.metadatas.length > 0) {
        const meta = existing.metadatas[0];
        await collection.update({
          ids: [id],
          metadatas: [{
            ...meta,
            usageCount: (meta.usageCount || 0) + 1,
            lastUsedAt: new Date().toISOString()
          }]
        });
      }
    } catch (error) {
      logger.debug(`Could not increment usage count: ${error.message}`);
    }
  }

  /**
   * Enrich keywords for an action
   */
  async enrichKeywords(actionId, newKeywords) {
    if (!this.isInitialized) await this.initialize();

    try {
      const existing = await this.collections.atomicActions.get({
        ids: [actionId]
      });

      if (!existing.metadatas || existing.metadatas.length === 0) {
        return { success: false, error: 'Action not found' };
      }

      const currentMeta = existing.metadatas[0];
      const currentKeywords = JSON.parse(currentMeta.keywords || '[]');
      const updatedKeywords = [...new Set([...currentKeywords, ...newKeywords])];

      // Update document text for better search
      const documentText = [
        currentMeta.actionName,
        currentMeta.methodName,
        currentMeta.className,
        ...updatedKeywords
      ].join(' ');

      await this.collections.atomicActions.update({
        ids: [actionId],
        documents: [documentText],
        metadatas: [{
          ...currentMeta,
          keywords: JSON.stringify(updatedKeywords)
        }]
      });

      return { success: true, keywords: updatedKeywords };
    } catch (error) {
      logger.error(`Failed to enrich keywords: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============ LAYER 2: Composite Actions ============

  /**
   * Add a composite action (action chain)
   * @param {Object} composite - Composite action object
   */
  async addCompositeAction(composite) {
    if (!this.isInitialized) await this.initialize();

    const {
      id,
      actionName,
      description,
      steps,
      prerequisites = [],
      targetScreen = null
    } = composite;

    // Create searchable text from steps
    const stepDescriptions = steps.map(s => s.atomicAction).join(' then ');
    const documentText = `${actionName} ${description} ${stepDescriptions}`;

    try {
      await this.collections.compositeActions.add({
        ids: [id],
        documents: [documentText],
        metadatas: [{
          actionName,
          description,
          steps: JSON.stringify(steps),
          prerequisites: JSON.stringify(prerequisites),
          targetScreen: targetScreen || '',
          usageCount: 0,
          createdAt: new Date().toISOString()
        }]
      });

      logger.debug(`Added composite action: ${actionName} with ${steps.length} steps`);
      return { success: true, id };
    } catch (error) {
      if (error.message?.includes('already exists')) {
        logger.debug(`Composite action ${id} already exists`);
        return { success: true, id, existed: true };
      }
      logger.error(`Failed to add composite action: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find composite action by semantic search
   */
  async findCompositeAction(actionQuery, topK = 3) {
    if (!this.isInitialized) await this.initialize();

    try {
      const results = await this.collections.compositeActions.query({
        queryTexts: [actionQuery],
        nResults: topK
      });

      if (!results.metadatas[0] || results.metadatas[0].length === 0) {
        return { found: false, query: actionQuery };
      }

      const matches = results.metadatas[0].map((meta, index) => ({
        ...meta,
        steps: JSON.parse(meta.steps || '[]'),
        prerequisites: JSON.parse(meta.prerequisites || '[]'),
        distance: results.distances[0][index],
        confidence: Math.max(0, 1 - results.distances[0][index])
      }));

      const bestMatch = matches[0];

      // Only return if confidence is high enough
      if (bestMatch.distance > 0.3) {
        return { found: false, query: actionQuery, closestMatch: bestMatch };
      }

      return {
        found: true,
        bestMatch,
        allMatches: matches,
        query: actionQuery
      };
    } catch (error) {
      logger.error(`Failed to find composite action: ${error.message}`);
      return { found: false, error: error.message, query: actionQuery };
    }
  }

  /**
   * Expand a composite action to its atomic steps
   */
  async expandCompositeAction(compositeId) {
    if (!this.isInitialized) await this.initialize();

    try {
      const result = await this.collections.compositeActions.get({
        ids: [compositeId]
      });

      if (!result.metadatas || result.metadatas.length === 0) {
        return { success: false, error: 'Composite action not found' };
      }

      const composite = result.metadatas[0];
      const steps = JSON.parse(composite.steps || '[]');
      const expanded = [];

      for (const step of steps) {
        const atomic = await this.findAtomicAction(step.atomicAction, step.targetScreen);

        if (atomic.found) {
          expanded.push({
            ...atomic.bestMatch,
            parameters: step.parameters || {},
            order: step.order,
            conditional: step.conditional || false
          });
        } else {
          // Mark as unmapped for Component Generator
          expanded.push({
            atomicAction: step.atomicAction,
            order: step.order,
            unmapped: true,
            parameters: step.parameters || {}
          });
        }
      }

      return {
        success: true,
        compositeAction: composite.actionName,
        expandedSteps: expanded,
        hasUnmappedSteps: expanded.some(s => s.unmapped)
      };
    } catch (error) {
      logger.error(`Failed to expand composite action: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============ LAYER 3: User Terminology ============

  /**
   * Translate user term to actions
   */
  async translateUserTerm(userInput) {
    if (!this.isInitialized) await this.initialize();

    try {
      const results = await this.collections.userTerminology.query({
        queryTexts: [userInput.toLowerCase()],
        nResults: 3
      });

      if (results.metadatas[0]?.length > 0) {
        const bestMatch = results.metadatas[0][0];
        const distance = results.distances[0][0];

        // Only match if very close (distance < 0.2)
        if (distance < 0.2) {
          // Increment usage count
          await this.incrementUsageCount('userTerminology', bestMatch.id || results.ids[0][0]);

          return {
            found: true,
            userTerm: bestMatch.userTerm,
            expandsTo: JSON.parse(bestMatch.expandsTo || '[]'),
            synonyms: JSON.parse(bestMatch.synonyms || '[]'),
            confidence: 1 - distance,
            source: 'learned_terminology'
          };
        }
      }

      // Not found in terminology, try atomic actions directly
      const atomicResult = await this.findAtomicAction(userInput);
      if (atomicResult.found) {
        return {
          found: true,
          expandsTo: [atomicResult.bestMatch.actionName],
          confidence: atomicResult.bestMatch.confidence,
          source: 'atomic_action_match'
        };
      }

      return {
        found: false,
        userInput,
        suggestion: 'Term not recognized. Consider teaching this term using learnFromUser()'
      };
    } catch (error) {
      logger.error(`Failed to translate user term: ${error.message}`);
      return { found: false, error: error.message, userInput };
    }
  }

  /**
   * Learn new terminology from user
   */
  async learnFromUser(userTerm, expandsTo, context = '', synonyms = []) {
    if (!this.isInitialized) await this.initialize();

    const id = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const normalizedTerm = userTerm.toLowerCase().trim();

    // Create searchable text
    const documentText = [normalizedTerm, ...synonyms, context].filter(Boolean).join(' ');

    try {
      await this.collections.userTerminology.add({
        ids: [id],
        documents: [documentText],
        metadatas: [{
          id,
          userTerm: normalizedTerm,
          expandsTo: JSON.stringify(expandsTo),
          synonyms: JSON.stringify(synonyms),
          context,
          learnedFrom: 'user_input',
          usageCount: 1,
          confidence: 1.0,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString()
        }]
      });

      logger.info(`Learned new terminology: "${normalizedTerm}" -> [${expandsTo.join(', ')}]`);

      return {
        success: true,
        id,
        term: {
          userTerm: normalizedTerm,
          expandsTo,
          synonyms,
          context
        }
      };
    } catch (error) {
      logger.error(`Failed to learn from user: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add synonym to existing terminology
   */
  async addSynonym(termId, newSynonym) {
    if (!this.isInitialized) await this.initialize();

    try {
      const existing = await this.collections.userTerminology.get({
        ids: [termId]
      });

      if (!existing.metadatas || existing.metadatas.length === 0) {
        return { success: false, error: 'Term not found' };
      }

      const meta = existing.metadatas[0];
      const synonyms = [...new Set([...JSON.parse(meta.synonyms || '[]'), newSynonym])];

      await this.collections.userTerminology.update({
        ids: [termId],
        metadatas: [{
          ...meta,
          synonyms: JSON.stringify(synonyms)
        }]
      });

      return { success: true, synonyms };
    } catch (error) {
      logger.error(`Failed to add synonym: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============ LAYER 4: Learned Action Patterns ============
  // These are PERMANENT rules learned from AI that enrich the rule engine

  /**
   * Store action patterns learned from AI decomposition
   * Each step from AI becomes a reusable pattern for future scenarios
   *
   * @param {Array} steps - AI-generated steps to learn from
   * @param {Object} context - Platform, brand, screen context
   */
  async learnActionPatterns(steps, context = {}) {
    if (!this.isInitialized) await this.initialize();

    const { platform = null, brand = null, primaryScreen = null } = context;
    const learned = [];
    const skipped = [];

    for (const step of steps) {
      // Skip prerequisite steps (login, navigate to home)
      if (step.isPrerequisite) {
        skipped.push(step.action);
        continue;
      }

      // Create pattern from step
      const pattern = {
        action: step.action,
        target: step.target,
        details: step.details || null,
        screen: primaryScreen || step.target?.replace(/_screen$/, '') || null
      };

      // Generate searchable phrases for this pattern
      const phrases = this.generateSearchPhrases(pattern);
      const id = `pattern_${pattern.action}_${pattern.target}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_');

      try {
        await this.collections.learnedDecompositions.add({
          ids: [id],
          documents: [phrases.join(' ')],
          metadatas: [{
            id,
            action: pattern.action,
            target: pattern.target,
            details: pattern.details || '',
            screen: pattern.screen || '',
            platform: platform || '',
            brand: brand || '',
            phrases: JSON.stringify(phrases),
            usageCount: 0,
            source: 'ai_learned',
            createdAt: new Date().toISOString()
          }]
        });

        learned.push({ action: pattern.action, target: pattern.target });
      } catch (error) {
        if (!error.message?.includes('already exists')) {
          logger.debug(`Could not store pattern: ${error.message}`);
        }
      }
    }

    if (learned.length > 0) {
      logger.info(`Learned ${learned.length} new action patterns from AI`);
    }

    return { success: true, learned, skipped };
  }

  /**
   * Generate searchable phrases for an action pattern
   */
  generateSearchPhrases(pattern) {
    const phrases = [];
    const { action, target, details } = pattern;

    // Base phrase
    phrases.push(`${action} ${target}`);

    // With details
    if (details) {
      phrases.push(`${action} ${target} ${details}`);
    }

    // Natural language variations
    const actionVariations = this.synonymMap[action] || [];
    for (const variation of actionVariations) {
      phrases.push(`${variation} ${target}`);
    }

    // Clean up targets (remove underscores)
    const cleanTarget = target?.replace(/_/g, ' ') || '';
    if (cleanTarget !== target) {
      phrases.push(`${action} ${cleanTarget}`);
    }

    return [...new Set(phrases)];
  }

  /**
   * Find learned action patterns matching a phrase
   * Used by rule engine to enhance decomposition
   *
   * @param {string} phrase - Action phrase to match (e.g., "click play button")
   * @param {Object} context - Platform, brand filters
   * @param {number} topK - Number of results
   */
  async findLearnedPattern(phrase, context = {}, topK = 3) {
    if (!this.isInitialized) await this.initialize();

    const { platform = null, brand = null, screen = null } = context;

    try {
      // Build where clause
      const whereConditions = [];
      if (platform) whereConditions.push({ platform: { $eq: platform } });
      if (brand) whereConditions.push({ brand: { $eq: brand } });
      if (screen) whereConditions.push({ screen: { $eq: screen } });

      const whereClause = whereConditions.length > 1
        ? { $and: whereConditions }
        : whereConditions.length === 1
          ? whereConditions[0]
          : undefined;

      const results = await this.collections.learnedDecompositions.query({
        queryTexts: [phrase.toLowerCase()],
        nResults: topK,
        where: whereClause
      });

      if (!results.metadatas[0] || results.metadatas[0].length === 0) {
        return { found: false, phrase };
      }

      const matches = results.metadatas[0].map((meta, index) => {
        const distance = results.distances[0][index];
        return {
          action: meta.action,
          target: meta.target,
          details: meta.details || null,
          screen: meta.screen || null,
          confidence: Math.max(0, 1 - distance),
          usageCount: meta.usageCount || 0
        };
      });

      // Filter to reasonable confidence (0.4 is fairly relaxed for semantic matching)
      const goodMatches = matches.filter(m => m.confidence > 0.4);

      if (goodMatches.length === 0) {
        return { found: false, phrase };
      }

      // Increment usage for best match
      const bestMatch = goodMatches[0];
      await this.incrementUsageCount('learnedDecompositions', results.ids[0][0]);

      return {
        found: true,
        bestMatch,
        allMatches: goodMatches,
        phrase
      };
    } catch (error) {
      logger.error(`Failed to find learned pattern: ${error.message}`);
      return { found: false, error: error.message, phrase };
    }
  }

  /**
   * Get all learned patterns (for debugging/export)
   */
  async getLearnedPatterns(limit = 100) {
    if (!this.isInitialized) await this.initialize();

    try {
      const results = await this.collections.learnedDecompositions.get({ limit });

      return {
        success: true,
        count: results.ids?.length || 0,
        patterns: results.metadatas?.map((meta, i) => ({
          id: results.ids[i],
          action: meta.action,
          target: meta.target,
          details: meta.details,
          screen: meta.screen,
          platform: meta.platform,
          brand: meta.brand,
          usageCount: meta.usageCount,
          createdAt: meta.createdAt
        })) || []
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics for learned patterns
   */
  async getLearnedPatternStats() {
    if (!this.isInitialized) await this.initialize();

    try {
      const count = await this.collections.learnedDecompositions.count();
      const results = await this.collections.learnedDecompositions.get({ limit: 500 });

      // Calculate stats
      let totalUsage = 0;
      const actionCounts = {};
      const screenCounts = {};

      for (const meta of results.metadatas || []) {
        totalUsage += meta.usageCount || 0;
        actionCounts[meta.action || 'unknown'] = (actionCounts[meta.action || 'unknown'] || 0) + 1;
        if (meta.screen) {
          screenCounts[meta.screen] = (screenCounts[meta.screen] || 0) + 1;
        }
      }

      return {
        totalPatterns: count,
        totalUsage,
        byAction: actionCounts,
        byScreen: screenCounts
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ============ Mining Methods from Codebase ============

  /**
   * Index methods from a repository into atomic actions
   */
  async indexMethodsFromRepository(repositoryPath) {
    if (!this.isInitialized) await this.initialize();

    logger.info(`Mining methods from repository: ${repositoryPath}`);

    const stats = {
      filesScanned: 0,
      methodsFound: 0,
      actionsCreated: 0,
      errors: []
    };

    try {
      await this.scanForMethods(repositoryPath, stats);

      logger.info(`Method indexing complete: ${stats.actionsCreated} actions from ${stats.methodsFound} methods`);
      return { success: true, stats };
    } catch (error) {
      logger.error(`Repository mining failed: ${error.message}`);
      return { success: false, error: error.message, stats };
    }
  }

  /**
   * Recursively scan directory for Java files
   */
  async scanForMethods(dirPath, stats, relativePath = '') {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden and build directories
        if (entry.name.startsWith('.') ||
            ['node_modules', 'target', 'build', 'out', '.git'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          await this.scanForMethods(fullPath, stats, relPath);
        } else if (entry.isFile() && entry.name.endsWith('.java')) {
          // Only process Screen/Page files for actions
          if (entry.name.includes('Screen') || entry.name.includes('Page')) {
            await this.extractMethodsFromFile(fullPath, relPath, stats);
          }
        }
      }
    } catch (error) {
      stats.errors.push({ path: dirPath, error: error.message });
    }
  }

  /**
   * Extract methods from a Java file and create atomic actions
   */
  async extractMethodsFromFile(filePath, relativePath, stats) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      stats.filesScanned++;

      const className = this.extractClassName(content);
      if (!className) return;

      // Detect platform and brand from path
      const { platform, brand } = this.detectPlatformAndBrand(relativePath);

      const methods = this.extractMethods(content);
      stats.methodsFound += methods.length;

      for (const method of methods) {
        // Skip getters, setters, and common methods
        if (this.shouldSkipMethod(method.name)) continue;

        const keywords = this.extractKeywordsFromMethodName(method.name);
        const actionName = this.methodNameToAction(method.name);
        const targetScreen = this.detectTargetScreen(className);

        // Generate unique ID including platform/brand if present
        const idParts = ['method'];
        if (platform) idParts.push(platform);
        if (brand) idParts.push(brand);
        idParts.push(className, method.name);
        const id = idParts.join('_');

        const result = await this.addAtomicAction({
          id,
          actionName,
          methodName: method.name,
          className,
          filePath,
          relativePath,
          platform,
          brand,
          returnType: method.returnType,
          parameters: method.params ? method.params.split(',').map(p => p.trim()) : [],
          keywords,
          targetScreen,
          confidence: 0.8
        });

        if (result.success) {
          stats.actionsCreated++;
        }
      }
    } catch (error) {
      stats.errors.push({ path: filePath, error: error.message });
    }
  }

  /**
   * Detect platform and brand from file path
   * Examples:
   *   ui/ctvscreens/pplus/PlayerScreen.java → { platform: 'ctv', brand: 'pplus' }
   *   ui/mobilescreens/plutotv/HomeScreen.java → { platform: 'mobile', brand: 'plutotv' }
   *   screens/PlayerScreen.java → { platform: null, brand: null }
   */
  detectPlatformAndBrand(relativePath) {
    const pathLower = relativePath.toLowerCase();

    // Detect platform
    let platform = null;
    if (pathLower.includes('ctvscreen') || pathLower.includes('/ctv/')) {
      platform = 'ctv';
    } else if (pathLower.includes('mobilescreen') || pathLower.includes('/mobile/')) {
      platform = 'mobile';
    } else if (pathLower.includes('webscreen') || pathLower.includes('webpage') || pathLower.includes('/web/')) {
      platform = 'web';
    } else if (pathLower.includes('html5screen') || pathLower.includes('/html5/')) {
      platform = 'html5';
    } else if (pathLower.includes('hdmiscreen') || pathLower.includes('/hdmi/')) {
      platform = 'hdmi';
    }

    // Detect brand
    let brand = null;
    if (pathLower.includes('/pplus/') || pathLower.includes('pplus')) {
      brand = 'pplus';
    } else if (pathLower.includes('/plutotv/') || pathLower.includes('plutotv')) {
      brand = 'plutotv';
    }

    return { platform, brand };
  }

  /**
   * Extract class name from Java content
   */
  extractClassName(content) {
    const match = content.match(/(?:public\s+)?class\s+(\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract methods from Java content
   */
  extractMethods(content) {
    const methods = [];
    const regex = /public\s+(?:static\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      methods.push({
        returnType: match[1],
        name: match[2],
        params: match[3]
      });
    }

    return methods;
  }

  /**
   * Check if method should be skipped
   */
  shouldSkipMethod(methodName) {
    const skipPatterns = [
      /^get[A-Z]/,      // Getters
      /^set[A-Z]/,      // Setters
      /^is[A-Z]/,       // Boolean getters
      /^has[A-Z]/,      // Boolean getters
      /^toString$/,
      /^equals$/,
      /^hashCode$/
    ];
    return skipPatterns.some(pattern => pattern.test(methodName));
  }

  /**
   * Extract keywords from method name using camelCase splitting
   */
  extractKeywordsFromMethodName(methodName) {
    // "clickPlayButton" -> ["click", "play", "button"]
    const words = methodName
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Expand with synonyms
    const expanded = new Set(words);
    for (const word of words) {
      if (this.synonymMap[word]) {
        this.synonymMap[word].forEach(syn => expanded.add(syn));
      }
    }

    return Array.from(expanded);
  }

  /**
   * Convert method name to action name
   * "clickPlayButton" -> "click_play_button"
   */
  methodNameToAction(methodName) {
    return methodName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Detect target screen from class name
   * "PlayerScreen" -> "player"
   */
  detectTargetScreen(className) {
    const match = className.match(/^(\w+?)(Screen|Page)$/);
    return match ? match[1].toLowerCase() : className.toLowerCase();
  }

  // ============ Statistics & Utilities ============

  /**
   * Get statistics for all collections
   */
  async getStats() {
    if (!this.isInitialized) {
      return { initialized: false };
    }

    try {
      const [atomicCount, compositeCount, terminologyCount, decompositionCount] = await Promise.all([
        this.collections.atomicActions.count(),
        this.collections.compositeActions.count(),
        this.collections.userTerminology.count(),
        this.collections.learnedDecompositions.count()
      ]);

      return {
        initialized: true,
        atomicActions: atomicCount,
        compositeActions: compositeCount,
        userTerminology: terminologyCount,
        learnedDecompositions: decompositionCount
      };
    } catch (error) {
      logger.error(`Failed to get stats: ${error.message}`);
      return { initialized: true, error: error.message };
    }
  }

  /**
   * Clear all collections (for re-indexing)
   */
  async clearAll() {
    if (!this.chromaClient) return;

    try {
      await this.chromaClient.deleteCollection({ name: 'atomic_actions' });
      await this.chromaClient.deleteCollection({ name: 'composite_actions' });
      await this.chromaClient.deleteCollection({ name: 'user_terminology' });
      await this.chromaClient.deleteCollection({ name: 'learned_decompositions' });

      this.isInitialized = false;
      await this.initialize();

      logger.info('All Action Knowledge Base collections cleared');
      return { success: true };
    } catch (error) {
      logger.error(`Failed to clear collections: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all items from a collection (for debugging/export)
   */
  async getAllFromCollection(collectionName, limit = 100) {
    if (!this.isInitialized) await this.initialize();

    const collection = this.collections[collectionName];
    if (!collection) {
      return { success: false, error: `Unknown collection: ${collectionName}` };
    }

    try {
      const results = await collection.get({ limit });
      return {
        success: true,
        count: results.ids?.length || 0,
        items: results.metadatas?.map((meta, i) => ({
          id: results.ids[i],
          ...meta
        })) || []
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton
export const actionKnowledgeBaseService = new ActionKnowledgeBaseService();
export default actionKnowledgeBaseService;
