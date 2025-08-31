#!/bin/bash

echo "🚀 Creating all remaining project files..."

# Backend Controllers
cat > backend/src/controllers/testRailController.js << 'EOF'
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
      const { suiteId } = req.params;
      const testCases = await this.testRailService.getTestCases(suiteId);
      res.json(testCases);
    } catch (error) {
      logger.error('Error fetching test cases:', error);
      next(error);
    }
  }
}
EOF

cat > backend/src/controllers/geminiController.js << 'EOF'
import { GeminiService } from '../services/geminiService.js';
import { logger } from '../utils/logger.js';

export class GeminiController {
  constructor() {
    this.geminiService = new GeminiService();
  }

  async generateTestCases(req, res, next) {
    try {
      const { ticket, options } = req.body;
      const testCases = await this.geminiService.generateTestCases(ticket, options);
      res.json(testCases);
    } catch (error) {
      logger.error('Error generating test cases:', error);
      next(error);
    }
  }

  async analyzeDuplicate(req, res, next) {
    try {
      const { testCase, existingTestCases } = req.body;
      const analysis = await this.geminiService.analyzeDuplicate(testCase, existingTestCases);
      res.json(analysis);
    } catch (error) {
      logger.error('Error analyzing duplicates:', error);
      next(error);
    }
  }
}
EOF

cat > backend/src/controllers/cypressController.js << 'EOF'
import { CypressGenerator } from '../services/cypressGenerator.js';
import { GitHubService } from '../services/githubService.js';
import { logger } from '../utils/logger.js';

export class CypressController {
  constructor() {
    this.cypressGenerator = new CypressGenerator();
    this.githubService = new GitHubService();
  }

  async generateCypressTest(req, res, next) {
    try {
      const { testCase, options } = req.body;
      const cypressTest = await this.cypressGenerator.generateTest(testCase, options);
      res.json(cypressTest);
    } catch (error) {
      logger.error('Error generating Cypress test:', error);
      next(error);
    }
  }

  async getTemplates(req, res, next) {
    try {
      const templates = await this.cypressGenerator.getTemplates();
      res.json(templates);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      next(error);
    }
  }

  async analyzeExistingTests(req, res, next) {
    try {
      const { repoPath } = req.body;
      const analysis = await this.githubService.analyzeTestStructure(repoPath);
      res.json(analysis);
    } catch (error) {
      logger.error('Error analyzing existing tests:', error);
      next(error);
    }
  }
}
EOF

# Backend Services
cat > backend/src/services/jiraService.js << 'EOF'
import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';

export class JiraService {
  constructor() {
    this.baseURL = process.env.JIRA_HOST;
    this.auth = {
      username: process.env.JIRA_EMAIL,
      password: process.env.JIRA_API_TOKEN
    };
    this.cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const cacheKey = `${method}:${endpoint}`;
    
    if (method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        auth: this.auth,
        data,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (method === 'GET') {
        this.cache.set(cacheKey, response.data);
      }

      return response.data;
    } catch (error) {
      logger.error(`JIRA API error: ${error.message}`);
      throw error;
    }
  }

  async getBoards() {
    const data = await this.makeRequest('/rest/agile/1.0/board');
    return data.values;
  }

  async getCurrentSprint(boardId) {
    const data = await this.makeRequest(`/rest/agile/1.0/board/${boardId}/sprint`);
    const activeSprint = data.values.find(sprint => sprint.state === 'active');
    return activeSprint || null;
  }

  async getSprintIssues(sprintId) {
    const data = await this.makeRequest(`/rest/agile/1.0/sprint/${sprintId}/issue`);
    return data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description,
      type: issue.fields.issuetype.name,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name,
      assignee: issue.fields.assignee?.displayName,
      acceptanceCriteria: issue.fields.customfield_10001 // Adjust field ID as needed
    }));
  }

  async getIssue(issueKey) {
    return await this.makeRequest(`/rest/api/2/issue/${issueKey}`);
  }
}
EOF

cat > backend/src/services/testRailService.js << 'EOF'
import axios from 'axios';
import { logger } from '../utils/logger.js';

