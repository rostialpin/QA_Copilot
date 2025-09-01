import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Helper function to get JIRA config from localStorage
function getJiraConfig() {
  try {
    const savedConfig = localStorage.getItem('apiConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      return config.jira;
    }
  } catch (error) {
    console.warn('Failed to load JIRA config from localStorage:', error);
  }
  return null;
}

// Request interceptor to add JIRA config headers
api.interceptors.request.use(
  config => {
    // Add JIRA config headers if available and the request is to a JIRA endpoint
    if (config.url && config.url.includes('/api/jira/')) {
      const jiraConfig = getJiraConfig();
      if (jiraConfig && jiraConfig.host && jiraConfig.email && jiraConfig.apiToken) {
        config.headers['X-JIRA-Host'] = jiraConfig.host;
        config.headers['X-JIRA-Email'] = jiraConfig.email;
        config.headers['X-JIRA-Token'] = jiraConfig.apiToken;
      }
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
