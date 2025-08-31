import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cypressApi } from '../services/cypressApi';

export default function CypressGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedTestCases, setSelectedTestCases] = useState([]);
  const [testCases, setTestCases] = useState(location.state?.testCases || []);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showCode, setShowCode] = useState(false);

  // Fetch available Cypress templates
  const { data: templates } = useQuery({
    queryKey: ['cypress-templates'],
    queryFn: cypressApi.getTemplates,
  });

  // Initialize with passed test cases
  useEffect(() => {
    if (location.state?.testCases) {
      setTestCases(location.state.testCases);
      // Pre-select all test cases by default
      setSelectedTestCases(location.state.testCases.map((_, index) => index));
    }
  }, [location.state]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const testsToGenerate = selectedTestCases.map(index => testCases[index]);
      
      if (testsToGenerate.length === 0) {
        throw new Error('Please select at least one test case');
      }

      const promises = testsToGenerate.map((testCase, index) => 
        cypressApi.generateCypressTest({
          title: testCase.title,
          steps: testCase.steps || [],
          expectedResult: testCase.expectedResult || '',
          preconditions: testCase.preconditions || '',
          template: selectedTemplate || undefined,
          ticketKey: location.state?.ticketKey,
          testRailId: location.state?.testRailIds?.[selectedTestCases[index]]
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: (results) => {
      setGeneratedTests(results);
      setShowCode(true);
      toast.success(`Generated ${results.length} Cypress test(s)!`);
    },
    onError: (error) => {
      console.error('Generation error:', error);
      toast.error(`Failed to generate Cypress tests: ${error.message}`);
    },
  });

  const toggleTestCase = (index) => {
    setSelectedTestCases(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const selectAll = () => {
    setSelectedTestCases(testCases.map((_, index) => index));
  };

  const deselectAll = () => {
    setSelectedTestCases([]);
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const downloadTests = () => {
    const combinedCode = generatedTests
      .map(test => test.code || test)
      .join('\n\n// ------- Next Test -------\n\n');
    
    const blob = new Blob([combinedCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cypress-tests-${location.state?.ticketKey || 'generated'}.cy.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Tests downloaded!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cypress Test Generator</h2>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
      </div>

      {location.state?.ticketKey && (
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-sm text-blue-800">
            Generating Cypress tests for: <strong>{location.state.ticketKey}</strong>
            {location.state.ticketSummary && ` - ${location.state.ticketSummary}`}
          </p>
          {location.state.testRailIds && location.state.testRailIds.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              TestRail Test Cases: {location.state.testRailIds.map(id => `#${id}`).join(', ')}
            </p>
          )}
        </div>
      )}

      {!showCode ? (
        <>
          {/* Test Case Selection */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Select Test Cases to Automate</h3>
              <div className="space-x-2">
                <button
                  onClick={selectAll}
                  className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {testCases.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No test cases available</p>
                <button
                  onClick={() => navigate('/test-generator')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Generate Test Cases First
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testCases.map((testCase, index) => (
                  <div
                    key={index}
                    className={`border p-3 rounded cursor-pointer transition-colors ${
                      selectedTestCases.includes(index) 
                        ? 'bg-indigo-50 border-indigo-300' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleTestCase(index)}
                  >
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={selectedTestCases.includes(index)}
                        onChange={() => {}}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{testCase.title}</h4>
                        {testCase.objective && (
                          <p className="text-xs text-gray-600 mt-1">{testCase.objective}</p>
                        )}
                        {testCase.priority && (
                          <span className={`text-xs px-2 py-1 rounded inline-block mt-1 ${
                            testCase.priority === 'High' ? 'bg-red-100 text-red-700' :
                            testCase.priority === 'Low' ? 'bg-gray-100 text-gray-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {testCase.priority} Priority
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-gray-600 mt-2">
              {selectedTestCases.length} of {testCases.length} test cases selected
            </div>
          </div>

          {/* Template Selection */}
          {templates && templates.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-medium mb-4">Cypress Template (Optional)</h3>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm p-2 border"
              >
                <option value="">No template - Generate from scratch</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center">
            <button
              onClick={() => generateMutation.mutate()}
              disabled={selectedTestCases.length === 0 || generateMutation.isPending}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {generateMutation.isPending 
                ? `Generating ${selectedTestCases.length} test(s)...` 
                : `Generate ${selectedTestCases.length} Cypress Test(s)`}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Generated Code Display */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Generated Cypress Tests</h3>
              <div className="space-x-2">
                <button
                  onClick={() => setShowCode(false)}
                  className="px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300"
                >
                  ← Back to Selection
                </button>
                <button
                  onClick={downloadTests}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Download All Tests
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {generatedTests.map((test, index) => {
                const testCase = testCases[selectedTestCases[index]];
                const code = test.code || test;
                
                return (
                  <div key={index} className="border rounded">
                    <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="font-medium text-sm">{testCase?.title}</span>
                      <button
                        onClick={() => copyToClipboard(code)}
                        className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-100"
                      >
                        Copy Code
                      </button>
                    </div>
                    <pre className="p-4 text-sm overflow-x-auto bg-gray-900 text-green-400">
                      <code>{code}</code>
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">Next Steps:</h4>
            <ol className="list-decimal list-inside text-sm text-green-700 space-y-1">
              <li>Download the generated tests or copy them to your clipboard</li>
              <li>Add them to your Cypress test suite (usually in cypress/e2e/)</li>
              <li>Update any selectors or test data as needed for your application</li>
              <li>Run the tests with: <code className="bg-green-100 px-1 rounded">npx cypress run</code></li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}