/**
 * JIRA Field Filter Configuration
 * One-time configuration to define which fields are used for test generation
 * This is hardcoded after analysis - not user configurable
 */

export const JIRA_FIELD_FILTER = {
  // Fields to INCLUDE for test generation
  includeFields: [
    'key',           // Ticket ID (e.g., ESWCTV-1234)
    'summary',       // Title of the ticket
    'description',   // Main description
    'issuetype',     // Bug, Story, Task, etc.
    'priority',      // P0, P1, P2, etc.
    'status',        // Current status
    'components',    // Product components affected
    'labels',        // Tags/labels for categorization
    
    // Custom fields we know are useful (adjust based on your JIRA)
    'customfield_10014',  // Acceptance Criteria (common)
    'customfield_10020',  // Story Points
    'customfield_10106',  // Sprint
    
    // Fields that might contain test-relevant info
    'fixVersions',   // Version where fix/feature will be released
    'affectsVersions', // Versions affected by bug
    'environment',   // Test environment details
  ],

  // Fields to EXCLUDE (sensitive or irrelevant)
  excludeFields: [
    // User/Personal data
    'creator',
    'reporter',
    'assignee',
    'watches',
    'votes',
    
    // Time tracking
    'worklog',
    'timetracking',
    'timespent',
    'timeoriginalestimate',
    
    // Internal/Administrative
    'project',
    'resolution',
    'resolutiondate',
    'created',
    'updated',
    'lastViewed',
    
    // Comments might contain sensitive info
    'comment',
    
    // Attachments (binary data)
    'attachment',
    
    // All other custom fields not explicitly included
    'customfield_*',
  ],

  // Transform/Clean specific fields
  fieldTransformers: {
    description: (value) => {
      if (!value) return '';
      
      // Remove user mentions
      value = value.replace(/@\[.*?\]/g, '[user]');
      value = value.replace(/@\w+/g, '[user]');
      
      // Remove internal URLs
      value = value.replace(/https?:\/\/[^\s]*internal[^\s]*/gi, '[internal-url]');
      value = value.replace(/https?:\/\/[^\s]*jira[^\s]*/gi, '[jira-link]');
      value = value.replace(/https?:\/\/[^\s]*confluence[^\s]*/gi, '[confluence-link]');
      
      // Remove email addresses
      value = value.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');
      
      // Keep only test-relevant content
      return value;
    },
    
    summary: (value) => {
      if (!value) return '';
      // Clean up summary but keep it mostly intact
      return value.replace(/@\w+/g, '').trim();
    },
    
    // Extract acceptance criteria from custom field or description
    acceptanceCriteria: (ticket) => {
      // Try common custom field numbers for AC
      const acFields = [
        'customfield_10014',
        'customfield_10200',
        'customfield_10201',
      ];
      
      for (const field of acFields) {
        if (ticket[field]) {
          return ticket[field];
        }
      }
      
      // Try to extract from description if marked
      if (ticket.description) {
        const acMatch = ticket.description.match(/acceptance criteria:?([\s\S]*?)(?:\n\n|$)/i);
        if (acMatch) {
          return acMatch[1].trim();
        }
      }
      
      return null;
    }
  },

  // Extract test-specific information
  extractTestData: (ticket) => {
    const filtered = {};
    
    // Only include specified fields
    for (const field of JIRA_FIELD_FILTER.includeFields) {
      if (ticket[field] !== undefined && ticket[field] !== null) {
        filtered[field] = ticket[field];
      }
    }
    
    // Apply transformers
    if (filtered.description) {
      filtered.description = JIRA_FIELD_FILTER.fieldTransformers.description(filtered.description);
    }
    if (filtered.summary) {
      filtered.summary = JIRA_FIELD_FILTER.fieldTransformers.summary(filtered.summary);
    }
    
    // Extract acceptance criteria
    filtered.acceptanceCriteria = JIRA_FIELD_FILTER.fieldTransformers.acceptanceCriteria(ticket);
    
    // Determine test requirements based on ticket type
    filtered.testRequirements = {
      needsPositiveTests: true,
      needsNegativeTests: ticket.issuetype?.name === 'Bug',
      needsEdgeCases: ticket.priority?.name === 'P0' || ticket.priority?.name === 'P1',
      needsRegressionTests: ticket.issuetype?.name === 'Bug',
      needsPlatformTests: ticket.labels?.includes('cross-platform') || 
                          ticket.description?.toLowerCase().includes('roku') ||
                          ticket.description?.toLowerCase().includes('ctv'),
    };
    
    // Extract platforms mentioned
    filtered.platforms = extractPlatforms(ticket);
    
    return filtered;
  }
};

// Helper function to extract platform information
function extractPlatforms(ticket) {
  const platforms = new Set();
  const searchText = `${ticket.summary} ${ticket.description} ${ticket.labels?.join(' ')}`.toLowerCase();
  
  const platformKeywords = {
    roku: ['roku', 'esroku', 'esr'],
    ctv: ['ctv', 'eswctv', 'esw', 'tv'],
    web: ['web', 'browser', 'desktop'],
    mobile: ['mobile', 'ios', 'android', 'phone', 'tablet'],
  };
  
  for (const [platform, keywords] of Object.entries(platformKeywords)) {
    if (keywords.some(keyword => searchText.includes(keyword))) {
      platforms.add(platform);
    }
  }
  
  // Default to CTV and Roku if no platform specified (based on your project)
  if (platforms.size === 0) {
    platforms.add('ctv');
    platforms.add('roku');
  }
  
  return Array.from(platforms);
}

// Export a simple function to filter a ticket
export function filterJiraTicket(rawTicket) {
  return JIRA_FIELD_FILTER.extractTestData(rawTicket);
}

// Example usage:
/*
const rawTicket = {
  key: 'ESWCTV-1234',
  summary: 'Add Skip Intro button for video player',
  description: 'As a user @john.doe, I want to skip...',
  issuetype: { name: 'Story' },
  priority: { name: 'P1' },
  customfield_10014: '- Button appears after 5 seconds\n- Button works on Roku',
  // ... lots of other fields we don't need
};

const filteredTicket = filterJiraTicket(rawTicket);
// Returns only the fields needed for test generation
*/

export default JIRA_FIELD_FILTER;