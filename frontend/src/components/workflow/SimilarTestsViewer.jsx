import { useState, useEffect } from 'react';
import { 
  Code, Loader2, ChevronRight, ChevronDown, 
  FileCode, AlertCircle, TrendingUp, Zap
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SimilarTestsViewer({ 
  repoPath, 
  testScenario,
  onTestsFound,
  limit = 5
}) {
  const [similarTests, setSimilarTests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTests, setExpandedTests] = useState(new Set());
  const [error, setError] = useState('');
  const [patterns, setPatterns] = useState(null);

  // Auto-search when test scenario changes
  useEffect(() => {
    if (testScenario && repoPath) {
      findSimilarTests();
    }
  }, [testScenario, repoPath]);

  const findSimilarTests = async () => {
    if (!testScenario || !repoPath) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_URL}/api/codebase/search/similar-tests`, {
        testScenario: testScenario.substring(0, 1000),
        repoPath,
        limit
      });
      
      const tests = response.data.tests || [];
      setSimilarTests(tests);
      
      // Extract patterns from similar tests
      if (tests.length > 0) {
        const extractedPatterns = extractPatterns(tests);
        setPatterns(extractedPatterns);
        onTestsFound && onTestsFound(tests, extractedPatterns);
      }
      
      // Auto-expand the most similar test
      if (tests.length > 0) {
        setExpandedTests(new Set([tests[0].filePath]));
      }
    } catch (error) {
      console.error('Error finding similar tests:', error);
      setError('Failed to find similar tests. Make sure the repository is indexed.');
    } finally {
      setIsLoading(false);
    }
  };

  const extractPatterns = (tests) => {
    const patterns = {
      imports: new Set(),
      annotations: new Set(),
      assertions: new Set(),
      pageObjectUsage: new Set(),
      navigationPatterns: [],
      dataPatterns: []
    };
    
    tests.forEach(test => {
      // Extract imports
      const importMatches = test.content?.match(/import\s+[\w.]+.*;/g) || [];
      importMatches.forEach(imp => patterns.imports.add(imp));
      
      // Extract annotations
      const annotationMatches = test.content?.match(/@\w+(\([^)]*\))?/g) || [];
      annotationMatches.forEach(ann => patterns.annotations.add(ann));
      
      // Extract assertion patterns
      const assertMatches = test.content?.match(/assert\w+\([^)]+\)/g) || [];
      assertMatches.forEach(assert => {
        const pattern = assert.replace(/\([^)]+\)/, '(...)');
        patterns.assertions.add(pattern);
      });
      
      // Extract Page Object usage
      const pageObjectMatches = test.content?.match(/new\s+\w+Page\(\)/g) || [];
      pageObjectMatches.forEach(po => patterns.pageObjectUsage.add(po));
      
      // Extract navigation patterns
      const navMatches = test.content?.match(/navigate\w+\([^)]*\)|launch\w+\([^)]*\)/gi) || [];
      patterns.navigationPatterns.push(...navMatches);
      
      // Extract data generation patterns
      const dataMatches = test.content?.match(/generate\w+\([^)]*\)|create\w+Data\([^)]*\)/gi) || [];
      patterns.dataPatterns.push(...dataMatches);
    });
    
    return {
      imports: Array.from(patterns.imports),
      annotations: Array.from(patterns.annotations),
      assertions: Array.from(patterns.assertions),
      pageObjectUsage: Array.from(patterns.pageObjectUsage),
      navigationPatterns: [...new Set(patterns.navigationPatterns)],
      dataPatterns: [...new Set(patterns.dataPatterns)],
      testCount: tests.length
    };
  };

  const toggleExpanded = (filePath) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedTests(newExpanded);
  };

  const getSimilarityColor = (similarity) => {
    if (similarity > 0.8) return 'text-green-600 bg-green-50';
    if (similarity > 0.6) return 'text-blue-600 bg-blue-50';
    if (similarity > 0.4) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSimilarityLabel = (similarity) => {
    if (similarity > 0.8) return 'Very Similar';
    if (similarity > 0.6) return 'Similar';
    if (similarity > 0.4) return 'Somewhat Similar';
    return 'Related';
  };

  const renderTest = (test, index) => {
    const isExpanded = expandedTests.has(test.filePath);
    const similarity = test.similarity || 0;
    const metadata = test.metadata || {};
    
    return (
      <div
        key={test.filePath}
        className={`border rounded-lg p-3 transition-all ${
          index === 0 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                #{index + 1}
              </span>
              <FileCode className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">
                {test.className || test.filePath.split('/').pop()}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${getSimilarityColor(similarity)}`}>
                {(similarity * 100).toFixed(0)}% • {getSimilarityLabel(similarity)}
              </span>
            </div>
            
            <div className="ml-6 mt-1">
              <p className="text-xs text-gray-500">
                {test.filePath.replace(repoPath, '').replace(/^\//, '')}
              </p>
              {metadata.methods && (
                <p className="text-xs text-gray-600 mt-1">
                  {metadata.methods} test methods
                </p>
              )}
            </div>
            
            <button
              onClick={() => toggleExpanded(test.filePath)}
              className="ml-6 mt-2 text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Hide code snippet
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  Show code snippet
                </>
              )}
            </button>
            
            {isExpanded && test.content && (
              <div className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                <pre className="font-mono text-gray-700">
                  <code>{test.content.substring(0, 500)}...</code>
                </pre>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Similar Tests Analysis
        </h3>
        <p className="text-sm text-gray-600">
          AI will learn from these existing tests to match your coding style
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="text-sm text-gray-600">
              Analyzing existing tests with Voyage AI...
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-900">{error}</span>
          </div>
        </div>
      )}

      {/* Similar Tests List */}
      {!isLoading && similarTests.length > 0 && (
        <>
          <div className="space-y-2">
            {similarTests.map((test, index) => renderTest(test, index))}
          </div>

          {/* Pattern Analysis Summary */}
          {patterns && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Pattern Analysis Complete
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs text-blue-700">
                <div>
                  <span className="font-medium">Imports:</span> {patterns.imports.length} patterns
                </div>
                <div>
                  <span className="font-medium">Annotations:</span> {patterns.annotations.length} patterns
                </div>
                <div>
                  <span className="font-medium">Assertions:</span> {patterns.assertions.length} styles
                </div>
                <div>
                  <span className="font-medium">Page Objects:</span> {patterns.pageObjectUsage.length} usage patterns
                </div>
                {patterns.navigationPatterns.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium">Navigation:</span> {patterns.navigationPatterns.join(', ')}
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-3 pt-2 border-t border-blue-200">
                ✨ These patterns will be used to generate code that matches your project style
              </p>
            </div>
          )}
        </>
      )}

      {/* No Results State */}
      {!isLoading && !error && similarTests.length === 0 && testScenario && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-yellow-900 font-medium">No similar tests found</p>
              <p className="text-yellow-700 text-sm mt-1">
                The AI will use default Selenium patterns. Index more tests for better results.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}