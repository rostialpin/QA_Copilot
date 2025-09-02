import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, ChevronLeft, CheckCircle, Circle, 
  AlertCircle, Loader2, FileText, FolderOpen, 
  TestTube, Save, Code, Zap
} from 'lucide-react';
import axios from 'axios';
import TicketSelector from './workflow/TicketSelector';
import ContextSelector from './workflow/ContextSelector';
import TestGenerator from './workflow/TestGenerator';
import TestReviewer from './workflow/TestReviewer';
import TestRailSaver from './workflow/TestRailSaver';
import CypressConverter from './workflow/CypressConverter';
import WorkflowSummary from './workflow/WorkflowSummary';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WORKFLOW_STEPS = [
  { id: 1, name: 'selectTicket', label: 'Select Ticket', icon: FileText },
  { id: 2, name: 'selectContext', label: 'Select Context', icon: FolderOpen },
  { id: 3, name: 'generateTests', label: 'Generate Tests', icon: TestTube },
  { id: 4, name: 'reviewTests', label: 'Review Tests', icon: CheckCircle },
  { id: 5, name: 'saveToTestRail', label: 'Save to TestRail', icon: Save },
  { id: 6, name: 'generateCypress', label: 'Generate Cypress', icon: Code, optional: true }
];

export default function WorkflowWizard({ initialTicket = null }) {
  const navigate = useNavigate();
  const [workflowId, setWorkflowId] = useState(null);
  const [currentStep, setCurrentStep] = useState(initialTicket ? 2 : 1);
  const [workflowData, setWorkflowData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasPreSelectedTicket] = useState(!!initialTicket);
  
  // Step-specific data
  const [selectedTicket, setSelectedTicket] = useState(initialTicket);
  const [selectedContext, setSelectedContext] = useState(null);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [reviewedTests, setReviewedTests] = useState([]);
  const [savedTests, setSavedTests] = useState([]);
  const [cypressCode, setCypressCode] = useState([]);

  // Initialize workflow on mount
  useEffect(() => {
    startWorkflow();
  }, []);

  const startWorkflow = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/workflow/start`, {
        userId: localStorage.getItem('userId') || 'demo-user'
      });
      setWorkflowId(response.data.workflowId);
      setWorkflowData(response.data.workflow);
      
      // Check for saved progress
      const savedProgress = localStorage.getItem(`workflow_${response.data.workflowId}`);
      if (savedProgress && !initialTicket) {
        const progress = JSON.parse(savedProgress);
        setCurrentStep(progress.currentStep);
        setSelectedTicket(progress.selectedTicket);
        setSelectedContext(progress.selectedContext);
        setGeneratedTests(progress.generatedTests || []);
      } else if (initialTicket) {
        // If we have an initial ticket, automatically execute the first step
        try {
          await axios.post(
            `${API_URL}/api/workflow/${response.data.workflowId}/step`,
            { step: 'selectTicket', data: initialTicket }
          );
        } catch (err) {
          console.error('Error selecting initial ticket:', err);
        }
      }
    } catch (err) {
      console.error('Error starting workflow:', err);
      setError('Failed to start workflow');
    } finally {
      setIsLoading(false);
    }
  };

  const executeStep = async (stepName, data) => {
    if (!workflowId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${API_URL}/api/workflow/${workflowId}/step`,
        { step: stepName, data }
      );
      
      // Save progress
      localStorage.setItem(`workflow_${workflowId}`, JSON.stringify({
        currentStep,
        selectedTicket,
        selectedContext,
        generatedTests,
        reviewedTests
      }));
      
      return response.data;
    } catch (err) {
      console.error(`Error executing step ${stepName}:`, err);
      setError(err.response?.data?.error || 'Step execution failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    const step = WORKFLOW_STEPS[currentStep - 1];
    
    console.log('handleNext called, current step:', step.name);
    console.log('Current state:', {
      selectedTicket: selectedTicket?.key || 'none',
      selectedContext: selectedContext?.sectionName || 'none',
      generatedTests: generatedTests?.length || 0,
      reviewedTests: reviewedTests?.length || 0
    });
    
    try {
      let result;
      
      switch (step.name) {
        case 'selectTicket':
          if (!selectedTicket) {
            setError('Please select a ticket');
            return;
          }
          result = await executeStep('selectTicket', selectedTicket);
          break;
          
        case 'selectContext':
          if (!selectedContext) {
            setError('Please select a TestRail context');
            return;
          }
          result = await executeStep('selectContext', selectedContext);
          break;
          
        case 'generateTests':
          // First ensure previous steps are complete
          if (selectedTicket && selectedContext) {
            // Re-submit ticket and context in case backend restarted
            await executeStep('selectTicket', selectedTicket);
            await executeStep('selectContext', selectedContext);
          }
          
          console.log('Calling generateTests API...');
          result = await executeStep('generateTests', {
            coverageLevel: 'standard',
            includeNegativeTests: true,
            includePlatformVariations: true
          });
          console.log('generateTests API response:', result);
          const tests = result?.tests || [];
          console.log('Setting generated tests:', tests.length, 'tests');
          setGeneratedTests(tests);
          // Auto-set as reviewed initially so the review step works
          setReviewedTests(tests);
          break;
          
        case 'reviewTests':
          // If no reviewed tests yet, use generated tests
          const testsToReview = reviewedTests.length > 0 ? reviewedTests : generatedTests;
          result = await executeStep('reviewTests', testsToReview);
          break;
          
        case 'saveToTestRail':
          result = await executeStep('saveToTestRail', {
            ...selectedContext,
            tests: reviewedTests
          });
          setSavedTests(result.savedTests || []);
          break;
          
        case 'generateCypress':
          result = await executeStep('generateCypress', {
            tests: reviewedTests,
            usePageObjects: true
          });
          setCypressCode(result.cypressTests || []);
          setIsComplete(true);
          break;
      }
      
      if (currentStep < WORKFLOW_STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err) {
      // Error already handled in executeStep
    }
  };

  const handleBack = () => {
    // Prevent going back to ticket selection if we started with a pre-selected ticket
    const minStep = hasPreSelectedTicket ? 2 : 1;
    if (currentStep > minStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipCypress = () => {
    setIsComplete(true);
  };

  const resetWorkflow = () => {
    if (workflowId) {
      localStorage.removeItem(`workflow_${workflowId}`);
    }
    // If we had a pre-selected ticket, navigate back to dashboard
    if (hasPreSelectedTicket) {
      navigate('/');
    } else {
      setWorkflowId(null);
      setCurrentStep(1);
      setSelectedTicket(null);
      setSelectedContext(null);
      setGeneratedTests([]);
      setReviewedTests([]);
      setSavedTests([]);
      setCypressCode([]);
      setIsComplete(false);
      startWorkflow();
    }
  };

  const renderStepContent = () => {
    const step = WORKFLOW_STEPS[currentStep - 1];
    
    switch (step.name) {
      case 'selectTicket':
        // If we have a pre-selected ticket, show it as read-only
        if (hasPreSelectedTicket && selectedTicket) {
          return (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Selected Ticket</h3>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{selectedTicket.key}</p>
                    <p className="text-gray-700 mt-1">{selectedTicket.summary}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span>Type: {selectedTicket.issueType}</span>
                      <span>Status: {selectedTicket.status}</span>
                      {selectedTicket.priority && <span>Priority: {selectedTicket.priority}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4">This ticket was pre-selected from the dashboard</p>
            </div>
          );
        }
        return (
          <TicketSelector
            onSelect={setSelectedTicket}
            selected={selectedTicket}
          />
        );
        
      case 'selectContext':
        return (
          <ContextSelector
            ticket={selectedTicket}
            onSelect={setSelectedContext}
            selected={selectedContext}
          />
        );
        
      case 'generateTests':
        return (
          <TestGenerator
            ticket={selectedTicket}
            context={selectedContext}
            onGenerated={setGeneratedTests}
            tests={generatedTests}
            isLoading={isLoading}
          />
        );
        
      case 'reviewTests':
        return (
          <TestReviewer
            tests={generatedTests}
            onReview={setReviewedTests}
            reviewed={reviewedTests}
          />
        );
        
      case 'saveToTestRail':
        return (
          <TestRailSaver
            tests={reviewedTests}
            context={selectedContext}
            onSaved={setSavedTests}
            saved={savedTests}
            isLoading={isLoading}
          />
        );
        
      case 'generateCypress':
        return (
          <CypressConverter
            tests={reviewedTests}
            ticket={selectedTicket}
            onGenerated={setCypressCode}
            cypressCode={cypressCode}
            isLoading={isLoading}
          />
        );
        
      default:
        return null;
    }
  };

  if (isComplete) {
    return (
      <WorkflowSummary
        workflowId={workflowId}
        ticket={selectedTicket}
        tests={reviewedTests}
        savedTests={savedTests}
        cypressCode={cypressCode}
        onNewWorkflow={resetWorkflow}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            QA Copilot Workflow
          </h1>
          <span className="text-sm text-gray-500">
            Workflow ID: {workflowId?.slice(-8) || 'Loading...'}
          </span>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.filter(step => !hasPreSelectedTicket || step.id !== 1).map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-indigo-600 text-white' : 
                        isCompleted ? 'bg-green-500 text-white' : 
                        'bg-gray-200 text-gray-400'}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`
                    text-xs mt-2 text-center
                    ${isActive ? 'text-indigo-600 font-medium' : 
                      isCompleted ? 'text-green-600' : 
                      'text-gray-400'}
                  `}>
                    {step.label}
                    {step.optional && <span className="block text-xs">(Optional)</span>}
                  </span>
                </div>
                {index < WORKFLOW_STEPS.filter(s => !hasPreSelectedTicket || s.id !== 1).length - 1 && (
                  <div className={`
                    flex-1 h-0.5 mx-2 mt-5
                    ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 min-h-[500px]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Step {currentStep}: {WORKFLOW_STEPS[currentStep - 1].label}
        </h2>
        
        {isLoading && !generatedTests.length ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-600">Processing...</p>
          </div>
        ) : (
          renderStepContent()
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          disabled={(hasPreSelectedTicket && currentStep === 2) || currentStep === 1 || isLoading}
          className={`flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
            (hasPreSelectedTicket && currentStep === 2) ? 'invisible' : ''
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex gap-2">
          {currentStep === 5 && (
            <button
              onClick={handleSkipCypress}
              className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Skip Cypress
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {currentStep === WORKFLOW_STEPS.length ? 'Complete' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}