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
