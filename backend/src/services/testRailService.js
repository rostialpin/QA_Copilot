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
      // Check if baseURL already contains /api/v2/
      const apiUrl = this.baseURL.includes('/api/v2/') 
        ? `${this.baseURL}${endpoint}`
        : `${this.baseURL}/api/v2/${endpoint}`;
      
      const response = await axios({
        method,
        url: apiUrl,
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
    const response = await this.makeRequest('get_projects');
    // TestRail API returns projects in a wrapper object with 'projects' array
    return response.projects || response;
  }

  async getSuites(projectId) {
    const response = await this.makeRequest(`get_suites/${projectId}`);
    // TestRail API returns suites directly as an array or in a wrapper
    return Array.isArray(response) ? response : (response.suites || response);
  }

  async createTestCase(testCaseData) {
    const { suiteId, ...data } = testCaseData;
    return await this.makeRequest(`add_case/${suiteId}`, 'POST', data);
  }

  async getTestCases(projectId, suiteId, sectionId = null, limit = 100) {
    // TestRail requires project_id in the query for get_cases
    let endpoint = `get_cases/${projectId}&suite_id=${suiteId}`;
    if (sectionId) {
      endpoint += `&section_id=${sectionId}`;
    }
    endpoint += `&limit=${limit}`;
    
    const response = await this.makeRequest(endpoint);
    // Handle both direct array response and wrapper object
    const cases = Array.isArray(response) ? response : (response.cases || response || []);
    
    // Extract the most important fields for context
    return cases.map(tc => ({
      id: tc.id,
      title: tc.title,
      priority_id: tc.priority_id,
      priority: this.mapPriorityName(tc.priority_id),
      type_id: tc.type_id,
      preconditions: tc.custom_preconds || '',
      description: tc.custom_test_case_description || '',
      steps: tc.custom_steps_separated || [],
      stepsText: tc.custom_steps || '',
      expected: tc.custom_expected || '',
      section_id: tc.section_id,
      refs: tc.refs // JIRA references if any
    }));
  }

  mapPriorityName(priorityId) {
    const priorities = {
      1: 'Critical',
      2: 'High', 
      3: 'Medium',
      4: 'Low'
    };
    return priorities[priorityId] || 'Medium';
  }

  async getSections(projectId, suiteId) {
    // Get ALL sections (folders) within a project - handle pagination
    // Note: TestRail API doesn't filter sections by suite in single-suite mode
    let allSections = [];
    let offset = 0;
    const limit = 250; // TestRail's default limit
    
    while (true) {
      const response = await this.makeRequest(`get_sections/${projectId}${offset > 0 ? `&offset=${offset}` : ''}`);
      
      // Handle both paginated response and direct array
      if (response && typeof response === 'object' && 'sections' in response) {
        // Paginated response
        const sections = response.sections || [];
        allSections = allSections.concat(sections);
        
        // Check if there are more pages
        if (sections.length < limit || response.size < limit) {
          break; // No more pages
        }
        offset += limit;
      } else {
        // Direct array response (shouldn't happen with TestRail but handle it)
        allSections = response || [];
        break;
      }
    }
    
    logger.info(`Fetched ${allSections.length} total sections for project ${projectId}`);
    
    // If suiteId is provided and sections have suite_id field, filter by it
    if (suiteId && allSections.length > 0 && allSections[0].suite_id !== undefined) {
      return allSections.filter(s => s.suite_id === parseInt(suiteId));
    }
    return allSections;
  }

  async checkDuplicates(suiteId, title) {
    const testCases = await this.getTestCases(suiteId);
    return testCases.filter(tc => 
      tc.title.toLowerCase().includes(title.toLowerCase())
    );
  }
}
