import React, { useState } from 'react';
import { 
  Globe, 
  Smartphone, 
  Tv, 
  Monitor,
  Target,
  Code,
  Eye,
  Save,
  RefreshCw,
  Check,
  X,
  Info,
  Download,
  Upload,
  Zap,
  Shield,
  Accessibility
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LocatorTraining = () => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('web');
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [locatorStrategies, setLocatorStrategies] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [trainedPatterns, setTrainedPatterns] = useState([]);
  const [testType, setTestType] = useState('functional');
  const [customName, setCustomName] = useState('');
  const [customTestId, setCustomTestId] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const platformIcons = {
    web: <Globe className="w-4 h-4" />,
    android: <Smartphone className="w-4 h-4" />,
    ios: <Smartphone className="w-4 h-4" />,
    roku: <Tv className="w-4 h-4" />,
    firetv: <Tv className="w-4 h-4" />,
    desktop: <Monitor className="w-4 h-4" />
  };

  const testTypeIcons = {
    functional: <Check className="w-4 h-4" />,
    performance: <Zap className="w-4 h-4" />,
    security: <Shield className="w-4 h-4" />,
    accessibility: <Accessibility className="w-4 h-4" />
  };

  const analyzeDOM = async () => {
    if (!url) {
      setError('Please enter a URL to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setElements([]);
    setSelectedElement(null);

    try {
      const response = await axios.post(`${API_URL}/api/dom-analyzer/analyze`, {
        url,
        platform,
        options: {
          captureScreenshot: true,
          extractInteractiveElements: true,
          generatePageObjects: true
        }
      });

      if (response.data) {
        setElements(response.data.elements || []);
        setScreenshot(response.data.screenshot);
        setSuccess('DOM analysis completed successfully');
      }
    } catch (error) {
      console.error('Error analyzing DOM:', error);
      setError(error.response?.data?.error || 'Failed to analyze DOM');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectElement = (element) => {
    setSelectedElement(element);
    generateLocatorStrategies(element);
  };

  const generateLocatorStrategies = (element) => {
    const strategies = [];

    if (element.attributes?.['data-testid']) {
      strategies.push({
        type: 'data-testid',
        value: `[data-testid="${element.attributes['data-testid']}"]`,
        priority: 1,
        confidence: 100
      });
    }

    if (element.attributes?.id) {
      strategies.push({
        type: 'id',
        value: `#${element.attributes.id}`,
        priority: 2,
        confidence: 95
      });
    }

    if (element.text) {
      strategies.push({
        type: 'text',
        value: `cy.contains('${element.text}')`,
        priority: 6,
        confidence: 70
      });
    }

    setLocatorStrategies(strategies.sort((a, b) => a.priority - b.priority));
  };

  const saveTrainedPattern = async () => {
    if (!selectedElement || !locatorStrategies.length) {
      setError('Please select an element first');
      return;
    }

    const pattern = {
      url,
      platform,
      element: {
        ...selectedElement,
        customName: customName || selectedElement.text || selectedElement.type,
        customTestId: customTestId
      },
      locatorStrategies,
      testType,
      timestamp: new Date().toISOString()
    };

    try {
      const response = await axios.post(`${API_URL}/api/pattern-learning/train`, {
        patterns: [pattern]
      });

      if (response.data) {
        setTrainedPatterns([...trainedPatterns, pattern]);
        setSuccess('Pattern saved successfully');
        setCustomName('');
        setCustomTestId('');
        setSelectedElement(null);
        setLocatorStrategies([]);
      }
    } catch (error) {
      console.error('Error saving pattern:', error);
      setError('Failed to save pattern');
    }
  };

  const exportPatterns = () => {
    const dataStr = JSON.stringify(trainedPatterns, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `locator-patterns-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Element Locator Training</h1>
        <p className="text-gray-600">Train the AI to better identify and locate elements in your application</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <X className="h-4 w-4 text-red-600 mr-2 mt-0.5" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
          <span className="text-green-800">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - URL Input and Analysis */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              DOM Analysis
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Application URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="web">Web</option>
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                    <option value="roku">Roku</option>
                    <option value="firetv">Fire TV</option>
                    <option value="desktop">Desktop</option>
                  </select>
                </div>
              </div>

              <button
                onClick={analyzeDOM}
                disabled={isAnalyzing}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing DOM...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Analyze DOM
                  </>
                )}
              </button>

              {screenshot && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Page Screenshot</h3>
                  <img 
                    src={`data:image/png;base64,${screenshot}`}
                    alt="Page screenshot"
                    className="w-full border rounded-lg"
                  />
                </div>
              )}

              {elements.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Interactive Elements ({elements.length})</h3>
                  <div className="max-h-96 overflow-y-auto border rounded-lg p-2 space-y-2">
                    {elements.map((element, index) => (
                      <div
                        key={index}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedElement === element 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => selectElement(element)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className="inline-block px-2 py-1 text-xs bg-gray-200 rounded">
                              {element.type}
                            </span>
                            {element.attributes?.id && (
                              <span className="inline-block ml-2 px-2 py-1 text-xs bg-blue-100 rounded">
                                #{element.attributes.id}
                              </span>
                            )}
                            {element.text && (
                              <p className="text-sm text-gray-600 mt-1">"{element.text}"</p>
                            )}
                          </div>
                          {selectedElement === element && (
                            <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Locator Training */}
        <div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code className="w-5 h-5" />
              Locator Training
            </h2>
            
            <div className="space-y-4">
              {selectedElement ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Selected Element
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="inline-block px-2 py-1 text-xs bg-gray-200 rounded">
                        {selectedElement.type}
                      </span>
                      {selectedElement.text && (
                        <p className="text-sm text-gray-600 mt-1">Text: "{selectedElement.text}"</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Element Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Login Button"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Test ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., login-submit-btn"
                      value={customTestId}
                      onChange={(e) => setCustomTestId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Test Type
                    </label>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="functional">Functional</option>
                      <option value="performance">Performance</option>
                      <option value="security">Security</option>
                      <option value="accessibility">Accessibility</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Locator Strategies
                    </label>
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {locatorStrategies.map((strategy, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{strategy.type}</span>
                            <span className="text-xs text-gray-500">
                              {strategy.confidence}% confidence
                            </span>
                          </div>
                          <code className="text-xs block mt-1 text-gray-700">
                            {strategy.value}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={saveTrainedPattern}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Pattern
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Analyze a page and select an element to train locators</p>
                </div>
              )}
            </div>
          </div>

          {/* Trained Patterns */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Trained Patterns
              </span>
              <span className="px-2 py-1 text-sm bg-gray-200 rounded">
                {trainedPatterns.length}
              </span>
            </h2>
            
            <div className="space-y-2">
              {trainedPatterns.length > 0 ? (
                <>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {trainedPatterns.map((pattern, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{pattern.element.customName}</span>
                          <span className="text-xs text-gray-500">{pattern.platform}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">{pattern.url}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={exportPatterns}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Patterns
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No patterns trained yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocatorTraining;