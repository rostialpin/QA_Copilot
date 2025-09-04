import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  FolderOpen, 
  Code, 
  ArrowRight, 
  CheckCircle,
  AlertCircle,
  FileText,
  Zap,
  Settings
} from 'lucide-react';
import TestRailSelector from '../components/workflow/TestRailSelector';
import JavaSeleniumGenerator from '../components/workflow/JavaSeleniumGenerator';
import PlaywrightGenerator from '../components/workflow/PlaywrightGenerator';

export default function AutomateExistingTests() {
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState('select'); // select, configure, generate
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedFramework, setSelectedFramework] = useState(null);
  const [generatedCode, setGeneratedCode] = useState(null);

  // Check if we're coming from the review page with tests
  useEffect(() => {
    if (location.state?.fromReview && location.state?.tests) {
      setSelectedTests(location.state.tests);
      // Skip directly to framework selection
      setCurrentStep('configure');
    } else {
      // Also check sessionStorage for reviewed tests
      const reviewedTests = sessionStorage.getItem('reviewedTests');
      if (reviewedTests) {
        try {
          const tests = JSON.parse(reviewedTests);
          setSelectedTests(tests);
          setCurrentStep('configure');
          // Clear after using
          sessionStorage.removeItem('reviewedTests');
        } catch (e) {
          console.error('Error parsing reviewed tests:', e);
        }
      } else {
        // If no tests are available, start from the beginning
        setCurrentStep('select');
      }
    }
  }, [location]);

  const frameworks = [
    { 
      id: 'selenium', 
      name: 'Java Selenium (Recommended)',
      icon: '☕',
      description: 'Generate Selenium WebDriver tests in Java for IntelliJ IDE',
      component: JavaSeleniumGenerator,
      recommended: true
    },
    { 
      id: 'playwright', 
      name: 'Playwright',
      icon: '🎭',
      description: 'Generate Playwright tests in TypeScript/JavaScript',
      component: PlaywrightGenerator
    },
    {
      id: 'restassured',
      name: 'Rest Assured',
      icon: '🔌',
      description: 'Generate API tests with Rest Assured',
      disabled: true,
      component: null
    }
  ];

  const handleTestSelection = (tests) => {
    setSelectedTests(tests);
    if (tests.length > 0) {
      setCurrentStep('configure');
    }
  };

  const handleFrameworkSelect = (framework) => {
    setSelectedFramework(framework);
    setCurrentStep('generate');
  };

  const handleComplete = (result) => {
    setGeneratedCode(result);
    // Could navigate to success page or show summary
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 'select', label: 'Select Tests', icon: FolderOpen },
      { id: 'configure', label: 'Choose Framework', icon: Settings },
      { id: 'generate', label: 'Generate Code', icon: Code }
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isActive ? 'bg-indigo-600 text-white' : 
                      isCompleted ? 'bg-green-500 text-white' : 
                      'bg-gray-200 text-gray-400'}
                  `}>
                    {isCompleted && !isActive ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`
                    text-xs mt-2
                    ${isActive ? 'text-indigo-600 font-medium' : 
                      isCompleted ? 'text-green-600' : 
                      'text-gray-400'}
                  `}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    flex-1 h-0.5 mx-3 -mt-5
                    ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500" />
          Automate Tests with Java Selenium
        </h1>
        <p className="text-gray-600 mt-2">
          Select existing manual tests from TestRail and generate Java Selenium automation code for IntelliJ IDE
        </p>
      </div>

      {renderStepIndicator()}

      {currentStep === 'select' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Select Tests from TestRail
          </h2>
          
          <TestRailSelector 
            onSelect={handleTestSelection}
            allowMultiple={true}
            showPreview={true}
          />
          
          {selectedTests.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-900 font-medium">
                {selectedTests.length} test(s) selected
              </p>
              <button
                onClick={() => setCurrentStep('configure')}
                className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === 'configure' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            Choose Automation Framework
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {frameworks.map(framework => (
              <button
                key={framework.id}
                onClick={() => !framework.disabled && handleFrameworkSelect(framework)}
                disabled={framework.disabled}
                className={`
                  p-6 rounded-lg border-2 text-left transition-all relative
                  ${framework.disabled 
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' 
                    : framework.recommended
                      ? 'border-indigo-300 bg-indigo-50 hover:border-indigo-500 cursor-pointer'
                      : 'border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer'}
                `}
              >
                {framework.recommended && (
                  <span className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                    Recommended
                  </span>
                )}
                <div className="text-3xl mb-2">{framework.icon}</div>
                <h3 className="font-semibold text-gray-900">{framework.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{framework.description}</p>
                {framework.disabled && (
                  <span className="inline-block mt-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setCurrentStep('select')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {currentStep === 'generate' && selectedFramework && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Generate {selectedFramework.name} Tests
          </h2>
          
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-900">
              <strong>{selectedTests.length} test(s)</strong> selected for automation
            </p>
          </div>
          
          {selectedFramework.id === 'selenium' ? (
            <JavaSeleniumGenerator
              tests={selectedTests}
              ticket={{
                key: 'TESTRAIL-' + Date.now(),
                summary: `Automated tests for ${selectedTests.length} TestRail test(s)`,
                type: 'Task'
              }}
              onGenerated={handleComplete}
              onSkip={() => setCurrentStep('configure')}
            />
          ) : selectedFramework.id === 'playwright' ? (
            <PlaywrightGenerator
              reviewedTests={selectedTests}
              ticket={{
                key: 'TESTRAIL-' + Date.now(),
                summary: `Automated tests for ${selectedTests.length} TestRail test(s)`,
                type: 'Task'
              }}
              onComplete={handleComplete}
              onSkip={() => setCurrentStep('configure')}
            />
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {selectedFramework.name} support coming soon!
              </p>
              <button
                onClick={() => setCurrentStep('configure')}
                className="mt-4 text-indigo-600 hover:text-indigo-700"
              >
                Choose different framework
              </button>
            </div>
          )}
        </div>
      )}

      {generatedCode && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Tests Generated Successfully!</span>
          </div>
          <p className="text-green-600 mt-2">
            Your automated tests have been generated and saved.
          </p>
        </div>
      )}
    </div>
  );
}