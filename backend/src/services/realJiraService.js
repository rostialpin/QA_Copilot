import axios from 'axios';
import { logger } from '../utils/logger.js';

class RealJiraService {
  constructor() {
    this.baseURL = process.env.JIRA_HOST || 'https://paramount.atlassian.net';
    this.email = process.env.JIRA_EMAIL || 'svc-unified_chatbot@paramount.com';
    this.apiToken = process.env.JIRA_API_TOKEN;
    
    // Create axios instance with auth
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      auth: {
        username: this.email,
        password: this.apiToken
      }
    });
  }

  async getBoards() {
    try {
      logger.info('🔄 Fetching boards from JIRA API');
      
      // Get all boards accessible to the user
      const response = await this.client.get('/rest/agile/1.0/board', {
        params: {
          maxResults: 50,
          type: 'scrum'
        }
      });
      
      const boards = response.data.values || [];
      
      // Filter for the boards we're interested in
      const targetBoards = ['ESW', 'ESWCTV', 'ESR', 'BET'];
      const filteredBoards = boards.filter(board => 
        targetBoards.some(target => 
          board.name?.toUpperCase().includes(target) || 
          board.location?.projectKey?.includes(target)
        )
      );
      
      logger.info(`✅ Found ${filteredBoards.length} relevant boards`);
      return filteredBoards;
    } catch (error) {
      logger.error('❌ Error fetching boards:', error.message);
      throw error;
    }
  }

  async getCurrentSprint(boardId) {
    try {
      logger.info(`🔄 Fetching active sprint for board ${boardId}`);
      
      const response = await this.client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
        params: {
          state: 'active'
        }
      });
      
      const activeSprints = response.data.values || [];
      const currentSprint = activeSprints[0]; // Get the first active sprint
      
      if (currentSprint) {
        logger.info(`✅ Found active sprint: ${currentSprint.name}`);
      } else {
        logger.info(`⚠️ No active sprint found for board ${boardId}`);
      }
      
      return currentSprint;
    } catch (error) {
      logger.error(`❌ Error fetching sprint for board ${boardId}:`, error.message);
      throw error;
    }
  }

  async getSprintIssues(sprintId) {
    try {
      logger.info(`🔄 Fetching issues for sprint ${sprintId}`);
      
      const response = await this.client.get(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
        params: {
          maxResults: 100,
          fields: 'summary,description,status,priority,assignee,issuetype,customfield_10014'
        }
      });
      
      const issues = response.data.issues || [];
      
      // Transform issues to match our format
      const transformedIssues = issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || '',
        type: issue.fields.issuetype?.name || 'Story',
        status: issue.fields.status?.name || 'To Do',
        priority: issue.fields.priority?.name || 'Medium',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        acceptanceCriteria: issue.fields.customfield_10014 || '',
        boardId: issue.fields.project?.id,
        sprintId: sprintId
      }));
      
      logger.info(`✅ Found ${transformedIssues.length} issues in sprint`);
      return transformedIssues;
    } catch (error) {
      logger.error(`❌ Error fetching issues for sprint ${sprintId}:`, error.message);
      throw error;
    }
  }

  async getBoardIssues(boardId, maxResults = 50) {
    try {
      logger.info(`🔄 Fetching issues for board ${boardId}`);
      
      // First try to get issues from active sprint
      const activeSprint = await this.getCurrentSprint(boardId);
      if (activeSprint) {
        return await this.getSprintIssues(activeSprint.id);
      }
      
      // Fallback to getting board backlog issues
      const response = await this.client.get(`/rest/agile/1.0/board/${boardId}/issue`, {
        params: {
          maxResults,
          fields: 'summary,description,status,priority,assignee,issuetype,customfield_10014'
        }
      });
      
      const issues = response.data.issues || [];
      
      // Transform issues to match our format
      const transformedIssues = issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || '',
        type: issue.fields.issuetype?.name || 'Story',
        status: issue.fields.status?.name || 'To Do',
        priority: issue.fields.priority?.name || 'Medium',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        acceptanceCriteria: issue.fields.customfield_10014 || '',
        boardId: boardId
      }));
      
      logger.info(`✅ Found ${transformedIssues.length} issues for board`);
      return transformedIssues;
    } catch (error) {
      logger.error(`❌ Error fetching issues for board ${boardId}:`, error.message);
      throw error;
    }
  }

  async searchIssues(jql, maxResults = 50) {
    try {
      logger.info(`🔄 Searching issues with JQL: ${jql}`);
      
      const response = await this.client.post('/rest/api/2/search', {
        jql,
        maxResults,
        fields: ['summary', 'description', 'status', 'priority', 'assignee', 'issuetype', 'customfield_10014']
      });
      
      const issues = response.data.issues || [];
      
      // Transform issues to match our format
      const transformedIssues = issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || '',
        type: issue.fields.issuetype?.name || 'Story',
        status: issue.fields.status?.name || 'To Do',
        priority: issue.fields.priority?.name || 'Medium',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        acceptanceCriteria: issue.fields.customfield_10014 || ''
      }));
      
      logger.info(`✅ Found ${transformedIssues.length} issues`);
      return transformedIssues;
    } catch (error) {
      logger.error(`❌ Error searching issues:`, error.message);
      throw error;
    }
  }

  async getIssue(issueKey) {
    try {
      logger.info(`🔄 Fetching issue ${issueKey}`);
      
      const response = await this.client.get(`/rest/api/2/issue/${issueKey}`, {
        params: {
          fields: 'summary,description,status,priority,assignee,issuetype,customfield_10014,comment'
        }
      });
      
      const issue = response.data;
      
      const transformedIssue = {
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || '',
        type: issue.fields.issuetype?.name || 'Story',
        status: issue.fields.status?.name || 'To Do',
        priority: issue.fields.priority?.name || 'Medium',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        acceptanceCriteria: issue.fields.customfield_10014 || '',
        comments: issue.fields.comment?.comments?.map(c => ({
          author: c.author.displayName,
          body: c.body,
          created: c.created
        })) || []
      };
      
      logger.info(`✅ Retrieved issue ${issueKey}`);
      return transformedIssue;
    } catch (error) {
      logger.error(`❌ Error fetching issue ${issueKey}:`, error.message);
      throw error;
    }
  }
}

export const realJiraService = new RealJiraService();