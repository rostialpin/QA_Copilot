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
    type: location.state?.ticketType || 'Story'
  });
  const [testCases, setTestCases] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSuite, setSelectedSuite] = useState('');
  const [showTestRailOptions, setShowTestRailOptions] = useState(false);
  const [testRailResults, setTestRailResults] = useState(null);
  const [showTestRailSuccess, setShowTestRailSuccess] = useState(false);

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
    mutationFn: () => geminiApi.generateTestCases(ticket),
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
          
          <button
            onClick={() => generateMutation.mutate()}
            disabled={!ticket.summary || generateMutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Test Cases with AI'}
          </button>
        </div>
      </div>

      {testCases.length > 0 && (
        <>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-medium mb-4">Generated Test Cases ({testCases.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {testCases.map((tc, index) => (
                <div key={index} className="border p-4 rounded">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-indigo-600">{tc.title}</h4>
                    {tc.priority && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        tc.priority === 'High' ? 'bg-red-100 text-red-700' :
                        tc.priority === 'Low' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tc.priority}
                      </span>
                    )}
                  </div>
                  {tc.objective && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Objective:</strong> {tc.objective}
                    </p>
                  )}
                  {tc.preconditions && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Preconditions:</strong> {tc.preconditions}
                    </p>
                  )}
                  {tc.steps && tc.steps.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Steps:</p>
                      <ol className="list-decimal list-inside text-sm text-gray-600 ml-2">
                        {tc.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="mt-1">
                            {step.action}
                            {step.expected && (
                              <span className="text-green-600 ml-2">
                                → {step.expected}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {tc.expectedResult && (
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>Expected Result:</strong> {tc.expectedResult}
                    </p>
                  )}
                </div>
              ))}
            </div>
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
    </div>
  );
}