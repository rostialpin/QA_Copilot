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

  async getResolvedTickets(req, res, next) {
    try {
      const { projectKey } = req.query;
      const { maxResults = 100 } = req.query;
      const jiraService = await this.getJiraServiceForRequest(req);
      const tickets = await jiraService.getResolvedTickets(projectKey, parseInt(maxResults));
      res.json(tickets);
    } catch (error) {
      logger.error('Error fetching resolved tickets:', error);
      next(error);
    }
  }

  async getSpecificTicket(req, res, next) {
    try {
      const { ticketKey } = req.params;
      const jiraService = await this.getJiraServiceForRequest(req);
      const ticket = await jiraService.getSpecificTicket(ticketKey);
      res.json(ticket);
    } catch (error) {
      logger.error('Error fetching specific ticket:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  async getActiveSprints(req, res, next) {
    try {
      const { boardId } = req.query;
      const jiraService = await this.getJiraServiceForRequest(req);
      const activeSprints = await jiraService.getActiveSprints(boardId);
      res.json({
        success: true,
        sprints: activeSprints,
        count: activeSprints.length
      });
    } catch (error) {
      logger.error('Error fetching active sprints:', error);
      next(error);
    }
  }

  async moveTicketToSprint(req, res, next) {
    try {
      const { ticketKey, sprintId } = req.body;
      
      if (!ticketKey || !sprintId) {
        return res.status(400).json({
          success: false,
          message: 'Both ticketKey and sprintId are required'
        });
      }
      
      const jiraService = await this.getJiraServiceForRequest(req);
      const result = await jiraService.moveTicketToSprint(ticketKey, sprintId);
      res.json({
        success: true,
        message: `Successfully moved ${ticketKey} to sprint ${sprintId}`,
        ...result
      });
    } catch (error) {
      logger.error('Error moving ticket to sprint:', error);
      next(error);
    }
  }

  async getBoards(req, res, next) {
    try {
      const { projectKey } = req.query;
      const jiraService = await this.getJiraServiceForRequest(req);
      const boards = await jiraService.getBoards(projectKey);
      res.json({
        success: true,
        boards,
        count: boards.length
      });
    } catch (error) {
      logger.error('Error fetching boards:', error);
      next(error);
    }
  }

  async getDemoTickets(req, res, next) {
    try {
      const { projectKey = 'ESWCTV', includeResolved = true } = req.query;
      const jiraService = await this.getJiraServiceForRequest(req);
      const tickets = await jiraService.getDemoTickets(projectKey, includeResolved);
      
      // Ensure ESWCTV-1124 is included if not already present
      const targetTicket = 'ESWCTV-1124';
      const hasTargetTicket = tickets.some(t => t.key === targetTicket);
      
      if (!hasTargetTicket) {
        try {
          const specificTicket = await jiraService.getSpecificTicket(targetTicket);
          tickets.unshift(specificTicket); // Add to beginning
        } catch (err) {
          logger.warn(`Could not fetch ${targetTicket} specifically`);
        }
      }
      
      res.json({
        success: true,
        tickets,
        count: tickets.length,
        message: 'Fetched recent tickets including resolved ones for demo'
      });
    } catch (error) {
      logger.error('Error fetching demo tickets:', error);
      next(error);
    }
  }
}
