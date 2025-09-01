import { JiraService } from '../services/jiraService.js';
import { logger } from '../utils/logger.js';
import { extractJiraConfigFromHeaders, validateJiraConfig } from '../utils/jiraUtils.js';

export class JiraController {
  constructor() {
    this.jiraService = new JiraService();
  }

  // Helper method to get JiraService instance from request
  async getJiraServiceForRequest(req) {
    // If environment variables are configured and working, prefer them
    if (this.jiraService && this.jiraService.baseURL && !this.jiraService.useMock) {
      logger.info('Using environment-configured JIRA service');
      return this.jiraService;
    }
    
    // Otherwise try headers from request
    const config = extractJiraConfigFromHeaders(req);
    if (config) {
      logger.info('Using JIRA config from request headers');
      return await JiraService.createWithConfig(config);
    }
    
    // Fall back to default service
    return this.jiraService;
  }

  async saveConfig(req, res, next) {
    try {
      const { host, email, apiToken } = req.body;
      
      const validation = validateJiraConfig({ host, email, apiToken });
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }

      // Test the configuration by creating a service instance
      try {
        const testService = await JiraService.createWithConfig({ host, email, apiToken });
        await testService.testConnection();
        
        res.json({
          success: true,
          message: 'JIRA configuration saved and tested successfully',
          baseUrl: testService.baseURL
        });
      } catch (testError) {
        res.status(401).json({
          success: false,
          message: 'JIRA configuration is invalid or connection failed',
          error: testError.message
        });
      }
    } catch (error) {
      logger.error('Error saving JIRA config:', error);
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const { host, email, apiToken } = req.body;
      
      const validation = validateJiraConfig({ host, email, apiToken });
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }

      const testService = await JiraService.createWithConfig({ host, email, apiToken });
      const result = await testService.testConnection();
      
      if (result) {
        res.json({
          success: true,
          message: 'JIRA connection successful',
          baseUrl: testService.baseURL
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'JIRA connection failed - please check your credentials'
        });
      }
    } catch (error) {
      logger.error('Error testing JIRA connection:', error);
      res.status(401).json({
        success: false,
        message: 'JIRA connection failed',
        error: error.message
      });
    }
  }

  async getBoards(req, res, next) {
    try {
      const jiraService = await this.getJiraServiceForRequest(req);
      const boards = await jiraService.getBoards();
      res.json(boards);
    } catch (error) {
      logger.error('Error fetching boards:', error);
      next(error);
    }
  }

  async searchProjects(req, res, next) {
    try {
      const { query = '' } = req.query;
      const jiraService = await this.getJiraServiceForRequest(req);
      const projects = await jiraService.searchProjects(query);
      res.json(projects);
    } catch (error) {
      logger.error('Error searching projects:', error);
      next(error);
    }
  }

  async getCurrentSprint(req, res, next) {
    try {
      const { boardId } = req.params;
      const jiraService = await this.getJiraServiceForRequest(req);
      const sprint = await jiraService.getCurrentSprint(boardId);
      res.json(sprint);
    } catch (error) {
      logger.error('Error fetching current sprint:', error);
      next(error);
    }
  }

  async getSprintIssues(req, res, next) {
    try {
      const { sprintId } = req.params;
      const jiraService = await this.getJiraServiceForRequest(req);
      const issues = await jiraService.getSprintIssues(sprintId);
      res.json(issues);
    } catch (error) {
      logger.error('Error fetching sprint issues:', error);
      next(error);
    }
  }

  async getProjectIssues(req, res, next) {
    try {
      const { projectKey } = req.params;
      const jiraService = await this.getJiraServiceForRequest(req);
      const issues = await jiraService.getRecentProjectIssues(projectKey);
      res.json(issues);
    } catch (error) {
      logger.error('Error fetching project issues:', error);
      next(error);
    }
  }


  async getIssue(req, res, next) {
    try {
      const { issueKey } = req.params;
      const jiraService = await this.getJiraServiceForRequest(req);
      const issue = await jiraService.getIssue(issueKey);
      res.json(issue);
    } catch (error) {
      logger.error('Error fetching issue:', error);
      next(error);
    }
  }
}
