import { logger } from '../utils/logger.js';

export class MockJiraService {
  constructor() {
    logger.warn('🎭 Using MOCK JIRA Service for demo purposes');
    this.mockData = this.initializeMockData();
  }

  initializeMockData() {
    return {
      boards: [
        { id: '2892', name: 'BETplus Web', key: 'ESW', type: 'software', projectCategory: 'Software Development' },
        { id: '3860', name: 'BETplus Roku', key: 'ESR', type: 'software', projectCategory: 'Software Development' },
        { id: '3859', name: 'BETplus WCTV', key: 'ESWCTV', type: 'software', projectCategory: 'Software Development' },
        { id: '1', name: 'QA Team Project', key: 'QA', type: 'software', projectCategory: 'Software Development' },
        { id: '2', name: 'Development Project', key: 'DEV', type: 'software', projectCategory: 'Software Development' },
        { id: '3', name: 'Product Management', key: 'PROD', type: 'business', projectCategory: 'Business' }
      ],
      sprints: [
        {
          id: '101',
          name: 'Sprint 23 - Web Platform',
          state: 'active',
          startDate: '2024-10-14T10:00:00.000Z',
          endDate: '2024-10-28T10:00:00.000Z',
          projectId: '2892',
          boardId: '2892'
        },
        {
          id: '102',
          name: 'Sprint 24 - CTV Features',
          state: 'active',
          startDate: '2024-10-14T10:00:00.000Z',
          endDate: '2024-10-28T10:00:00.000Z',
          projectId: '3859',
          boardId: '3859'
        },
        {
          id: '103',
          name: 'Sprint 25 - Roku Release',
          state: 'active',
          startDate: '2024-10-14T10:00:00.000Z',
          endDate: '2024-10-28T10:00:00.000Z',
          projectId: '3860',
          boardId: '3860'
        }
      ],
      issues: {
        // ESW (Web) issues for board 2892
        '2892': [
          {
            key: 'ESW-1234',
            summary: 'Implement skip intro button for web player',
            description: 'Add a skip intro button that appears 5 seconds into video playback on the web platform.',
            type: 'Story',
            status: 'In Progress',
            priority: 'High',
            assignee: 'John Doe',
            acceptanceCriteria: '1. Button appears after 5 seconds\n2. Clicking skips to main content\n3. Button disappears after intro ends\n4. Works on all browsers',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1235',
            summary: 'Fix video buffering issues on Chrome',
            description: 'Users experiencing buffering issues on Chrome browser during peak hours.',
            type: 'Bug',
            status: 'To Do',
            priority: 'Critical',
            assignee: 'Jane Smith',
            acceptanceCriteria: '1. Video loads without buffering\n2. Smooth playback on Chrome\n3. Performance matches other browsers',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1236',
            summary: 'Add subtitle customization options',
            description: 'Allow users to customize subtitle appearance including font size, color, and background.',
            type: 'Story',
            status: 'To Do',
            priority: 'Medium',
            assignee: 'Mike Johnson',
            acceptanceCriteria: '1. Font size adjustable\n2. Color options available\n3. Background opacity control\n4. Settings persist across sessions',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1237',
            summary: 'Implement watch party feature',
            description: 'Enable synchronized viewing experience for multiple users watching together.',
            type: 'Story',
            status: 'In Progress',
            priority: 'High',
            assignee: 'Sarah Connor',
            acceptanceCriteria: '1. Real-time sync\n2. Chat functionality\n3. Support up to 10 users\n4. Host controls',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1238',
            summary: 'Fix login timeout issues',
            description: 'Users being logged out unexpectedly during video playback.',
            type: 'Bug',
            status: 'In Review',
            priority: 'High',
            assignee: 'Tom Wilson',
            acceptanceCriteria: '1. Session stays active during playback\n2. Proper timeout warnings\n3. Seamless re-authentication',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1239',
            summary: 'Add download for offline viewing',
            description: 'Allow premium users to download content for offline viewing.',
            type: 'Story',
            status: 'To Do',
            priority: 'Medium',
            assignee: 'Emma Davis',
            acceptanceCriteria: '1. Download quality options\n2. DRM protection\n3. Storage management\n4. Expiry handling',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1240',
            summary: 'Optimize image loading performance',
            description: 'Improve thumbnail and poster image loading times across the platform.',
            type: 'Task',
            status: 'Done',
            priority: 'Medium',
            assignee: 'Chris Martin',
            acceptanceCriteria: '1. Lazy loading implemented\n2. WebP format support\n3. CDN optimization\n4. Progressive loading',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1241',
            summary: 'Fix search results pagination',
            description: 'Search results not loading properly when scrolling to next page.',
            type: 'Bug',
            status: 'In Progress',
            priority: 'High',
            assignee: 'Lisa Anderson',
            acceptanceCriteria: '1. Infinite scroll works\n2. No duplicate results\n3. Smooth loading\n4. Error handling',
            boardId: '2892',
            sprintId: '101'
          },
          {
            key: 'ESW-1242',
            summary: 'Add parental control features',
            description: 'Implement comprehensive parental control system for family accounts.',
            type: 'Story',
            status: 'To Do',
            priority: 'High',
            assignee: 'Robert Brown',
            acceptanceCriteria: '1. PIN protection\n2. Content filtering\n3. Time restrictions\n4. Viewing history',
            boardId: '2892',
            sprintId: '101'
          }
        ],
        // ESWCTV (CTV) issues for board 3859 - Using real JIRA ticket IDs
        '3859': [
          {
            key: 'ESWCTV-750',
            summary: 'Create CMP Preferences Page menu/banner',
            description: 'Implement the CMP (Consent Management Platform) preferences page with menu and banner components.',
            type: 'Story',
            status: 'In Progress',
            priority: 'High',
            assignee: 'Bob Wilson',
            acceptanceCriteria: '1. CMP menu displays correctly\n2. Banner shows on first visit\n3. User preferences saved\n4. GDPR compliant',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-1088',
            summary: '[WCTV][BET+] Promo - Unable to skip promo in Continue Watching rail',
            description: 'Users cannot skip promotional content in the Continue Watching rail on BET+ WCTV app.',
            type: 'Bug',
            status: 'Blocked',
            priority: 'High',
            assignee: 'Alice Johnson',
            acceptanceCriteria: '1. Skip button appears\n2. Skip functionality works\n3. Promo tracking maintained\n4. No playback issues',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-1114',
            summary: '[QA][Kids] Redirect Expired Kids Profile to PIN Screen',
            description: 'When a kids profile expires, redirect user to PIN entry screen for re-authentication.',
            type: 'Story',
            status: 'Ready for Work',
            priority: 'High',
            assignee: 'Mark Thompson',
            acceptanceCriteria: '1. Expiry detection works\n2. Redirect to PIN screen\n3. PIN validation\n4. Profile reactivation',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-1034',
            summary: 'Handle Profile Switching',
            description: 'Implement smooth profile switching functionality across all CTV platforms.',
            type: 'Story',
            status: 'Build Ready',
            priority: 'High',
            assignee: 'Diana Prince',
            acceptanceCriteria: '1. Profile switch without logout\n2. Content saves state\n3. Preferences load correctly\n4. No data leakage',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-1170',
            summary: 'Fix Isolated wctv-app Not Loading Pages Correctly',
            description: 'WCTV app isolation mode fails to load certain pages correctly, showing blank screens.',
            type: 'Bug',
            status: 'Complete',
            priority: 'Critical',
            assignee: 'Steve Rogers',
            acceptanceCriteria: '1. All pages load\n2. No blank screens\n3. Error handling improved\n4. Performance maintained',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-752',
            summary: 'Add CMP IAB to ad calls',
            description: 'Integrate CMP (Consent Management Platform) IAB framework with advertising calls.',
            type: 'Story',
            status: 'In Progress',
            priority: 'High',
            assignee: 'Tony Stark',
            acceptanceCriteria: '1. IAB compliance\n2. Consent passed to ads\n3. Proper targeting\n4. Privacy maintained',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-1125',
            summary: '[Reporting][WCTV] Implement eden for Special Pages',
            description: 'Implement Eden analytics reporting for special pages in WCTV application.',
            type: 'Story',
            status: 'Ready for Work',
            priority: 'Medium',
            assignee: 'Bruce Banner',
            acceptanceCriteria: '1. Eden integration complete\n2. Special pages tracked\n3. Data accuracy verified\n4. Dashboard updated',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-1124',
            summary: '[Restart][WCTV] Implement Restart specs on CTV',
            description: 'Implement restart functionality specifications for live content on Connected TV platforms.',
            type: 'Story',
            status: 'Ready for Work',
            priority: 'High',
            assignee: 'Natasha Romanoff',
            acceptanceCriteria: '1. Restart from beginning\n2. Seek functionality\n3. Live return option\n4. Buffer management',
            boardId: '3859',
            sprintId: '102'
          },
          {
            key: 'ESWCTV-874',
            summary: '[Restart][WCTV] Implement Accessibility Restart Specs',
            description: 'Implement accessibility features for restart functionality including screen readers and keyboard navigation.',
            type: 'Story',
            status: 'In Progress (QA)',
            priority: 'High',
            assignee: 'Peter Parker',
            acceptanceCriteria: '1. Screen reader support\n2. Keyboard navigation\n3. Focus indicators\n4. WCAG compliance',
            boardId: '3859',
            sprintId: '102'
          }
        ],
        // ESR (Roku) issues for board 3860
        '3860': [
          {
            key: 'ESR-3001',
            summary: 'Optimize Roku app performance',
            description: 'Improve app loading time and navigation speed on Roku devices.',
            type: 'Story',
            status: 'To Do',
            priority: 'High',
            assignee: 'Charlie Brown',
            acceptanceCriteria: '1. App loads in under 3 seconds\n2. Smooth navigation\n3. Reduced memory usage',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3002',
            summary: 'Add 4K streaming support for Roku Ultra',
            description: 'Enable 4K streaming capability for Roku Ultra devices.',
            type: 'Story',
            status: 'In Progress',
            priority: 'Critical',
            assignee: 'David Lee',
            acceptanceCriteria: '1. 4K content plays smoothly\n2. Auto-quality adjustment\n3. HDR support enabled',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3003',
            summary: 'Fix memory leak on Roku Express',
            description: 'App crashes after extended viewing sessions on Roku Express devices due to memory leak.',
            type: 'Bug',
            status: 'In Progress',
            priority: 'Critical',
            assignee: 'Jennifer Wilson',
            acceptanceCriteria: '1. No memory leaks\n2. Stable performance\n3. Memory cleanup\n4. Crash reporting',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3004',
            summary: 'Implement Roku Voice Remote features',
            description: 'Add support for Roku Voice Remote commands for hands-free navigation.',
            type: 'Story',
            status: 'To Do',
            priority: 'Medium',
            assignee: 'Michael Scott',
            acceptanceCriteria: '1. Voice search\n2. Voice playback controls\n3. Voice navigation\n4. Error handling',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3005',
            summary: 'Add private listening mode support',
            description: 'Enable private listening through Roku mobile app for headphone audio.',
            type: 'Story',
            status: 'In Review',
            priority: 'Medium',
            assignee: 'Pam Beesly',
            acceptanceCriteria: '1. Audio routing\n2. Sync maintenance\n3. Quality settings\n4. Connection stability',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3006',
            summary: 'Fix channel store listing issues',
            description: 'App not appearing correctly in Roku Channel Store search results.',
            type: 'Bug',
            status: 'Done',
            priority: 'High',
            assignee: 'Jim Halpert',
            acceptanceCriteria: '1. Proper categorization\n2. Search visibility\n3. Screenshots updated\n4. Description accurate',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3007',
            summary: 'Optimize bandwidth usage for data caps',
            description: 'Reduce data consumption for users with limited bandwidth or data caps.',
            type: 'Task',
            status: 'To Do',
            priority: 'Medium',
            assignee: 'Dwight Schrute',
            acceptanceCriteria: '1. Data saver mode\n2. Quality presets\n3. Usage tracking\n4. Warning alerts',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3008',
            summary: 'Add Roku TV integration features',
            description: 'Implement deep integration with Roku TV including input switching and TV controls.',
            type: 'Story',
            status: 'In Progress',
            priority: 'High',
            assignee: 'Angela Martin',
            acceptanceCriteria: '1. TV controls access\n2. Input switching\n3. Power management\n4. Volume control',
            boardId: '3860',
            sprintId: '103'
          },
          {
            key: 'ESR-3009',
            summary: 'Fix buffering on older Roku models',
            description: 'Excessive buffering on Roku 3 and older models during peak hours.',
            type: 'Bug',
            status: 'To Do',
            priority: 'High',
            assignee: 'Kevin Malone',
            acceptanceCriteria: '1. Reduced buffering\n2. Adaptive streaming\n3. Cache optimization\n4. Fallback quality',
            boardId: '3860',
            sprintId: '103'
          }
        ],
        // Default/legacy issues
        'default': [
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
        ]  // end of default array
      }  // end of issues object
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
      // Collect all issues from all boards
      let allIssues = [];
      for (const boardId in this.mockData.issues) {
        const boardIssues = this.mockData.issues[boardId];
        if (Array.isArray(boardIssues)) {
          allIssues = allIssues.concat(boardIssues);
        }
      }
      return { issues: allIssues };
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

  async getCurrentSprint(boardId) {
    logger.info(`🎭 Returning mock sprint for board ${boardId}`);
    const sprint = this.mockData.sprints.find(s => s.boardId === String(boardId) || s.projectId === String(boardId));
    if (sprint) {
      return sprint;
    }
    // Fallback to first sprint
    logger.info(`🎭 No sprint found for board ${boardId}, using default`);
    return this.mockData.sprints[0];
  }

  async getSprintIssues(sprintId) {
    logger.info(`🎭 Returning mock issues for sprint ${sprintId}`);
    
    // Find which board this sprint belongs to
    const sprint = this.mockData.sprints.find(s => s.id === String(sprintId));
    if (sprint && sprint.boardId) {
      const boardIssues = this.mockData.issues[sprint.boardId];
      if (boardIssues) {
        logger.info(`🎭 Found ${boardIssues.length} issues for board ${sprint.boardId}`);
        return boardIssues;
      }
    }
    
    // Fallback to default issues
    logger.info(`🎭 Using default issues for sprint ${sprintId}`);
    return this.mockData.issues.default || [];
  }

  async getIssue(issueKey) {
    logger.info(`🎭 Returning mock issue ${issueKey}`);
    
    // Search through all board issues
    for (const boardId in this.mockData.issues) {
      const boardIssues = this.mockData.issues[boardId];
      if (Array.isArray(boardIssues)) {
        const issue = boardIssues.find(i => i.key === issueKey);
        if (issue) {
          return issue;
        }
      }
    }
    
    // Fallback to first issue in default
    return this.mockData.issues.default?.[0] || null;
  }

  async searchIssues(jql, maxResults = 50) {
    logger.info(`🎭 Returning mock search results for: ${jql}`);
    
    // Collect all issues from all boards
    let allIssues = [];
    for (const boardId in this.mockData.issues) {
      const boardIssues = this.mockData.issues[boardId];
      if (Array.isArray(boardIssues)) {
        allIssues = allIssues.concat(boardIssues);
      }
    }
    
    return allIssues.slice(0, maxResults);
  }

  async testConnection() {
    logger.info('✅ Mock JIRA connection always successful!');
    return true;
  }
}
