# Intelligent Test Generation Workflow

## Overview
An AI-enhanced workflow that leverages existing tests to generate higher quality test cases while preventing duplicates.

## Architecture Flow

```
┌─────────────────┐
│  User Selects   │
│  JIRA Ticket    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pre-Flight     │
│  Analysis       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Context        │
│  Gathering      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Test        │
│  Generation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Quality        │
│  Review         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Save to        │
│  TestRail       │
└─────────────────┘
```

## Detailed Workflow Steps

### 1. **Ticket Selection & Analysis**
When user opens a JIRA ticket:

```javascript
{
  ticket: "ESWCTV-1234",
  title: "Add skip intro button to video player",
  type: "Story|Bug|Task",
  description: "...",
  acceptance_criteria: "...",
  project_mapping: {
    jira_project: "ESWCTV",
    testrail_project: "Unified OAO",
    platform: ["CTV", "Roku"]
  }
}
```

### 2. **Pre-Flight Analysis**
Before generating tests, perform automated checks:

#### a. **Feature Extraction**
```javascript
extracted_features: {
  component: "video_player",
  action: "skip_intro",
  user_interaction: "button_click",
  keywords: ["video", "player", "skip", "intro", "button"]
}
```

#### b. **Similar Test Search**
```javascript
// Search TestRail for similar tests
similar_tests = searchTestRail({
  project: "Unified OAO",
  keywords: ["video player", "skip", "intro"],
  fuzzy_match: true,
  threshold: 0.7
})
```

#### c. **Confluence Documentation**
```javascript
related_docs = fetchConfluence({
  links_from_ticket: true,
  search_keywords: extracted_features.keywords
})
```

### 3. **Context Gathering & Display**

#### UI Layout:
```
┌──────────────────────────────────────────────────────┐
│                  Test Generator                      │
├──────────────────────────────────────────────────────┤
│ Ticket: ESWCTV-1234 - Add skip intro button         │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────────────────┬────────────────────────┐│
│ │   Similar Tests Found   │   Related Context      ││
│ │                         │                        ││
│ │ ⚠️ 3 similar tests:     │ 📄 Confluence Docs:    ││
│ │ • Video Player - Skip   │ • Player Controls Spec ││
│ │   (85% match)          │ • UI Guidelines        ││
│ │ • Skip Ad Button Test   │                        ││
│ │   (72% match)          │ 🏗️ Component:          ││
│ │ • Intro Detection       │ • VideoPlayer.jsx      ││
│ │   (68% match)          │ • SkipButton.jsx       ││
│ └─────────────────────────┴────────────────────────┘│
│                                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │          Suggested Test Approach                 ││
│ │                                                   ││
│ │ Based on similar tests, recommend:               ││
│ │ • Reuse setup from "Video Player - Skip"         ││
│ │ • Add new scenario for intro-specific skip       ││
│ │ • Include platform variations if needed          ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ [Review Similar Tests] [Generate New] [Modify Existing]│
└──────────────────────────────────────────────────────┘
```

### 4. **Enhanced AI Prompt**

```javascript
const enhancedPrompt = {
  ticket_info: jiraTicket,
  existing_tests: {
    similar: similarTests,
    count: 3,
    patterns: extractedPatterns
  },
  context: {
    confluence: confluenceDocs,
    test_standards: testRailStandards,
    platform_requirements: ["CTV", "Roku"]
  },
  instructions: {
    avoid_duplication: "Do not recreate these existing test scenarios: [...]",
    reuse_patterns: "Follow the structure and naming from similar tests",
    focus_areas: "Focus on unique aspects not covered by existing tests",
    quality_checks: [
      "Ensure test is platform-agnostic",
      "Include negative scenarios",
      "Add boundary conditions",
      "Document platform differences if any"
    ]
  }
}
```

### 5. **Quality Scoring System**

```javascript
const qualityMetrics = {
  uniqueness: {
    score: 0.92,  // How different from existing tests
    feedback: "Covers new scenario not in existing suite"
  },
  completeness: {
    score: 0.88,  // Coverage of requirements
    feedback: "Includes positive, negative, and edge cases"
  },
  clarity: {
    score: 0.95,  // Clear steps and expectations
    feedback: "Well-structured with clear assertions"
  },
  reusability: {
    score: 0.90,  // Can be automated/reused
    feedback: "Follows patterns that can be automated"
  },
  overall: 0.91  // Weighted average
}
```

