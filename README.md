# QA Copilot - Intelligent Test Automation

An AI-powered QA automation assistant featuring a **Multi-Agent Test Generation Pipeline** that transforms natural language scenarios into production-ready Java TestNG automation tests.

## Architecture Overview

```
                              +------------------------------------------+
                              |        QA Copilot Multi-Agent System     |
                              +------------------------------------------+
                                                  |
                  +-------------------------------+-------------------------------+
                  |                               |                               |
                  v                               v                               v
    +------------------------+    +------------------------+    +------------------------+
    |   JIRA Integration     |    |   TestRail Integration |    |   Repository Mining    |
    |   - Ticket fetching    |    |   - Test case sync     |    |   - Java method index  |
    |   - AC extraction      |    |   - Section mapping    |    |   - Screen classes     |
    +------------------------+    +------------------------+    +------------------------+
                  |                               |                               |
                  +-------------------------------+-------------------------------+
                                                  |
                                                  v
+=======================================================================================+
||                          MULTI-AGENT TEST GENERATION PIPELINE                       ||
+=======================================================================================+
|                                                                                       |
|  +------------------+     +------------------+     +---------------------+            |
|  |  1. Scenario     |     |  2. Action       |     |  3. Prerequisite    |            |
|  |  Decomposer      | --> |  Mapper          | --> |  Builder            |            |
|  |  Agent           |     |  Agent           |     |  Agent              |            |
|  +------------------+     +------------------+     +---------------------+            |
|         |                        |                         |                          |
|         v                        v                         v                          |
|  Natural Language         Method Selection          MQE Navigation                    |
|  "Click restart" -->      from KB + RAG -->        Pattern Setup                      |
|  [click, restart_btn]     scrollToRestart()        launchApp...selectEpisode          |
|                                                                                       |
|  +------------------+     +------------------+     +---------------------+            |
|  |  4. Test         |     |  5. Component    |     |  ChromaDB           |            |
|  |  Composer        | <-- |  Generator       | <-- |  Knowledge Base     |            |
|  |  Agent           |     |  Agent           |     |  (Vector Store)     |            |
|  +------------------+     +------------------+     +---------------------+            |
|         |                        |                         |                          |
|         v                        v                         v                          |
|  Java TestNG Code         Missing Method           3-Layer Action KB:                 |
|  with Allure +            Stub Generation          - Atomic Actions                   |
|  proper structure                                  - Composite Actions                |
|                                                    - User Terminology                 |
+=======================================================================================+
                                                  |
                                                  v
                              +------------------------------------------+
                              |           Generated Test Code            |
                              |  - MQE Unified Framework compatible     |
                              |  - TestNG + Allure annotations          |
                              |  - Screen-aware method calls            |
                              |  - Proper imports and data providers    |
                              +------------------------------------------+
```

## Key Features

### Multi-Agent Pipeline
| Agent | Model | Role |
|-------|-------|------|
| **Scenario Decomposer** | `gemini-2.0-flash` | Parses natural language into structured action steps with duration extraction |
| **Action Mapper** | `claude-sonnet-4` | Maps actions to actual Java methods using intelligent LLM selection + vector search |
| **Prerequisite Builder** | Rule-based | Generates MQE-specific navigation patterns (launch -> home -> content -> player) |
| **Test Composer** | Rule-based | Assembles final Java TestNG code with proper ordering (actions before verifications) |
| **Component Generator** | `gemini-2.0-flash` | Creates stubs for missing methods and locators |

### Intelligent Method Selection
- Uses Claude Sonnet 4 via OpenRouter for intelligent candidate selection
- Hybrid RAG (ChromaDB) for semantic method search across 2600+ indexed methods
- Learns from selections to improve future mappings
- Supports composite actions that expand to multiple method calls

### Composite Actions
Multi-step operations stored as reusable patterns:
```
navigate_to_restart_button:
  1. playerScreen().backFromPlayer()      // Exit player
  2. containerScreen().scrollToRestartButton()  // Focus on button
  3. containerScreen().select()           // Click button
```

### Smart Duration Handling
Preconditions with durations use configurable seek ratio:
```
"Content has 10 minutes of watch progress"
  --> seekForwardToPosition(100)  // 600s / 6 = 100s (1:6 ratio)
```

## Quick Start

### Prerequisites
- Node.js 18+
- ChromaDB (for vector search)
- OpenRouter API key (for LLM)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd qa-copilot
npm run setup

# Start ChromaDB
./start-chromadb.sh

# Start the application
npm run dev
```

### Environment Variables

```bash
# Required for multi-agent generation
export OPENROUTER_API_KEY="your-openrouter-key"

# Optional integrations
export JIRA_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email"
export JIRA_API_TOKEN="your-token"
export TESTRAIL_URL="https://your-company.testrail.io"
export TESTRAIL_EMAIL="your-email"
export TESTRAIL_TOKEN="your-token"
```

## API Endpoints

### Multi-Agent Generation
```bash
POST /api/multi-agent/generate
{
  "scenario": "Verify Restart functionality. Click restart button to restart playback.",
  "platform": "ctv",
  "brand": "pplus",
  "precondition": "Content has 10 minutes of watch progress."
}
```

### Knowledge Base Management
```bash
# Get stats
GET /api/knowledge-base/stats

