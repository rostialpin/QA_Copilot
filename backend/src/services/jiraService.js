import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';
import { MockJiraService } from './mockJiraService.js';

export class JiraService {
  constructor() {
    // Check if we should use mock mode
    this.useMock = process.env.USE_MOCK_JIRA === 'true' || process.env.NODE_ENV === 'demo';
    
    if (this.useMock) {
      logger.info('🎭 Using Mock JIRA Service');
      this.mockService = new MockJiraService();
      return;
    }

    // Use environment variables from ~/.zshrc
    this.baseURL = process.env.ATLASSIAN_URL || process.env.JIRA_HOST;
    this.email = process.env.ATLASSIAN_EMAIL || process.env.JIRA_EMAIL;
    this.apiToken = process.env.ATLASSIAN_TOKEN || process.env.JIRA_API_TOKEN;
    this.cache = new NodeCache({ stdTTL: 300 });
    
    // Clean up the base URL (remove trailing slash if present)
    if (this.baseURL && this.baseURL.endsWith('/')) {
      this.baseURL = this.baseURL.slice(0, -1);
    }
    
    // Log configuration status
    if (this.baseURL && this.email && this.apiToken) {
      logger.info(`JIRA configured for ${this.baseURL}`);
      this.testConnection().catch(err => {
        logger.error('JIRA authentication failed, switching to mock mode');
        this.useMock = true;
        this.mockService = new MockJiraService();
      });
    } else {
      logger.warn('JIRA credentials not found, using mock mode');
      this.useMock = true;
      this.mockService = new MockJiraService();
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    if (this.useMock) {
      return this.mockService.makeRequest(endpoint, method, data);
    }

    if (!this.baseURL || !this.email || !this.apiToken) {
      logger.warn('JIRA not configured, using mock data');
      this.useMock = true;
      this.mockService = new MockJiraService();
      return this.mockService.makeRequest(endpoint, method, data);
    }

    const cacheKey = `${method}:${endpoint}`;
    
    if (method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    try {
      // Create Basic Auth token
      const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      
      const url = `${this.baseURL}${endpoint}`;
      
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (method === 'GET') {
        this.cache.set(cacheKey, response.data);
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 401) {
        logger.error(`Authentication failed (${error.response.status}), switching to mock mode`);
        logger.info('💡 Tip: For Okta/SSO, try using your personal API token instead of service account');
        this.useMock = true;
        this.mockService = new MockJiraService();
        return this.mockService.makeRequest(endpoint, method, data);
      }
      throw error;
    }
  }

  async testConnection() {
    if (this.useMock) {
      return this.mockService.testConnection();
    }

    try {
      const response = await this.makeRequest('/rest/api/2/myself');
      logger.info('✅ JIRA connection successful!');
      logger.info(`Connected as: ${response.displayName} (${response.emailAddress})`);
      return true;
    } catch (error) {
      logger.error('❌ JIRA connection failed, using mock mode for demo');
      return false;
    }
  }

  async getBoards() {
    if (this.useMock) {
      return this.mockService.getBoards();
    }

    try {
      const data = await this.makeRequest('/rest/agile/1.0/board');
      return data.values || [];
    } catch (error) {
      logger.warn('Failed to get boards, using mock data');
      return this.mockService ? this.mockService.getBoards() : [];
    }
  }

  async getCurrentSprint(boardId) {
    if (this.useMock) {
      return this.mockService.getCurrentSprint(boardId);
    }

    try {
      const data = await this.makeRequest(`/rest/agile/1.0/board/${boardId}/sprint`);
      const activeSprint = data.values?.find(sprint => sprint.state === 'active');
      return activeSprint || null;
    } catch (error) {
      logger.warn('Failed to get sprint, using mock data');
      return this.mockService ? this.mockService.getCurrentSprint(boardId) : null;
    }
  }

  async getSprintIssues(sprintId) {
    if (this.useMock) {
      return this.mockService.getSprintIssues(sprintId);
    }

    try {
      const data = await this.makeRequest(`/rest/agile/1.0/sprint/${sprintId}/issue`);
      return data.issues?.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description,
        type: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        acceptanceCriteria: issue.fields.customfield_10001
      })) || [];
    } catch (error) {
      logger.warn('Failed to get issues, using mock data');
      return this.mockService ? this.mockService.getSprintIssues(sprintId) : [];
    }
  }

  async getIssue(issueKey) {
    if (this.useMock) {
      return this.mockService.getIssue(issueKey);
    }

    try {
      return await this.makeRequest(`/rest/api/2/issue/${issueKey}`);
    } catch (error) {
      return this.mockService ? this.mockService.getIssue(issueKey) : null;
    }
  }
  
  async searchIssues(jql = 'project != null ORDER BY created DESC', maxResults = 50) {
    if (this.useMock) {
      return this.mockService.searchIssues(jql, maxResults);
    }

    try {
      const data = await this.makeRequest(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
      return data.issues || [];
    } catch (error) {
      logger.error('Failed to search issues, using mock data');
      return this.mockService ? this.mockService.searchIssues(jql, maxResults) : [];
    }
  }
}
