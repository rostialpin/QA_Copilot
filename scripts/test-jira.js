#!/usr/bin/env node

// Test JIRA Connection
import axios from 'axios';

const ATLASSIAN_URL = process.env.ATLASSIAN_URL;
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_TOKEN = process.env.ATLASSIAN_TOKEN;

console.log('🔍 Testing JIRA Connection...');
console.log('================================');
console.log(`URL: ${ATLASSIAN_URL}`);
console.log(`Email: ${ATLASSIAN_EMAIL}`);
console.log(`Token starts with: ${ATLASSIAN_TOKEN?.substring(0, 10)}...`);
console.log('================================\n');

async function testJiraConnection() {
  if (!ATLASSIAN_URL || !ATLASSIAN_EMAIL || !ATLASSIAN_TOKEN) {
    console.error('❌ Missing environment variables!');
    console.error('Please ensure these are set in your ~/.zshrc:');
    console.error('- ATLASSIAN_URL');
    console.error('- ATLASSIAN_EMAIL');
    console.error('- ATLASSIAN_TOKEN');
    process.exit(1);
  }

  // Clean up URL
  const baseURL = ATLASSIAN_URL.endsWith('/') ? ATLASSIAN_URL.slice(0, -1) : ATLASSIAN_URL;
  
  // Create auth header
  const authString = Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_TOKEN}`).toString('base64');

  try {
    // Test 1: Get current user
    console.log('📝 Test 1: Getting current user info...');
    const userResponse = await axios({
      method: 'GET',
      url: `${baseURL}/rest/api/2/myself`,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ Authentication successful!');
    console.log(`   Logged in as: ${userResponse.data.displayName}`);
    console.log(`   Email: ${userResponse.data.emailAddress}`);
    console.log(`   Account ID: ${userResponse.data.accountId}\n`);

    // Test 2: Get projects
    console.log('📝 Test 2: Getting projects...');
    const projectsResponse = await axios({
      method: 'GET',
      url: `${baseURL}/rest/api/2/project`,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`✅ Found ${projectsResponse.data.length} projects:`);
    projectsResponse.data.slice(0, 5).forEach(project => {
      console.log(`   - ${project.key}: ${project.name}`);
    });
    if (projectsResponse.data.length > 5) {
      console.log(`   ... and ${projectsResponse.data.length - 5} more\n`);
    }

    // Test 3: Try to get boards (might fail if no Jira Software)
    console.log('📝 Test 3: Checking for Agile boards...');
    try {
      const boardsResponse = await axios({
        method: 'GET',
        url: `${baseURL}/rest/agile/1.0/board`,
        headers: {
          'Authorization': `Basic ${authString}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(`✅ Found ${boardsResponse.data.values.length} boards:`);
      boardsResponse.data.values.slice(0, 5).forEach(board => {
        console.log(`   - ${board.id}: ${board.name}`);
      });
    } catch (boardError) {
      if (boardError.response?.status === 404) {
        console.log('⚠️  Agile API not available (might be using Jira Core instead of Jira Software)');
      } else {
        console.log('⚠️  Could not fetch boards:', boardError.response?.status);
      }
    }

    // Test 4: Search for recent issues
    console.log('\n📝 Test 4: Searching for recent issues...');
    const jql = 'ORDER BY created DESC';
    const searchResponse = await axios({
      method: 'GET',
      url: `${baseURL}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=5`,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`✅ Found ${searchResponse.data.total} total issues. Recent 5:`);
    searchResponse.data.issues.forEach(issue => {
      console.log(`   - ${issue.key}: ${issue.fields.summary}`);
    });

    console.log('\n✅ All tests passed! JIRA connection is working correctly.');
    console.log('You can now use the QA Copilot application.\n');

  } catch (error) {
    console.error('\n❌ Connection failed!');
    
    if (error.response) {
      console.error(`Status: ${error.response.status} - ${error.response.statusText}`);
      
      if (error.response.status === 403) {
        console.error('\n🔐 403 Forbidden - Authentication issue. Please check:');
        console.error('1. Your API token is valid and not expired');
        console.error('2. Generate a new token at:');
        console.error('   https://id.atlassian.com/manage-profile/security/api-tokens');
        console.error('3. Make sure you are using an API token, NOT your password');
        console.error('4. The service account has proper permissions');
      } else if (error.response.status === 401) {
        console.error('\n🔐 401 Unauthorized - Invalid credentials');
        console.error('Check your email and API token are correct');
      } else if (error.response.status === 404) {
        console.error('\n🔍 404 Not Found - Check your ATLASSIAN_URL');
        console.error(`Current URL: ${baseURL}`);
      }
      
      if (error.response.data) {
        console.error('\nError details:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testJiraConnection();
