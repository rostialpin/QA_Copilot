// Smart caching service for QA Copilot
// Provides multi-level caching with automatic fallback

class CacheService {
  constructor() {
    // In-memory cache for ultra-fast access
    this.memoryCache = new Map();
    
    // Cache TTL (time to live) in milliseconds
    this.defaultTTL = 15 * 60 * 1000; // 15 minutes
    
    // Cache keys
    this.KEYS = {
      JIRA_BOARDS: 'jira_boards',
      JIRA_SPRINT: 'jira_sprint_',
      JIRA_TICKETS: 'jira_tickets_',
      TESTRAIL_PROJECTS: 'testrail_projects',
      TESTRAIL_SUITES: 'testrail_suites_',
      TESTRAIL_TESTS: 'testrail_tests_',
      CYPRESS_PATTERNS: 'cypress_patterns',
      GENERATED_TESTS: 'generated_tests_',
      TEST_CONTEXT: 'test_context_'
    };
    
    // Initialize cache stats
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0
    };
  }

  // Get item from cache with fallback to fetcher
  async get(key, fetcher, options = {}) {
    const { ttl = this.defaultTTL, force = false } = options;
    
    // Skip cache if forced
    if (force) {
      const data = await fetcher();
      this.set(key, data, ttl);
      return data;
    }
    
    // Check memory cache first
    const memoryCached = this.getFromMemory(key);
    if (memoryCached) {
      this.stats.hits++;
      console.log(`Cache HIT (memory): ${key}`);
      return memoryCached;
    }
    
    // Check localStorage
    const localCached = this.getFromLocalStorage(key);
    if (localCached) {
      this.stats.hits++;
      console.log(`Cache HIT (localStorage): ${key}`);
      // Promote to memory cache
      this.setInMemory(key, localCached, ttl);
      return localCached;
    }
    
    // Cache miss - fetch data
    this.stats.misses++;
    console.log(`Cache MISS: ${key}, fetching...`);
    
    try {
      const data = await fetcher();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error(`Error fetching data for ${key}:`, error);
      throw error;
    }
  }

  // Set item in both memory and localStorage
  set(key, data, ttl = this.defaultTTL) {
    this.stats.saves++;
    this.setInMemory(key, data, ttl);
    this.setInLocalStorage(key, data, ttl);
  }

  // Memory cache operations
  getFromMemory(key) {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setInMemory(key, data, ttl) {
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  // LocalStorage operations
  getFromLocalStorage(key) {
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (!stored) return null;
      
      const { data, expiry } = JSON.parse(stored);
      
      if (Date.now() > expiry) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Error reading from localStorage for ${key}:`, error);
      return null;
    }
  }

  setInLocalStorage(key, data, ttl) {
    try {
      const toStore = {
        data,
        expiry: Date.now() + ttl
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error writing to localStorage for ${key}:`, error);
      // If localStorage is full, clear old cache entries
      if (error.name === 'QuotaExceededError') {
        this.clearOldLocalStorage();
        // Try once more
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify({ data, expiry: Date.now() + ttl }));
        } catch (retryError) {
          console.error('Failed to save to localStorage even after cleanup');
        }
      }
    }
  }

  // Clear old cache entries from localStorage
  clearOldLocalStorage() {
    const now = Date.now();
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        try {
          const { expiry } = JSON.parse(localStorage.getItem(key));
          if (now > expiry) {
            keysToRemove.push(key);
          }
        } catch (error) {
          // Invalid entry, remove it
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} expired cache entries`);
  }

  // Clear specific cache entry
  invalidate(key) {
    this.memoryCache.delete(key);
    localStorage.removeItem(`cache_${key}`);
  }

  // Clear all cache
  clear() {
    this.memoryCache.clear();
    
    // Clear all cache entries from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('Cache cleared');
  }

  // Get cache statistics
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return {
      ...this.stats,
      hitRate: `${(hitRate * 100).toFixed(1)}%`,
      memoryCacheSize: this.memoryCache.size,
      localStorageSize: this.getLocalStorageSize()
    };
  }

  getLocalStorageSize() {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache_')) {
        count++;
      }
    }
    return count;
  }

  // Preload data for demo
  async preloadDemoData() {
    console.log('Preloading demo data...');
    
    // Preload commonly used data with extended TTL
    const extendedTTL = 60 * 60 * 1000; // 1 hour
    
    // You can add actual preloading logic here
    const preloadTasks = [
      { key: this.KEYS.TESTRAIL_PROJECTS, data: { preloaded: true } },
      { key: this.KEYS.CYPRESS_PATTERNS, data: { patterns: [] } }
    ];
    
    preloadTasks.forEach(({ key, data }) => {
      this.set(key, data, extendedTTL);
    });
    
    console.log('Demo data preloaded');
  }
}

// Singleton instance
const cacheService = new CacheService();

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Enhanced API methods with caching
export const cachedApi = {
  // JIRA methods with caching
  async getJiraBoards() {
    return cacheService.get(
      cacheService.KEYS.JIRA_BOARDS,
      async () => {
        const response = await fetch(`${API_URL}/api/jira/boards`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      }
    );
  },

  async getJiraSprint(boardId) {
    return cacheService.get(
      `${cacheService.KEYS.JIRA_SPRINT}${boardId}`,
      async () => {
        const response = await fetch(`${API_URL}/api/jira/current-sprint/${boardId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      }
    );
  },

  async getJiraTickets(sprintId) {
    return cacheService.get(
      `${cacheService.KEYS.JIRA_TICKETS}${sprintId}`,
      async () => {
        const response = await fetch(`${API_URL}/api/jira/sprint/${sprintId}/issues`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      }
    );
  },

  // TestRail methods with caching
  async getTestRailProjects() {
    return cacheService.get(
      cacheService.KEYS.TESTRAIL_PROJECTS,
      async () => {
        const response = await fetch(`${API_URL}/api/testrail/projects`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      }
    );
  },

  async getTestRailSuites(projectId) {
    return cacheService.get(
      `${cacheService.KEYS.TESTRAIL_SUITES}${projectId}`,
      async () => {
        const response = await fetch(`${API_URL}/api/testrail/suites/${projectId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      }
    );
  },

  async getTestRailTests(projectId, suiteId) {
    return cacheService.get(
      `${cacheService.KEYS.TESTRAIL_TESTS}${projectId}_${suiteId}`,
      async () => {
        const response = await fetch(`${API_URL}/api/testrail/test-cases/${projectId}/${suiteId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      }
    );
  },

  // Cypress patterns with caching
  async getCypressPatterns() {
    return cacheService.get(
      cacheService.KEYS.CYPRESS_PATTERNS,
      async () => {
        const response = await fetch(`${API_URL}/api/cypress/patterns`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      },
      { ttl: 60 * 60 * 1000 } // Cache for 1 hour
    );
  },

  // Clear cache for specific resource
  invalidateCache(resource) {
    switch(resource) {
      case 'jira':
        Object.keys(cacheService.KEYS)
          .filter(k => k.startsWith('JIRA'))
          .forEach(k => cacheService.invalidate(cacheService.KEYS[k]));
        break;
      case 'testrail':
        Object.keys(cacheService.KEYS)
          .filter(k => k.startsWith('TESTRAIL'))
          .forEach(k => cacheService.invalidate(cacheService.KEYS[k]));
        break;
      default:
        cacheService.invalidate(resource);
    }
  }
};

export default cacheService;