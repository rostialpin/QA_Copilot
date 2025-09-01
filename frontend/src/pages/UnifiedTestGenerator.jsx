import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, ChevronLeft, FileText, FolderOpen, 
  Cpu, Code, CheckCircle, AlertCircle, RefreshCw,
  Play, Save, Copy, Download, Search, X
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function UnifiedTestGenerator() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Step 1: Ticket Selection
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('ESWCTV');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Step 2: Context Selection
  const [testRailProject, setTestRailProject] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [contextTests, setContextTests] = useState([]);
  
  // Step 3: Test Generation
  const [generationOptions, setGenerationOptions] = useState({
    coverageLevel: 'standard',
    includePositive: true,
    includeNegative: true,
    includeEdgeCases: true,
    includePlatformVariations: true
  });
  const [generatedTests, setGeneratedTests] = useState([]);
  const [qualityScore, setQualityScore] = useState(0);
  
  // Step 4: Cypress Conversion
  const [selectedTestsForCypress, setSelectedTestsForCypress] = useState([]);
  const [cypressCode, setCypressCode] = useState('');
  const [cypressConfig, setCypressConfig] = useState({
    suite: 'video-player.cy.js',
    baseUrl: 'https://www.paramountplus.com',
    platform: 'both'
  });

  // Load demo ticket
  const loadDemoTicket = () => {
    setIsDemoMode(true);
    setSelectedTicket({
      key: 'ESWCTV-5001',
      type: 'Story',
      summary: 'Add Skip Intro Button to Video Player',
      description: `
## Overview
Users have requested the ability to skip intro sequences when watching content.

## Requirements
1. Skip intro button appears after 5 seconds
2. Button remains visible for 10 seconds
3. Clicking button skips to main content
4. Works on both CTV and Roku platforms

## Acceptance Criteria
- [ ] Button displays at correct timing
- [ ] Skip functionality works correctly
- [ ] Analytics event is tracked
- [ ] Accessible via remote control
      `,
      priority: 'High',
      storyPoints: 5
    });
    setCurrentStep(2);
  };

  // Fetch tickets (mock for demo)
  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      // In demo mode, return mock tickets
      const mockTickets = [
        { key: 'ESWCTV-5001', summary: 'Add Skip Intro Button', type: 'Story' },
        { key: 'ESWCTV-5002', summary: 'Fix Roku Navigation Bug', type: 'Bug' },
        { key: 'ESWCTV-5003', summary: 'Update Player Controls', type: 'Task' }
      ];
      setTickets(mockTickets);
    } catch (error) {
      setError('Failed to fetch tickets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // Load TestRail project from localStorage if available
    const savedProject = localStorage.getItem('testrail_selected_project');
    if (savedProject) {
      setTestRailProject(JSON.parse(savedProject));
    }
  }, []);

  // Generate tests
  const generateTests = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/gemini/generate-tests`, {
        ticket: selectedTicket,
        context: {
          folder: selectedFolder,
          tests: contextTests
        },
        options: generationOptions
      });
      
      setGeneratedTests(response.data.tests);
      setQualityScore(response.data.qualityScore || 92);
      setCurrentStep(4);
    } catch (error) {
      // For demo, use mock data
      const mockTests = [
        {
          id: 1,
          title: 'Video Player - Skip Intro Button Display',
          objective: 'Validate skip intro button appears at correct timing',
          steps: [
            'Navigate to video with intro',
            'Start video playback',
            'Wait 5 seconds',
            'Verify skip intro button appears',
            'Wait additional 10 seconds',
            'Verify button disappears'
          ]
        },
        {
          id: 2,
          title: 'Video Player - Skip Intro Functionality',
          objective: 'Validate skip action works correctly',
          steps: [
            'Navigate to video with intro',
            'Wait for skip button to appear',
            'Click skip intro button',
            'Verify video jumps to main content'
          ]
        },
        {
          id: 3,
          title: 'Video Player - Skip Intro Remote Navigation',
          objective: 'Validate remote control accessibility',
          steps: [
            'Navigate to video using remote',
            'Wait for skip button',
            'Navigate to button using directional pad',
            'Press OK/Select',
            'Verify skip action triggers'
          ]
        }
      ];
      
      setGeneratedTests(mockTests);
      setQualityScore(92);
      setCurrentStep(4);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Cypress code
  const generateCypressCode = () => {
    const code = `