export class TestRailService {
  constructor() {
    this.baseURL = process.env.TESTRAIL_HOST;
    this.auth = {
      username: process.env.TESTRAIL_USERNAME,
      password: process.env.TESTRAIL_API_KEY
    };
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
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
      throw error;
    }
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
EOF

cat > backend/src/services/geminiService.js << 'EOF'
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

export class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('Gemini API key not configured');
      return;
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async generateTestCases(ticket, options = {}) {
    if (!this.model) {
      throw new Error('Gemini API not configured');
    }

    const prompt = this.buildTestCasePrompt(ticket, options);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse the generated test cases
      return this.parseTestCases(text);
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
    }
  }

  buildTestCasePrompt(ticket, options) {
    const { style = 'BDD', types = ['positive', 'negative', 'edge'] } = options;
    
    return `
      Generate comprehensive test cases for the following JIRA ticket:
      
      Title: ${ticket.summary}
      Description: ${ticket.description || 'No description provided'}
      Type: ${ticket.type}
      Acceptance Criteria: ${ticket.acceptanceCriteria || 'Not specified'}
      
      Requirements:
      1. Generate test cases in ${style} format
      2. Include ${types.join(', ')} test scenarios
      3. Each test case should have:
         - Title
         - Description
         - Preconditions
         - Steps (or Given/When/Then for BDD)
         - Expected Result
         - Test Data (if applicable)
      4. Format the output as JSON array
      
      Generate realistic and comprehensive test cases that would catch real bugs.
    `;
  }

  parseTestCases(text) {
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: try to parse the entire text
      return JSON.parse(text);
    } catch (error) {
      logger.error('Failed to parse Gemini response:', error);
      // Return a structured fallback
      return [{
        title: 'Generated Test Case',
        description: text,
        steps: ['Review and format manually'],
        expectedResult: 'To be defined'
      }];
    }
  }

  async analyzeDuplicate(testCase, existingTestCases) {
    if (!this.model) {
      throw new Error('Gemini API not configured');
    }

    const prompt = `
      Analyze if this test case is a duplicate of any existing test cases.
      
      New Test Case:
      ${JSON.stringify(testCase, null, 2)}
      
      Existing Test Cases:
      ${JSON.stringify(existingTestCases, null, 2)}
      
      Return a JSON object with:
      - isDuplicate: boolean
      - similarityScore: number (0-100)
      - similarTestCases: array of IDs of similar test cases
      - recommendation: string
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return JSON.parse(text);
    } catch (error) {
      logger.error('Duplicate analysis error:', error);
      return {
        isDuplicate: false,
        similarityScore: 0,
        similarTestCases: [],
        recommendation: 'Unable to analyze'
      };
    }
  }
}
EOF

cat > backend/src/services/cypressGenerator.js << 'EOF'
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class CypressGenerator {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('Gemini API key not configured');
      return;
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async generateTest(testCase, options = {}) {
    if (!this.model) {
      throw new Error('Gemini API not configured');
    }

    const prompt = this.buildCypressPrompt(testCase, options);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseCypressTest(text);
    } catch (error) {
      logger.error('Cypress generation error:', error);
      throw error;
    }
  }

  buildCypressPrompt(testCase, options) {
    const { 
      baseUrl = 'http://localhost:3000',
      selectorStrategy = 'multiple',
      pageObject = false 
    } = options;

    return `
      Generate a Cypress test for the following test case:
      
      Test Case:
      ${JSON.stringify(testCase, null, 2)}
      
      Requirements:
      1. Base URL: ${baseUrl}
      2. Use ${selectorStrategy} selector strategies (data-testid, CSS, text)
      3. ${pageObject ? 'Use Page Object pattern' : 'Use direct commands'}
      4. Include proper assertions
      5. Add error handling
      6. Generate self-healing selectors with fallbacks
      7. Include test data generation where needed
      
      Format the output as a complete Cypress test file with:
      - Proper describe/it blocks
      - Before/beforeEach hooks if needed
      - Comments explaining complex logic
      - Multiple selector strategies for each element
      
      Return the code in a JSON object with:
      - code: the complete test code
      - selectors: array of selectors used
      - dependencies: any required imports
    `;
  }

  parseCypressTest(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: return as code only
      return {
        code: text,
        selectors: [],
        dependencies: []
      };
    } catch (error) {
      logger.error('Failed to parse Cypress test:', error);
      return {
        code: text,
        selectors: [],
        dependencies: []
      };
    }
  }

  async getTemplates() {
    const templatesDir = path.join(process.cwd(), 'cypress-templates');
    try {
      const files = await fs.readdir(templatesDir);
      const templates = [];
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.cy.js')) {
          const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');
          templates.push({
            name: file,
            content: content
          });
        }
      }
      
      return templates;
    } catch (error) {
      logger.warn('No templates found:', error);
      return [];
    }
  }
}
EOF

cat > backend/src/services/githubService.js << 'EOF'
import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger.js';

export class GitHubService {
  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      logger.warn('GitHub token not configured');
      return;
    }
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    this.owner = process.env.GITHUB_OWNER;
    this.repo = process.env.GITHUB_REPO;
  }

  async getFileContent(path) {
    if (!this.octokit) {
      throw new Error('GitHub not configured');
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: path
      });
      
      if (data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      logger.error(`Failed to fetch file ${path}:`, error);
      return null;
    }
  }

  async analyzeTestStructure(repoPath = 'cypress/e2e') {
    if (!this.octokit) {
      throw new Error('GitHub not configured');
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: repoPath
      });

      const testFiles = [];
      for (const item of data) {
        if (item.type === 'file' && (item.name.endsWith('.cy.js') || item.name.endsWith('.spec.js'))) {
          const content = await this.getFileContent(item.path);
          testFiles.push({
            name: item.name,
            path: item.path,
            structure: this.analyzeTestFile(content)
          });
        }
      }

      return {
        files: testFiles,
        patterns: this.extractPatterns(testFiles)
      };
    } catch (error) {
      logger.error('Failed to analyze test structure:', error);
      throw error;
    }
  }

  analyzeTestFile(content) {
    const analysis = {
      hasPageObjects: /import.*pages?/i.test(content),
      hasCustomCommands: /cy\..*\(/.test(content),
      selectorTypes: [],
      hooks: []
    };

    // Detect selector types
    if (/data-testid|data-cy/i.test(content)) {
      analysis.selectorTypes.push('data-testid');
    }
    if (/\[class.*=|\.class/i.test(content)) {
      analysis.selectorTypes.push('css');
    }
    if (/cy\.contains/i.test(content)) {
      analysis.selectorTypes.push('text');
    }

    // Detect hooks
    ['before', 'beforeEach', 'after', 'afterEach'].forEach(hook => {
      if (new RegExp(`${hook}\\s*\\(`).test(content)) {
        analysis.hooks.push(hook);
      }
    });

    return analysis;
  }

  extractPatterns(testFiles) {
    const patterns = {
      usePageObjects: false,
      commonSelectors: [],
      commonHooks: [],
      testStructure: 'standard'
    };

    // Analyze patterns across all files
    testFiles.forEach(file => {
      if (file.structure.hasPageObjects) {
        patterns.usePageObjects = true;
      }
      patterns.commonHooks = [...new Set([...patterns.commonHooks, ...file.structure.hooks])];
    });

    return patterns;
  }
}
EOF

# Backend Utils
cat > backend/src/utils/logger.js << 'EOF'
import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat)
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add file transports
logger.add(new winston.transports.File({ 
  filename: path.join(logsDir, 'error.log'), 
  level: 'error' 
}));

logger.add(new winston.transports.File({ 
  filename: path.join(logsDir, 'combined.log') 
}));
EOF

cat > backend/src/utils/database.js << 'EOF'
import { Sequelize } from 'sequelize';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: (msg) => logger.debug(msg)
});

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    
    // Sync models
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
}
EOF

cat > backend/src/middleware/errorHandler.js << 'EOF'
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error(err.stack);

  if (err.response) {
    // API error from external service
    return res.status(err.response.status || 500).json({
      error: err.response.data?.message || err.message,
      service: err.config?.baseURL
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
EOF

# Backend Models
cat > backend/src/models/testCase.js << 'EOF'
import { DataTypes } from 'sequelize';
import { sequelize } from '../utils/database.js';

export const TestCase = sequelize.define('TestCase', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  jiraKey: {
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  steps: {
    type: DataTypes.JSON
  },
  expectedResult: {
    type: DataTypes.TEXT
  },
  testRailId: {
    type: DataTypes.STRING
  },
  cypressGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});
EOF

cat > backend/src/models/sprint.js << 'EOF'
import { DataTypes } from 'sequelize';
import { sequelize } from '../utils/database.js';

export const Sprint = sequelize.define('Sprint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  jiraId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING
  },
  startDate: {
    type: DataTypes.DATE
  },
  endDate: {
    type: DataTypes.DATE
  },
  boardId: {
    type: DataTypes.STRING
  }
});
EOF

echo "✅ All backend files created successfully!"
