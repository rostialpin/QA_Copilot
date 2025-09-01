# Cypress Test Training Strategy

## Approach to Use Real Cypress Tests as Examples

### Option 1: Direct File Reference
Provide the agent with paths to existing Cypress tests in your GitHub repository:

```javascript
const cypressContext = {
  repository: "https://github.com/viacomcbs/unified-oao",
  testPaths: [
    "/cypress/e2e/video-player/playback.cy.js",
    "/cypress/e2e/video-player/controls.cy.js",
    "/cypress/e2e/navigation/remote-control.cy.js"
  ],
  patterns: {
    pageObjects: "/cypress/support/pages/",
    commands: "/cypress/support/commands.js",
    fixtures: "/cypress/fixtures/"
  }
};
```

### Option 2: Copy Test Patterns Locally
Copy a few exemplary test files into the project:

```
qa-copilot/
  /examples/
    /cypress-tests/
      video-player.cy.js      # Real test from your repo
      navigation.cy.js        # Real test from your repo
      test-patterns.md        # Documented patterns
```

### Option 3: Test Template Extraction
Extract patterns from your tests and create templates:

```javascript
const cypressTemplates = {
  testStructure: `
    describe('[Feature] - [Component]', () => {
      beforeEach(() => {
        cy.login();
        cy.visit('/path');
      });

      it('should [action] when [condition]', () => {
        // Arrange
        cy.get('[data-testid="element"]').should('be.visible');
        
        // Act
        cy.get('[data-testid="button"]').click();
        
        // Assert
        cy.get('[data-testid="result"]').should('contain', 'expected');
      });
    });
  `,
  
  selectors: {
    pattern: "data-testid",
    examples: [
      "video-player",
      "skip-intro-button",
      "playback-controls"
    ]
  },
  
  customCommands: [
    "cy.login()",
    "cy.navigateToVideo(videoId)",
    "cy.waitForVideoLoad()",
    "cy.skipToTimestamp(seconds)"
  ]
};
```

### Option 4: Dynamic GitHub Fetching
Fetch test files directly from GitHub during generation:

```javascript
async function fetchCypressExample(path) {
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = 'viacomcbs/unified-oao';
  
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    }
  );
  
  return await response.text();
}

// Use in prompt
const exampleTest = await fetchCypressExample('cypress/e2e/video-player/skip-intro.cy.js');
const prompt = `
  Generate a Cypress test following this pattern from our codebase:
  
  ${exampleTest}
  
  Now create a similar test for: ${newFeature}
`;
```

## Recommended Approach for Demo

### Step 1: Create Example Directory
```bash
mkdir -p qa-copilot/examples/cypress-tests
```

### Step 2: Copy 2-3 Real Tests
Copy your best, most representative Cypress tests:
- One happy path test
- One with error handling
- One with platform-specific logic

### Step 3: Document Patterns
Create a patterns file:

```markdown
# Our Cypress Test Patterns

## Naming Convention
- Files: `feature-name.cy.js`
- Describes: `[Component] - [Feature]`
- Tests: `should [action] when [condition]`

## Page Objects
We use page objects in `/cypress/support/pages/`

## Custom Commands
- `cy.login()` - Handles authentication
- `cy.navigateToVideo()` - Goes to video player
- `cy.waitForVideoLoad()` - Waits for player ready

## Selectors
Always use `data-testid` attributes

## Platform Handling
```javascript
if (Cypress.env('platform') === 'roku') {
  cy.remoteControl('OK');
} else {
  cy.get('[data-testid="button"]').click();
}
```
```

### Step 4: Enhanced Prompt Generation

```javascript
const generateCypressWithContext = async (testCase, ticket) => {
  // Load example tests
  const exampleTests = await loadExampleTests();
  
  // Build context-aware prompt
  const prompt = `
    You are generating Cypress tests for our Unified OAO platform.
    
    CONTEXT FROM OUR CODEBASE:
    =========================
    Here are examples of our existing Cypress tests:
    
    ${exampleTests}
    
    OUR PATTERNS:
    - Use data-testid selectors
    - Include beforeEach setup
    - Use our custom commands
    - Handle both CTV and Roku platforms
    
    TICKET TO AUTOMATE:
    ==================
    ${ticket.key}: ${ticket.summary}
    ${ticket.description}
    
    TEST CASE TO CONVERT:
    ====================
    ${testCase.title}
    Steps: ${testCase.steps}
    
    Generate a Cypress test that:
    1. Follows our exact patterns
    2. Uses our custom commands
    3. Includes platform handling if needed
    4. Uses our selector conventions
  `;
  
  return await geminiService.generate(prompt);
};
```

## For Your Demo

1. **Pick 2 real Cypress tests** from your repo that test similar features
2. **Save them locally** in the examples folder
3. **Reference them in the prompt** when generating new tests
4. The AI will **follow your exact patterns** instead of generic Cypress

This way, the generated tests will look like they were written by your team!

## Example Implementation

```javascript
// In your UnifiedGenerator component
const handleCypressGeneration = async () => {
  // Load your real test patterns
  const videoPlayerTest = await fetch('/examples/cypress-tests/video-player.cy.js').then(r => r.text());
  
  // Include in generation request
  const response = await axios.post('/api/cypress/generate', {
    testCase: selectedTest,
    ticket: selectedTicket,
    examplePattern: videoPlayerTest,
    projectConfig: {
      baseUrl: 'https://www.paramountplus.com',
      selectors: 'data-testid',
      platforms: ['ctv', 'roku']
    }
  });
  
  setCypressCode(response.data.code);
};
```

This ensures the generated Cypress tests match your team's coding standards exactly!