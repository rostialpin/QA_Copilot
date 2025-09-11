import { useState, useEffect } from 'react';
import { 
  Search, FileCode, Package, Loader2, CheckCircle, 
  AlertCircle, X, ChevronRight, ChevronDown, Eye
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function PageObjectSelector({ 
  repoPath, 
  testScenario,
  onPageObjectsSelected,
  selectedPageObjects = []
}) {
  const [pageObjects, setPageObjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(new Set(selectedPageObjects));
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [error, setError] = useState('');
  const [indexStatus, setIndexStatus] = useState(null);

  // Check index status when repo path changes
  useEffect(() => {
    if (repoPath) {
      checkIndexStatus();
    }
  }, [repoPath]);

  // Auto-search when test scenario changes
  useEffect(() => {
    if (testScenario && repoPath && indexStatus?.indexed) {
      searchPageObjects();
    }
  }, [testScenario, indexStatus]);

  const checkIndexStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/codebase/status`, {
        params: { repoPath }
      });
      setIndexStatus(response.data);
      
      if (!response.data.indexed) {
        setError('Repository not indexed. Please index the repository first.');
      }
    } catch (error) {
      console.error('Error checking index status:', error);
      setError('Failed to check repository index status');
    }
  };

  const searchPageObjects = async () => {
    if (!repoPath) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // First, get all Page Objects
      const response = await axios.get(`${API_URL}/api/codebase/page-objects`, {
        params: { 
          repoPath,
          searchTerm: searchTerm || testScenario?.substring(0, 100)
        }
      });
      
      const pageObjectList = response.data.pageObjects || [];
      
      // If we have a test scenario, find the most relevant ones
      if (testScenario && pageObjectList.length > 0) {
        const relevanceResponse = await axios.post(`${API_URL}/api/codebase/search/similar-tests`, {
          testScenario: testScenario.substring(0, 500),
          repoPath,
          limit: 10
        });
        
        // Mark the most relevant Page Objects
        const relevantFiles = new Set(
          relevanceResponse.data.tests
            .filter(t => t.metadata?.type === 'page_object')
            .map(t => t.filePath)
        );
        
        pageObjectList.forEach(po => {
          po.isRelevant = relevantFiles.has(po.filePath);
        });
        
        // Sort by relevance
        pageObjectList.sort((a, b) => {
          if (a.isRelevant && !b.isRelevant) return -1;
          if (!a.isRelevant && b.isRelevant) return 1;
          return a.className.localeCompare(b.className);
        });
      }
      
      setPageObjects(pageObjectList);
    } catch (error) {
      console.error('Error searching Page Objects:', error);
      setError('Failed to search Page Objects');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (pageObject) => {
    const newSelected = new Set(selected);
    const key = pageObject.filePath;
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelected(newSelected);
    
    // Notify parent with selected Page Objects
    const selectedObjects = pageObjects.filter(po => 
      newSelected.has(po.filePath)
    );
    onPageObjectsSelected(selectedObjects);
  };

  const toggleExpanded = (filePath) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedItems(newExpanded);
  };

  const getMethodPreview = (methods) => {
    if (!methods || methods.length === 0) return 'No methods';
    const methodList = typeof methods === 'string' ? JSON.parse(methods) : methods;
    return `${methodList.length} methods`;
  };

  const renderPageObject = (pageObject) => {
    const isSelected = selected.has(pageObject.filePath);
    const isExpanded = expandedItems.has(pageObject.filePath);
    const methods = typeof pageObject.methods === 'string' 
      ? JSON.parse(pageObject.methods) 
      : pageObject.methods || [];
    
    return (
      <div
        key={pageObject.filePath}
        className={`border rounded-lg p-3 transition-all ${
          isSelected 
            ? 'border-indigo-500 bg-indigo-50' 
            : pageObject.isRelevant
              ? 'border-green-300 bg-green-50'
              : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelection(pageObject)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <FileCode className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">
                {pageObject.className}
              </span>
              {pageObject.isRelevant && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  Recommended
                </span>
              )}
            </div>
            
            <div className="ml-6 mt-1">
              <p className="text-xs text-gray-500">
                {pageObject.filePath.replace(repoPath, '').replace(/^\//, '')}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {getMethodPreview(methods)}
              </p>
            </div>
            
            {methods.length > 0 && (
              <button
                onClick={() => toggleExpanded(pageObject.filePath)}
                className="ml-6 mt-2 text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Hide methods
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    Show methods
                  </>
                )}
              </button>
            )}
            
            {isExpanded && methods.length > 0 && (
              <div className="ml-6 mt-2 p-2 bg-gray-50 rounded text-xs">
                <div className="space-y-1">
                  {methods.map((method, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <code className="text-gray-700">{method}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Select Page Objects
        </h3>
        <p className="text-sm text-gray-600">
          Choose relevant Page Objects to reuse in your test generation
        </p>
      </div>

      {/* Index Status */}
      {indexStatus && (
        <div className={`p-3 rounded-lg border ${
          indexStatus.indexed 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {indexStatus.indexed ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-900">
                  Repository indexed • {indexStatus.stats?.totalFiles || 0} files • 
                  {indexStatus.stats?.pageObjects || 0} Page Objects
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-900">
                  Repository not indexed yet
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPageObjects()}
            placeholder="Search Page Objects by name..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={searchPageObjects}
          disabled={isLoading || !indexStatus?.indexed}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Search
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-900">{error}</span>
          </div>
        </div>
      )}

      {/* Page Objects List */}
      {pageObjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Found {pageObjects.length} Page Objects
              {selected.size > 0 && ` • ${selected.size} selected`}
            </span>
            {selected.size > 0 && (
              <button
                onClick={() => {
                  setSelected(new Set());
                  onPageObjectsSelected([]);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear selection
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pageObjects.map(renderPageObject)}
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-sm text-indigo-900 font-medium">
            {selected.size} Page Object{selected.size !== 1 ? 's' : ''} selected
          </p>
          <p className="text-xs text-indigo-700 mt-1">
            These Page Objects will be used to generate your test with proper imports and method calls
          </p>
        </div>
      )}
    </div>
  );
}