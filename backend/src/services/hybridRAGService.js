/**
 * Hybrid RAG Service for Context-Aware Test Generation
 *
 * Combines automatic retrieval with optional user hints for best results:
 * - AUTO: Retrieves relevant Page Objects, Properties, and tests via RAG
 * - HINTS: User can optionally provide "similar test" or "primary screen" for accuracy
 *
 * Flow:
 * 1. User provides test scenario + optional hints
 * 2. RAG auto-retrieves relevant context from indexed repository
 * 3. User hints boost/filter the retrieved context
 * 4. Combined context sent to AI for generation
 */

import { ChromaClient } from 'chromadb';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

class HybridRAGService {
  constructor() {
    this.chromaClient = null;
    this.collections = {
      pageObjects: null,
      properties: null,
      tests: null,
      methods: null
    };
    this.isInitialized = false;
    this.repositoryPath = null;
  }

  /**
   * Initialize connection to ChromaDB
   */
  async initialize(chromaHost = 'http://localhost:8000') {
    try {
      this.chromaClient = new ChromaClient({ path: chromaHost });

      // Get or create collections
      this.collections.pageObjects = await this.chromaClient.getOrCreateCollection({
        name: 'page_objects',
        metadata: { description: 'Java Page Object classes' }
      });

      this.collections.properties = await this.chromaClient.getOrCreateCollection({
        name: 'properties',
        metadata: { description: 'Element locator properties files' }
      });

      this.collections.tests = await this.chromaClient.getOrCreateCollection({
        name: 'test_files',
        metadata: { description: 'Existing test files for pattern learning' }
      });

      this.collections.methods = await this.chromaClient.getOrCreateCollection({
        name: 'methods',
        metadata: { description: 'Individual methods from Page Objects' }
      });

      this.isInitialized = true;
      logger.info('HybridRAGService initialized with ChromaDB');

      return true;
    } catch (error) {
      logger.error('Failed to initialize HybridRAGService:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Index a repository for RAG retrieval
   * Should be called once when user sets up a new repository
   */
  async indexRepository(repoPath) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.repositoryPath = repoPath;
    logger.info(`Indexing repository: ${repoPath}`);

    const stats = {
      pageObjects: 0,
      properties: 0,
      tests: 0,
      methods: 0
    };

    try {
      // Scan and index all relevant files
      await this.scanAndIndex(repoPath, stats);

      logger.info(`Indexing complete: ${JSON.stringify(stats)}`);
      return { success: true, stats };
    } catch (error) {
      logger.error('Repository indexing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recursively scan directory and index files
   */
  async scanAndIndex(dirPath, stats, relativePath = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden directories and build outputs
      if (entry.name.startsWith('.') ||
          ['node_modules', 'target', 'build', 'out'].includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await this.scanAndIndex(fullPath, stats, relPath);
      } else if (entry.isFile()) {
        await this.indexFile(fullPath, relPath, stats);
      }
    }
  }

  /**
   * Index a single file based on its type
   */
  async indexFile(fullPath, relativePath, stats) {
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const fileName = path.basename(fullPath);

      // Determine file type and index accordingly
      if (fileName.endsWith('.properties')) {
        await this.indexPropertiesFile(fullPath, relativePath, content, stats);
      } else if (fileName.endsWith('.java')) {
        if (fileName.includes('Screen') || fileName.includes('Page')) {
          await this.indexPageObject(fullPath, relativePath, content, stats);
        } else if (fileName.includes('Test')) {
          await this.indexTestFile(fullPath, relativePath, content, stats);
        }
      }
    } catch (error) {
      logger.debug(`Could not index ${fullPath}: ${error.message}`);
    }
  }

  /**
   * Index a Page Object file
   */
  async indexPageObject(fullPath, relativePath, content, stats) {
    const className = this.extractClassName(content);
    if (!className) return;

    // Extract methods for method-level retrieval
    const methods = this.extractMethods(content);

    // Create searchable text
    const searchText = `${className} ${methods.map(m => m.name).join(' ')} ${this.extractComments(content)}`;

    // Add to page_objects collection
    await this.collections.pageObjects.add({
      ids: [relativePath],
      documents: [searchText],
      metadatas: [{
        className,
        filePath: fullPath,
        relativePath,
        methodCount: methods.length,
        methods: JSON.stringify(methods.map(m => m.name))
      }]
    });
    stats.pageObjects++;

    // Index individual methods for fine-grained retrieval
    for (const method of methods) {
      const methodId = `${relativePath}::${method.name}`;
      const methodText = `${className} ${method.name} ${method.returnType} ${method.signature}`;

      await this.collections.methods.add({
        ids: [methodId],
        documents: [methodText],
        metadatas: [{
          className,
          methodName: method.name,
          returnType: method.returnType,
          signature: method.signature,
          filePath: fullPath
        }]
      });
      stats.methods++;
    }
  }

  /**
   * Index a Properties file
   */
  async indexPropertiesFile(fullPath, relativePath, content, stats) {
    const screenName = path.basename(fullPath, '.properties');
    const elements = this.parseProperties(content);

    // Create searchable text from element names
    const searchText = `${screenName} ${Object.keys(elements).join(' ')}`;

    await this.collections.properties.add({
      ids: [relativePath],
      documents: [searchText],
      metadatas: [{
        screenName,
        filePath: fullPath,
        relativePath,
        elementCount: Object.keys(elements).length,
        elements: JSON.stringify(Object.keys(elements))
      }]
    });
    stats.properties++;
  }

  /**
   * Index a Test file
   */
  async indexTestFile(fullPath, relativePath, content, stats) {
    const className = this.extractClassName(content);
    if (!className) return;

    // Extract test scenario information
    const testMethods = this.extractTestMethods(content);
    const annotations = this.extractAnnotations(content);
    const screenUsage = this.extractScreenUsage(content);

    // Create rich searchable text
    const searchText = [
      className,
      ...testMethods.map(t => t.name),
      ...testMethods.map(t => t.description || ''),
      ...screenUsage,
      this.extractComments(content)
    ].join(' ');

    await this.collections.tests.add({
      ids: [relativePath],
      documents: [searchText],
      metadatas: [{
        className,
        filePath: fullPath,
        relativePath,
        testCount: testMethods.length,
        testMethods: JSON.stringify(testMethods.map(t => t.name)),
        screensUsed: JSON.stringify(screenUsage),
        category: this.inferTestCategory(relativePath, className)
      }]
    });
    stats.tests++;
  }

  /**
   * MAIN METHOD: Retrieve context using hybrid RAG + user hints
   *
   * @param {Object} params
   * @param {string} params.testScenario - Description of the test to generate
   * @param {Object} params.hints - Optional user hints
   * @param {string} params.hints.similarTest - Path to a similar test file
   * @param {string} params.hints.primaryScreen - Main screen (e.g., "player", "container")
   * @param {string} params.hints.template - Quick template name
   * @param {number} params.topK - Number of results per category (default: 5)
   */
  async retrieveContext(params) {
    const {
      testScenario,
      hints = {},
      topK = 5
    } = params;

    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info(`Retrieving context for: "${testScenario.substring(0, 50)}..."`);
    logger.info(`User hints: ${JSON.stringify(hints)}`);

    const context = {
      pageObjects: [],
      properties: [],
      tests: [],
      methods: [],
      confidence: {},
      source: 'hybrid-rag'
    };

    // Build query from scenario + hints
    let queryText = testScenario;
    if (hints.primaryScreen) {
      queryText += ` ${hints.primaryScreen}Screen ${hints.primaryScreen}`;
    }
    if (hints.template) {
      queryText += ` ${hints.template}`;
    }

    // 1. Retrieve relevant Page Objects
    const pageObjectResults = await this.collections.pageObjects.query({
      queryTexts: [queryText],
      nResults: topK
    });
    context.pageObjects = this.processResults(pageObjectResults, 'pageObject');
    context.confidence.pageObjects = this.calculateConfidence(pageObjectResults);

    // 2. Retrieve relevant Properties files
    const propertiesResults = await this.collections.properties.query({
      queryTexts: [queryText],
      nResults: topK
    });
    context.properties = this.processResults(propertiesResults, 'properties');
    context.confidence.properties = this.calculateConfidence(propertiesResults);

    // 3. Retrieve similar Tests
    let testQuery = queryText;
    if (hints.similarTest) {
      // Boost with content from similar test
      try {
        const similarContent = await fs.readFile(hints.similarTest, 'utf8');
        testQuery += ' ' + this.extractTestSignature(similarContent);
      } catch (e) {
        logger.warn(`Could not read similar test hint: ${hints.similarTest}`);
      }
    }

    const testResults = await this.collections.tests.query({
      queryTexts: [testQuery],
      nResults: topK
    });
    context.tests = this.processResults(testResults, 'test');
    context.confidence.tests = this.calculateConfidence(testResults);

    // 4. Retrieve specific methods that match scenario
    const methodResults = await this.collections.methods.query({
      queryTexts: [queryText],
      nResults: topK * 2  // More methods since they're smaller units
    });
    context.methods = this.processResults(methodResults, 'method');
    context.confidence.methods = this.calculateConfidence(methodResults);

    // 5. Apply user hint boosting
    if (hints.similarTest) {
      context.hints = { similarTest: hints.similarTest };
      // Move similar test to top of list if found
      this.boostByHint(context.tests, hints.similarTest);
    }

    if (hints.primaryScreen) {
      context.hints = { ...context.hints, primaryScreen: hints.primaryScreen };
      // Boost Page Objects and Properties matching primary screen
      this.boostByScreen(context.pageObjects, hints.primaryScreen);
      this.boostByScreen(context.properties, hints.primaryScreen);
    }

    // 6. Load actual file contents for top results
    await this.loadFileContents(context);

    logger.info(`Retrieved: ${context.pageObjects.length} POs, ${context.properties.length} props, ${context.tests.length} tests, ${context.methods.length} methods`);

    return context;
  }

  /**
   * Process ChromaDB results into usable format
   */
  processResults(results, type) {
    if (!results || !results.ids || !results.ids[0]) {
      return [];
    }

    return results.ids[0].map((id, index) => ({
      id,
      type,
      metadata: results.metadatas[0][index],
      distance: results.distances ? results.distances[0][index] : null,
      relevance: results.distances ? (1 - results.distances[0][index]) : 0.5
    }));
  }

  /**
   * Calculate confidence score from distances
   */
  calculateConfidence(results) {
    if (!results.distances || !results.distances[0] || results.distances[0].length === 0) {
      return 0;
    }

    // Average relevance of top results (1 - distance)
    const relevances = results.distances[0].map(d => 1 - d);
    const avgRelevance = relevances.reduce((a, b) => a + b, 0) / relevances.length;

    return Math.round(avgRelevance * 100);
  }

  /**
   * Boost items matching hint to top
   */
  boostByHint(items, hintPath) {
    const index = items.findIndex(item =>
      item.id.includes(hintPath) ||
      item.metadata?.filePath?.includes(hintPath)
    );

    if (index > 0) {
      const [boosted] = items.splice(index, 1);
      boosted.boosted = true;
      boosted.boostReason = 'user-hint';
      items.unshift(boosted);
    }
  }

  /**
   * Boost items matching screen name
   */
  boostByScreen(items, screenName) {
    const normalized = screenName.toLowerCase();
    items.forEach(item => {
      const itemScreen = (item.metadata?.className || item.metadata?.screenName || '').toLowerCase();
      if (itemScreen.includes(normalized)) {
        item.relevance = Math.min(1, item.relevance + 0.2);
        item.boosted = true;
        item.boostReason = 'primary-screen';
      }
    });

    // Re-sort by relevance
    items.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Load actual file contents for retrieved items
   */
  async loadFileContents(context) {
    const loadContent = async (items, limit = 3) => {
      for (let i = 0; i < Math.min(items.length, limit); i++) {
        const item = items[i];
        try {
          const filePath = item.metadata?.filePath;
          if (filePath) {
            item.content = await fs.readFile(filePath, 'utf8');
          }
        } catch (e) {
          logger.debug(`Could not load content for ${item.id}`);
        }
      }
    };

    await Promise.all([
      loadContent(context.pageObjects, 5),
      loadContent(context.properties, 5),
      loadContent(context.tests, 3)
    ]);
  }

  // ============ Helper Methods ============

  extractClassName(content) {
    const match = content.match(/(?:public\s+)?class\s+(\w+)/);
    return match ? match[1] : null;
  }

  extractMethods(content) {
    const methods = [];
    const regex = /public\s+(?:static\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      methods.push({
        returnType: match[1],
        name: match[2],
        params: match[3],
        signature: `${match[1]} ${match[2]}(${match[3]})`
      });
    }

    return methods;
  }

  extractTestMethods(content) {
    const tests = [];
    const regex = /@Test(?:\(([^)]*)\))?\s*(?:public\s+)?void\s+(\w+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const description = match[1]?.match(/description\s*=\s*"([^"]+)"/)?.[1] || '';
      tests.push({
        name: match[2],
        description
      });
    }

    return tests;
  }

  extractAnnotations(content) {
    const annotations = new Set();
    const regex = /@(\w+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      annotations.add(match[1]);
    }

    return Array.from(annotations);
  }

  extractScreenUsage(content) {
    const screens = new Set();
    const regex = /(\w+Screen|\w+Page)\(\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      screens.add(match[1]);
    }

    return Array.from(screens);
  }

  extractComments(content) {
    const comments = [];

    // Javadoc comments
    const javadocRegex = /\/\*\*([\s\S]*?)\*\//g;
    let match;
    while ((match = javadocRegex.exec(content)) !== null) {
      comments.push(match[1].replace(/\s*\*\s*/g, ' ').trim());
    }

    // Single line comments
    const singleRegex = /\/\/\s*(.+)/g;
    while ((match = singleRegex.exec(content)) !== null) {
      comments.push(match[1].trim());
    }

    return comments.join(' ').substring(0, 500);
  }

  extractTestSignature(content) {
    // Extract meaningful parts for similarity matching
    const className = this.extractClassName(content);
    const testMethods = this.extractTestMethods(content);
    const screens = this.extractScreenUsage(content);

    return [className, ...testMethods.map(t => t.name), ...screens].join(' ');
  }

  parseProperties(content) {
    const props = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.+)$/);
      if (match) {
        props[match[1].trim()] = match[2].trim();
      }
    }