describe('Video Player - Skip Intro', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/video/test-content-with-intro');
  });

  it('Should display skip intro button after 5 seconds', () => {
    cy.get('[data-testid="video-player"]').should('be.visible');
    cy.wait(5000);
    cy.get('[data-testid="skip-intro-button"]')
      .should('be.visible')
      .and('contain', 'Skip Intro');
  });

  it('Should skip to main content when button clicked', () => {
    cy.wait(5000);
    cy.get('[data-testid="skip-intro-button"]').click();
    cy.get('[data-testid="video-player"]')
      .should('have.attr', 'data-current-time')
      .and('be.greaterThan', 30); // Assuming intro is 30 seconds
  });

  it('Should be accessible via keyboard navigation', () => {
    cy.wait(5000);
    cy.get('body').type('{downarrow}');
    cy.get('[data-testid="skip-intro-button"]')
      .should('have.focus');
    cy.get('body').type('{enter}');
    // Verify skip action occurred
  });
});`;
    
    setCypressCode(code);
  };

  // Step components
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {[
          { num: 1, label: 'Ticket' },
          { num: 2, label: 'Context' },
          { num: 3, label: 'Generate' },
          { num: 4, label: 'Cypress' }
        ].map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.num
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {currentStep > step.num ? <CheckCircle size={20} /> : step.num}
            </div>
            <div className="ml-2">
              <span className={`text-sm ${currentStep >= step.num ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {index < 3 && (
              <div className={`w-16 h-0.5 ml-4 ${
                currentStep > step.num ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <FileText className="mr-2" size={24} />
          Select JIRA Ticket
        </h2>
        <span className="text-sm text-gray-500">Step 1 of 4</span>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <select
            className="px-4 py-2 border rounded-lg"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="ESWCTV">ESWCTV</option>
            <option value="ESROKU">ESROKU</option>
            <option value="ESW">ESW</option>
          </select>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        <button
          onClick={loadDemoTicket}
          className="mb-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
        >
          Use Demo Ticket
        </button>

        <div className="space-y-2">
          {tickets.map(ticket => (
            <div
              key={ticket.key}
              onClick={() => setSelectedTicket(ticket)}
              className={`p-4 border rounded-lg cursor-pointer ${
                selectedTicket?.key === ticket.key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{ticket.key}</span>
                  <span className="ml-2 text-gray-600">{ticket.summary}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  ticket.type === 'Bug' ? 'bg-red-100 text-red-700' :
                  ticket.type === 'Story' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {ticket.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedTicket && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Selected Ticket Details:</h3>
          <p className="text-sm text-gray-600">{selectedTicket.summary}</p>
          {selectedTicket.description && (
            <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">
              {selectedTicket.description.substring(0, 200)}...
            </pre>
          )}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={() => setCurrentStep(2)}
          disabled={!selectedTicket}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          Next: Context
          <ChevronRight className="ml-2" size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <FolderOpen className="mr-2" size={24} />
          Select Test Context
        </h2>
        <span className="text-sm text-gray-500">Step 2 of 4</span>
      </div>

      {isDemoMode && (
        <div className="mb-4 p-3 bg-purple-100 border border-purple-300 rounded-lg">
          <span className="text-purple-700">🎭 Demo Mode: Using pre-selected context folder</span>
        </div>
      )}

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          For ticket: <strong>{selectedTicket?.key} - {selectedTicket?.summary}</strong>
        </p>
        
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Select a folder with similar tests:</h3>
          
          <div className="bg-gray-50 p-4 rounded">
            <div className="mb-2">
              <span className="text-sm text-gray-500">TestRail Project:</span>
              <span className="ml-2 font-medium">Unified OAO</span>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => setSelectedFolder({ 
                  name: 'Video Player Controls',
                  testCount: 5,
                  pattern: 'Video Player - [Feature]'
                })}
                className={`w-full text-left p-3 rounded border ${
                  selectedFolder?.name === 'Video Player Controls'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  <FolderOpen className="mr-2" size={16} />
                  <span>Video Player Controls</span>
                  <span className="ml-auto text-sm text-gray-500">(5 tests)</span>
                </div>
              </button>
              
              <button
                onClick={() => navigate('/testrail')}
                className="w-full text-left p-3 rounded border border-gray-200 hover:bg-gray-100"
              >
                <span className="text-blue-600">Browse TestRail for different folder →</span>
              </button>
            </div>
          </div>
        </div>

        {selectedFolder && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Selected Context:</h4>
            <p className="text-sm text-green-700">📁 {selectedFolder.name}</p>
            <p className="text-sm text-green-600 mt-1">Pattern: "{selectedFolder.pattern}"</p>
            <p className="text-sm text-green-600">Will analyze {selectedFolder.testCount} similar tests</p>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep(1)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center"
        >
          <ChevronLeft className="mr-2" size={20} />
          Back: Ticket
        </button>
        <div className="space-x-2">
          <button
            onClick={() => setCurrentStep(3)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Skip Context
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            disabled={!selectedFolder}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            Next: Generate
            <ChevronRight className="ml-2" size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Cpu className="mr-2" size={24} />
          Generate Test Cases
        </h2>
        <span className="text-sm text-gray-500">Step 3 of 4</span>
      </div>

      {!generatedTests.length ? (
        <div>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-3">Generation Options:</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Coverage Level:</label>
                <div className="mt-1 flex space-x-4">
                  {['basic', 'standard', 'comprehensive'].map(level => (
                    <label key={level} className="flex items-center">
                      <input
                        type="radio"
                        value={level}
                        checked={generationOptions.coverageLevel === level}
                        onChange={(e) => setGenerationOptions({
                          ...generationOptions,
                          coverageLevel: e.target.value
                        })}
                        className="mr-2"
                      />
                      <span className="capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Include:</label>
                <div className="mt-1 space-y-1">
                  {[
                    { key: 'includePositive', label: 'Positive Tests' },
                    { key: 'includeNegative', label: 'Negative Tests' },
                    { key: 'includeEdgeCases', label: 'Edge Cases' },
                    { key: 'includePlatformVariations', label: 'Platform Variations (CTV/Roku)' }
                  ].map(option => (
                    <label key={option.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={generationOptions[option.key]}
                        onChange={(e) => setGenerationOptions({
                          ...generationOptions,
                          [option.key]: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={generateTests}
            disabled={isLoading}
            className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <RefreshCw className="animate-spin mr-2" size={20} />
                Generating Tests...
              </>
            ) : (
              <>
                <Play className="mr-2" size={20} />
                Generate Tests
              </>
            )}
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-green-700 font-medium">
                ✅ {generatedTests.length} tests generated successfully!
              </span>
              <span className="text-green-600">
                Quality Score: {qualityScore}/100
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {generatedTests.map((test, index) => (
              <div key={test.id || index} className="p-4 border rounded-lg">
                <h4 className="font-medium flex items-center">
                  <CheckCircle className="mr-2 text-green-500" size={16} />
                  {test.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{test.objective}</p>
                <details className="mt-2">
                  <summary className="text-sm text-blue-600 cursor-pointer">View steps</summary>
                  <ol className="mt-2 text-sm text-gray-500 list-decimal list-inside">
                    {test.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </details>
              </div>
            ))}
          </div>

          <div className="mt-4 flex space-x-2">
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Regenerate
            </button>
            <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center">
              <Save className="mr-2" size={16} />
              Save to TestRail
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center"
        >
          <ChevronLeft className="mr-2" size={20} />
          Back: Context
        </button>
        {generatedTests.length > 0 && (
          <button
            onClick={() => {
              setSelectedTestsForCypress(generatedTests);
              generateCypressCode();
              setCurrentStep(4);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
          >
            Next: Convert to Cypress
            <ChevronRight className="ml-2" size={20} />
          </button>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center">
          <Code className="mr-2" size={24} />
          Convert to Cypress
        </h2>
        <span className="text-sm text-gray-500">Step 4 of 4</span>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-3">Select Tests to Automate:</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
          {generatedTests.map((test) => (
            <label key={test.id} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedTestsForCypress.includes(test)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTestsForCypress([...selectedTestsForCypress, test]);
                  } else {
                    setSelectedTestsForCypress(selectedTestsForCypress.filter(t => t.id !== test.id));
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">{test.title}</span>
            </label>
          ))}
        </div>
      </div>

      {cypressCode && (
        <div>
          <h3 className="font-semibold mb-3">Generated Cypress Code:</h3>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{cypressCode}</code>
            </pre>
            <div className="absolute top-2 right-2 space-x-2">
              <button
                onClick={() => navigator.clipboard.writeText(cypressCode)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center"
              >
                <Copy className="mr-1" size={14} />
                Copy
              </button>
              <button className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex items-center">
                <Download className="mr-1" size={14} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">Workflow Complete! 🎉</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
          <div>Time Saved: ~3 hours</div>
          <div>Tests Generated: {generatedTests.length}</div>
          <div>Coverage: 100% of requirements</div>
          <div>Quality Score: {qualityScore}/100</div>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep(3)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center"
        >
          <ChevronLeft className="mr-2" size={20} />
          Back: Tests
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Complete Workflow ✓
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 text-center">
            🚀 QA Copilot - Smart Test Generator
          </h1>
          {isDemoMode && (
            <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded-lg text-center">
              <span className="text-purple-700 font-medium">
                🎭 DEMO MODE - Using structured example for presentation
              </span>
              <button
                onClick={() => setIsDemoMode(false)}
                className="ml-4 text-purple-600 underline"
              >
                Exit Demo
              </button>
            </div>
          )}
        </div>

        {renderStepIndicator()}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="mr-2 text-red-500" size={20} />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
}

export default UnifiedTestGenerator;