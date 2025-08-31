import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Settings() {
  const [config, setConfig] = useState({
    jira: { host: '', email: '', apiToken: '' },
    gemini: { apiKey: '' }
  });

  const handleSave = () => {
    localStorage.setItem('apiConfig', JSON.stringify(config));
    toast.success('Settings saved!');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-medium mb-4">JIRA Configuration</h3>
        <div className="space-y-4">
          <input
            type="text"
            value={config.jira.host}
            onChange={(e) => setConfig({
              ...config,
              jira: {...config.jira, host: e.target.value}
            })}
            className="w-full rounded-md border-gray-300 shadow-sm"
            placeholder="https://your-domain.atlassian.net"
          />
          <input
            type="email"
            value={config.jira.email}
            onChange={(e) => setConfig({
              ...config,
              jira: {...config.jira, email: e.target.value}
            })}
            className="w-full rounded-md border-gray-300 shadow-sm"
            placeholder="your-email@company.com"
          />
          <input
            type="password"
            value={config.jira.apiToken}
            onChange={(e) => setConfig({
              ...config,
              jira: {...config.jira, apiToken: e.target.value}
            })}
            className="w-full rounded-md border-gray-300 shadow-sm"
            placeholder="JIRA API Token"
          />
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
