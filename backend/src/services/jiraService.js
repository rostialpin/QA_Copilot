import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';
import { MockJiraService } from './mockJiraService.js';
import { parseJiraUrl, validateJiraConfig } from '../utils/jiraUtils.js';

export class JiraService {
  static async createWithConfig(config) {
    const validation = validateJiraConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid JIRA configuration: ${validation.errors.join(', ')}`);
    }
    
    const service = new JiraService(config);
    return service;
  }

  constructor(config = null) {
    // Check if we should use mock mode
    this.useMock = process.env.USE_MOCK_JIRA === 'true' || process.env.NODE_ENV === 'demo';
    
    // Remove debug logging
    
    if (this.useMock) {
      logger.info('🎭 Using Mock JIRA Service');
      this.mockService = new MockJiraService();
      return;
    }

    this.cache = new NodeCache({ stdTTL: 300 });
    
    if (config) {
      // Use provided configuration (from frontend)
      this.baseURL = parseJiraUrl(config.host);
      this.email = config.email;
      this.apiToken = config.apiToken;
    } else {
      // Use environment variables from ~/.zshrc
      this.baseURL = process.env.ATLASSIAN_URL || process.env.JIRA_HOST;
      this.email = process.env.ATLASSIAN_EMAIL || process.env.JIRA_EMAIL;
      this.apiToken = process.env.ATLASSIAN_TOKEN || process.env.JIRA_API_TOKEN;
      
      // Clean up the base URL (remove trailing slash if present)
      if (this.baseURL && this.baseURL.endsWith('/')) {
        this.baseURL = this.baseURL.slice(0, -1);
      }
    }
    
    // Log configuration status
    if (this.baseURL && this.email && this.apiToken) {
      logger.info(`JIRA configured for ${this.baseURL}`);
      if (!config) {
        // Only auto-test connection for environment-based config
        this.testConnection().catch(err => {
          logger.error('JIRA authentication failed, switching to mock mode');
          this.useMock = true;
          this.mockService = new MockJiraService();
        });
      }
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
      
      // Remove debug logging for production
      
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
        logger.error(`Authentication failed (${error.response.status})`);
        // Detailed error logging removed for cleaner output
        logger.info('💡 Tip: For Okta/SSO, try using your personal API token instead of service account');
        // Only switch to mock if we haven't been explicitly configured
        if (!this.baseURL || !this.email || !this.apiToken) {
          logger.info('No credentials provided, switching to mock mode');
          this.useMock = true;
          this.mockService = new MockJiraService();
          return this.mockService.makeRequest(endpoint, method, data);
        }
        // If we have credentials, throw the error so user knows auth failed
        throw new Error(`JIRA authentication failed: ${error.response.status} ${error.response.statusText}`);
      }
      throw error;
    }
  }

  async testConnection() {
    // Don't use mock for testing - we want to know if real auth works
    if (this.useMock && !this.baseURL) {
      return this.mockService.testConnection();
    }

    try {
      // Create Basic Auth token
      const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      
      const url = `${this.baseURL}/rest/api/2/myself`;
      
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ JIRA connection successful!');
      logger.info(`Connected as: ${response.data.displayName} (${response.data.emailAddress})`);
      this.useMock = false; // Connection successful, don't use mock
      return true;
    } catch (error) {
      if (error.response?.status === 403) {
        logger.error('❌ JIRA authentication failed: 403 Forbidden');
        logger.info('💡 Possible causes:');
        logger.info('   1. Invalid API token - regenerate at https://id.atlassian.com/manage-profile/security/api-tokens');
        logger.info('   2. For SSO/Okta: Use your personal Atlassian account, not corporate SSO account');
        logger.info('   3. Email doesn\'t match the API token owner');
        throw new Error('Authentication failed: Invalid credentials or insufficient permissions');
      } else if (error.response?.status === 401) {
        logger.error('❌ JIRA authentication failed: 401 Unauthorized');
        throw new Error('Authentication failed: Invalid API token or email');
      } else {
        logger.error('JIRA connection test failed:', error.message);
        throw error;
      }
    }
  }

  // Known board mappings for BETplus projects
  getBoardMapping() {
    return {
      'ESR': 3860,    // BETplus Roku
      'ESW': 2892,    // BETplus Web
      'ESWCTV': 3859  // BETplus WCTV
    };
  }

  async searchProjects(query = '') {
    if (this.useMock) {
      const mockProjects = await this.mockService.getBoards();
      if (!query) return mockProjects;
      
      const lowerQuery = query.toLowerCase();
      return mockProjects.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.key.toLowerCase().includes(lowerQuery)
      );
    }

    try {
      logger.info(`Searching for projects with query: "${query}"`);
      
      const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      // Use the query parameter to search for specific projects
      const url = query 
        ? `${this.baseURL}/rest/api/2/project/search?query=${encodeURIComponent(query)}&maxResults=100`
        : `${this.baseURL}/rest/api/2/project/search?maxResults=100`;
      
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      if (data.values && data.values.length > 0) {
        const boardMapping = this.getBoardMapping();
        const projects = data.values.map(project => ({
          id: boardMapping[project.key] || parseInt(project.id), // Use board ID if we have it
          name: project.name,
          key: project.key,
          type: project.projectTypeKey || 'software',
          projectCategory: project.projectCategory?.name || 'Uncategorized',
          boardId: boardMapping[project.key] // Add board ID for known projects
        }));
        
        logger.info(`Found ${projects.length} projects matching "${query}"`);
        return projects;
      }
      
      logger.info('No projects found matching the search query');
      return [];
      
    } catch (error) {
      logger.error('Error searching projects:', error.message);
      if (error.response) {
        logger.error(`Response status: ${error.response.status} ${error.response.statusText}`);
      }
      return [];
    }
  }

  async getBoards() {
    if (this.useMock) {
      return this.mockService.getBoards();
    }

    try {
      // Try the project search API first (works with service account)
      logger.info('Fetching projects via project search API');
      
      const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      // Get all projects - increase maxResults to fetch all available projects
      const url = `${this.baseURL}/rest/api/2/project/search?maxResults=1000`;
      
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      // Check if we got projects from the project search API
      if (data.values && data.values.length > 0) {
        const boardMapping = this.getBoardMapping();
        const projects = data.values.map(project => ({
          id: boardMapping[project.key] || parseInt(project.id), // Use board ID if we have it
          name: project.name,
          key: project.key,
          type: project.projectTypeKey || 'software',
          projectCategory: project.projectCategory?.name || 'Uncategorized',
          boardId: boardMapping[project.key] // Add board ID for known projects
        }));
        
        logger.info(`Found ${projects.length} projects (total available: ${data.total})`);
        if (data.total > projects.length) {
          logger.warn(`Only retrieved ${projects.length} out of ${data.total} available projects. Consider pagination if needed.`);
        }
        return projects;
      }
      
      // Fallback: discover projects via recent issues if project search returns empty
      logger.info('No projects from search API, falling back to issue discovery');
      const jql = 'created >= -30d';
      const searchUrl = `${this.baseURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=project`;
      
      const searchResponse = await axios({
        method: 'GET',
        url: searchUrl,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const searchData = searchResponse.data;
      const projectsMap = new Map();
      
      if (searchData.issues && searchData.issues.length > 0) {
        searchData.issues.forEach(issue => {
          const project = issue.fields.project;
          if (project && !projectsMap.has(project.id)) {
            projectsMap.set(project.id, {
              id: parseInt(project.id),
              name: project.name,
              key: project.key,
              type: project.projectTypeKey || 'software',
              projectCategory: project.projectCategory?.name || 'Uncategorized'
            });
          }
        });
      }
      
      const projects = Array.from(projectsMap.values());
      logger.info(`Discovered ${projects.length} projects via issue search`);
      return projects;
    } catch (error) {
      logger.error('Error discovering projects:', error.message);
      if (error.response) {
        logger.error(`Response status: ${error.response.status} ${error.response.statusText}`);
        logger.error('Request URL:', error.config?.url);
        const dataStr = JSON.stringify(error.response.data);
        logger.error('Response data:', dataStr.substring(0, 500));
      }
      
      // Initialize mock service if not already done
      if (!this.mockService) {
        this.mockService = new MockJiraService();
      }
      
      logger.warn('Failed to discover projects, using mock data');
      return this.mockService.getBoards();
    }
  }

  async getCurrentSprint(boardId) {
    if (this.useMock) {
      return this.mockService.getCurrentSprint(boardId);
    }

    try {
      const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      
      // If boardId is one of our known board IDs, use Agile API directly
      const boardMapping = this.getBoardMapping();
      const knownBoardIds = Object.values(boardMapping);
      
      if (knownBoardIds.includes(parseInt(boardId))) {
        logger.info(`Using Agile API for board ${boardId}`);
        const url = `${this.baseURL}/rest/agile/1.0/board/${boardId}/sprint?state=active`;
        
        try {
          const response = await axios({
            method: 'GET',
            url,
            headers: {
              'Authorization': `Basic ${authString}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data.values && response.data.values.length > 0) {
            const sprint = response.data.values[0];
            logger.info(`Found active sprint: ${sprint.name} (ID: ${sprint.id})`);
            return {
              id: sprint.id,
              name: sprint.name,
              state: sprint.state,
              startDate: sprint.startDate,
              endDate: sprint.endDate
            };
          } else {
            logger.info(`No active sprints for board ${boardId}`);
            return null;
          }
        } catch (agileError) {
          logger.error(`Agile API error for board ${boardId}:`, agileError.message);
          // Fall through to JQL method
        }
      }
      
      // Fallback: use JQL method
      logger.info(`Using JQL method for project/board ${boardId}`);
      
      // First, get the project key by searching for any recent issue from this project
      let projectKey;
      try {
        const projectUrl = `${this.baseURL}/rest/api/2/search?jql=project=${projectId}&maxResults=1&fields=project`;
        const projectResponse = await axios({
          method: 'GET',
          url: projectUrl,
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (projectResponse.data.issues && projectResponse.data.issues.length > 0) {
          projectKey = projectResponse.data.issues[0].fields.project.key;
        } else {
          logger.warn(`No issues found for project ${projectId}`);
          return null;
        }
      } catch (error) {
        logger.error(`Error fetching project key for ${projectId}:`, error.message);
        return null;
      }
      
      // Search for issues in active sprints for this project
      const jql = `project = "${projectKey}" AND sprint in openSprints() ORDER BY created DESC`;
      const url = `${this.baseURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=1&fields=sprint,customfield_10020`;
      
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const searchData = response.data;
      
      if (searchData.issues && searchData.issues.length > 0) {
        // Extract sprint information from the first issue
        const issue = searchData.issues[0];
        const sprintField = issue.fields.customfield_10020 || issue.fields.sprint; // Common sprint custom fields
        
        if (sprintField && sprintField.length > 0) {
          const activeSprint = sprintField.find(sprint => sprint.state === 'ACTIVE');
          if (activeSprint) {
            return {
              id: activeSprint.id,
              name: activeSprint.name,
              state: 'active',
              startDate: activeSprint.startDate,
              endDate: activeSprint.endDate,
              projectId: projectId
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to get current sprint, using mock data');
      return this.mockService ? this.mockService.getCurrentSprint(projectId) : null;
    }
  }

  async getSprintIssues(sprintId) {
    if (this.useMock) {
      return this.mockService.getSprintIssues(sprintId);
    }

    try {
      // Use direct axios since makeRequest has issues
      const authString = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      
      // Use JQL to find issues in the specific sprint
      const jql = `sprint = ${sprintId} ORDER BY created DESC`;
      const url = `${this.baseURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=100`;
      
      const response = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      return data.issues?.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description,
        type: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        acceptanceCriteria: issue.fields.customfield_10001 || issue.fields.customfield_10004 // Different orgs use different fields
      })) || [];
    } catch (error) {
      logger.warn('Failed to get sprint issues, using mock data');
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
