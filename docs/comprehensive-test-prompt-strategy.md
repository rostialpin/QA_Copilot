# Comprehensive Test Generation Prompt Strategy

## The Challenge
Connect three critical pieces:
1. **JIRA Ticket** (Requirements) - What needs to be tested
2. **Similar Tests** (Context) - How we test similar features  
3. **AI Understanding** (Intelligence) - Generate appropriate tests

## Master Prompt Template

```javascript
const masterPrompt = `
You are a QA Engineer creating test cases for a new feature/bug fix.

=== PRIMARY REQUIREMENTS (Most Important) ===
TICKET: ${ticket.key} - ${ticket.type}
TITLE: ${ticket.summary}
DESCRIPTION: 
${ticket.description}

ACCEPTANCE CRITERIA:
${ticket.acceptanceCriteria || 'Not specified - derive from description'}

=== ANALYSIS TASKS ===
1. Extract the core functionality from the title and description
2. Identify all user interactions mentioned
3. List all expected outcomes
4. Note any edge cases or error conditions mentioned
5. Identify platform-specific requirements (if any)

=== CONTEXT FROM SIMILAR TESTS ===
These existing tests from "${contextFolder.name}" show how we test similar features:

${contextFolder.tests.slice(0, 5).map(test => `
Test: ${test.title}
Purpose: Tests ${extractPurpose(test)}
Key Steps: ${extractKeySteps(test)}
`).join('\n')}

PATTERNS TO FOLLOW:
- Test naming: ${detectNamingPattern(contextFolder.tests)}
- Structure: ${detectStructurePattern(contextFolder.tests)}
- Coverage areas: ${detectCoveragePattern(contextFolder.tests)}

=== GENERATION REQUIREMENTS ===

MUST HAVE:
1. Cover ALL acceptance criteria from the ticket
2. Test the specific functionality in the title
3. Include positive, negative, and edge cases
4. Follow patterns from similar tests

AVOID:
1. Don't duplicate these existing scenarios: ${listExistingScenarios(contextFolder.tests)}
2. Don't test unrelated functionality
3. Don't assume features not mentioned in the ticket

OUTPUT FORMAT:
For each test case provide:
- Title: Clear, following the folder's naming pattern
- Objective: What this test validates
- Preconditions: Required setup
- Steps: Detailed, numbered steps
- Expected Results: Clear pass/fail criteria
- Test Data: Specific data needed
- Platform Notes: Any CTV/Roku differences

=== SPECIFIC FOCUS AREAS ===
Based on the ticket type (${ticket.type}):
${getTypeSpecificGuidance(ticket.type)}

Now generate comprehensive test cases for this ticket.
`
```

## Parsing Strategies for Different Description Formats

### 1. **Well-Structured Descriptions**
```javascript
// Example: Clear requirements
"As a user, I want to skip the intro 
so that I can start watching content immediately.

Requirements:
- Skip button appears after 5 seconds
- Clicking skip jumps to main content
- Analytics event fired"

// AI extracts:
{
  user_story: "skip intro to start watching immediately",
  requirements: [
    "button timing: 5 seconds",
    "action: jump to main content", 
    "tracking: analytics event"
  ]
}
```

### 2. **Unstructured Descriptions**
```javascript
// Example: Informal description
"Users complaining about having to watch the same intro 
every time. PO wants a skip button like Netflix has. 
Should work on both CTV and Roku."

// AI extracts:
{
  problem: "repetitive intro viewing",
  solution: "skip button",
  reference: "Netflix-like functionality",
  platforms: ["CTV", "Roku"]
}
```

### 3. **Bug Descriptions**
```javascript
// Example: Bug report
"Skip button not working on Roku. 
Works fine on CTV. 
Clicking does nothing, no errors in console."

// AI extracts:
{
  issue: "skip button non-functional",
  affected_platform: "Roku",
  working_platform: "CTV",
  symptoms: ["no response on click", "no console errors"],
  test_focus: "platform-specific button activation"
}
```

## UI Design to Connect Everything

### Proposed Layout:

