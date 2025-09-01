// Demo tickets for Hackathon presentation
// These are structured to showcase the system's capabilities

export const demoTickets = {
  // Perfect structured ticket for demo
  ESWCTV_DEMO_001: {
    key: 'ESWCTV-5001',
    type: 'Story',
    status: 'In Progress',
    priority: 'High',
    summary: 'Add Skip Intro Button to Video Player',
    reporter: 'Sarah Chen (Product Owner)',
    assignee: 'Development Team',
    sprint: 'Sprint 42',
    storyPoints: 5,
    labels: ['video-player', 'user-experience', 'ctv', 'roku'],
    
    description: `
## Overview
Users have requested the ability to skip intro sequences when watching content on our Unified OAO platform.

## Business Value
- Reduces friction for binge-watching sessions
- Improves user satisfaction scores
- Aligns with industry standards (Netflix, Disney+)

## Requirements

### Functional Requirements
1. **Skip Intro Button Display**
   - Button SHALL appear 5 seconds after intro starts
   - Button SHALL remain visible for 10 seconds
   - Button SHALL display "Skip Intro" text
   - Button SHALL be accessible via remote navigation

2. **Skip Functionality**
   - Clicking/selecting button SHALL skip to main content timestamp
   - Skip SHALL be smooth without buffering
   - System SHALL remember skip preference for series

3. **Platform Behavior**
   - CTV: Button positioned in bottom-right corner
   - Roku: Button positioned in bottom-right corner
   - Both: Accessible via OK/Select button on remote

### Non-Functional Requirements
- Response time: < 500ms from button press to skip
- Analytics: Track skip intro usage per user/content
- Accessibility: Support screen readers

## Acceptance Criteria
- [ ] Skip intro button appears after 5 seconds of intro playback
- [ ] Button is accessible via remote control navigation
- [ ] Selecting button skips to main content (post-intro timestamp)
- [ ] Skip action is tracked in analytics
- [ ] Feature works on both CTV and Roku platforms
- [ ] No degradation in video playback performance

## Technical Notes
- Intro timestamps provided via metadata API
- Use existing VideoPlayerControls component
- Follow design system for button styling

## Test Considerations
- Test with various intro lengths (30s, 60s, 90s)
- Test remote navigation accessibility
- Test analytics event firing
- Verify no memory leaks during skip action
`,
    
    // Additional metadata for demo
    confluenceLinks: [
      'https://confluence.paramount.tech/display/STREAMING/Video+Player+Controls',
      'https://confluence.paramount.tech/display/UX/Skip+Intro+Design'
    ],
    
    relatedTickets: [
      'ESWCTV-4950 - Skip Recap Button',
      'ESROKU-2100 - Video Player Control Improvements'
    ],
    
    // Expected test scenarios (for demo validation)
    expectedTests: [
      'Skip Intro Button Display Timing',
      'Skip Intro Functionality',
      'Remote Navigation Accessibility',
      'Analytics Event Tracking',
      'Platform-Specific Behavior',
      'Edge Cases (No Intro, Short Video)',
      'Performance During Skip'
    ]
  },

  // Bug ticket example
  ESWCTV_DEMO_002: {
    key: 'ESWCTV-5002',
    type: 'Bug',
    status: 'Open',
    priority: 'Critical',
    summary: 'Skip Intro Button Not Responding on Roku Platform',
    reporter: 'QA Team',
    assignee: 'Platform Team',
    
    description: `
## Bug Description
The Skip Intro button is not responding to remote control input on Roku devices.

## Environment
- Platform: Roku Ultra 4800X
- App Version: 3.2.1
- Build: 2024.12.15.001

## Steps to Reproduce
1. Launch Unified OAO app on Roku
2. Start playing any series with intro
3. Wait for Skip Intro button to appear (5 seconds)
4. Navigate to Skip Intro button using remote
5. Press OK/Select button

## Expected Result
- Video should skip to main content timestamp

## Actual Result
- Button highlights but does not trigger skip action
- No console errors observed
- Analytics event is NOT fired

## Additional Information
- Issue ONLY occurs on Roku platform
- CTV platform works as expected
- Issue started after build 2024.12.15.001

## Workaround
None available - users must watch full intro

## Impact
- Affecting 100% of Roku users
- Customer complaints increasing
- Engagement metrics dropping for Roku platform
`,
    
    expectedTests: [
      'Roku Skip Button Focus State',
      'Roku Skip Button Activation',
      'Cross-Platform Comparison Test',
      'Event Listener Verification',
      'Regression Test for Build 2024.12.15.001'
    ]
  },

  // Simple task example
  ESWCTV_DEMO_003: {
    key: 'ESWCTV-5003',
    type: 'Task',
    status: 'To Do',
    priority: 'Medium',
    summary: 'Update Skip Intro Button Color to Match Brand Guidelines',
    
    description: `
Change the Skip Intro button background color from #FFFFFF to #6B46C1 (Paramount purple) to match brand guidelines.

The text should remain white for contrast.

This change should apply to both CTV and Roku platforms.
`,
    
    expectedTests: [
      'Skip Intro Button Color Verification',
      'Text Contrast Validation',
      'Brand Guideline Compliance'
    ]
  }
};

