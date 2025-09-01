import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

export default function TestRailSaver({ tests, context, onSaved, saved, isLoading: parentLoading }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState([]);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      // Simulate saving to TestRail
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock save results
      const results = tests.map((test, index) => ({
        ...test,
        testRailId: 1000 + index,
        testRailUrl: `https://paramount.testrail.io/index.php?/cases/view/${1000 + index}`,
        status: 'success'
      }));
      
      setSaveResults(results);
      onSaved(results);
    } catch (err) {
      console.error('Error saving to TestRail:', err);
      setError('Failed to save tests. Please try again.');
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
          <p>Project: <strong>Unified OAO</strong></p>
          <p>Suite: <strong>Master</strong></p>
          <p>Folder: <strong>{context?.sectionName || 'Video Player Controls'}</strong></p>
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
            </li>
          ))}
        </ul>
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
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: '60%' }}
                />
              </div>
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-900">Save Complete!</h4>
            </div>
            <p className="text-sm text-green-700">
              Successfully saved {successCount} test{successCount !== 1 ? 's' : ''} to TestRail
              {failedCount > 0 && ` (${failedCount} failed)`}
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