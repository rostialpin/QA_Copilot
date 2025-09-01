import { api } from './api';

export const jiraApi = {
  getBoards: async () => {
    const response = await api.get('/api/jira/boards');
    return response.data;
  },
  searchProjects: async (query) => {
    const response = await api.get(`/api/jira/projects/search?query=${encodeURIComponent(query)}`);
    return response.data;
  },
  getCurrentSprint: async (boardId) => {
    const response = await api.get(`/api/jira/current-sprint/${boardId}`);
    return response.data;
  },
  getSprintIssues: async (sprintId) => {
    const response = await api.get(`/api/jira/sprint/${sprintId}/issues`);
    return response.data;
  },
  getProjectIssues: async (projectKey) => {
    const response = await api.get(`/api/jira/project/${projectKey}/issues`);
    return response.data;
  }
};