    return props;
  }

  inferTestCategory(relativePath, className) {
    const pathLower = relativePath.toLowerCase();
    const nameLower = className.toLowerCase();

    if (pathLower.includes('player') || nameLower.includes('playback')) return 'playback';
    if (pathLower.includes('container') || nameLower.includes('container')) return 'container';
    if (pathLower.includes('search')) return 'search';
    if (pathLower.includes('auth') || nameLower.includes('login')) return 'auth';
    if (pathLower.includes('nav')) return 'navigation';
    if (pathLower.includes('ad') || nameLower.includes('advertisement')) return 'ads';

    return 'general';
  }

  /**
   * Get index statistics
   */
  async getStats() {
    if (!this.isInitialized) {
      return { initialized: false };
    }

    return {
      initialized: true,
      pageObjects: await this.collections.pageObjects.count(),
      properties: await this.collections.properties.count(),
      tests: await this.collections.tests.count(),
      methods: await this.collections.methods.count()
    };
  }

  /**
   * Clear all collections (for re-indexing)
   */
  async clearIndex() {
    if (!this.isInitialized) return;

    await this.chromaClient.deleteCollection({ name: 'page_objects' });
    await this.chromaClient.deleteCollection({ name: 'properties' });
    await this.chromaClient.deleteCollection({ name: 'test_files' });
    await this.chromaClient.deleteCollection({ name: 'methods' });

    // Recreate collections
    await this.initialize();

    logger.info('Index cleared');
  }
}

// Export singleton
export const hybridRAGService = new HybridRAGService();
export default hybridRAGService;