# Search atomic actions
POST /api/knowledge-base/atomic-actions/search
{ "query": "click restart button", "platform": "ctv" }

# Add composite action
POST /api/knowledge-base/composite-actions
{
  "actionName": "navigate_to_restart_button",
  "description": "Navigate from player to restart button and click it",
  "steps": [...]
}

# Index repository methods
POST /api/knowledge-base/index-methods
{ "repositoryPath": "/path/to/test-framework" }
```

## Project Structure

```
qa-copilot/
├── frontend/              # React + Vite UI
│   └── src/
│       └── pages/
│           └── AutomateTestsPage.jsx  # Main generation UI
├── backend/
│   └── src/
│       ├── agents/        # Multi-agent pipeline
│       │   ├── scenarioDecomposerAgent.js
│       │   ├── actionMapperAgent.js
│       │   ├── prerequisiteBuilderAgent.js
│       │   ├── testComposerAgent.js
│       │   └── componentGeneratorAgent.js
│       ├── services/
│       │   ├── actionKnowledgeBaseService.js  # ChromaDB KB
│       │   ├── hybridRAGService.js            # Method search
│       │   └── intelligentMethodSelector.js   # LLM selection
│       └── routes/
│           ├── multiAgent.routes.js
│           └── actionKnowledgeBase.routes.js
└── docs/                  # Documentation
```

## Generated Test Example

Input:
```
Scenario: "Verify Restart functionality. Click restart button to restart playback."
Precondition: "Content has 10 minutes of watch progress."
Platform: CTV
```

Output:
```java
@Test(groups = {GroupConstants.FULL, GroupConstants.REGRESSION, GroupConstants.PLAYBACK})
@Description("Verify Restart functionality. Click restart button to restart playback.")
public void verifyRestartFunctionalityTest() {
    SoftAssert softAssert = new SoftAssert();
    TestData data = TestUtils.getDataWithSkip(TestDataProvider::getThreadSafeEpisodeWithoutContinuousPlayback);
    try {
        Item item = TestDataProvider.getBrandFeedEpisodeItem(data);
        // Navigation to content
        launchAppAndNavigateToHomeScreen();
        homeScreen().openShowFromBrandFeedSection(data, item);
        containerScreen().selectEpisode(item, data.getEpisodeIndex(), data.getSeasonIndex());
        playerScreen().waitForVideoLoaded();
        playerScreen().seekForwardToPosition(100); // Seek 100s to simulate 600s watch progress (ratio 1:6)

        playerScreen().backFromPlayer();
        containerScreen().scrollToRestartButton();
        containerScreen().select();
        playerScreen().verifyVideoStartsAtBeginning();
        softAssert.assertAll();
    } finally {
        TestDataProvider.removeThreadSafeEpisode(data);
    }
}
```

## Configuration

### Seek Ratio (Duration to Seek Time)
Default ratio is 1:6. To adjust, modify `SEEK_RATIO` in:
- `backend/src/agents/actionMapperAgent.js`
- `backend/src/agents/prerequisiteBuilderAgent.js`

### Composite Actions
Add new composite actions via the Knowledge Base API or directly in ChromaDB.

### Stub Generation for Missing Methods
When actions cannot be mapped to existing methods, the Component Generator creates stubs:
```java
// MISSING ACTION: click special_button
// Suggested: ContainerScreen.clickSpecialButton()
// Add to Knowledge Base to resolve

/* === GENERATED STUBS FOR MISSING ACTIONS ===
 * Add these to your Page Object classes:
 *
 * ContainerScreen.java:
 * public void clickSpecialButton() {
 *     clickElement(specialButton);
 * }
 *
 * Locator suggestion (CTV):
 * //android.widget.Button[@resource-id="com.example.app:id/specialButton"]
 */
```

---

## Manual Test Generation (Legacy)

The system also includes a legacy manual test generation flow using:
- **GeminiService**: Direct LLM-based test generation
- **PlaywrightService**: Web test generation with self-healing locators

This approach differs from the multi-agent pipeline - it sends the entire scenario to an LLM in a single prompt rather than decomposing into specialized agents.

**Note**: The multi-agent approach provides better accuracy and maintainability. Future work may migrate manual test generation to use the same agent architecture.

---

## Development

```bash
# Start development servers
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Run tests
npm test
```

## Technology Stack

- **Frontend**: React 18, Vite, TanStack Query, Tailwind CSS
- **Backend**: Node.js, Express
- **AI/ML**: OpenRouter (Claude Sonnet 4), ChromaDB (Vector Store)
- **Integrations**: JIRA, TestRail, GitHub

## License

MIT License

---

Built for MQE Automation Team
