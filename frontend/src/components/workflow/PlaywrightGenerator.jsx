import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Code, 
  CheckCircle, 
  AlertCircle, 
  Download,
  GitBranch,
  PlayCircle,
  Settings,
  Folder,
  FileCode,
  Zap,
  Shield,
  TestTube
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PlaywrightGenerator = ({ 
  reviewedTests = [], 
  ticket, 
  onComplete, 
  onSkip 
}) => {
  const [currentStep, setCurrentStep] = useState('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Configuration state
  const [config, setConfig] = useState({
    projectPath: '',
    testDirectory: 'tests/e2e',
    framework: 'playwright', // playwright, playwright-ct (component testing)
    language: 'typescript', // javascript, typescript
    testRunner: 'playwright-test', // playwright-test, jest, mocha
    browsers: ['chromium', 'firefox', 'webkit'],
    baseUrl: '',
    usePageObjects: true,
    generateMocks: true,
    enableTracing: true,
    enableScreenshots: true,
    enableVideo: false,
    selfHealing: true,
    parallelExecution: true,
    retryCount: 2
  });

  // Pattern learning state
  const [patterns, setPatterns] = useState(null);
  const [learningProgress, setLearningProgress] = useState(0);
  
  // Generated test state
  const [generatedTests, setGeneratedTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(0);
  
  // Repository validation
  const [repoValidation, setRepoValidation] = useState({
    isValid: false,
    hasPlaywright: false,
    hasPackageJson: false,
    existingTests: 0,
    playwrightVersion: null
  });

  const steps = [
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'learn', label: 'Pattern Learning', icon: Zap },
    { id: 'generate', label: 'Generate Tests', icon: FileCode },
    { id: 'review', label: 'Review & Enhance', icon: Shield },
    { id: 'save', label: 'Save & Execute', icon: PlayCircle }
  ];

  // Validate project path
  const validateProjectPath = async () => {
    if (!config.projectPath) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/playwright/validate`, {
        repoPath: config.projectPath
      });
      
      const data = response.data;
      setRepoValidation({
        isValid: data.valid,
        hasPlaywright: data.type === 'playwright',
        hasPackageJson: data.type === 'javascript' || data.type === 'playwright',
        existingTests: 0,
        playwrightVersion: null
      });
      
      if (data.type === 'playwright') {
        // Auto-detect configuration from existing setup
        setConfig(prev => ({
          ...prev,
          ...data.detectedConfig
        }));
      }
    } catch (err) {
      console.error('Validation error:', err);
      setError('Failed to validate repository path');
    } finally {
      setLoading(false);
    }
  };

  // Learn patterns from existing tests
  const learnPatterns = async () => {
    setLoading(true);
    setLearningProgress(0);
    
    try {
      const response = await axios.post(`${API_URL}/api/playwright/learn-patterns`, {
        repoPath: config.projectPath,
        testDirectory: config.testDirectory
      });
      
      const data = response.data;
      if (data.patterns) {
        setPatterns(data.patterns);
        setLearningProgress(100);
      }
      
      setCurrentStep('generate');
    } catch (err) {
      setError('Failed to learn patterns: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate Playwright tests
  const generateTests = async () => {
    setLoading(true);
    
    try {
      // Generate test for each reviewed test
      const tests = [];
      for (const manualTest of reviewedTests) {
        const response = await axios.post(`${API_URL}/api/playwright/generate`, {
          manualTest,
          repoPath: config.projectPath,
          testDirectory: config.testDirectory,
          options: {
            framework: config.framework,
            language: config.language,
            usePageObjects: config.usePageObjects,
            browsers: config.browsers,
            selfHealing: config.selfHealing,
            generateMocks: config.generateMocks
          }
        });
        
        if (response.data.test) {
          tests.push(response.data.test);
        }
      }
      
      setGeneratedTests(tests);
      setCurrentStep('review');
    } catch (err) {
      setError('Failed to generate tests: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enhance tests with AI
  const enhanceTests = async () => {
    setLoading(true);
    
    try {
      // For now, enhancement is done during generation
      // This could be expanded to use AI for test improvements
      console.log('Enhancing tests with patterns:', patterns);
      setCurrentStep('save');
    } catch (err) {
      console.error('Enhancement error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save and optionally execute tests
  const saveTests = async () => {
    setLoading(true);
    
    try {
      // Save each generated test
      const savedPaths = [];
      let branch = null;
      
      for (const test of generatedTests) {
        const response = await axios.post(`${API_URL}/api/playwright/save`, {
          repoPath: config.projectPath,
          testDirectory: config.testDirectory,
          generatedTest: test,
          createBranch: !branch, // Only create branch for first test
          ticketId: ticket?.key,
          openInIDE: false
        });
        
        if (response.data.success) {
          savedPaths.push(response.data.path);
          if (response.data.branch) {
            branch = response.data.branch;
          }
        }
      }
      
      const result = { success: savedPaths.length > 0, paths: savedPaths, branch };
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onComplete({
            tests: generatedTests,
            savedPaths: result.paths,
            branch: result.branch
          });
        }, 2000);
      }
    } catch (err) {
      setError('Failed to save tests: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isActive ? 'bg-blue-600 text-white' : 
                  isCompleted ? 'bg-green-600 text-white' : 
                  'bg-gray-200 text-gray-500'}
              `}>
                {isCompleted && !isActive ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </div>
              <span className={`mt-2 text-sm ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="text-gray-300" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderConfiguration = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Playwright Test Configuration</h3>
        
        {/* Project Path */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Project Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.projectPath}
              onChange={(e) => setConfig({...config, projectPath: e.target.value})}
              onBlur={validateProjectPath}
              className="flex-1 px-3 py-2 border rounded-md"
              placeholder="/path/to/your/project"
            />
            <button
              onClick={validateProjectPath}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={loading}
            >
              <Folder className="w-5 h-5" />
            </button>
          </div>
          
          {repoValidation.isValid && (
            <div className="mt-2 text-sm">
              {repoValidation.hasPlaywright ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Playwright detected (v{repoValidation.playwrightVersion})
                </span>
              ) : (
                <span className="text-yellow-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Playwright not installed - will add to project
                </span>
              )}
            </div>
          )}
          
          {/* Help text */}
          {pathType === 'local' && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Use the full path to your local Playwright project directory
            </p>
          )}
          {pathType === 'github' && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ GitHub URL support coming soon. Please clone the repository locally for now.
            </p>
          )}
        </div>

        {/* Test Directory */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Test Directory</label>
          <input
            type="text"
            value={config.testDirectory}
            onChange={(e) => setConfig({...config, testDirectory: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="tests/e2e"
          />
        </div>

        {/* Language Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Language</label>
          <select
            value={config.language}
            onChange={(e) => setConfig({...config, language: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>

        {/* Base URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Base URL</label>
          <input
            type="url"
            value={config.baseUrl}
            onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="https://your-app.com"
          />
        </div>

        {/* Browser Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Target Browsers</label>
          <div className="flex gap-4">
            {['chromium', 'firefox', 'webkit'].map(browser => (
              <label key={browser} className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.browsers.includes(browser)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setConfig({...config, browsers: [...config.browsers, browser]});
                    } else {
                      setConfig({...config, browsers: config.browsers.filter(b => b !== browser)});
                    }
                  }}
                  className="mr-2"
                />
                <span className="capitalize">{browser}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Advanced Options */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Advanced Options</h4>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.usePageObjects}
                onChange={(e) => setConfig({...config, usePageObjects: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Use Page Object Model</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.selfHealing}
                onChange={(e) => setConfig({...config, selfHealing: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Enable Self-Healing Selectors</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.generateMocks}
                onChange={(e) => setConfig({...config, generateMocks: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Generate API Mocks</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableTracing}
                onChange={(e) => setConfig({...config, enableTracing: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Enable Tracing</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableScreenshots}
                onChange={(e) => setConfig({...config, enableScreenshots: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Capture Screenshots</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.parallelExecution}
                onChange={(e) => setConfig({...config, parallelExecution: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Parallel Execution</span>
            </label>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Retry Count</label>
            <input
              type="number"
              min="0"
              max="5"
              value={config.retryCount}
              onChange={(e) => setConfig({...config, retryCount: parseInt(e.target.value)})}
              className="w-24 px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Skip
          </button>
          <button
            onClick={() => setCurrentStep('learn')}
            disabled={!config.projectPath || !repoValidation.isValid}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatternLearning = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Learning Test Patterns</h3>
      
      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Analyzing existing tests...</span>
            <span className="text-sm font-medium">{learningProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${learningProgress}%` }}
            />
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${learningProgress > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                Scanning test directory
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${learningProgress > 25 ? 'bg-green-500' : 'bg-gray-300'}`} />
                Parsing test files with AST
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${learningProgress > 50 ? 'bg-green-500' : 'bg-gray-300'}`} />
                Extracting patterns and best practices
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${learningProgress > 75 ? 'bg-green-500' : 'bg-gray-300'}`} />
                Building pattern model
              </div>
            </div>
          </div>
        </div>
      ) : patterns ? (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Pattern Learning Complete!</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Discovered Patterns</h4>
              <div className="space-y-1 text-sm">
                <div>Test files analyzed: {patterns.filesAnalyzed || 0}</div>
                <div>Page objects found: {patterns.pageObjects || 0}</div>
                <div>Custom commands: {patterns.customCommands || 0}</div>
                <div>Assertion patterns: {patterns.assertions || 0}</div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Test Conventions</h4>
              <div className="space-y-1 text-sm">
                <div>Naming convention: {patterns.namingConvention || 'describe-it'}</div>
                <div>Async handling: {patterns.asyncStyle || 'async/await'}</div>
                <div>Selector strategy: {patterns.selectorStrategy || 'data-testid'}</div>
                <div>Wait patterns: {patterns.waitStrategy || 'explicit'}</div>
              </div>
            </div>
          </div>
          
          {patterns.selectors && patterns.selectors.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Common Selectors</h4>
              <div className="flex flex-wrap gap-2">
                {patterns.selectors.slice(0, 10).map((selector, idx) => (
                  <span key={idx} className="px-2 py-1 bg-white rounded text-sm font-mono">
                    {selector}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep('config')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
            <button
              onClick={generateTests}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Generate Tests
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <button
            onClick={learnPatterns}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Start Pattern Learning
          </button>
        </div>
      )}
    </div>
  );

  const renderGeneratedTests = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Generated Playwright Tests</h3>
        <div className="flex gap-2">
          <button
            onClick={enhanceTests}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
            disabled={loading}
          >
            <Zap className="w-4 h-4" />
            Enhance with AI
          </button>
          <button
            onClick={() => setCurrentStep('save')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Proceed to Save
          </button>
        </div>
      </div>

      {generatedTests.length > 0 ? (
        <div className="grid grid-cols-4 gap-4">
          {/* Test List */}
          <div className="col-span-1 border-r pr-4">
            <h4 className="font-medium mb-3">Test Files</h4>
            <div className="space-y-2">
              {generatedTests.map((test, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTest(idx)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                    selectedTest === idx 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    <span>{test.filename}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {test.testCount} tests • {test.type}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Code Preview */}
          <div className="col-span-3">
            <div className="bg-gray-900 rounded-md overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2 bg-gray-800">
                <span className="text-sm text-gray-300">
                  {generatedTests[selectedTest]?.filename}
                </span>
                <div className="flex gap-2">
                  {config.selfHealing && (
                    <span className="text-xs px-2 py-1 bg-green-600 text-white rounded">
                      Self-Healing Enabled
                    </span>
                  )}
                  <button
                    className="text-gray-300 hover:text-white"
                    onClick={() => navigator.clipboard.writeText(generatedTests[selectedTest]?.code)}
                  >
                    <Code className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="max-h-[500px] overflow-auto">
                <SyntaxHighlighter
                  language={config.language === 'typescript' ? 'typescript' : 'javascript'}
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, fontSize: '13px' }}
                  showLineNumbers
                >
                  {generatedTests[selectedTest]?.code || ''}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* Test Features */}
            {generatedTests[selectedTest]?.features && (
              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <h4 className="font-medium mb-2">Test Features</h4>
                <div className="flex flex-wrap gap-2">
                  {generatedTests[selectedTest].features.map((feature, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-md">
          <TestTube className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Generating tests...</p>
        </div>
      )}
    </div>
  );

  const renderSaveAndExecute = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Save and Execute Tests</h3>
      
      {success ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Tests Saved Successfully!</h3>
          <p className="text-gray-600 mb-6">
            Your Playwright tests have been generated and saved to the project
          </p>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Branch created: <span className="font-mono">feature/playwright-tests-{ticket.key}</span>
            </p>
            <p className="text-sm text-gray-600">
              Tests saved to: <span className="font-mono">{config.testDirectory}/</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 p-6 rounded-md">
            <h4 className="font-medium mb-4">Save Options</h4>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Create Git Branch</span>
                  <p className="text-sm text-gray-600">
                    Create branch: feature/playwright-tests-{ticket.key}
                  </p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.usePageObjects}
                  disabled
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Generate Page Objects</span>
                  <p className="text-sm text-gray-600">
                    Create reusable page object files
                  </p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => {}}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Run Tests After Saving</span>
                  <p className="text-sm text-gray-600">
                    Execute tests immediately to verify they work
                  </p>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Update Configuration Files</span>
                  <p className="text-sm text-gray-600">
                    Update playwright.config.ts with test settings
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium mb-2">Files to be created:</h4>
            <ul className="text-sm space-y-1">
              {generatedTests.map((test, idx) => (
                <li key={idx} className="font-mono text-gray-700">
                  {config.testDirectory}/{test.filename}
                </li>
              ))}
              {config.usePageObjects && (
                <li className="font-mono text-gray-700">
                  {config.testDirectory}/pages/*.page.ts
                </li>
              )}
            </ul>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('review')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
            <button
              onClick={saveTests}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Tests'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {renderStepIndicator()}
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {currentStep === 'config' && renderConfiguration()}
        {currentStep === 'learn' && renderPatternLearning()}
        {currentStep === 'generate' && loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Generating Playwright tests...</p>
          </div>
        )}
        {currentStep === 'review' && renderGeneratedTests()}
        {currentStep === 'save' && renderSaveAndExecute()}
      </div>
    </div>
  );
};

export default PlaywrightGenerator;