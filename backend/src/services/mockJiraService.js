import { logger } from '../utils/logger.js';

export class MockJiraService {
  constructor() {
    logger.warn('🎭 Using MOCK JIRA Service for demo purposes');
    this.mockData = this.initializeMockData();
  }

  initializeMockData() {
    return {
      boards: [
        { id: '1', name: 'QA Team Project', key: 'QA', type: 'software', projectCategory: 'Software Development' },
        { id: '2', name: 'Development Project', key: 'DEV', type: 'software', projectCategory: 'Software Development' },
        { id: '3', name: 'Product Management', key: 'PROD', type: 'business', projectCategory: 'Business' }
      ],
      sprints: [
        {
          id: '101',
          name: 'Sprint 23 - Q4 Release Prep',
          state: 'active',
          startDate: '2024-10-14T10:00:00.000Z',
          endDate: '2024-10-28T10:00:00.000Z',
          projectId: '1'
        }
      ],
      issues: [
        {
          key: 'QA-1234',
          summary: 'Test user authentication flow for new SSO integration',
          description: 'Verify that users can successfully authenticate using the new Okta SSO integration. Test various scenarios including first-time login, returning users, and error cases.',
          type: 'Story',
          status: 'In Progress',
          priority: 'High',
          assignee: 'John Doe',
          acceptanceCriteria: '1. User can login with valid credentials\n2. Invalid credentials show error\n3. Session persists correctly\n4. Logout works properly'
        },
        {
          key: 'QA-1235',
          summary: 'API endpoint validation for payment service',
          description: 'Comprehensive testing of the new payment service API endpoints including successful transactions, error handling, and edge cases.',
          type: 'Task',
          status: 'To Do',
          priority: 'Critical',
          assignee: 'Jane Smith',
          acceptanceCriteria: '1. All endpoints return correct status codes\n2. Payment processing completes successfully\n3. Refunds are handled correctly\n4. Error messages are meaningful'
        },
        {
          key: 'QA-1236',
          summary: 'Performance testing for dashboard loading',
          description: 'Ensure dashboard loads within acceptable time limits under various load conditions.',
          type: 'Bug',
          status: 'To Do',
          priority: 'Medium',
          assignee: 'Bob Wilson',
          acceptanceCriteria: '1. Dashboard loads in under 2 seconds\n2. Can handle 100 concurrent users\n3. No memory leaks detected'
        },
        {
          key: 'QA-1237',
          summary: 'Mobile app compatibility testing on iOS 17',
          description: 'Test the mobile application on the latest iOS 17 devices to ensure compatibility and proper functionality.',
          type: 'Story',
          status: 'In Review',
          priority: 'High',
          assignee: 'Alice Johnson',
          acceptanceCriteria: '1. App launches without crashes\n2. All features work as expected\n3. UI elements display correctly\n4. Performance is acceptable'
        },
        {
          key: 'QA-1238',
          summary: 'Security testing for user data encryption',
          description: 'Verify that all sensitive user data is properly encrypted both in transit and at rest.',
          type: 'Task',
          status: 'Done',
          priority: 'Critical',
          assignee: 'Charlie Brown',
          acceptanceCriteria: '1. Data encrypted using AES-256\n2. TLS 1.3 for data in transit\n3. Encryption keys properly managed\n4. No data leaks in logs'
        }
      ]
    };
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    logger.info(`🎭 Mock JIRA: ${method} ${endpoint}`);
    
    // Return mock data based on endpoint
    if (endpoint.includes('/board')) {
      return { values: this.mockData.boards };
    }
    if (endpoint.includes('/sprint')) {
      return { values: this.mockData.sprints };
    }
    if (endpoint.includes('/issue')) {
      return { issues: this.mockData.issues };
    }
    if (endpoint.includes('/myself')) {
      return {
        displayName: 'Demo User',
        emailAddress: 'demo@qacopilot.com',
        accountId: 'demo-123'
      };
    }
    
    return {};
  }

  async getBoards() {
    logger.info('🎭 Returning mock boards');
    return this.mockData.boards;
  }

  async getCurrentSprint(projectId) {
    logger.info(`🎭 Returning mock sprint for project ${projectId}`);
    return this.mockData.sprints.find(s => s.projectId === projectId) || this.mockData.sprints[0];
  }

  async getSprintIssues(sprintId) {
    logger.info(`🎭 Returning mock issues for sprint ${sprintId}`);
    return this.mockData.issues;
  }

  async getIssue(issueKey) {
    logger.info(`🎭 Returning mock issue ${issueKey}`);
    return this.mockData.issues.find(i => i.key === issueKey) || this.mockData.issues[0];
  }

  async searchIssues(jql, maxResults = 50) {
    logger.info(`🎭 Returning mock search results for: ${jql}`);
    return this.mockData.issues.slice(0, maxResults);
  }

  async testConnection() {
    logger.info('✅ Mock JIRA connection always successful!');
    return true;
  }
}
