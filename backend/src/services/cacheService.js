import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

/**
 * Multi-level caching service that sits BEFORE embedding generation
 * Prevents unnecessary parsing and API calls
 */
class CacheService {
  constructor() {
    this.db = null;
    this.cacheDir = path.join(process.cwd(), '.qa-copilot-cache');
    this.dbPath = path.join(this.cacheDir, 'cache.db');
    this.astCacheDir = path.join(this.cacheDir, 'ast');
    this.metadataCacheDir = path.join(this.cacheDir, 'metadata');
    
    // Cache TTLs (in milliseconds)
    this.TTL = {
      fileHash: 7 * 24 * 60 * 60 * 1000,  // 7 days for file hashes
      ast: 30 * 24 * 60 * 60 * 1000,      // 30 days for parsed AST
      metadata: 7 * 24 * 60 * 60 * 1000,  // 7 days for extracted metadata
      embedding: 30 * 24 * 60 * 60 * 1000, // 30 days for embeddings
      pattern: 3 * 24 * 60 * 60 * 1000    // 3 days for patterns
    };
  }

  async initialize() {
    try {
      // Create cache directories
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(this.astCacheDir, { recursive: true });
      await fs.mkdir(this.metadataCacheDir, { recursive: true });
      
      // Initialize SQLite database for cache metadata
      this.db = new Database(this.dbPath);
      
      // Create cache tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS file_cache (
          file_path TEXT PRIMARY KEY,
          file_hash TEXT NOT NULL,
          last_modified INTEGER NOT NULL,
          file_size INTEGER NOT NULL,
          ast_cached BOOLEAN DEFAULT 0,
          metadata_cached BOOLEAN DEFAULT 0,
          embedding_cached BOOLEAN DEFAULT 0,
          cache_timestamp INTEGER NOT NULL,
          UNIQUE(file_path)
        );
        
        CREATE TABLE IF NOT EXISTS ast_cache (
          file_path TEXT PRIMARY KEY,
          ast_hash TEXT NOT NULL,
          node_count INTEGER,
          cache_timestamp INTEGER NOT NULL,
          FOREIGN KEY (file_path) REFERENCES file_cache(file_path)
        );
        
        CREATE TABLE IF NOT EXISTS metadata_cache (
          file_path TEXT PRIMARY KEY,
          class_name TEXT,
          methods TEXT,
          imports TEXT,
          annotations TEXT,
          type TEXT,
          cache_timestamp INTEGER NOT NULL,
          FOREIGN KEY (file_path) REFERENCES file_cache(file_path)
        );
        
        CREATE TABLE IF NOT EXISTS embedding_cache (
          file_path TEXT PRIMARY KEY,
          embedding_id TEXT,
          vector_dimension INTEGER,
          model_version TEXT,
          cache_timestamp INTEGER NOT NULL,
          FOREIGN KEY (file_path) REFERENCES file_cache(file_path)
        );
        
        CREATE TABLE IF NOT EXISTS pattern_cache (
          directory_path TEXT PRIMARY KEY,
          patterns TEXT,
          file_count INTEGER,
          cache_timestamp INTEGER NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_file_hash ON file_cache(file_hash);
        CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON file_cache(cache_timestamp);
        CREATE INDEX IF NOT EXISTS idx_pattern_timestamp ON pattern_cache(cache_timestamp);
      `);
      
      logger.info('Cache service initialized');
      
      // Clean up expired cache entries on startup
      await this.cleanupExpiredCache();
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize cache service:', error);
      throw error;
    }
  }

  /**
   * Calculate file hash for change detection
   */
  async getFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      logger.error(`Failed to hash file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if file has changed since last cache
   */
  async hasFileChanged(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const currentHash = await this.getFileHash(filePath);
      
      const cached = this.db.prepare(
        'SELECT file_hash, last_modified FROM file_cache WHERE file_path = ?'
      ).get(filePath);
      
      if (!cached) {
        return true; // Not cached, needs processing
      }
      
      // Check both hash and modification time
      return cached.file_hash !== currentHash || 
             cached.last_modified < stats.mtimeMs;
    } catch (error) {
      logger.error(`Error checking file change for ${filePath}:`, error);
      return true; // Assume changed on error
    }
  }

  /**
   * Get cached AST for a file
   */
  async getCachedAST(filePath) {
    try {
      // Check if file has changed
      if (await this.hasFileChanged(filePath)) {
        return null;
      }
      
      const cached = this.db.prepare(
        'SELECT * FROM ast_cache WHERE file_path = ?'
      ).get(filePath);
      
      if (!cached) {
        return null;
      }
      
      // Check TTL
      if (Date.now() - cached.cache_timestamp > this.TTL.ast) {
        return null;
      }
      
      // Read AST from file cache
      const astPath = path.join(this.astCacheDir, `${cached.ast_hash}.json`);
      try {
        const astData = await fs.readFile(astPath, 'utf8');
        return JSON.parse(astData);
      } catch (error) {
        logger.warn(`AST cache file not found for ${filePath}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error getting cached AST for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Cache parsed AST
   */
  async cacheAST(filePath, ast) {
    try {
      const fileHash = await this.getFileHash(filePath);
      const stats = await fs.stat(filePath);
      const astHash = crypto.createHash('sha256')
        .update(JSON.stringify(ast))
        .digest('hex');
      
      // Save AST to file
      const astPath = path.join(this.astCacheDir, `${astHash}.json`);
      await fs.writeFile(astPath, JSON.stringify(ast), 'utf8');
      
      // Update database
      const timestamp = Date.now();
      
      // Update file cache
      this.db.prepare(`
        INSERT OR REPLACE INTO file_cache 
        (file_path, file_hash, last_modified, file_size, ast_cached, cache_timestamp)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(filePath, fileHash, stats.mtimeMs, stats.size, timestamp);
      
      // Update AST cache
      this.db.prepare(`
        INSERT OR REPLACE INTO ast_cache
        (file_path, ast_hash, node_count, cache_timestamp)
        VALUES (?, ?, ?, ?)
      `).run(filePath, astHash, ast.rootNode?.namedChildCount || 0, timestamp);
      
      logger.debug(`Cached AST for ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error caching AST for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get cached metadata for a file
   */
  async getCachedMetadata(filePath) {
    try {
      if (await this.hasFileChanged(filePath)) {
        return null;
      }
      
      const cached = this.db.prepare(
        'SELECT * FROM metadata_cache WHERE file_path = ?'
      ).get(filePath);
      
      if (!cached) {
        return null;
      }
      
      // Check TTL
      if (Date.now() - cached.cache_timestamp > this.TTL.metadata) {
        return null;
      }
      
      return {
        className: cached.class_name,
        methods: JSON.parse(cached.methods || '[]'),
        imports: JSON.parse(cached.imports || '[]'),
        annotations: JSON.parse(cached.annotations || '[]'),
        type: cached.type
      };
    } catch (error) {
      logger.error(`Error getting cached metadata for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Cache extracted metadata
   */
  async cacheMetadata(filePath, metadata) {
    try {
      const timestamp = Date.now();
      
      this.db.prepare(`
        INSERT OR REPLACE INTO metadata_cache
        (file_path, class_name, methods, imports, annotations, type, cache_timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        filePath,
        metadata.className,
        JSON.stringify(metadata.methods || []),
        JSON.stringify(metadata.imports || []),
        JSON.stringify(metadata.annotations || []),
        metadata.type,
        timestamp
      );
      
      // Update file cache
      this.db.prepare(`
        UPDATE file_cache SET metadata_cached = 1, cache_timestamp = ?
        WHERE file_path = ?
      `).run(timestamp, filePath);
      
      logger.debug(`Cached metadata for ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error caching metadata for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Check if embedding exists and is valid
   */
  async hasValidEmbedding(filePath) {
    try {
      if (await this.hasFileChanged(filePath)) {
        return false;
      }
      
      const cached = this.db.prepare(
        'SELECT * FROM embedding_cache WHERE file_path = ?'
      ).get(filePath);
      
      if (!cached) {
        return false;
      }
      
      // Check TTL
      if (Date.now() - cached.cache_timestamp > this.TTL.embedding) {
        return false;
      }
      
      return cached.embedding_id; // Return embedding ID if valid
    } catch (error) {
      logger.error(`Error checking embedding for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Cache embedding reference
   */
  async cacheEmbedding(filePath, embeddingId, dimension = 1024, modelVersion = 'voyage-code-2') {
    try {
      const timestamp = Date.now();
      
      this.db.prepare(`
        INSERT OR REPLACE INTO embedding_cache
        (file_path, embedding_id, vector_dimension, model_version, cache_timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(filePath, embeddingId, dimension, modelVersion, timestamp);
      
      // Update file cache
      this.db.prepare(`
        UPDATE file_cache SET embedding_cached = 1, cache_timestamp = ?
        WHERE file_path = ?
      `).run(timestamp, filePath);
      
      logger.debug(`Cached embedding reference for ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error caching embedding for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get cached patterns for a directory
   */
  async getCachedPatterns(directoryPath) {
    try {
      const cached = this.db.prepare(
        'SELECT * FROM pattern_cache WHERE directory_path = ?'
      ).get(directoryPath);
      
      if (!cached) {
        return null;
      }
      
      // Check TTL
      if (Date.now() - cached.cache_timestamp > this.TTL.pattern) {
        return null;
      }
      
      return JSON.parse(cached.patterns);
    } catch (error) {
      logger.error(`Error getting cached patterns for ${directoryPath}:`, error);
      return null;
    }
  }

  /**
   * Cache extracted patterns
   */
  async cachePatterns(directoryPath, patterns, fileCount) {
    try {
      const timestamp = Date.now();
      
      this.db.prepare(`
        INSERT OR REPLACE INTO pattern_cache
        (directory_path, patterns, file_count, cache_timestamp)
        VALUES (?, ?, ?, ?)
      `).run(directoryPath, JSON.stringify(patterns), fileCount, timestamp);
      
      logger.debug(`Cached patterns for ${directoryPath}`);
      return true;
    } catch (error) {
      logger.error(`Error caching patterns for ${directoryPath}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    try {
      const stats = {
        totalFiles: this.db.prepare('SELECT COUNT(*) as count FROM file_cache').get().count,
        cachedAST: this.db.prepare('SELECT COUNT(*) as count FROM ast_cache').get().count,
        cachedMetadata: this.db.prepare('SELECT COUNT(*) as count FROM metadata_cache').get().count,
        cachedEmbeddings: this.db.prepare('SELECT COUNT(*) as count FROM embedding_cache').get().count,
        cachedPatterns: this.db.prepare('SELECT COUNT(*) as count FROM pattern_cache').get().count,
        cacheSize: 0 // Calculate cache directory size if needed
      };
      
      // Calculate cache hit rate
      const recentHits = this.db.prepare(`
        SELECT COUNT(*) as count FROM file_cache 
        WHERE cache_timestamp > ?
      `).get(Date.now() - 3600000).count; // Last hour
      
      stats.recentHitRate = stats.totalFiles > 0 
        ? (recentHits / stats.totalFiles * 100).toFixed(2) + '%'
        : '0%';
      
      return stats;
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache() {
    try {
      const now = Date.now();
      
      // Remove expired file cache entries
      const expiredFiles = this.db.prepare(`
        DELETE FROM file_cache 
        WHERE cache_timestamp < ?
        RETURNING file_path
      `).all(now - this.TTL.fileHash);
      
      // Remove expired pattern cache
      this.db.prepare(`
        DELETE FROM pattern_cache 
        WHERE cache_timestamp < ?
      `).run(now - this.TTL.pattern);
      
      // Clean up orphaned AST files
      const astFiles = await fs.readdir(this.astCacheDir);
      const validHashes = new Set(
        this.db.prepare('SELECT ast_hash FROM ast_cache').all()
          .map(row => row.ast_hash)
      );
      
      for (const file of astFiles) {
        const hash = path.basename(file, '.json');
        if (!validHashes.has(hash)) {
          await fs.unlink(path.join(this.astCacheDir, file));
        }
      }
      
      logger.info(`Cleaned up ${expiredFiles.length} expired cache entries`);
      return expiredFiles.length;
    } catch (error) {
      logger.error('Error cleaning up cache:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache for specific files (e.g., after git pull)
   */
  async invalidateFiles(filePaths) {
    try {
      const stmt = this.db.prepare('DELETE FROM file_cache WHERE file_path = ?');
      const deleteMany = this.db.transaction((paths) => {
        for (const path of paths) {
          stmt.run(path);
        }
      });
      
      deleteMany(filePaths);
      logger.info(`Invalidated cache for ${filePaths.length} files`);
      return true;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      this.db.exec('DELETE FROM file_cache');
      this.db.exec('DELETE FROM ast_cache');
      this.db.exec('DELETE FROM metadata_cache');
      this.db.exec('DELETE FROM embedding_cache');
      this.db.exec('DELETE FROM pattern_cache');
      
      // Clear cache directories
      const astFiles = await fs.readdir(this.astCacheDir);
      for (const file of astFiles) {
        await fs.unlink(path.join(this.astCacheDir, file));
      }
      
      logger.info('Cleared all cache');
      return true;
    } catch (error) {
      logger.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;