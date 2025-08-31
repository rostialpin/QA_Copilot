import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';
import open from 'open';
import http from 'http';
import url from 'url';

export class JiraOAuthService {
  constructor() {
    this.baseURL = process.env.ATLASSIAN_URL || 'https://paramount.atlassian.net';
    this.clientId = process.env.ATLASSIAN_CLIENT_ID;
    this.clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
    this.redirectUri = 'http://localhost:3000/callback';
    this.cache = new NodeCache({ stdTTL: 300 });
    
    // Try to use existing token or personal API token
    this.accessToken = process.env.ATLASSIAN_ACCESS_TOKEN;
    this.personalToken = process.env.ATLASSIAN_TOKEN;
    this.email = process.env.ATLASSIAN_EMAIL;
    
    if (this.baseURL) {
      this.baseURL = this.baseURL.replace(/\/$/, ''); // Remove trailing slash
    }
  }

  async authenticate() {
    // If we have a personal API token, use that (simpler)
    if (this.personalToken && this.email) {
      logger.info('Using personal API token authentication');
      return true;
    }

    // Otherwise, try OAuth
    if (!this.clientId || !this.clientSecret) {
      logger.error('OAuth credentials not configured. Please use personal API token instead.');
      return false;
    }

    return new Promise((resolve, reject) => {
      const authUrl = `https://auth.atlassian.com/authorize?` +
        `audience=api.atlassian.com&` +
        `client_id=${this.clientId}&` +
        `scope=${encodeURIComponent('read:jira-work read:jira-user')}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `response_type=code&` +
        `prompt=consent`;

      // Create temporary server to handle callback
      const server = http.createServer(async (req, res) => {
        const queryObject = url.parse(req.url, true).query;
        
        if (queryObject.code) {
          try {
            // Exchange code for token
            const tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
              grant_type: 'authorization_code',
              client_id: this.clientId,
              client_secret: this.clientSecret,
              code: queryObject.code,
              redirect_uri: this.redirectUri
            });

            this.accessToken = tokenResponse.data.access_token;
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>');
            
            server.close();
            resolve(true);
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication failed!</h1>');
            server.close();
            reject(error);
          }
        }
      });

      server.listen(3000, () => {
        logger.info('Opening browser for authentication...');
        open(authUrl);
      });
    });
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const cacheKey = `${method}:${endpoint}`;
    
    if (method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      let headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      // Use personal API token if available
      if (this.personalToken && this.email) {
        const authString = Buffer.from(`${this.email}:${this.personalToken}`).toString('base64');
        headers['Authorization'] = `Basic ${authString}`;
      } else if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      } else {
        throw new Error('No authentication method available');
      }

      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        data,
        headers
      });

      if (method === 'GET') {
        this.cache.set(cacheKey, response.data);
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 403) {
        logger.error('403 Forbidden - This might be due to:');
        logger.error('1. Okta SSO restrictions on service accounts');
        logger.error('2. API access disabled for this account');
        logger.error('3. Try using your personal account instead of service account');
      }
      throw error;
    }
  }

  // ... rest of the methods remain the same
}