// Mock TestRail context for demo
export const demoTestRailContext = {
  project: {
    id: 167,
    name: 'Unified OAO'
  },
  suite: {
    id: 14819,
    name: 'Master'
  },
  section: {
    id: 98765,
    name: 'Video Player Controls',
    parent_id: null
  },
  existingTests: [
    {
      id: 1001,
      title: 'Video Player - Play/Pause Toggle',
      custom_steps: `
1. Navigate to video player
2. Press play button
3. Verify video starts playing
4. Press pause button
5. Verify video pauses`,
      custom_expected: 'Video responds correctly to play/pause commands'
    },
    {
      id: 1002,
      title: 'Video Player - Skip Ad Button',
      custom_steps: `
1. Navigate to video with ad
2. Wait for ad to start
3. Wait for "Skip Ad" button (5 seconds)
4. Click Skip Ad button
5. Verify ad is skipped`,
      custom_expected: 'Ad is skipped and main content plays'
    },
    {
      id: 1003,
      title: 'Video Player - Seek Bar Navigation',
      custom_steps: `
1. Navigate to video player
2. Start video playback
3. Use remote to navigate to seek bar
4. Press right to seek forward
5. Press left to seek backward`,
      custom_expected: 'Video seeks correctly in both directions'
    },
    {
      id: 1004,
      title: 'Video Player - Closed Captions Toggle',
      custom_steps: `
1. Navigate to video player
2. Access player controls
3. Navigate to CC button
4. Toggle closed captions on
5. Verify captions display`,
      custom_expected: 'Closed captions display when enabled'
    },
    {
      id: 1005,
      title: 'Video Player - Volume Control',
      custom_steps: `
1. Navigate to video player
2. Access volume controls
3. Increase volume
4. Decrease volume
5. Mute/unmute`,
      custom_expected: 'Volume adjusts correctly'
    }
  ]
};

// Helper function to get demo ticket
export const getDemoTicket = (ticketKey = 'ESWCTV-5001') => {
  const key = ticketKey.replace('-', '_DEMO_');
  return demoTickets[key] || demoTickets.ESWCTV_DEMO_001;
};

// Helper function to simulate JIRA API response
export const mockJiraTicketResponse = (ticketKey) => {
  const ticket = getDemoTicket(ticketKey);
  return {
    id: Math.random().toString(36).substr(2, 9),
    key: ticket.key,
    fields: {
      summary: ticket.summary,
      description: ticket.description,
      issuetype: { name: ticket.type },
      priority: { name: ticket.priority },
      status: { name: ticket.status },
      reporter: { displayName: ticket.reporter },
      assignee: { displayName: ticket.assignee },
      labels: ticket.labels,
      customfield_10008: ticket.storyPoints, // Story points
      customfield_10020: [{ name: ticket.sprint }], // Sprint
    }
  };
};

// Demo prompt template that works perfectly with structured ticket
export const getDemoPrompt = (ticket, context) => {
  return `
You are an expert QA Engineer creating comprehensive test cases for the Unified OAO platform.

=== TICKET INFORMATION ===
Ticket: ${ticket.key}
Type: ${ticket.type}
Title: ${ticket.summary}

Description:
${ticket.description}

=== CONTEXT FROM SIMILAR TESTS ===
You should follow the patterns from these existing tests in the "Video Player Controls" folder:

${context.existingTests.map(test => `
Test: "${test.title}"
Steps: ${test.custom_steps}
Expected: ${test.custom_expected}
`).join('\n')}

=== IMPORTANT PATTERNS TO FOLLOW ===
1. Test Naming: Use format "Video Player - [Feature Being Tested]"
2. Structure: Number each step, be specific about actions
3. Platform Notes: Mention both CTV and Roku when applicable
4. Coverage: Include positive, negative, and edge cases

=== YOUR TASK ===
Generate comprehensive test cases that:
1. Cover ALL acceptance criteria from the ticket
2. Follow the naming and structure patterns shown above
3. Include platform-specific validations for CTV and Roku
4. Test edge cases and error conditions
5. Verify analytics and performance requirements

For each test case, provide:
- Title (following the pattern)
- Objective (what it validates)
- Preconditions
- Test Steps (numbered)
- Expected Results
- Platform Notes (if different for CTV/Roku)

DO NOT duplicate these existing scenarios:
- Play/Pause Toggle (already covered)
- Skip Ad Button (similar but different from Skip Intro)
- Seek Bar Navigation (already covered)
- Closed Captions (already covered)
- Volume Control (already covered)

Focus on the NEW Skip Intro functionality described in the ticket.
`;
};