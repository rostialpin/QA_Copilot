import { useState, useEffect } from 'react';
import { 
  Sparkles, Loader2, CheckCircle, AlertCircle, 
  RefreshCw, Settings, TrendingUp
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TestGenerator({ ticket, context, onGenerated, tests, isLoading: parentLoading }) {
  // Load saved options from localStorage or use defaults
  const [options, setOptions] = useState(() => {
    const savedOptions = localStorage.getItem('testGeneratorOptions');
    if (savedOptions) {
      return JSON.parse(savedOptions);
    }
    return {
      coverageLevel: 'comprehensive',
      includePositive: true,
      includeNegative: true,
      includeEdgeCases: true,
      includePlatformVariations: true,
      includePerformance: true,
      includeSecurity: true,
      includeAccessibility: true
    };
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');
  const [qualityScore, setQualityScore] = useState(0);
  const [error, setError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showTestTypeModal, setShowTestTypeModal] = useState(false);

  // Test type templates for manual test creation
  const getTestCaseTemplate = (testType) => {
    const templates = {
      functional: {
        title: 'New Functional Test Case',
        objective: 'Verify functional behavior',
        priority: 'Medium',
        testType: 'functional',
        steps: [{ action: 'Perform action', expectedResult: 'Expected outcome' }]
      },
      performance: {
        title: 'New Performance Test Case',
        objective: 'Measure and validate system performance',
        priority: 'High',
        testType: 'performance',
        steps: [
          { action: 'Set up performance monitoring', expectedResult: 'Monitoring configured' },
          { action: 'Execute performance scenario', expectedResult: 'Load generated' },
          { action: 'Measure response times', expectedResult: 'Times within limits' }
        ]
      },
      security: {
        title: 'New Security Test Case',
        objective: 'Validate security controls',
        priority: 'Critical',
        testType: 'security',
        steps: [
          { action: 'Test authentication', expectedResult: 'Auth properly enforced' },
          { action: 'Verify authorization', expectedResult: 'Access control working' },
          { action: 'Check for vulnerabilities', expectedResult: 'No vulnerabilities found' }
        ]
      },
      accessibility: {
        title: 'New Accessibility Test Case',
        objective: 'Ensure WCAG 2.1 compliance',
        priority: 'High',
        testType: 'accessibility',
        steps: [
          { action: 'Test with screen reader', expectedResult: 'Content readable' },
          { action: 'Verify keyboard navigation', expectedResult: 'All elements accessible' },
          { action: 'Check color contrast', expectedResult: 'Meets WCAG requirements' }
        ]
      }
    };
    return templates[testType] || templates.functional;
  };

  const addManualTestCase = (testType) => {
    const newTestCase = getTestCaseTemplate(testType);
    const updatedTests = [...(tests || []), newTestCase];
    onGenerated(updatedTests);
    setShowTestTypeModal(false);
  };

  const generateTests = async () => {
    if (!ticket || !context) {
      setError('Please complete previous steps first');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);
    setProgressMessage('Initializing AI model...');
    
    // Realistic progress milestones
    const progressMilestones = [
      { progress: 10, message: 'Analyzing ticket requirements...', delay: 200 },
      { progress: 25, message: 'Identifying test scenarios...', delay: 400 },
      { progress: 40, message: 'Generating functional tests...', delay: 600 },
      { progress: 55, message: 'Adding edge cases...', delay: 800 },
      { progress: 70, message: 'Creating non-functional tests...', delay: 1000 },
      { progress: 85, message: 'Adding validation points...', delay: 1200 },
      { progress: 95, message: 'Finalizing test cases...', delay: 1400 }
    ];
    
    // Smooth progress animation
    let currentMilestoneIndex = 0;
    const animateProgress = () => {
      if (currentMilestoneIndex < progressMilestones.length) {
        const milestone = progressMilestones[currentMilestoneIndex];
        setTimeout(() => {
          setGenerationProgress(milestone.progress);
          setProgressMessage(milestone.message);
          currentMilestoneIndex++;
          animateProgress();
        }, milestone.delay);
      }
    };
    animateProgress();
    
    try {
      // Get workflow ID from localStorage or generate a new one
      const workflowId = localStorage.getItem('currentWorkflowId') || 
                        `workflow_${Date.now()}_${localStorage.getItem('userId') || 'demo-user'}`;
      
      // Determine test types to generate
      const testTypes = [];
      if (options.includePositive || options.includeNegative || options.includeEdgeCases) {
        testTypes.push('functional');
      }
      if (options.includePerformance) testTypes.push('performance');
      if (options.includeSecurity) testTypes.push('security');
      if (options.includeAccessibility) testTypes.push('accessibility');

      // Call the workflow API to generate tests
      const requestData = {
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
          // Spread options directly instead of nesting them
          ...options,
          testTypes,
          // Map coverage level to test count
          testCount: options.coverageLevel === 'basic' ? 3 : 
                    options.coverageLevel === 'comprehensive' ? 10 : 5
        }
      };
      
      console.log('Sending test generation request:', requestData);
      console.log('Coverage level:', options.coverageLevel);
      console.log('Test count:', requestData.data.testCount);
      console.log('Test types:', testTypes);
      
      const response = await axios.post(`${API_URL}/api/workflow/${workflowId}/step`, requestData);
      
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
      setIsGenerating(false);
      setGenerationProgress(0);
      setProgressMessage('Initializing...');
    } finally {
      if (!error) {
        // Smoothly complete to 100%
        setGenerationProgress(100);
        setProgressMessage('Completed!');
        setTimeout(() => {
          setIsGenerating(false);
          setGenerationProgress(0);
          setProgressMessage('Initializing...');
        }, 500);
      }
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

  // Save options to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('testGeneratorOptions', JSON.stringify(options));
  }, [options]);

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
                    onClick={() => {
                      // Auto-enable non-functional tests for comprehensive coverage
                      const updates = { ...options, coverageLevel: level };
                      if (level === 'comprehensive') {
                        updates.includePerformance = true;
                        updates.includeSecurity = true;
                        updates.includeAccessibility = true;
                      }
                      setOptions(updates);
                    }}
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
              <div className="text-sm font-medium text-gray-700 mb-1">Test Types</div>
              {[
                { key: 'includePositive', label: 'Positive Tests', color: 'indigo' },
                { key: 'includeNegative', label: 'Negative Tests', color: 'indigo' },
                { key: 'includeEdgeCases', label: 'Edge Cases', color: 'indigo' },
                { key: 'includePlatformVariations', label: 'Platform Variations', color: 'indigo' },
                { key: 'includePerformance', label: 'Performance Tests', color: 'green' },
                { key: 'includeSecurity', label: 'Security Tests', color: 'red' },
                { key: 'includeAccessibility', label: 'Accessibility Tests', color: 'purple' }
              ].map(option => (
                <label key={option.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options[option.key] !== false}
                    onChange={(e) => setOptions({
                      ...options,
                      [option.key]: e.target.checked
                    })}
                    className={`rounded border-gray-300 text-${option.color}-600 focus:ring-${option.color}-500`}
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                  {option.color !== 'indigo' && (
                    <span className={`text-xs px-2 py-0.5 rounded bg-${option.color}-100 text-${option.color}-700`}>
                      Non-functional
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Button - Always visible */}
      {!isGenerating && (
        <button
          onClick={generateTests}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
        >
          <Sparkles className="h-5 w-5" />
          {tests && tests.length > 0 ? `Regenerate Test Cases (${options.coverageLevel})` : `Generate Test Cases (${options.coverageLevel})`}
        </button>
      )}

      {/* Generating Animation */}
      {isGenerating && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-600 font-medium mb-2">Generating test cases...</p>
            <p className="text-sm text-gray-500">
              {progressMessage}
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
                onClick={() => setShowTestTypeModal(true)}
                className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-medium"
              >
                <Sparkles className="h-4 w-4" />
                Add Manual Test
              </button>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-green-700">
                Generated {tests.length} test cases
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(tests.map(t => t.testType || 'functional'))].map(type => (
                  <span key={type} className={`text-xs px-2 py-1 rounded ${
                    type === 'performance' ? 'bg-green-100 text-green-700' :
                    type === 'security' ? 'bg-red-100 text-red-700' :
                    type === 'accessibility' ? 'bg-purple-100 text-purple-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Test List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tests.map((test, index) => (
              <div key={test.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {index + 1}. {test.title}
                    </h4>
                    <span className={`inline-block mt-1 text-xs px-2 py-1 rounded ${
                      test.testType === 'performance' ? 'bg-green-100 text-green-700' :
                      test.testType === 'security' ? 'bg-red-100 text-red-700' :
                      test.testType === 'accessibility' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {(test.testType || 'functional').charAt(0).toUpperCase() + (test.testType || 'functional').slice(1)} Test
                    </span>
                  </div>
                  <span className={`
                    text-xs px-2 py-1 rounded ml-2
                    ${test.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                      test.priority === 'High' ? 'bg-amber-100 text-amber-700' : 
                      test.priority === 'Low' ? 'bg-gray-100 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'}
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

      {/* Test Type Selection Modal */}
      {showTestTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Select Test Type</h3>
            <div className="space-y-3">
              <button
                onClick={() => addManualTestCase('functional')}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-indigo-600">Functional Test</div>
                <div className="text-sm text-gray-600 mt-1">Verify feature functionality and behavior</div>
              </button>
              
              <button
                onClick={() => addManualTestCase('performance')}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-green-600">Performance Test</div>
                <div className="text-sm text-gray-600 mt-1">Measure response times and resource usage</div>
              </button>
              
              <button
                onClick={() => addManualTestCase('security')}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-red-600">Security Test</div>
                <div className="text-sm text-gray-600 mt-1">Validate authentication and data protection</div>
              </button>
              
              <button
                onClick={() => addManualTestCase('accessibility')}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-purple-600">Accessibility Test</div>
                <div className="text-sm text-gray-600 mt-1">Ensure WCAG compliance and screen reader support</div>
              </button>
            </div>
            
            <button
              onClick={() => setShowTestTypeModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}