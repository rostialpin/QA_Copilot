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
