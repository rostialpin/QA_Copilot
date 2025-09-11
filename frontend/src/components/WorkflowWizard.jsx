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
import JavaSeleniumGenerator from './workflow/JavaSeleniumGenerator';
import SuccessAnimation from './SuccessAnimation';
import AnimatedProgressBar from './AnimatedProgressBar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WORKFLOW_STEPS = [
  { id: 1, name: 'selectTicket', label: 'Select Ticket', icon: FileText },
  { id: 2, name: 'selectContext', label: 'Select Context', icon: FolderOpen },
  { id: 3, name: 'generateTests', label: 'Generate & Review Tests', icon: TestTube },
  { id: 4, name: 'saveToTestRail', label: 'Save to TestRail', icon: Save },
  { id: 5, name: 'generateAutomation', label: '☕ Generate Automation', icon: Zap, highlight: true }
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
  const [seleniumTest, setSeleniumTest] = useState(null);
  const [cypressCode, setCypressCode] = useState([]);
  const [selectedAutomationFramework, setSelectedAutomationFramework] = useState('selenium'); // Default to Selenium
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successAnimationType, setSuccessAnimationType] = useState('manual');
  const [successTestCount, setSuccessTestCount] = useState(0);

  // Initialize workflow on mount
  useEffect(() => {
    startWorkflow();
  }, []);

  // Debug: Track step changes
  useEffect(() => {
    console.log('=== STEP CHANGED ===');
    console.log('New currentStep:', currentStep);
    console.log('Step name:', WORKFLOW_STEPS[currentStep - 1]?.name);
    console.log('Time:', new Date().toISOString());
    console.log('isLoading:', isLoading);
    console.log('==================');
  }, [currentStep]);

  const startWorkflow = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/workflow/start`, {
        userId: localStorage.getItem('userId') || 'demo-user'
      });
      setWorkflowId(response.data.workflowId);
      setWorkflowData(response.data.workflow);
      // Store workflow ID in localStorage for child components
      localStorage.setItem('currentWorkflowId', response.data.workflowId);
      
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
    const startTime = performance.now();
    
    console.log('=== HANDLE NEXT DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Current step:', step.name);
    console.log('Current step number:', currentStep);
    console.log('Current state:', {
      selectedTicket: selectedTicket?.key || 'none',
      selectedContext: selectedContext?.sectionName || 'none',
      generatedTests: generatedTests?.length || 0,
      reviewedTests: reviewedTests?.length || 0,
      isLoading: isLoading
    });
    
    // Only set loading for steps that make API calls (excluding those with their own loading states)
    if (step.name !== 'generateSelenium' && step.name !== 'generateTests') {
      setIsLoading(true);
    }
    
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
          // If we already have tests, just move to next step (user clicked Next after reviewing)
          if (generatedTests && generatedTests.length > 0) {
            console.log('Tests already generated, moving to next step');
            break; // Continue to next step
          }
          
          // Otherwise, generate new tests
          const genStartTime = performance.now();
          console.log('Starting generateTests at:', new Date().toISOString());
          // Pass ticket and context directly with the generate request
          result = await executeStep('generateTests', {
            ticket: selectedTicket,
            context: selectedContext,
            coverageLevel: 'standard',
            includeNegativeTests: true,
            includePlatformVariations: true
          });
          const genEndTime = performance.now();
          console.log('generateTests completed in:', (genEndTime - genStartTime) / 1000, 'seconds');
          const tests = result?.tests || [];
          console.log('Setting generated tests:', tests.length, 'tests');
          setGeneratedTests(tests);
          // Auto-set as reviewed tests since user can edit them
          setReviewedTests(tests);
          // Show manual test success animation after generation
          setSuccessAnimationType('manual');
          setSuccessTestCount(tests.length);
          setShowSuccessAnimation(true);
          // Don't auto-advance - let user review and edit tests
          setIsLoading(false);
          return; // Stay on this step for review
          
        case 'saveToTestRail':
          result = await executeStep('saveToTestRail', {
            ...selectedContext,
            tests: reviewedTests
          });
          setSavedTests(result.savedTests || []);
          // Don't show animation on save anymore - moved to generation
          break;
          
        case 'generateAutomation':
          // Handle automation generation based on selected framework
          if (selectedAutomationFramework === 'cypress') {
            result = await executeStep('generateCypress', {
              tests: reviewedTests,
              usePageObjects: true
            });
            setCypressCode(result.cypressTests || []);
          }
          // For Selenium, the component handles everything locally
          setIsComplete(true);
          break;
      }
      
      if (currentStep < WORKFLOW_STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err) {
      // Error already handled in executeStep
      console.error('Error in handleNext:', err);
    } finally {
      // Always ensure loading is turned off after step completes
      setIsLoading(false);
      const endTime = performance.now();
      console.log('=== STEP COMPLETED ===');
      console.log('Total time for handleNext:', (endTime - startTime) / 1000, 'seconds');
      console.log('Final isLoading state:', false);
      console.log('Now on step:', currentStep);
      console.log('========================\n');
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

  const handleComplete = () => {
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
    console.log('Rendering step content for:', step.name, 'at', new Date().toISOString());
    
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
        // Combined generate and review step
        if (!generatedTests || generatedTests.length === 0) {
          // Show generator if no tests yet
          return (
            <TestGenerator
              ticket={selectedTicket}
              context={selectedContext}
              onGenerated={(tests) => {
                setGeneratedTests(tests);
                setReviewedTests(tests); // Auto-set as reviewed
                // Show success animation
                setSuccessAnimationType('manual');
                setSuccessTestCount(tests.length);
                setShowSuccessAnimation(true);
              }}
              tests={generatedTests}
              isLoading={isLoading}
            />
          );
        } else {
          // Show reviewer once tests are generated
          return (
            <TestReviewer
              tests={generatedTests}
              onReview={setReviewedTests}
              reviewed={reviewedTests}
              onSkipToAutomation={() => {
                // Skip TestRail and go directly to Selenium generation  
                setCurrentStep(5); // generateSelenium step (now step 5 since we removed review)
              }}
            />
          );
        }
        
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
        
      case 'generateAutomation':
        // For demo, only show Java Selenium
        return (
          <JavaSeleniumGenerator
            tests={reviewedTests}
            ticket={selectedTicket}
            onGenerated={setSeleniumTest}
            generatedCode={seleniumTest}
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
      {/* Enhanced Progress Bar */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow-sm border border-indigo-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-medium text-gray-700">
              Workflow Progress
            </span>
            <span className="text-xs text-gray-500 ml-2">
              (Step {currentStep} of {WORKFLOW_STEPS.length})
            </span>
          </div>
          <span className="text-sm text-gray-500">
            ID: {workflowId?.slice(-8) || 'demo-user'}
          </span>
        </div>
        
        {/* Animated Progress Bar */}
        <div className="mb-3">
          {(() => {
            // Simple, direct progress calculation
            let progress = 0;
            
            if (hasPreSelectedTicket) {
              // With pre-selected ticket: Steps 2-5 map to 0-100%  
              // Step 2 = 0%, Step 3 = 33.33%, Step 4 = 66.67%, Step 5 = 100%
              progress = ((currentStep - 2) / 3) * 100;
            } else {
              // Without pre-selected ticket: Steps 1-5 map to 0-100%
              // Step 1 = 0%, Step 2 = 25%, Step 3 = 50%, Step 4 = 75%, Step 5 = 100%
              progress = ((currentStep - 1) / 4) * 100;
            }
            
            // Ensure progress is between 0 and 100
            progress = Math.max(0, Math.min(100, progress));
            
            console.log('Progress calculation:', {
              currentStep,
              hasPreSelectedTicket,
              progress: progress.toFixed(1)
            });
            
            return (
              <>
                <AnimatedProgressBar 
                  progress={progress}
                  label={`Overall Progress (Step ${currentStep} of 5)`}
                  color={currentStep === 5 ? 'green' : currentStep > 3 ? 'purple' : 'blue'}
                  showPercentage={true}
                  size="md"
                  animated={true}
                />
                {/* Debug: Show actual percentage */}
                <div className="text-xs text-gray-500 mt-1 text-center">
                  Actual progress: {progress.toFixed(1)}%
                </div>
              </>
            );
          })()}
        </div>
        
        {/* Current Step Indicator */}
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-indigo-600 font-medium flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            Current: {WORKFLOW_STEPS[currentStep - 1]?.label}
          </span>
          {currentStep < WORKFLOW_STEPS.length && (
            <span className="text-gray-500">
              Next: {WORKFLOW_STEPS[currentStep]?.label}
            </span>
          )}
        </div>
        
        {/* Compact Progress Steps */}
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.filter(step => !hasPreSelectedTicket || step.id !== 1).map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {isActive && (
                      <div className="absolute inset-0 w-8 h-8 bg-indigo-400 rounded-full animate-ping opacity-75" />
                    )}
                    <div
                      className={`
                        relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300
                        ${isActive ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white scale-110 shadow-lg' : 
                          isCompleted ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' : 
                          'bg-gray-200 text-gray-500'}
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : isActive && isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </div>
                  </div>
                  <span className={`
                    text-xs mt-1 text-center
                    ${isActive ? 'text-indigo-600 font-medium' : 
                      isCompleted ? 'text-green-600' : 
                      'text-gray-400'}
                  `}>
                    {step.label}
                    {step.optional && <span className="text-xs opacity-70">(Optional)</span>}
                  </span>
                </div>
                {index < WORKFLOW_STEPS.filter(s => !hasPreSelectedTicket || s.id !== 1).length - 1 && (
                  <div className="flex-1 mx-2 -mt-4 relative">
                    <div className="h-1 bg-gray-200 rounded-full">
                      <div 
                        className={`h-1 rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-gradient-to-r from-green-400 to-green-500 w-full' : 
                          isActive ? 'bg-gradient-to-r from-blue-400 to-blue-500 w-1/2 animate-pulse' : 
                          'w-0'
                        }`}
                      />
                    </div>
                  </div>
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
        
        {isLoading && currentStep !== 3 && currentStep !== 4 ? ( // Don't show loading spinner for generate tests (step 3) or review step (step 4)
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
              onClick={handleComplete}
              className="px-4 py-2 text-green-600 bg-white border border-green-300 rounded-lg hover:bg-green-50"
            >
              Complete Workflow
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

      {/* Success Animation */}
      <SuccessAnimation
        type={successAnimationType}
        testCount={successTestCount}
        show={showSuccessAnimation}
        onComplete={() => setShowSuccessAnimation(false)}
      />
    </div>
  );
}