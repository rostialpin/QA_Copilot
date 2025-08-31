#!/bin/bash

# Navigate to project
cd "/Users/alpinro/Code Prjects/qa-copilot/qa-copilot"

echo "🚀 Creating all remaining frontend files..."

# Frontend Components
cat > frontend/src/components/Layout.jsx << 'EOF'
import { Outlet, NavLink } from 'react-router-dom';
import { 
  HomeIcon, 
  BeakerIcon, 
  CodeBracketIcon, 
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';

export default function Layout() {
  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Test Generator', href: '/test-generator', icon: BeakerIcon },
    { name: 'Cypress Generator', href: '/cypress-generator', icon: CodeBracketIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-indigo-600">🤖 QA Copilot</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-indigo-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5 mr-2" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
EOF

# Pages
cat > frontend/src/pages/Dashboard.jsx << 'EOF'
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jiraApi } from '../services/jiraApi';

export default function Dashboard() {
  const [selectedBoard, setSelectedBoard] = useState(null);

  const { data: boards, isLoading: boardsLoading } = useQuery({
    queryKey: ['boards'],
    queryFn: jiraApi.getBoards,
  });

  const { data: sprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['currentSprint', selectedBoard],
    queryFn: () => jiraApi.getCurrentSprint(selectedBoard),
    enabled: !!selectedBoard,
  });

  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ['sprintIssues', sprint?.id],
    queryFn: () => jiraApi.getSprintIssues(sprint.id),
    enabled: !!sprint?.id,
  });

  useEffect(() => {
    if (boards && boards.length > 0 && !selectedBoard) {
      setSelectedBoard(boards[0].id);
    }
  }, [boards, selectedBoard]);

  if (boardsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">Sprint Overview</h2>
        <p className="mt-1 text-sm text-gray-600">
          Current sprint status and test coverage
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700">
          Select Board
        </label>
        <select
          value={selectedBoard || ''}
          onChange={(e) => setSelectedBoard(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Select a board...</option>
          {boards?.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </div>

      {sprint && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">{sprint.name}</h3>
          <p className="text-sm text-gray-600">Status: {sprint.state}</p>
        </div>
      )}

      {issues && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Sprint Issues</h3>
            <div className="space-y-2">
              {issues.map((issue) => (
                <div key={issue.key} className="border p-3 rounded">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm">{issue.key}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {issue.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{issue.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

cat > frontend/src/pages/TestGenerator.jsx << 'EOF'
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { geminiApi } from '../services/geminiApi';

export default function TestGenerator() {
  const [ticket, setTicket] = useState({
    summary: '',
    description: '',
    type: 'Story'
  });
  const [testCases, setTestCases] = useState([]);

  const generateMutation = useMutation({
    mutationFn: () => geminiApi.generateTestCases(ticket),
    onSuccess: (data) => {
      setTestCases(data);
      toast.success('Test cases generated!');
    },
    onError: () => {
      toast.error('Failed to generate test cases');
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Test Case Generator</h2>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ticket Summary
            </label>
            <input
              type="text"
              value={ticket.summary}
              onChange={(e) => setTicket({...ticket, summary: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="e.g., User login functionality"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={ticket.description}
              onChange={(e) => setTicket({...ticket, description: e.target.value})}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Describe the feature or requirement..."
            />
          </div>
          
          <button
            onClick={() => generateMutation.mutate()}
            disabled={!ticket.summary || generateMutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Test Cases'}
          </button>
        </div>
      </div>

      {testCases.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-medium mb-4">Generated Test Cases</h3>
          {testCases.map((tc, index) => (
            <div key={index} className="border p-4 rounded mb-2">
              <h4 className="font-medium">{tc.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{tc.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

cat > frontend/src/pages/CypressGenerator.jsx << 'EOF'
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cypressApi } from '../services/cypressApi';

export default function CypressGenerator() {
  const [testCase, setTestCase] = useState({
    title: '',
    steps: [''],
    expectedResult: ''
  });
  const [generatedCode, setGeneratedCode] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => cypressApi.generateCypressTest(testCase),
    onSuccess: (data) => {
      setGeneratedCode(data.code || '');
      toast.success('Cypress test generated!');
    },
    onError: () => {
      toast.error('Failed to generate test');
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Cypress Test Generator</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-medium mb-4">Test Case Details</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Test title"
              value={testCase.title}
              onChange={(e) => setTestCase({...testCase, title: e.target.value})}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
            <textarea
              placeholder="Expected result"
              value={testCase.expectedResult}
              onChange={(e) => setTestCase({...testCase, expectedResult: e.target.value})}
              className="w-full rounded-md border-gray-300 shadow-sm"
              rows={3}
            />
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!testCase.title || generateMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Generate Cypress Test
            </button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-medium mb-4">Generated Code</h3>
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
            {generatedCode || 'Generated test will appear here...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
EOF

cat > frontend/src/pages/Settings.jsx << 'EOF'
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
EOF

# Services
cat > frontend/src/services/api.js << 'EOF'
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
EOF

cat > frontend/src/services/jiraApi.js << 'EOF'
import { api } from './api';

export const jiraApi = {
  getBoards: async () => {
    const response = await api.get('/api/jira/boards');
    return response.data;
  },
  getCurrentSprint: async (boardId) => {
    const response = await api.get(`/api/jira/current-sprint/${boardId}`);
    return response.data;
  },
  getSprintIssues: async (sprintId) => {
    const response = await api.get(`/api/jira/sprint/${sprintId}/issues`);
    return response.data;
  }
};
EOF

cat > frontend/src/services/testRailApi.js << 'EOF'
import { api } from './api';

export const testRailApi = {
  getProjects: async () => {
    const response = await api.get('/api/testrail/projects');
    return response.data;
  },
  createTestCase: async (testCaseData) => {
    const response = await api.post('/api/testrail/test-case', testCaseData);
    return response.data;
  }
};
EOF

cat > frontend/src/services/geminiApi.js << 'EOF'
import { api } from './api';

export const geminiApi = {
  generateTestCases: async (ticket, options = {}) => {
    const response = await api.post('/api/gemini/generate-test-cases', {
      ticket,
      options
    });
    return response.data;
  }
};
EOF

cat > frontend/src/services/cypressApi.js << 'EOF'
import { api } from './api';

export const cypressApi = {
  generateCypressTest: async (testCase, options = {}) => {
    const response = await api.post('/api/cypress/generate-test', {
      testCase,
      options
    });
    return response.data;
  }
};
EOF

cat > frontend/src/styles/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply antialiased;
  }
}
EOF

# Create a Cypress template
cat > cypress-templates/login-template.cy.js << 'EOF'
describe('User Authentication', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should login with valid credentials', () => {
    cy.get('[data-testid="email-input"]').type('user@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/dashboard');
  });
});
EOF

echo "✅ All files created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Install dependencies:"
echo "   cd /Users/alpinro/Code\\ Prjects/qa-copilot/qa-copilot"
echo "   npm install"
echo "   cd backend && npm install"
echo "   cd ../frontend && npm install"
echo ""
echo "2. Copy .env files:"
echo "   cp backend/.env.example backend/.env"
echo "   cp frontend/.env.example frontend/.env"
echo ""
echo "3. Add your API keys to backend/.env"
echo ""
echo "4. Start development:"
echo "   npm run dev"
