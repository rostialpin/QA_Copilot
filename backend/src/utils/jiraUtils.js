import { logger } from './logger.js';

/**
 * Parses a JIRA URL to extract the base Atlassian URL
 * Handles various JIRA URL formats including board URLs and issue URLs
 * @param {string} url - The JIRA URL (can be board URL, issue URL, or base URL)
 * @returns {string|null} - The base Atlassian URL or null if invalid
 */
export function parseJiraUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url);
    
    // Check if it's an Atlassian URL
    if (!urlObj.hostname.includes('atlassian.net')) {
      logger.warn(`URL does not appear to be an Atlassian URL: ${url}`);
      return null;
    }

    // Extract the base URL (protocol + hostname)
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    
    // Clean up and validate
    if (baseUrl.endsWith('/')) {
      return baseUrl.slice(0, -1);
    }
    
    return baseUrl;
  } catch (error) {
    logger.error(`Error parsing JIRA URL: ${url}`, error);
    return null;
  }
}

/**
 * Validates JIRA configuration object
 * @param {Object} config - Configuration object with host, email, apiToken
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateJiraConfig(config) {
  const errors = [];
  
  if (!config) {
    errors.push('Configuration is required');
    return { isValid: false, errors };
  }

  if (!config.host || typeof config.host !== 'string') {
    errors.push('JIRA host URL is required');
  } else {
    const baseUrl = parseJiraUrl(config.host);
    if (!baseUrl) {
      errors.push('Invalid JIRA host URL - must be an Atlassian URL');
    }
  }

  if (!config.email || typeof config.email !== 'string') {
    errors.push('Email is required');
  } else if (!config.email.includes('@')) {
    errors.push('Invalid email format');
  }

  if (!config.apiToken || typeof config.apiToken !== 'string') {
    errors.push('API token is required');
  } else if (config.apiToken.length < 10) {
    errors.push('API token appears to be too short');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extracts JIRA configuration from request headers
 * @param {Object} req - Express request object
 * @returns {Object|null} - JIRA configuration or null if not found
 */
export function extractJiraConfigFromHeaders(req) {
  const host = req.headers['x-jira-host'];
  const email = req.headers['x-jira-email'];
  const apiToken = req.headers['x-jira-token'];

  if (!host || !email || !apiToken) {
    return null;
  }

  return { host, email, apiToken };
}