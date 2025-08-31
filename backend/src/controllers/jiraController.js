import { JiraService } from '../services/jiraService.js';
import { logger } from '../utils/logger.js';

export class JiraController {
  constructor() {
    this.jiraService = new JiraService();
  }

  async getBoards(req, res, next) {
    try {
      const boards = await this.jiraService.getBoards();
      res.json(boards);
    } catch (error) {
      logger.error('Error fetching boards:', error);
      next(error);
    }
  }

  async getCurrentSprint(req, res, next) {
    try {
      const { boardId } = req.params;
      const sprint = await this.jiraService.getCurrentSprint(boardId);
      res.json(sprint);
    } catch (error) {
      logger.error('Error fetching current sprint:', error);
      next(error);
    }
  }

  async getSprintIssues(req, res, next) {
    try {
      const { sprintId } = req.params;
      const issues = await this.jiraService.getSprintIssues(sprintId);
      res.json(issues);
    } catch (error) {
      logger.error('Error fetching sprint issues:', error);
      next(error);
    }
  }

  async getIssue(req, res, next) {
    try {
      const { issueKey } = req.params;
      const issue = await this.jiraService.getIssue(issueKey);
      res.json(issue);
    } catch (error) {
      logger.error('Error fetching issue:', error);
      next(error);
    }
  }
}
