import { useState, useEffect } from 'react';
import { 
  Sparkles, Loader2, CheckCircle, AlertCircle, 
  RefreshCw, Settings, TrendingUp
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TestGenerator({ ticket, context, onGenerated, tests, isLoading: parentLoading }) {
  const [options, setOptions] = useState({
    coverageLevel: 'standard',
    includePositive: true,
    includeNegative: true,
    includeEdgeCases: true,
    includePlatformVariations: true
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');
  const [qualityScore, setQualityScore] = useState(0);
  const [error, setError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  const generateTests = async () => {
    if (!ticket || !context) {
      setError('Please complete previous steps first');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);
    setProgressMessage('Initializing AI model...');
    
    // Simulate progress updates
    let progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 90) {
          return 90; // Stay at 90% until API completes
        }
        const increment = Math.random() * 15 + 5; // Random increment between 5-20
        return Math.min(90, prev + increment);
      });
    }, 800);
    
    // Update messages as progress increases
    setTimeout(() => setProgressMessage('Analyzing ticket requirements...'), 500);
    setTimeout(() => setProgressMessage('Identifying test scenarios...'), 1500);
    setTimeout(() => setProgressMessage('Generating test steps...'), 2500);
    setTimeout(() => setProgressMessage('Adding validation points...'), 3500);
    setTimeout(() => setProgressMessage('Finalizing test cases...'), 4500);
    
    try {
      // Get workflow ID from localStorage or generate a new one
      const workflowId = localStorage.getItem('currentWorkflowId') || 
                        `workflow_${Date.now()}_${localStorage.getItem('userId') || 'demo-user'}`;
      
      // Call the workflow API to generate tests
      const response = await axios.post(`${API_URL}/api/workflow/${workflowId}/step`, {
        step: 'generateTests',
        data: {
          ticket: {
            key: ticket.key,
            summary: ticket.summary,
            description: ticket.description,
            type: ticket.issueType || ticket.type,
            acceptanceCriteria: ticket.acceptanceCriteria,
            platforms: ticket.platforms || []
          },
          context: {
            projectId: context.projectId,
            suiteId: context.suiteId,
            sectionId: context.sectionId,
            existingTests: context.existingTests || []
          },
          options
        }
      });
      
      if (response.data && response.data.tests && response.data.tests.length > 0) {
        const generatedTests = response.data.tests;
        onGenerated(generatedTests);
        setQualityScore(calculateQualityScore(generatedTests, context));
      } else if (response.data && response.data.testCases && response.data.testCases.length > 0) {
        // Handle alternate response format
        const generatedTests = response.data.testCases;
        onGenerated(generatedTests);
        setQualityScore(calculateQualityScore(generatedTests, context));
      } else {
        // If no tests returned, show error
        setError('No tests were generated. Please try again.');
      }
    } catch (err) {
      console.error('Error generating tests:', err);
      const errorMessage = err.response?.data?.error || 'Failed to generate tests. Please try again.';
      setError(errorMessage);
      clearInterval(progressInterval); // Clear interval on error
    } finally {
      clearInterval(progressInterval); // Clear interval when done
      setIsGenerating(false);
      setGenerationProgress(100);
      setTimeout(() => {
        setGenerationProgress(0);
        setProgressMessage('Initializing...');
      }, 500);
    }
  };

  const calculateQualityScore = (tests, context) => {
    let score = 70; // Base score
    
    // More tests = better coverage
    if (tests.length >= 5) score += 10;
    if (tests.length >= 3) score += 5;
    
    // Platform coverage
    const hasPlatformTests = tests.some(t => t.platforms && t.platforms.length > 0);
    if (hasPlatformTests) score += 5;
    
    // Test variety
    const hasNegativeTests = tests.some(t => t.title.includes('Negative'));
    const hasEdgeCases = tests.some(t => t.title.includes('Edge'));
    if (hasNegativeTests) score += 5;
    if (hasEdgeCases) score += 5;
    
    return Math.min(score, 100);
  };

  const regenerateTests = () => {
    onGenerated([]);
    setQualityScore(0);
    generateTests();
  };

  // Check for tests from parent on mount/update
  useEffect(() => {
    if (tests && tests.length > 0 && !isGenerating) {
      setQualityScore(calculateQualityScore(tests, context));
    }
  }, [tests]);

  return (
    <div className="space-y-4">
      {/* Generation Options */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Generation Options
          </h4>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {showOptions ? 'Hide' : 'Show'} Options
          </button>
        </div>
        
        {showOptions && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Coverage Level
              </label>
              <div className="flex gap-2">
                {['basic', 'standard', 'comprehensive'].map(level => (
                  <button
                    key={level}
                    onClick={() => setOptions({ ...options, coverageLevel: level })}
                    className={`
                      px-3 py-1 rounded text-sm capitalize
                      ${options.coverageLevel === level
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}
                    `}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              {[
                { key: 'includePositive', label: 'Positive Tests' },
                { key: 'includeNegative', label: 'Negative Tests' },
                { key: 'includeEdgeCases', label: 'Edge Cases' },
                { key: 'includePlatformVariations', label: 'Platform Variations' }
              ].map(option => (
                <label key={option.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options[option.key]}
                    onChange={(e) => setOptions({
                      ...options,
                      [option.key]: e.target.checked
                    })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      {(!tests || tests.length === 0) && !isGenerating && (
        <button
          onClick={generateTests}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
        >
          <Sparkles className="h-5 w-5" />
          Generate Test Cases
        </button>
      )}

      {/* Generating Animation with Dynamic Progress */}
      {isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-600 font-medium">Generating test cases...</p>
            <p className="text-sm text-gray-500 mt-2">
              {progressMessage}
            </p>
            <div className="w-64 bg-gray-200 rounded-full h-3 mt-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${generationProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {Math.round(generationProgress)}% complete
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Generated Tests */}
      {tests && tests.length > 0 && (
        <>
          {/* Quality Score */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Quality Score: {qualityScore}/100
                </span>
              </div>
              <button
                onClick={regenerateTests}
                className="flex items-center gap-1 text-sm text-green-700 hover:text-green-800"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </button>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Generated {tests.length} test cases covering {
                [...new Set(tests.flatMap(t => t.platforms || []))].join(', ')
              }
            </p>
          </div>

          {/* Test List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tests.map((test, index) => (
              <div key={test.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">
                    {index + 1}. {test.title}
                  </h4>
                  <span className={`
                    text-xs px-2 py-1 rounded
                    ${test.priority === 'High' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-yellow-100 text-yellow-700'}
                  `}>
                    {test.priority}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{test.objective}</p>
                
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-gray-500">
                    {test.steps.length} steps
                  </span>
                  {test.platforms && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">
                        {test.platforms.join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}