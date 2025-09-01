import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';

export default function Settings() {
  const [config, setConfig] = useState({
    jira: { host: '', email: '', apiToken: '' },
    gemini: { apiKey: '' }
  });
  
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [currentModel, setCurrentModel] = useState('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState(false);
  const [jiraStatus, setJiraStatus] = useState({ testing: false, connected: false, error: null });

  const modelOptions = [
    {
      value: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Faster responses, cost-effective - Great for most test generation tasks'
    },
    {
      value: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro', 
      description: 'Higher quality, better reasoning - Best for complex test scenarios'
    }
  ];

  useEffect(() => {
    // Load saved settings
    const savedConfig = localStorage.getItem('apiConfig');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
    
    // Load current model from localStorage or use default
    const savedModel = localStorage.getItem('geminiModel') || 'gemini-2.5-flash';
    setSelectedModel(savedModel);
    setCurrentModel(savedModel);
    
    // Fetch current model from backend
    fetchCurrentModel();
  }, []);

  const fetchCurrentModel = async () => {
    try {
      const response = await api.get('/api/gemini/model');
      if (response.data.model) {
        setCurrentModel(response.data.model);
        setSelectedModel(response.data.model);
      }
    } catch (error) {
      console.log('Could not fetch current model, using default');
    }
  };

  const testJiraConnection = async () => {
    if (!config.jira.host || !config.jira.email || !config.jira.apiToken) {
      toast.error('Please fill in all JIRA fields before testing');
      return;
    }

    setJiraStatus({ testing: true, connected: false, error: null });
    
    try {
      const response = await api.post('/api/jira/test-connection', {
        host: config.jira.host,
        email: config.jira.email,
        apiToken: config.jira.apiToken
      });
      
      if (response.data.success) {
        setJiraStatus({ testing: false, connected: true, error: null });
        toast.success('JIRA connection successful!');
      } else {
        setJiraStatus({ testing: false, connected: false, error: response.data.message });
        toast.error(response.data.message || 'JIRA connection failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'JIRA connection failed';
      setJiraStatus({ testing: false, connected: false, error: errorMessage });
      toast.error(errorMessage);
    }
  };

  const handleSave = async () => {
    // Save to localStorage
    localStorage.setItem('apiConfig', JSON.stringify(config));
    
    // If JIRA config is provided, test it
    if (config.jira.host && config.jira.email && config.jira.apiToken) {
      try {
        await api.post('/api/jira/config', {
          host: config.jira.host,
          email: config.jira.email,
          apiToken: config.jira.apiToken
        });
        setJiraStatus({ testing: false, connected: true, error: null });
        toast.success('Settings saved and JIRA connection verified!');
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'JIRA configuration failed';
        setJiraStatus({ testing: false, connected: false, error: errorMessage });
        toast.error(`Settings saved but JIRA connection failed: ${errorMessage}`);
      }
    } else {
      toast.success('Settings saved!');
    }
  };

  const handleModelChange = async () => {
    if (selectedModel === currentModel) {
      toast.info('Model is already selected');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/gemini/model', { model: selectedModel });
      localStorage.setItem('geminiModel', selectedModel);
      setCurrentModel(selectedModel);
      toast.success(`Successfully switched to ${modelOptions.find(m => m.value === selectedModel)?.label}`);
    } catch (error) {
      console.error('Failed to update model:', error);
      toast.error('Failed to update model. Please try again.');
      setSelectedModel(currentModel); // Revert selection
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>
      
      {/* Gemini Model Selection */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-medium mb-4">AI Model Selection</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <h4 className="font-medium text-blue-900">Current Active Model</h4>
              <p className="text-sm text-blue-700">
                {modelOptions.find(m => m.value === currentModel)?.label || currentModel}
              </p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {modelOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-3">
            {modelOptions.map(option => (
              <div 
                key={option.value}
                className={`p-3 rounded-lg border ${
                  selectedModel === option.value 
                    ? 'border-indigo-300 bg-indigo-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className={`font-medium ${
                    selectedModel === option.value ? 'text-indigo-900' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </h4>
                  {currentModel === option.value && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 ${
                  selectedModel === option.value ? 'text-indigo-700' : 'text-gray-600'
                }`}>
                  {option.description}
                </p>
              </div>
            ))}
          </div>
          
          <button
            onClick={handleModelChange}
            disabled={isLoading || selectedModel === currentModel}
            className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
              isLoading || selectedModel === currentModel
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isLoading ? 'Switching Model...' : 'Switch Model'}
          </button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">JIRA Configuration</h3>
          {jiraStatus.connected && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Connected
            </span>
          )}
          {jiraStatus.error && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Error
            </span>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              JIRA URL (Board or Issue URL)
            </label>
            <input
              type="text"
              value={config.jira.host}
              onChange={(e) => {
                setConfig({
                  ...config,
                  jira: {...config.jira, host: e.target.value}
                });
                setJiraStatus({ testing: false, connected: false, error: null });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="https://your-domain.atlassian.net or board URL"
            />
            <p className="mt-1 text-sm text-gray-500">
              You can paste your JIRA board URL here - we'll extract the base URL automatically
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={config.jira.email}
              onChange={(e) => {
                setConfig({
                  ...config,
                  jira: {...config.jira, email: e.target.value}
                });
                setJiraStatus({ testing: false, connected: false, error: null });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="your-email@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token
            </label>
            <input
              type="password"
              value={config.jira.apiToken}
              onChange={(e) => {
                setConfig({
                  ...config,
                  jira: {...config.jira, apiToken: e.target.value}
                });
                setJiraStatus({ testing: false, connected: false, error: null });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="JIRA API Token"
            />
            <p className="mt-1 text-sm text-gray-500">
              Generate an API token from your Atlassian account settings
            </p>
          </div>
          
          {jiraStatus.error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{jiraStatus.error}</p>
            </div>
          )}
          
          <button
            onClick={testJiraConnection}
            disabled={jiraStatus.testing || !config.jira.host || !config.jira.email || !config.jira.apiToken}
            className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
              jiraStatus.testing || !config.jira.host || !config.jira.email || !config.jira.apiToken
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {jiraStatus.testing ? 'Testing Connection...' : 'Test JIRA Connection'}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-medium mb-4">Gemini API</h3>
        <input
          type="password"
          value={config.gemini.apiKey}
          onChange={(e) => setConfig({
            ...config,
            gemini: {...config.gemini, apiKey: e.target.value}
          })}
          className="w-full rounded-md border-gray-300 shadow-sm"
          placeholder="Gemini API Key"
        />
      </div>
      
      <button
        onClick={handleSave}
        className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
      >
        Save Settings
      </button>
    </div>
  );
}
