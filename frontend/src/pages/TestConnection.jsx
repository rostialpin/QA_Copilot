import { useState } from 'react';
import axios from 'axios';

export default function TestConnection() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const testResults = {};

    // Test 1: Direct fetch to health endpoint
    try {
      const healthResponse = await fetch('http://localhost:3001/health');
      const healthData = await healthResponse.json();
      testResults.health = { success: true, data: healthData };
    } catch (error) {
      testResults.health = { success: false, error: error.message };
    }

    // Test 2: Axios to health endpoint
    try {
      const axiosResponse = await axios.get('http://localhost:3001/health');
      testResults.axios = { success: true, data: axiosResponse.data };
    } catch (error) {
      testResults.axios = { success: false, error: error.message };
    }

    // Test 3: API service to boards
    try {
      const boardsResponse = await axios.get('http://localhost:3001/api/jira/boards');
      testResults.boards = { success: true, data: boardsResponse.data };
    } catch (error) {
      testResults.boards = { success: false, error: error.message };
    }

    // Test 4: Mock data endpoint
    try {
      const mockResponse = await axios.get('http://localhost:3001/api/test-mock');
      testResults.mock = { success: true, data: mockResponse.data };
    } catch (error) {
      testResults.mock = { success: false, error: error.message };
    }

    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API Connection Test</h1>
      
      <button
        onClick={runTests}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Running Tests...' : 'Run Connection Tests'}
      </button>

      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-bold">Environment:</h3>
          <p>API URL: {import.meta.env.VITE_API_URL || 'http://localhost:3001'}</p>
          <p>Mode: {import.meta.env.MODE}</p>
        </div>

        {Object.entries(results).map(([test, result]) => (
          <div key={test} className={`p-4 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
            <h3 className="font-bold">{test.toUpperCase()} Test:</h3>
            <p>Status: {result.success ? '✅ Success' : '❌ Failed'}</p>
            {result.error && <p>Error: {result.error}</p>}
            {result.data && (
              <pre className="mt-2 text-xs overflow-auto bg-white p-2 rounded">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
