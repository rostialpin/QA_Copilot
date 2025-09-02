import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TestRailSaver({ tests, context, onSaved, saved, isLoading: parentLoading }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState([]);
  const [error, setError] = useState(null);

  // Format test for TestRail API
  const formatTestForTestRail = (test) => {
    // Convert test steps to TestRail format
    const steps = test.steps?.map((step, index) => ({
      content: step.action || step.description || step,
      expected: step.expectedResult || step.expected || ''
    })) || [];
    
    // Create steps string in TestRail format
    const stepsString = steps.map((step, index) => 
      `${index + 1}. ${step.content}\nExpected: ${step.expected}`
    ).join('\n\n');

    return {
      title: test.title,
      template_id: 2, // Test Case (Steps) template
      type_id: 7, // Functional test type
      priority_id: test.priority === 'High' ? 1 : test.priority === 'Low' ? 3 : 2,
      estimate: test.estimate || '5m',
      refs: context?.ticketKey || '',
      custom_preconds: test.preconditions || '',
      custom_steps: stepsString || test.description || '',
      section_id: context?.sectionId,
      suite_id: context?.suiteId
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const results = [];
      
      // Save each test to TestRail
      for (const test of tests) {
        try {
          const testRailFormat = formatTestForTestRail(test);
          
          const response = await fetch(`${API_URL}/api/testrail/test-case`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              suiteId: context?.suiteId || 1, // Default to suite 1 if not specified
              ...testRailFormat
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to save test: ${response.statusText}`);
          }
          
          const savedTest = await response.json();
          
          results.push({
            ...test,
            testRailId: savedTest.id,
            testRailUrl: `https://paramount.testrail.io/index.php?/cases/view/${savedTest.id}`,
            status: 'success'
          });
        } catch (err) {
          console.error(`Error saving test "${test.title}":`, err);
          results.push({
            ...test,
            status: 'failed',
            error: err.message
          });
        }
      }
      
      setSaveResults(results);
      onSaved(results);
    } catch (err) {
      console.error('Error saving to TestRail:', err);
      setError('Failed to save tests. Please check your TestRail configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const successCount = saveResults.filter(r => r.status === 'success').length;
  const failedCount = saveResults.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Context Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Save Location</h4>
        <div className="text-sm text-blue-700">
          <p>Project: <strong>{context?.projectName || 'Unified OAO'}</strong></p>
          <p>Suite: <strong>{context?.suiteName || 'Master'}</strong></p>
          <p>Folder: <strong>{context?.sectionName || 'Test Cases'}</strong></p>
          {context?.ticketKey && (
            <p>Reference: <strong>{context.ticketKey}</strong></p>
          )}
        </div>
      </div>

      {/* Tests Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Tests to Save</h4>
        <ul className="space-y-1">
          {tests.map((test, index) => (
            <li key={test.id} className="text-sm text-gray-600 flex items-center gap-2">
              <span className="text-gray-400">{index + 1}.</span>
              {test.title}
              {saveResults.find(r => r.id === test.id)?.status === 'success' && (
                <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />
              )}
              {saveResults.find(r => r.id === test.id)?.status === 'failed' && (
                <AlertCircle className="h-3 w-3 text-red-500 ml-auto" />
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Format Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> Tests will be formatted to match TestRail's structure. 
          You can edit them in TestRail after saving.
        </p>
      </div>

      {/* Save Button */}
      {saveResults.length === 0 && (
        <button
          onClick={handleSave}
          disabled={isSaving || tests.length === 0}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving to TestRail...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Save {tests.length} Tests to TestRail
            </>
          )}
        </button>
      )}

      {/* Saving Progress */}
      {isSaving && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Saving tests to TestRail...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a few moments...</p>
            </div>
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

      {/* Save Results */}
      {saveResults.length > 0 && (
        <div className="space-y-4">
          <div className={`${successCount > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              {successCount > 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-green-900">Save Complete!</h4>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h4 className="font-medium text-red-900">Save Failed</h4>
                </>
              )}
            </div>
            <p className={`text-sm ${successCount > 0 ? 'text-green-700' : 'text-red-700'}`}>
              {successCount > 0 && `Successfully saved ${successCount} test${successCount !== 1 ? 's' : ''} to TestRail`}
              {failedCount > 0 && successCount > 0 && ` (${failedCount} failed)`}
              {successCount === 0 && `Failed to save tests to TestRail`}
            </p>
          </div>

          <div className="space-y-2">
            {saveResults.map((result, index) => (
              <div 
                key={result.id}
                className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {result.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-gray-700">
                    {index + 1}. {result.title}
                  </span>
                  {result.status === 'failed' && result.error && (
                    <span className="text-xs text-red-500 ml-2">({result.error})</span>
                  )}
                </div>
                
                {result.testRailUrl && (
                  <a
                    href={result.testRailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    View in TestRail
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}