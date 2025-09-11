import { useState, useEffect } from 'react';
import { Bot, ChevronDown, Sparkles, Brain } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AIModelSelector({ onModelChange, className = '' }) {
  const [currentProvider, setCurrentProvider] = useState('gemini');
  const [currentModel, setCurrentModel] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetchAIStatus();
  }, []);

  const fetchAIStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ai/status`);
      setStatus(response.data);
      setCurrentProvider(response.data.currentProvider);
      setCurrentModel(response.data.currentModel);
      setAvailableModels(response.data.availableModels);
    } catch (error) {
      console.error('Error fetching AI status:', error);
    }
  };

  const handleProviderChange = async (provider) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/ai/provider`, { provider });
      setCurrentProvider(provider);
      setCurrentModel(response.data.currentModel);
      await fetchAIStatus();
      if (onModelChange) {
        onModelChange({ provider, model: response.data.currentModel });
      }
    } catch (error) {
      console.error('Error changing provider:', error);
    } finally {
      setIsLoading(false);
      setIsDropdownOpen(false);
    }
  };

  const handleModelChange = async (model) => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/ai/model`, { model });
      setCurrentModel(model);
      if (onModelChange) {
        onModelChange({ provider: currentProvider, model });
      }
    } catch (error) {
      console.error('Error changing model:', error);
    } finally {
      setIsLoading(false);
      setIsDropdownOpen(false);
    }
  };

  const getProviderIcon = (provider) => {
    if (provider === 'claude') {
      return <Brain className="w-4 h-4" />;
    }
    return <Sparkles className="w-4 h-4" />;
  };

  const getProviderName = (provider) => {
    if (provider === 'claude') {
      return 'Claude';
    }
    return 'Gemini';
  };

  const getModelDisplayName = (model) => {
    const modelNames = {
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'claude-opus-4-1-20250805': 'Claude Opus 4.1',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-haiku-20240307': 'Claude 3 Haiku'
    };
    return modelNames[model] || model;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <Bot className="w-4 h-4 text-gray-600" />
        <div className="flex items-center gap-2">
          {getProviderIcon(currentProvider)}
          <span className="text-sm font-medium">
            {currentModel ? getModelDisplayName(currentModel) : 'Select Model'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {/* Provider Selection */}
            <div className="mb-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                AI Provider
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleProviderChange('gemini')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-50 transition-colors ${
                    currentProvider === 'gemini' ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Gemini</div>
                    <div className="text-xs text-gray-500">Google AI</div>
                  </div>
                  {currentProvider === 'gemini' && (
                    <div className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Active
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => handleProviderChange('claude')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-50 transition-colors ${
                    currentProvider === 'claude' ? 'bg-purple-50 text-purple-700' : ''
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Claude</div>
                    <div className="text-xs text-gray-500">Anthropic AI</div>
                  </div>
                  {currentProvider === 'claude' && (
                    <div className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      Active
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            {/* Model Selection */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                Model
              </div>
              <div className="space-y-1">
                {availableModels.map((model) => (
                  <button
                    key={model}
                    onClick={() => handleModelChange(model)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left hover:bg-gray-50 transition-colors ${
                      currentModel === model ? 'bg-gray-100' : ''
                    }`}
                  >
                    <span className="text-sm">{getModelDisplayName(model)}</span>
                    {currentModel === model && (
                      <div className="text-xs text-gray-500">Current</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Information */}
            {status && !status.providers[currentProvider]?.available && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-xs text-yellow-700">
                  {currentProvider === 'claude' 
                    ? 'Claude API key not configured' 
                    : 'Gemini API key not configured'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}