## Page Organization

### Proposed UI Structure:

```
/qa-copilot
  /dashboard        → Project/Sprint selection
  /test-generator   → Unified test generation with context
    /ticket-select  → Choose JIRA ticket
    /context-review → Review similar tests & docs
    /generate       → AI generation with context
    /quality-check  → Review & score generated tests
    /save          → Select TestRail location & save
  /testrail        → Browse/manage existing tests
  /cypress         → Convert to automation
  /reports         → Test coverage & quality metrics
```

### Unified Test Generator Page Flow:

1. **Step 1: Ticket Selection**
   - Select or paste JIRA ticket
   - Auto-detect project mapping
   - Show ticket details

2. **Step 2: Context Review**
   - Display similar existing tests
   - Show related documentation
   - Highlight potential duplicates
   - Option to view/modify existing tests

3. **Step 3: Generation Options**
   - **Generate New**: Create with context awareness
   - **Extend Existing**: Add scenarios to existing test
   - **Skip & Manual**: Write manually with AI assistance

4. **Step 4: AI Generation**
   - Show AI thinking process
   - Display context being used
   - Generate with duplicate prevention

5. **Step 5: Quality Review**
   - Show quality scores
   - Highlight similarities/differences
   - Allow manual edits
   - Suggest improvements

6. **Step 6: Save**
   - Select TestRail folder (with suggestion)
   - Add tags/metadata
   - Link to JIRA ticket

## Benefits of This Approach

### 1. **Higher Quality Tests**
- AI learns from existing test patterns
- Follows established conventions
- Maintains consistency across suite

### 2. **Duplicate Prevention**
- Proactive detection before generation
- Suggests extending vs. creating new
- Shows coverage gaps instead

### 3. **Better Context Understanding**
- Confluence docs provide business context
- Existing tests show technical patterns
- Component code reveals implementation details

### 4. **Improved Efficiency**
- Reuse existing test setups
- Avoid redundant test creation
- Focus on uncovered scenarios

### 5. **Platform Awareness**
- Understands Unified OAO = multi-platform
- Generates platform-agnostic tests
- Documents platform-specific variations

## Implementation Priority

1. **Phase 1: Context Gathering**
   - Integrate TestRail search
   - Add similar test detection
   - Display context in UI

2. **Phase 2: Enhanced Generation**
   - Update Gemini prompts with context
   - Add duplicate prevention logic
   - Implement quality scoring

3. **Phase 3: Workflow Integration**
   - Unify pages into single flow
   - Add step-by-step wizard
   - Implement save to TestRail

4. **Phase 4: Advanced Features**
   - Auto-suggest test modifications
   - Batch processing for multiple tickets
   - Test coverage analytics

## Example: Skip Intro Button Test

### Without Context (Current):
```
Test: Skip Intro Button
1. Open video
2. Click skip intro
3. Verify video skips
```

### With Context (Proposed):
```
Test: Video Player - Skip Intro Button [extends: Video Player Controls Suite]
Prerequisites: [Reused from existing Video Player tests]
Test Data: [Reused from existing test data]

Scenarios:
1. Skip intro during playback [New - not covered]
   - Uses existing video player setup
   - Follows naming convention from similar tests
   - Includes platform variations documented in existing tests

2. Skip intro button visibility [Extends existing visibility tests]
   - Follows pattern from "Skip Ad Button Test"
   - Adds intro-specific timing validations

3. Analytics tracking [Reuses existing analytics patterns]
   - Follows event tracking pattern from suite
   - Adds intro-skip specific events

Platform Notes: [Inherited from suite]
- CTV: Remote navigation required
- Roku: OK button activation
- Both: 5-second intro minimum
```

This context-aware approach would produce much higher quality, consistent, and maintainable tests!

---

*This workflow ensures tests are generated with full awareness of existing test suite, preventing duplicates and maintaining quality standards.*