import { api } from './api';

export const cypressApi = {
  generateCypressTest: async (testCase, options = {}) => {
    const response = await api.post('/api/cypress/generate-test', {
      ...testCase,
      ...options
    });
    return response.data;
  },
  
  getTemplates: async () => {
    const response = await api.get('/api/cypress/templates');
    return response.data;
  },
  
  analyzeExisting: async (projectPath) => {
    const response = await api.post('/api/cypress/analyze-existing', {
      projectPath
    });
    return response.data;
  }
};
