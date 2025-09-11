import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { geminiApi } from '../services/geminiApi';
import { testRailApi } from '../services/testRailApi';

export default function TestGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState({
    key: location.state?.ticketKey || '',
    summary: location.state?.ticketSummary || '',
    description: location.state?.ticketDescription || '',
    type: location.state?.ticketType || 'Story',
    // Bug-specific fields
    stepsToReproduce: location.state?.stepsToReproduce || '',
    actualBehavior: location.state?.actualBehavior || '',
    expectedBehavior: location.state?.expectedBehavior || '',
    // Story/Task fields
    acceptanceCriteria: location.state?.acceptanceCriteria || ''
  });
  const [testCases, setTestCases] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSuite, setSelectedSuite] = useState('');
  const [showTestRailOptions, setShowTestRailOptions] = useState(false);
  const [testRailResults, setTestRailResults] = useState(null);
  const [showTestRailSuccess, setShowTestRailSuccess] = useState(false);
  const [showTestTypeModal, setShowTestTypeModal] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState('functional');

  // Fetch TestRail projects
  const { data: projects } = useQuery({
    queryKey: ['testrail-projects'],
    queryFn: testRailApi.getProjects,
    enabled: showTestRailOptions
  });

  // Fetch TestRail suites for selected project
  const { data: suites } = useQuery({
    queryKey: ['testrail-suites', selectedProject],
    queryFn: () => testRailApi.getSuites(selectedProject),
    enabled: !!selectedProject && showTestRailOptions
  });

  const generateMutation = useMutation({
    mutationFn: (testTypes = ['functional']) => geminiApi.generateTestCases(ticket, { 
      testTypes,
      includePerformance: testTypes.includes('performance'),
      includeSecurity: testTypes.includes('security'),
      includeAccessibility: testTypes.includes('accessibility')
    }),
    onSuccess: (data) => {
      setTestCases(data.testCases || data);
      toast.success(`Generated ${data.testCases?.length || data.length} test cases!`);
      setShowTestRailOptions(true);
    },
    onError: (error) => {
      console.error('Generation error:', error);
      toast.error('Failed to generate test cases');
    },
  });

  const pushToTestRailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSuite) {
        throw new Error('Please select a TestRail suite');
      }
      
      const promises = testCases.map(testCase => 
        testRailApi.createTestCase({
          suite_id: selectedSuite,
          title: testCase.title,
          custom_steps: testCase.steps?.map(step => ({
            content: step.action,
            expected: step.expected
          })) || [],
          custom_preconds: testCase.preconditions || '',
          refs: ticket.key || '',
          type_id: 1, // Manual test
          priority_id: testCase.priority === 'High' ? 1 : testCase.priority === 'Low' ? 4 : 2
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: (results) => {
      toast.success(`Successfully created ${results.length} test cases in TestRail!`);
      setTestRailResults(results);
      setShowTestRailSuccess(true);
      
      // Auto-navigate to Cypress after 3 seconds
      setTimeout(() => {
        navigate('/cypress-generator', {
          state: {
            ticketKey: ticket.key,
            ticketSummary: ticket.summary,
            testCases: testCases,
            testRailIds: results.map(r => r.id)
          }
        });
      }, 3000);
    },
    onError: (error) => {
      console.error('TestRail error:', error);
      toast.error(`Failed to push to TestRail: ${error.message}`);
    }
  });

  // Test type templates
  const getTestCaseTemplate = (testType) => {
    const templates = {
      functional: {
        title: 'New Functional Test Case',
        objective: 'Verify functional behavior',
        preconditions: '',
        priority: 'Medium',
        testType: 'functional',
        steps: [{ action: '', expected: '' }],
        expectedResult: ''
      },
      performance: {
        title: 'New Performance Test Case',
        objective: 'Measure and validate system performance',
        preconditions: 'System under normal load conditions',
        priority: 'High',
        testType: 'performance',
        metrics: {
          responseTime: '',
          throughput: '',
          resourceUsage: ''
        },
        steps: [
          { action: 'Set up performance monitoring', expected: 'Monitoring tools configured' },
          { action: 'Execute performance scenario', expected: 'Load generated successfully' },
          { action: 'Measure response times', expected: 'Response times within acceptable limits' },
          { action: 'Check resource utilization', expected: 'CPU/Memory usage within thresholds' }
        ],
        expectedResult: 'System meets performance requirements'
      },
      security: {
        title: 'New Security Test Case',
        objective: 'Validate security controls and vulnerabilities',
        preconditions: 'Test user accounts with various permission levels',
        priority: 'Critical',
        testType: 'security',
        securityChecks: {
          authentication: false,
          authorization: false,
          dataProtection: false,
          inputValidation: false
        },
        steps: [
          { action: 'Test authentication mechanisms', expected: 'Authentication properly enforced' },
          { action: 'Verify authorization controls', expected: 'Access control working correctly' },
          { action: 'Check for common vulnerabilities', expected: 'No vulnerabilities detected' },
          { action: 'Validate data encryption', expected: 'Sensitive data properly encrypted' }
        ],
        expectedResult: 'System passes security validation'
      },
      accessibility: {
        title: 'New Accessibility Test Case',
        objective: 'Ensure compliance with WCAG 2.1 standards',
        preconditions: 'Screen reader and accessibility tools available',
        priority: 'High',
        testType: 'accessibility',
        wcagLevel: 'AA',
        accessibilityChecks: {
          screenReader: false,
          keyboardNavigation: false,
          colorContrast: false,
          altText: false
        },
        steps: [
          { action: 'Test with screen reader', expected: 'All content readable and navigable' },
          { action: 'Verify keyboard navigation', expected: 'All interactive elements accessible via keyboard' },
          { action: 'Check color contrast ratios', expected: 'Meets WCAG contrast requirements' },
          { action: 'Validate ARIA labels', expected: 'Proper ARIA attributes present' }
        ],
        expectedResult: 'Meets accessibility standards'
      }
    };
    return templates[testType] || templates.functional;
  };

  // Auto-fill from JIRA navigation
  useEffect(() => {
    if (location.state) {
      setTicket({
        key: location.state.ticketKey || '',
        summary: location.state.ticketSummary || '',
        description: location.state.ticketDescription || '',
        type: location.state.ticketType || 'Story'
      });
    }
  }, [location.state]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Test Case Generator</h2>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back to Dashboard
        </button>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          {ticket.key && (
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm text-blue-800">
                Generating tests for: <strong>{ticket.key}</strong>
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ticket Summary
            </label>
            <input
              type="text"
              value={ticket.summary}
              onChange={(e) => setTicket({...ticket, summary: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="e.g., User login functionality"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={ticket.description}
              onChange={(e) => setTicket({...ticket, description: e.target.value})}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="Describe the feature or requirement..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ticket Type
            </label>
            <select
              value={ticket.type}
              onChange={(e) => setTicket({...ticket, type: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            >
              <option value="Story">Story</option>
              <option value="Bug">Bug</option>
              <option value="Task">Task</option>
            </select>
          </div>

          {/* Bug-specific fields */}
          {ticket.type === 'Bug' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Steps to Reproduce
                </label>
                <textarea
                  value={ticket.stepsToReproduce}
                  onChange={(e) => setTicket({...ticket, stepsToReproduce: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  placeholder="1. Navigate to login page\n2. Enter valid credentials\n3. Click login button"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Actual Behavior
                </label>
                <textarea
                  value={ticket.actualBehavior}
                  onChange={(e) => setTicket({...ticket, actualBehavior: e.target.value})}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  placeholder="The login button remains disabled and user cannot proceed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Expected Behavior
                </label>
                <textarea
                  value={ticket.expectedBehavior}
                  onChange={(e) => setTicket({...ticket, expectedBehavior: e.target.value})}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  placeholder="User should be logged in and redirected to dashboard"
                />
              </div>
            </>
          )}

          {/* Story/Task specific fields */}
          {(ticket.type === 'Story' || ticket.type === 'Task') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Acceptance Criteria
              </label>
              <textarea
                value={ticket.acceptanceCriteria}
                onChange={(e) => setTicket({...ticket, acceptanceCriteria: e.target.value})}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                placeholder="• User can reset password via email\n• Reset link expires after 24 hours\n• Password must meet security requirements"
              />
            </div>
          )}
          
          {/* Test Type Selection for Generation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Types to Generate
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked
                  id="gen-functional"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm">Functional</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  id="gen-performance"
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="ml-2 text-sm">Performance</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  id="gen-security"
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm">Security</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  id="gen-accessibility"
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm">Accessibility</span>
              </label>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                const testTypes = [];
                if (document.getElementById('gen-functional').checked) testTypes.push('functional');
                if (document.getElementById('gen-performance').checked) testTypes.push('performance');
                if (document.getElementById('gen-security').checked) testTypes.push('security');
                if (document.getElementById('gen-accessibility').checked) testTypes.push('accessibility');
                
                if (testTypes.length === 0) {
                  toast.error('Please select at least one test type');
                  return;
                }
                
                generateMutation.mutate(testTypes);
              }}
              disabled={!ticket.summary || generateMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate Test Cases with AI'}
            </button>
            
            <button
              onClick={() => setShowTestTypeModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              + Add Manual Test Case
            </button>
          </div>
        </div>
      </div>

      {testCases.length > 0 && (
        <>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Generated Test Cases ({testCases.length})</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setTestCases([...testCases])}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Reset Changes
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  className="text-sm px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                >
                  Regenerate
                </button>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {testCases.map((tc, index) => (
                <div key={index} className="border p-4 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={tc.title}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[index].title = e.target.value;
                          setTestCases(updated);
                        }}
                        className="font-medium text-indigo-600 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:outline-none w-full"
                      />
                      {tc.testType && tc.testType !== 'functional' && (
                        <span className={`inline-block mt-1 text-xs px-2 py-1 rounded ${
                          tc.testType === 'performance' ? 'bg-green-100 text-green-700' :
                          tc.testType === 'security' ? 'bg-red-100 text-red-700' :
                          tc.testType === 'accessibility' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {tc.testType.charAt(0).toUpperCase() + tc.testType.slice(1)} Test
                        </span>
                      )}
                    </div>
                    <select
                      value={tc.priority || 'Medium'}
                      onChange={(e) => {
                        const updated = [...testCases];
                        updated[index].priority = e.target.value;
                        setTestCases(updated);
                      }}
                      className={`text-xs px-2 py-1 rounded border ml-2 ${
                        tc.priority === 'High' || tc.priority === 'Critical' ? 'bg-red-100 text-red-700 border-red-300' :
                        tc.priority === 'Low' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                        'bg-yellow-100 text-yellow-700 border-yellow-300'
                      }`}
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Objective:</label>
                      <textarea
                        value={tc.objective || ''}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[index].objective = e.target.value;
                          setTestCases(updated);
                        }}
                        className="w-full text-sm text-gray-600 p-1 border rounded resize-none"
                        rows={2}
                      />
                    </div>
                    
                    {/* Performance Test Specific Fields */}
                    {tc.testType === 'performance' && tc.metrics && (
                      <div className="bg-green-50 p-2 rounded">
                        <label className="text-xs font-medium text-gray-500">Performance Metrics:</label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <input
                            type="text"
                            placeholder="Response Time (ms)"
                            value={tc.metrics.responseTime || ''}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[index].metrics.responseTime = e.target.value;
                              setTestCases(updated);
                            }}
                            className="text-xs p-1 border rounded"
                          />
                          <input
                            type="text"
                            placeholder="Throughput (req/s)"
                            value={tc.metrics.throughput || ''}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[index].metrics.throughput = e.target.value;
                              setTestCases(updated);
                            }}
                            className="text-xs p-1 border rounded"
                          />
                          <input
                            type="text"
                            placeholder="Resource Usage (%)"
                            value={tc.metrics.resourceUsage || ''}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[index].metrics.resourceUsage = e.target.value;
                              setTestCases(updated);
                            }}
                            className="text-xs p-1 border rounded"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Security Test Specific Fields */}
                    {tc.testType === 'security' && tc.securityChecks && (
                      <div className="bg-red-50 p-2 rounded">
                        <label className="text-xs font-medium text-gray-500">Security Checks:</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {Object.keys(tc.securityChecks).map(check => (
                            <label key={check} className="flex items-center text-xs">
                              <input
                                type="checkbox"
                                checked={tc.securityChecks[check]}
                                onChange={(e) => {
                                  const updated = [...testCases];
                                  updated[index].securityChecks[check] = e.target.checked;
                                  setTestCases(updated);
                                }}
                                className="mr-1"
                              />
                              {check.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Accessibility Test Specific Fields */}
                    {tc.testType === 'accessibility' && tc.accessibilityChecks && (
                      <div className="bg-purple-50 p-2 rounded">
                        <label className="text-xs font-medium text-gray-500">
                          Accessibility Checks (WCAG {tc.wcagLevel || 'AA'}):
                        </label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {Object.keys(tc.accessibilityChecks).map(check => (
                            <label key={check} className="flex items-center text-xs">
                              <input
                                type="checkbox"
                                checked={tc.accessibilityChecks[check]}
                                onChange={(e) => {
                                  const updated = [...testCases];
                                  updated[index].accessibilityChecks[check] = e.target.checked;
                                  setTestCases(updated);
                                }}
                                className="mr-1"
                              />
                              {check.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500">Preconditions:</label>
                      <input
                        type="text"
                        value={tc.preconditions || ''}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[index].preconditions = e.target.value;
                          setTestCases(updated);
                        }}
                        className="w-full text-sm text-gray-600 p-1 border rounded"
                      />
                    </div>
                    
                    {tc.steps && tc.steps.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500">Steps:</label>
                        <div className="space-y-1 ml-2">
                          {tc.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex items-start gap-2">
                              <span className="text-sm text-gray-400 mt-1">{stepIndex + 1}.</span>
                              <div className="flex-1 space-y-1">
                                <input
                                  type="text"
                                  value={step.action}
                                  onChange={(e) => {
                                    const updated = [...testCases];
                                    updated[index].steps[stepIndex].action = e.target.value;
                                    setTestCases(updated);
                                  }}
                                  className="w-full text-sm p-1 border rounded"
                                  placeholder="Action"
                                />
                                <input
                                  type="text"
                                  value={step.expected || ''}
                                  onChange={(e) => {
                                    const updated = [...testCases];
                                    updated[index].steps[stepIndex].expected = e.target.value;
                                    setTestCases(updated);
                                  }}
                                  className="w-full text-sm text-green-600 p-1 border border-green-200 rounded"
                                  placeholder="Expected result"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const updated = [...testCases];
                                  updated[index].steps.splice(stepIndex, 1);
                                  setTestCases(updated);
                                }}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const updated = [...testCases];
                              updated[index].steps.push({ action: '', expected: '' });
                              setTestCases(updated);
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            + Add Step
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500">Expected Result:</label>
                      <textarea
                        value={tc.expectedResult || ''}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[index].expectedResult = e.target.value;
                          setTestCases(updated);
                        }}
                        className="w-full text-sm text-gray-600 p-1 border rounded resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => {
                        const updated = testCases.filter((_, i) => i !== index);
                        setTestCases(updated);
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove Test Case
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setShowTestTypeModal(true)}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
            >
              + Add New Test Case
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-medium mb-4">Push to TestRail</h3>
            
            {showTestRailSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-green-800">
                        Successfully pushed to TestRail!
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Created {testRailResults?.length || 0} test cases in TestRail:</p>
                        <ul className="list-disc list-inside mt-2">
                          {testRailResults?.map((result, index) => (
                            <li key={index}>
                              Test Case #{result.id}: {testCases[index]?.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {selectedProject && selectedSuite && (
                        <div className="mt-3">
                          <p className="text-sm text-green-700 mb-2">
                            <strong>Project:</strong> {projects?.find(p => p.id == selectedProject)?.name}
                            <br />
                            <strong>Suite:</strong> {suites?.find(s => s.id == selectedSuite)?.name}
                          </p>
                          <a
                            href={`${import.meta.env.VITE_TESTRAIL_URL || 'https://paramount.testrail.io'}/index.php?/suites/view/${selectedSuite}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-green-600 hover:text-green-800"
                          >
                            View in TestRail
                            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    Redirecting to Cypress Generator in 3 seconds...
                  </p>
                  <button
                    onClick={() => navigate('/cypress-generator', {
                      state: {
                        ticketKey: ticket.key,
                        ticketSummary: ticket.summary,
                        testCases: testCases,
                        testRailIds: testRailResults?.map(r => r.id)
                      }
                    })}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Continue to Cypress Generator Now
                  </button>
                </div>
              </div>
            ) : !showTestRailOptions ? (
              <button
                onClick={() => setShowTestRailOptions(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Configure TestRail
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    TestRail Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => {
                      setSelectedProject(e.target.value);
                      setSelectedSuite('');
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  >
                    <option value="">Select a project...</option>
                    {projects?.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProject && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Test Suite
                    </label>
                    <select
                      value={selectedSuite}
                      onChange={(e) => setSelectedSuite(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                      <option value="">Select a suite...</option>
                      {suites?.map((suite) => (
                        <option key={suite.id} value={suite.id}>
                          {suite.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => pushToTestRailMutation.mutate()}
                    disabled={!selectedSuite || pushToTestRailMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {pushToTestRailMutation.isPending ? 'Pushing...' : 'Push to TestRail & Generate Cypress'}
                  </button>
                  
                  <button
                    onClick={() => navigate('/cypress-generator', {
                      state: {
                        ticketKey: ticket.key,
                        ticketSummary: ticket.summary,
                        testCases: testCases
                      }
                    })}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Skip TestRail → Generate Cypress
                  </button>
                </div>
              </div>
            )}
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
                onClick={() => {
                  setTestCases([...testCases, getTestCaseTemplate('functional')]);
                  setShowTestTypeModal(false);
                }}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-indigo-600">Functional Test</div>
                <div className="text-sm text-gray-600 mt-1">Verify feature functionality and behavior</div>
              </button>
              
              <button
                onClick={() => {
                  setTestCases([...testCases, getTestCaseTemplate('performance')]);
                  setShowTestTypeModal(false);
                }}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-green-600">Performance Test</div>
                <div className="text-sm text-gray-600 mt-1">Measure response times, throughput, and resource usage</div>
              </button>
              
              <button
                onClick={() => {
                  setTestCases([...testCases, getTestCaseTemplate('security')]);
                  setShowTestTypeModal(false);
                }}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-red-600">Security Test</div>
                <div className="text-sm text-gray-600 mt-1">Validate authentication, authorization, and data protection</div>
              </button>
              
              <button
                onClick={() => {
                  setTestCases([...testCases, getTestCaseTemplate('accessibility')]);
                  setShowTestTypeModal(false);
                }}
                className="w-full text-left p-4 border rounded-lg hover:bg-gray-50">
                <div className="font-medium text-purple-600">Accessibility Test</div>
                <div className="text-sm text-gray-600 mt-1">Ensure WCAG compliance and screen reader compatibility</div>
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