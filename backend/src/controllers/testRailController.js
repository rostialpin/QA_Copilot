import { TestRailService } from '../services/testRailService.js';
import { logger } from '../utils/logger.js';

export class TestRailController {
  constructor() {
    this.testRailService = new TestRailService();
  }

  async getProjects(req, res, next) {
    try {
      const projects = await this.testRailService.getProjects();
      res.json(projects);
    } catch (error) {
      logger.error('Error fetching TestRail projects:', error);
      next(error);
    }
  }

  async getSuites(req, res, next) {
    try {
      const { projectId } = req.params;
      const suites = await this.testRailService.getSuites(projectId);
      res.json(suites);
    } catch (error) {
      logger.error('Error fetching TestRail suites:', error);
      next(error);
    }
  }

  async createTestCase(req, res, next) {
    try {
      const testCase = await this.testRailService.createTestCase(req.body);
      res.status(201).json(testCase);
    } catch (error) {
      logger.error('Error creating test case:', error);
      next(error);
    }
  }

  async getTestCases(req, res, next) {
    try {
      const { projectId, suiteId } = req.params;
      const { section_id } = req.query; // Get section_id from query params
      const testCases = await this.testRailService.getTestCases(projectId, suiteId, section_id);
      res.json(testCases);
    } catch (error) {
      logger.error('Error fetching test cases:', error);
      next(error);
    }
  }

  async getSections(req, res, next) {
    try {
      const { projectId, suiteId } = req.params;
      const sections = await this.testRailService.getSections(projectId, suiteId);
      res.json(sections);
    } catch (error) {
      logger.error('Error fetching sections:', error);
      next(error);
    }
  }
}
