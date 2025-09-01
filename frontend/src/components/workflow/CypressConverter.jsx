import { useState, useEffect } from 'react';
import { Code, Copy, Download, CheckCircle, Loader2 } from 'lucide-react';

export default function CypressConverter({ tests, ticket, onGenerated, cypressCode, isLoading: parentLoading }) {
  const [selectedTests, setSelectedTests] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Auto-select all tests by default
    if (tests && tests.length > 0) {
      setSelectedTests(tests.map(t => t.id));
    }
  }, [tests]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // Simulate Cypress generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock Cypress code
      const code = generateCypressCode(
        tests.filter(t => selectedTests.includes(t.id)),
        ticket
      );
      
      setGeneratedCode(code);
      onGenerated([{ 
        fileName: 'skip-intro.cy.js',
        code: code 
      }]);
    } catch (err) {
      console.error('Error generating Cypress code:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCypressCode = (selectedTestCases, ticket) => {
    return `describe('${ticket?.summary || 'Test Suite'}', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/video/test-video');
    cy.waitForVideoLoad();
  });

${selectedTestCases.map(test => `
  it('${test.title}', () => {
    // ${test.objective}
${test.steps.map(step => `
    // ${step.action}
    cy.get('[data-testid="video-player"]').should('be.visible');
    // Expected: ${step.expected}`).join('')}
    
    // Verify: ${test.expectedResult}
    cy.get('[data-testid="skip-intro-button"]').should('not.exist');
  });`).join('\n')}

  // Platform-specific tests
  if (Cypress.env('platform') === 'roku') {
    it('Should handle remote navigation on Roku', () => {
      cy.remoteControl('DOWN');
      cy.remoteControl('OK');
      cy.get('[data-testid="skip-intro-button"]').should('have.focus');
    });
  }
});`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skip-intro.cy.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleTestSelection = (testId) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Select tests to convert to Cypress automation code. The generated code will follow your team's patterns.
        </p>
      </div>

      {/* Test Selection */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Select Tests to Automate</h4>
        <div className="space-y-2">
          {tests.map(test => (
            <label key={test.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTests.includes(test.id)}
                onChange={() => toggleTestSelection(test.id)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">{test.title}</span>
              {test.platforms && (
                <span className="text-xs text-gray-500 ml-auto">
                  {test.platforms.join(', ')}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      {!generatedCode && (
        <button
          onClick={handleGenerate}
          disabled={isGenerating || selectedTests.length === 0}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Cypress Code...
            </>
          ) : (
            <>
              <Code className="h-5 w-5" />
              Generate Cypress Code
            </>
          )}
        </button>
      )}

      {/* Generated Code */}
      {generatedCode && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">
                Cypress code generated successfully!
              </span>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 relative">
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={handleCopy}
                className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-600 flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-600 flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                Download
              </button>
            </div>
            
            <pre className="text-green-400 text-sm overflow-x-auto">
              <code>{generatedCode}</code>
            </pre>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Next Steps</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Copy or download the generated code</li>
              <li>2. Add to your Cypress test suite</li>
              <li>3. Update selectors as needed</li>
              <li>4. Run tests locally to verify</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}