```
┌────────────────────────────────────────────────────────────┐
│                   Smart Test Generator                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📋 TICKET DETAILS                    [ESWCTV-1234]  │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ Title: Add skip intro button to video player        │  │
│  │ Type: Story | Priority: High | Sprint: 42           │  │
│  │                                                      │  │
│  │ Description:                                         │  │
│  │ ┌─────────────────────────────────────────────────┐ │  │
│  │ │ Users need ability to skip repetitive intros... │ │  │
│  │ │ [Show More]                                     │ │  │
│  │ └─────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │ 🎯 AI Extracted Requirements:                       │  │
│  │ • Skip button after 5 seconds                       │  │
│  │ • Works on CTV and Roku                             │  │
│  │ • Analytics tracking required                       │  │
│  │ [Edit/Refine]                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📁 CONTEXT FOLDER           [Select Similar Tests]  │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ Selected: Unified OAO > Video Player Tests          │  │
│  │                                                      │  │
│  │ 🔍 Similar Tests Found (15):                        │  │
│  │ □ Video Player - Play/Pause Controls                │  │
│  │ □ Video Player - Skip Ad Button                     │  │
│  │ □ Video Player - Seek Bar Navigation                │  │
│  │ [View All] [Change Folder]                          │  │
│  │                                                      │  │
│  │ 📊 Patterns Detected:                               │  │
│  │ • Naming: "Video Player - [Feature]"                │  │
│  │ • Structure: Setup → Action → Validation           │  │
│  │ • Always tests both platforms                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🤖 AI GENERATION OPTIONS                            │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ Coverage Level:                                     │  │
│  │ ○ Basic (Happy Path)                                │  │
│  │ ● Comprehensive (All Scenarios)                     │  │
│  │ ○ Extended (Edge Cases + Performance)               │  │
│  │                                                      │  │
│  │ Test Types to Generate:                             │  │
│  │ ☑ Functional  ☑ Negative  ☑ Edge Cases            │  │
│  │ ☐ Performance ☐ Security  ☐ Accessibility          │  │
│  │                                                      │  │
│  │ Platform Specific:                                  │  │
│  │ ☑ Unified (Both CTV & Roku)                        │  │
│  │ ☐ CTV Only  ☐ Roku Only                            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  [🔄 Analyze Ticket] [🎯 Generate Tests] [💾 Save Draft]  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### After Generation:

```
┌────────────────────────────────────────────────────────────┐
│                  Generated Test Cases                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 Summary: 5 Test Cases Generated                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Test 1: Video Player - Skip Intro Button Display    │  │
│  │ ✓ Covers: Requirement #1 (5-second display)         │  │
│  │ ✓ Pattern: Follows "Video Player - [Feature]"       │  │
│  │ ⚠️ Similar to: "Skip Ad Button" (42% match)         │  │
│  │                                                      │  │
│  │ [Expand Details] [Edit] [Remove]                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Test 2: Video Player - Skip Intro Functionality     │  │
│  │ ✓ Covers: Requirement #2 (jump to content)          │  │
│  │ ✓ New Coverage: Not found in existing tests         │  │
│  │                                                      │  │
│  │ [Expand Details] [Edit] [Remove]                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Quality Score: 92/100                                     │
│  ✓ All requirements covered                                │
│  ✓ No duplicates detected                                  │
│  ✓ Follows folder patterns                                 │
│  ⚠️ Consider adding: Error recovery test                   │
│                                                             │
│  [♻️ Regenerate] [✏️ Edit All] [💾 Save to TestRail]      │
└────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Parsing
```javascript
// Intelligent requirement extraction
const extractRequirements = (ticket) => {
  // Look for keywords
  const keywords = {
    actions: ['click', 'tap', 'select', 'enter', 'skip', 'play'],
    conditions: ['when', 'if', 'after', 'before', 'until'],
    validations: ['should', 'must', 'verify', 'ensure', 'check'],
    platforms: ['ctv', 'roku', 'web', 'mobile', 'tv']
  };
  
  // Parse description for requirements
  const requirements = parseDescriptionIntelligently(
    ticket.description,
    keywords
  );
  
  return requirements;
};
```

### Phase 2: Context Integration
```javascript
// Connect ticket to context
const connectContext = (ticket, folderTests) => {
  return {
    primaryGoal: ticket.summary,
    requirements: extractRequirements(ticket),
    similarPatterns: analyzeFolderPatterns(folderTests),
    gaps: identifyTestGaps(ticket, folderTests),
    suggestedApproach: recommendTestStrategy(ticket, folderTests)
  };
};
```

### Phase 3: Smart Generation
```javascript
// Generate with full context
const generateSmartTests = async (ticket, context) => {
  const enrichedPrompt = buildMasterPrompt(ticket, context);
  const tests = await geminiService.generate(enrichedPrompt);
  
  // Post-process to ensure quality
  return validateAndEnhance(tests, context);
};
```

## Benefits of This Approach

1. **Requirements-First**: Always starts with what needs to be tested
2. **Context-Aware**: Uses similar tests as examples, not requirements
3. **Intelligent Parsing**: Extracts requirements even from poor descriptions
4. **Visual Clarity**: User sees how everything connects
5. **Quality Assurance**: Shows coverage and pattern compliance

This creates a bridge between:
- **Product Owner's Intent** (in the ticket)
- **QA Best Practices** (in existing tests)
- **AI Capabilities** (connecting the dots)

The UI challenge is real, but this layout shows everything while keeping it organized and actionable!