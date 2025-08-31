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

    if (/data-testid|data-cy/i.test(content)) {
      analysis.selectorTypes.push('data-testid');
    }
    if (/\[class.*=|\.class/i.test(content)) {
      analysis.selectorTypes.push('css');
    }
    if (/cy\.contains/i.test(content)) {
      analysis.selectorTypes.push('text');
    }

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

    testFiles.forEach(file => {
      if (file.structure.hasPageObjects) {
        patterns.usePageObjects = true;
      }
      patterns.commonHooks = [...new Set([...patterns.commonHooks, ...file.structure.hooks])];
    });

    return patterns;
  }
}
