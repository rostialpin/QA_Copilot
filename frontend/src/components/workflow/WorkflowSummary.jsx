import { Trophy, Clock, TestTube, Code, ExternalLink, Home, RefreshCw } from 'lucide-react';

export default function WorkflowSummary({ 
  workflowId, 
  ticket, 
  tests, 
  savedTests, 
  cypressCode, 
  onNewWorkflow 
}) {
  // Calculate metrics
  const timeSaved = tests.length * 30; // Estimate 30 minutes per test case
  const coverageScore = tests.length >= 5 ? 100 : (tests.length / 5) * 100;
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gradient-to-r from-green-50 to-indigo-50 rounded-lg shadow-lg border border-green-200 p-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Trophy className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Workflow Complete! 🎉
          </h1>
          <p className="text-gray-600">
            Successfully generated and saved test cases for {ticket?.summary}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 text-center">
            <Clock className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              ~{Math.floor(timeSaved / 60)}h {timeSaved % 60}m
            </div>
            <div className="text-sm text-gray-600">Time Saved</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 text-center">
            <TestTube className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {tests.length}
            </div>
            <div className="text-sm text-gray-600">Tests Generated</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="h-6 w-6 mx-auto mb-2">
              <svg className="w-full h-full text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {coverageScore}%
            </div>
            <div className="text-sm text-gray-600">Coverage</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 text-center">
            <Code className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {cypressCode?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Cypress Tests</div>
          </div>
        </div>

        {/* Details Section */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-500 w-24">Ticket:</span>
              <span className="text-sm text-gray-900">
                {ticket?.key} - {ticket?.summary}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-500 w-24">Tests Saved:</span>
              <div className="flex-1">
                {savedTests?.length > 0 ? (
                  <div className="space-y-1">
                    {savedTests.slice(0, 3).map((test, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">
                          {index + 1}. {test.title}
                        </span>
                        {test.testRailUrl && (
                          <a
                            href={test.testRailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                    {savedTests.length > 3 && (
                      <span className="text-sm text-gray-500">
                        ...and {savedTests.length - 3} more
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-900">
                    {tests.length} tests ready (not saved to TestRail)
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-500 w-24">Cypress:</span>
              <span className="text-sm text-gray-900">
                {cypressCode?.length > 0 
                  ? `${cypressCode.length} test file(s) generated`
                  : 'Not generated'}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-gray-500 w-24">Workflow ID:</span>
              <span className="text-sm text-gray-900 font-mono">
                {workflowId?.slice(-8)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          {savedTests?.length > 0 && savedTests[0].testRailUrl && (
            <a
              href={savedTests[0].testRailUrl.replace(/\/cases\/view\/\d+/, '/suites/view/5524')}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View in TestRail
            </a>
          )}
          
          {cypressCode?.length > 0 && (
            <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
              <Code className="h-4 w-4" />
              Run Cypress Tests
            </button>
          )}
          
          <button
            onClick={onNewWorkflow}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Start New Workflow
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Review the generated tests in TestRail</li>
          <li>• Run the Cypress tests in your CI/CD pipeline</li>
          <li>• Link test results back to the JIRA ticket</li>
          <li>• Share coverage report with stakeholders</li>
        </ul>
      </div>
    </div>
  );
}