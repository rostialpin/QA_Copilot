import { api } from './api';

export const testRailApi = {
  getProjects: async () => {
    const response = await api.get('/api/testrail/projects');
    return response.data;
  },
  
  getSuites: async (projectId) => {
    const response = await api.get(`/api/testrail/suites/${projectId}`);
    return response.data;
  },
  
  getTestCases: async (suiteId) => {
    const response = await api.get(`/api/testrail/test-cases/${suiteId}`);
    return response.data;
  },
  
  createTestCase: async (testCaseData) => {
    const response = await api.post('/api/testrail/test-case', testCaseData);
    return response.data;
  },
  
  analyzeDuplicate: async (testCase, existingTestCases) => {
    const response = await api.post('/api/testrail/analyze-duplicate', {
      testCase,
      existingTestCases
    });
    return response.data;
  }
};
