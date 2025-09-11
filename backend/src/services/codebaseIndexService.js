import { ChromaClient } from 'chromadb';
import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Codebase Indexing Service with Voyage AI embeddings
 * Provides intelligent code search and similarity matching
 */
class CodebaseIndexService {
  constructor() {
    this.chromaClient = null;
    this.collection = null;
    this.parser = null;
    this.git = null;
    this.voyageApiKey = process.env.VOYAGE_API_KEY;
    this.voyageApiUrl = 'https://api.voyageai.com/v1/embeddings';
    this.indexes = new Map(); // Cache per repository
  }

  async initialize() {
    try {
      // Initialize ChromaDB client
      this.chromaClient = new ChromaClient({
        path: './chroma_db'
      });

      // Initialize Tree-sitter parser for Java
      this.parser = new Parser();
      this.parser.setLanguage(Java);

      logger.info('Codebase Index Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Codebase Index Service:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Voyage AI
   */
  async generateEmbeddings(texts, inputType = 'document') {
    try {
      const response = await fetch(this.voyageApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.voyageApiKey}`
        },
        body: JSON.stringify({
          input: texts,
          model: 'voyage-code-2',
          input_type: inputType
        })
      });

      if (!response.ok) {
        throw new Error(`Voyage AI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Index a repository with smart caching and incremental updates
   */
  async indexRepository(repoPath, forceReindex = false) {
    try {
      logger.info(`Indexing repository: ${repoPath}`);
      
      // Initialize git for the repository
      this.git = simpleGit(repoPath);
      
      // Check if we have an existing index
      const collectionName = this.getCollectionName(repoPath);
      let collection;
      
      try {
        collection = await this.chromaClient.getCollection({
          name: collectionName
        });
        
        if (!forceReindex) {
          // Check for incremental updates
          const updated = await this.incrementalUpdate(repoPath, collection);
          if (updated) {
            logger.info('Repository index updated incrementally');
            this.collection = collection;
            return await this.getIndexStats(collection);
          }
        }
      } catch (e) {
        // Collection doesn't exist, will create new one
        logger.info('Creating new index for repository');
      }

      // Create or recreate collection
      if (collection && forceReindex) {
        await this.chromaClient.deleteCollection({ name: collectionName });
      }
      
      collection = await this.chromaClient.createCollection({
        name: collectionName,
        metadata: { 
          repoPath,
          indexedAt: new Date().toISOString()
        }
      });
      
      this.collection = collection;
      
      // Full index
      await this.fullIndex(repoPath, collection);
      
      return await this.getIndexStats(collection);
    } catch (error) {
      logger.error('Error indexing repository:', error);
      throw error;
    }
  }

  /**
   * Perform full indexing of repository
   */
  async fullIndex(repoPath, collection) {
    const javaFiles = await this.findJavaFiles(repoPath);
    logger.info(`Found ${javaFiles.length} Java files to index`);
    
    const batchSize = 10;
    for (let i = 0; i < javaFiles.length; i += batchSize) {
      const batch = javaFiles.slice(i, i + batchSize);
      await this.indexBatch(batch, collection, repoPath);
      logger.info(`Indexed ${Math.min(i + batchSize, javaFiles.length)}/${javaFiles.length} files`);
    }
    
    // Store current git commit
    const currentCommit = await this.git.revparse(['HEAD']);
    await collection.modify({
      metadata: {
        lastCommit: currentCommit,
        lastIndexed: new Date().toISOString()
      }
    });
  }

  /**
   * Index a batch of files
   */
  async indexBatch(files, collection, repoPath) {
    const documents = [];
    const metadatas = [];
    const ids = [];
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(repoPath, file);
      
      // Parse with Tree-sitter
      const tree = this.parser.parse(content);
      const analysis = this.analyzeJavaFile(tree, content, relativePath);
      
      // Prepare document for embedding
      const docText = this.prepareDocumentText(analysis);
      documents.push(docText);
      
      metadatas.push({
        filePath: relativePath,
        className: analysis.className,
        packageName: analysis.packageName,
        isPageObject: analysis.isPageObject,
        isTest: analysis.isTest,
        methods: JSON.stringify(analysis.methods.map(m => m.name)),
        imports: JSON.stringify(analysis.imports),
        fileType: analysis.fileType
      });
      
      ids.push(relativePath);
    }
    
    // Generate embeddings
    const embeddings = await this.generateEmbeddings(documents);
    
    // Add to collection
    await collection.add({
      ids,
      embeddings,
      metadatas,
      documents
    });
  }

  /**
   * Analyze Java file using Tree-sitter AST
   */
  analyzeJavaFile(tree, content, filePath) {
    const analysis = {
      filePath,
      className: '',
      packageName: '',
      methods: [],
      imports: [],
      isPageObject: false,
      isTest: false,
      fileType: 'unknown',
      elements: []
    };

    const rootNode = tree.rootNode;
    
    // Extract package name
    const packageNode = rootNode.children.find(n => n.type === 'package_declaration');
    if (packageNode) {
      analysis.packageName = content.substring(packageNode.startPosition.column, packageNode.endPosition.column)
        .replace(/package\s+|;/g, '').trim();
    }
    
    // Extract imports
    const importNodes = rootNode.children.filter(n => n.type === 'import_declaration');
    analysis.imports = importNodes.map(node => 
      content.substring(node.startPosition.column, node.endPosition.column)
        .replace(/import\s+|;/g, '').trim()
    );
    
    // Find class declaration
    const classNode = rootNode.children.find(n => n.type === 'class_declaration');
    if (classNode) {
      // Extract class name
      const identifierNode = classNode.children.find(n => n.type === 'identifier');
      if (identifierNode) {
        analysis.className = content.substring(
          identifierNode.startPosition.column,
          identifierNode.endPosition.column
        );
      }
      
      // Check if it's a Page Object or Test
      analysis.isPageObject = analysis.className.includes('Page') || 
                             analysis.className.includes('Screen') ||
                             filePath.includes('pages/') ||
                             filePath.includes('pageobjects/');
      
      analysis.isTest = analysis.className.includes('Test') ||
                       analysis.imports.some(imp => imp.includes('junit') || imp.includes('testng'));
      
      // Extract methods
      const methodNodes = this.findMethodNodes(classNode);
      for (const methodNode of methodNodes) {
        const method = this.extractMethodInfo(methodNode, content);
        if (method) {
          analysis.methods.push(method);
        }
      }
      
      // Extract WebElement declarations for Page Objects
      if (analysis.isPageObject) {
        analysis.elements = this.extractWebElements(classNode, content);
      }
    }
    
    // Determine file type
    if (analysis.isTest) {
      analysis.fileType = 'test';
    } else if (analysis.isPageObject) {
      analysis.fileType = 'pageObject';
    } else if (analysis.className.includes('Util') || analysis.className.includes('Helper')) {
      analysis.fileType = 'utility';
    } else {
      analysis.fileType = 'other';
    }
    
    return analysis;
  }

  /**
   * Find all method nodes in a class
   */
  findMethodNodes(classNode) {
    const methods = [];
    const classBody = classNode.children.find(n => n.type === 'class_body');
    
    if (classBody) {
      for (const child of classBody.children) {
        if (child.type === 'method_declaration') {
          methods.push(child);
        }
      }
    }
    
    return methods;
  }

  /**
   * Extract method information
   */
  extractMethodInfo(methodNode, content) {
    const method = {
      name: '',
      signature: '',
      modifiers: [],
      returnType: '',
      parameters: []
    };
    
    // Extract method name
    const identifierNode = methodNode.children.find(n => n.type === 'identifier');
    if (identifierNode) {
      method.name = content.substring(
        identifierNode.startPosition.column,
        identifierNode.endPosition.column
      );
    }
    
    // Extract full signature
    method.signature = content.substring(
      methodNode.startPosition.column,
      methodNode.endPosition.column
    ).split('{')[0].trim();
    
    // Extract modifiers
    const modifierNodes = methodNode.children.filter(n => n.type === 'modifiers');
    for (const modNode of modifierNodes) {
      const modifier = content.substring(
        modNode.startPosition.column,
        modNode.endPosition.column
      );
      method.modifiers.push(modifier);
    }
    
    return method;
  }

  /**
   * Extract WebElement declarations from Page Object
   */
  extractWebElements(classNode, content) {
    const elements = [];
    const classBody = classNode.children.find(n => n.type === 'class_body');
    
    if (classBody) {
      for (const child of classBody.children) {
        if (child.type === 'field_declaration') {
          const fieldText = content.substring(
            child.startPosition.column,
            child.endPosition.column
          );
          
          // Check if it's a WebElement
          if (fieldText.includes('WebElement') || fieldText.includes('@FindBy')) {
            elements.push({
              declaration: fieldText.trim(),
              name: this.extractFieldName(fieldText)
            });
          }
        }
      }
    }
    
    return elements;
  }

  /**
   * Extract field name from declaration
   */
  extractFieldName(fieldText) {
    const match = fieldText.match(/(\w+)\s*;/);
    return match ? match[1] : '';
  }

  /**
   * Prepare document text for embedding
   */
  prepareDocumentText(analysis) {
    const parts = [
      `class ${analysis.className}`,
      analysis.packageName ? `package ${analysis.packageName}` : '',
      analysis.fileType,
      ...analysis.methods.map(m => m.signature),
      ...analysis.elements.map(e => e.name)
    ];
    
    return parts.filter(Boolean).join(' ');
  }

  /**
   * Find Java files in repository
   */
  async findJavaFiles(dirPath, files = []) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip common directories to ignore
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'target', 'build', '.idea'].includes(entry.name)) {
          await this.findJavaFiles(fullPath, files);
        }
      } else if (entry.name.endsWith('.java')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Incremental update based on git diff
   */
  async incrementalUpdate(repoPath, collection) {
    try {
      const metadata = collection.metadata || {};
      const lastCommit = metadata.lastCommit;
      
      if (!lastCommit) {
        return false; // Need full index
      }
      
      const currentCommit = await this.git.revparse(['HEAD']);
      if (lastCommit === currentCommit) {
        logger.info('Repository unchanged since last index');
        return true;
      }
      
      // Get changed files
      const diff = await this.git.diff([lastCommit, currentCommit, '--name-only']);
      const changedFiles = diff.split('\n')
        .filter(f => f.endsWith('.java'))
        .map(f => path.join(repoPath, f));
      
      if (changedFiles.length === 0) {
        logger.info('No Java files changed');
        return true;
      }
      
      logger.info(`Updating ${changedFiles.length} changed files`);
      
      // Remove old versions from index
      const relativePaths = changedFiles.map(f => path.relative(repoPath, f));
      await collection.delete({ ids: relativePaths });
      
      // Index changed files
      await this.indexBatch(changedFiles, collection, repoPath);
      
      // Update commit reference
      await collection.modify({
        metadata: {
          lastCommit: currentCommit,
          lastIndexed: new Date().toISOString()
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Incremental update failed:', error);
      return false;
    }
  }

  /**
   * Search for similar code
   */
  async findSimilarCode(query, repoPath, limit = 5) {
    try {
      const collection = await this.getCollection(repoPath);
      if (!collection) {
        throw new Error('Repository not indexed');
      }
      
      // Generate query embedding
      const [queryEmbedding] = await this.generateEmbeddings([query], 'query');
      
      // Search in ChromaDB
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit
      });
      
      // Format results
      return results.ids[0].map((id, index) => ({
        filePath: id,
        similarity: 1 - (results.distances[0][index] || 0),
        metadata: results.metadatas[0][index],
        document: results.documents[0][index]
      }));
    } catch (error) {
      logger.error('Error finding similar code:', error);
      throw error;
    }
  }

  /**
   * Find similar tests based on scenario
   */
  async findSimilarTests(testScenario, repoPath, limit = 5) {
    try {
      const collection = await this.getCollection(repoPath);
      if (!collection) {
        throw new Error('Repository not indexed');
      }
      
      // Generate embedding for test scenario
      const [queryEmbedding] = await this.generateEmbeddings([testScenario], 'query');
      
      // Search only in test files
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit * 2, // Get more to filter
        where: { isTest: true }
      });
      
      // Format and filter results
      const formattedResults = results.ids[0]
        .map((id, index) => ({
          filePath: id,
          similarity: 1 - (results.distances[0][index] || 0),
          metadata: results.metadatas[0][index],
          className: results.metadatas[0][index].className,
          methods: JSON.parse(results.metadatas[0][index].methods || '[]')
        }))
        .filter(r => r.similarity > 0.5)
        .slice(0, limit);
      
      return formattedResults;
    } catch (error) {
      logger.error('Error finding similar tests:', error);
      throw error;
    }
  }

  /**
   * Find Page Objects
   */
  async findPageObjects(repoPath, searchTerm = null) {
    try {
      const collection = await this.getCollection(repoPath);
      if (!collection) {
        throw new Error('Repository not indexed');
      }
      
      let results;
      if (searchTerm) {
        // Search with term
        const [queryEmbedding] = await this.generateEmbeddings([searchTerm], 'query');
        results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: 20,
          where: { isPageObject: true }
        });
      } else {
        // Get all Page Objects
        results = await collection.get({
          where: { isPageObject: true }
        });
      }
      
      // Format results
      const pageObjects = (results.ids || []).map((id, index) => ({
        filePath: id,
        className: results.metadatas[index].className,
        methods: JSON.parse(results.metadatas[index].methods || '[]'),
        packageName: results.metadatas[index].packageName
      }));
      
      return pageObjects;
    } catch (error) {
      logger.error('Error finding Page Objects:', error);
      throw error;
    }
  }

  /**
   * Get or create collection for repository
   */
  async getCollection(repoPath) {
    const collectionName = this.getCollectionName(repoPath);
    
    try {
      return await this.chromaClient.getCollection({ name: collectionName });
    } catch (error) {
      logger.warn(`Collection ${collectionName} not found`);
      return null;
    }
  }

  /**
   * Generate collection name from repository path
   */
  getCollectionName(repoPath) {
    return `repo_${Buffer.from(repoPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 50)}`;
  }

  /**
   * Get index statistics
   */
  async getIndexStats(collection) {
    const count = await collection.count();
    const metadata = collection.metadata || {};
    
    return {
      totalFiles: count,
      lastIndexed: metadata.lastIndexed,
      lastCommit: metadata.lastCommit
    };
  }
}

// Export singleton instance
const codebaseIndexService = new CodebaseIndexService();
export default codebaseIndexService;