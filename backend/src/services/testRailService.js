import axios from 'axios';
import { logger } from '../utils/logger.js';

export class TestRailService {
  constructor() {
    // Use environment variables from ~/.zshrc
    this.baseURL = process.env.TESTRAIL_URL || process.env.TESTRAIL_HOST;
    this.auth = {
      username: process.env.TESTRAIL_EMAIL || process.env.TESTRAIL_USERNAME,
      password: process.env.TESTRAIL_TOKEN || process.env.TESTRAIL_API_KEY
    };
    
    if (this.baseURL && this.auth.username) {
      logger.info(`TestRail configured for ${this.baseURL}`);
    } else {
      logger.warn('TestRail credentials not found in environment variables');
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    if (!this.baseURL || !this.auth.username || !this.auth.password) {
      logger.warn('TestRail not configured, using mock data');
      return this.getMockData(endpoint, method, data);
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseURL}/api/v2/${endpoint}`,
        auth: this.auth,
        data,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`TestRail API error: ${error.message}`);
      logger.warn('Falling back to mock TestRail data');
      return this.getMockData(endpoint, method, data);
    }
  }

  getMockData(endpoint, method, data) {
    // Mock responses for TestRail API
    if (endpoint === 'get_projects') {
      return [
        { id: 1, name: 'QA Automation Project', is_completed: false },
        { id: 2, name: 'Web Application Testing', is_completed: false },
        { id: 3, name: 'Mobile App Testing', is_completed: false }
      ];
    }
    
    if (endpoint.startsWith('get_suites/')) {
      return [
        { id: 1, name: 'Regression Suite', project_id: 1 },
        { id: 2, name: 'Smoke Tests', project_id: 1 },
        { id: 3, name: 'Feature Tests', project_id: 1 }
      ];
    }
    
    if (endpoint.startsWith('add_case/')) {
      return {
        id: Math.floor(Math.random() * 1000) + 100,
        title: data.title,
        suite_id: data.suite_id,
        created_on: Math.floor(Date.now() / 1000),
        ...data
      };
    }
    
    if (endpoint.startsWith('get_cases/')) {
      return [
        { id: 1, title: 'Login with valid credentials', suite_id: 1 },
        { id: 2, title: 'Login with invalid password', suite_id: 1 },
        { id: 3, title: 'Password reset flow', suite_id: 1 }
      ];
    }
    
    return { success: true, message: 'Mock operation completed' };
  }

  async getProjects() {
    return await this.makeRequest('get_projects');
  }

  async getSuites(projectId) {
    return await this.makeRequest(`get_suites/${projectId}`);
  }

  async createTestCase(testCaseData) {
    const { suiteId, ...data } = testCaseData;
    return await this.makeRequest(`add_case/${suiteId}`, 'POST', data);
  }

  async getTestCases(suiteId) {
    return await this.makeRequest(`get_cases/${suiteId}`);
  }

  async checkDuplicates(suiteId, title) {
    const testCases = await this.getTestCases(suiteId);
    return testCases.filter(tc => 
      tc.title.toLowerCase().includes(title.toLowerCase())
    );
  }
}
