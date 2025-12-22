# QA-Copilot Multi-Agent System Guide

**Version**: 2.0
**Last Updated**: December 22, 2025
**Author**: QA Automation Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Agents](#agents)
   - [Scenario Decomposer Agent](#1-scenario-decomposer-agent)
   - [Action Mapper Agent](#2-action-mapper-agent)
   - [Prerequisite Builder Agent](#3-prerequisite-builder-agent)
   - [Test Composer Agent](#4-test-composer-agent)
   - [Component Generator Agent](#5-component-generator-agent)
4. [Services](#services)
   - [Action Knowledge Base Service](#action-knowledge-base-service)
   - [Hybrid RAG Service](#hybrid-rag-service)
   - [OpenRouter Service](#openrouter-service)
5. [Pipeline Flow](#pipeline-flow)
6. [API Reference](#api-reference)
7. [Configuration](#configuration)

---

## Overview

The QA-Copilot Multi-Agent System transforms natural language test scenarios into executable Java/TestNG test code. Instead of using a single monolithic AI call, the system uses **5 specialized agents** that work together in a pipeline.

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Cost Optimization** | Rules-first approach minimizes AI token usage |
| **Learning System** | AI patterns are stored and reused forever |
| **Accuracy** | Each agent is specialized for one task |
| **Consistency** | Generated tests match mqe-unified-oao-tests format exactly |
| **Traceability** | Each step can be debugged independently |

### Design Principles

1. **Rules First, AI Second**: Use regex/patterns before calling AI
2. **Learn Once, Use Forever**: Store AI-generated patterns for reuse
3. **Single Responsibility**: Each agent does one thing well
4. **Fail Gracefully**: Mark unmapped actions as TODOs, don't fail

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                        │
│  "Verify user can search for a show, select it, and start playback"     │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     STAGE 1: SCENARIO DECOMPOSER                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ Learned Patterns│ -> │  Rule Engine    │ -> │   AI Fallback   │      │
│  │     (FREE)      │    │    (FREE)       │    │   (TOKENS)      │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│                                                                          │
│  OUTPUT: [{action: "search", target: "show"}, {action: "select"}, ...]  │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAGE 2: ACTION MAPPER                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ Learned Patterns│ -> │ Atomic Actions  │ -> │ Composite Acts  │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│           │                                            │                 │
│           └──────────────────┬─────────────────────────┘                 │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │   Hybrid RAG    │ (semantic search in codebase)     │
│                    └─────────────────┘                                   │
│                                                                          │
│  OUTPUT: [{action: "search", method: "searchScreen().searchText()"}]    │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   STAGE 3: PREREQUISITE BUILDER                          │
│                                                                          │
│  Screen Graph (BFS shortest path):                                       │
│  app_launch -> login -> home -> search -> content -> player              │
│                                                                          │
│  OUTPUT: {                                                               │
│    targetScreen: "player",                                               │
│    screenChain: ["LoginScreen", "HomeScreen", "PlayerScreen"],           │
│    setupSequence: [launchApp(), login(), waitForHome()]                  │
│  }                                                                       │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     STAGE 4: TEST COMPOSER                               │
│                                                                          │
│  Generates complete Java test class in mqe-unified-oao-tests format:    │
│  - @Factory constructor with TestParams                                  │
│  - @Platforms, @AppBrand, @Locales annotations                          │
│  - Screen accessor methods (homeScreen(), playerScreen())               │
│  - SoftAssert with assertAll()                                          │
│  - try/finally with TestDataProvider cleanup                            │
│                                                                          │
│  OUTPUT: Complete .java file content                                     │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   STAGE 5: COMPONENT GENERATOR                           │
│                     (Only if unmapped actions exist)                     │
│                                                                          │
│  For actions that couldn't be mapped to existing methods:                │
│  - Generates new Page Object methods                                     │
│  - Generates smart locators (Android/iOS/Web)                           │
│  - Generates property file entries                                       │
│                                                                          │
│  OUTPUT: {newMethods: [...], newLocators: [...], newProperties: [...]}  │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FINAL OUTPUT                                    │
│                                                                          │
│  {                                                                       │
│    code: "package com.viacom.unified.tests...",                         │
│    className: "SearchAndPlaybackTest",                                   │
│    warnings: [...],                                                      │
│    generatedComponents: {...}  // if any unmapped actions               │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agents

### 1. Scenario Decomposer Agent

**File**: `backend/src/agents/scenarioDecomposerAgent.js`
**Lines**: ~650

#### Purpose
Breaks down a natural language test scenario into atomic, actionable steps.

#### Input
```json
{
  "scenario": "Verify user can search for a show and start playback",
  "platform": "ctv",
  "brand": "betplus",
  "includeLogin": true
}
```

#### Output
```json
{
  "success": true,
  "steps": [
    {"id": 1, "action": "login", "target": "application", "isPrerequisite": true},
    {"id": 2, "action": "navigate", "target": "home_screen", "isPrerequisite": true},
    {"id": 3, "action": "search", "target": "show", "isPrerequisite": false},
    {"id": 4, "action": "select", "target": "result", "isPrerequisite": false},
    {"id": 5, "action": "play", "target": "content", "isPrerequisite": false},
    {"id": 6, "action": "verify", "target": "playback", "isPrerequisite": false}
  ],
  "primary_screen": "player",
  "decomposition_method": "rules",
  "learned_patterns_used": 2
}
```

#### Key Features

| Feature | Description |
|---------|-------------|
| **Rules-First** | Uses regex patterns before AI (saves tokens) |
| **AI Learning** | When AI is used, patterns are stored for future reuse |
| **Prerequisite Detection** | Automatically adds login/navigation steps |
| **Primary Screen Inference** | Determines which screen the test focuses on |

#### Cost Optimization Flow

```
1. Check Learned Patterns (FREE) → Previous AI decompositions
2. Apply Rule Engine (FREE)      → Regex-based decomposition
3. Call AI (TOKENS)              → Only when confidence < 0.7
   └→ Patterns learned and stored PERMANENTLY
```

---

### 2. Action Mapper Agent

**File**: `backend/src/agents/actionMapperAgent.js`
**Lines**: ~350

#### Purpose
Maps each decomposed step to an actual method in your codebase.

#### Input
```json
{
  "decomposition": {
    "steps": [
      {"action": "search", "target": "show"},
      {"action": "select", "target": "result"}
    ]
  },
  "platform": "ctv",
  "brand": "betplus"
}
```

#### Output
```json
{
  "success": true,
  "mappings": [
    {
      "action": "search",
      "target": "show",
      "status": "found",
      "className": "SearchScreen",
      "methodName": "searchText",
      "confidence": 0.92,
      "source": "atomic_actions"
    }
  ],
  "unmapped": [
    {
      "action": "select",
      "target": "result",
      "reason": "No matching method found"
    }
  ],
  "statistics": {
    "mapped": 5,
    "unmapped": 1,
    "mappingRate": "83.3%"
  }
}
```

#### 4-Strategy Lookup

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTION MAPPER STRATEGIES                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Strategy 1: LEARNED PATTERNS                                │
│  ────────────────────────────                                │
│  Check patterns learned from previous successful mappings    │
│  Cost: FREE | Speed: Fastest                                 │
│                                                              │
│  Strategy 2: ATOMIC ACTIONS                                  │
│  ──────────────────────────                                  │
│  Direct lookup in Knowledge Base atomic_actions collection   │
│  Cost: FREE | Speed: Fast                                    │
│                                                              │
│  Strategy 3: COMPOSITE ACTIONS                               │
│  ────────────────────────────                                │
│  Expand multi-step actions from composite_actions collection │
│  Cost: FREE | Speed: Fast                                    │
│                                                              │
│  Strategy 4: HYBRID RAG                                      │
│  ────────────────────────                                    │
│  Semantic search across indexed codebase                     │
│  Cost: Embedding tokens | Speed: Medium                      │
│  └→ Successful matches are auto-learned for future use       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Prerequisite Builder Agent

**File**: `backend/src/agents/prerequisiteBuilderAgent.js`
**Lines**: ~320

#### Purpose
Builds the navigation path and setup code needed to reach the test's target screen.

#### Input
```json
{
  "mappingResult": { "mappings": [...] },
  "platform": "ctv",
  "includeLogin": true,
  "targetScreen": "player"
}
```

#### Output
```json
{
  "success": true,
  "targetScreen": "player",
  "screenChain": ["LoginScreen", "HomeScreen", "ContentScreen", "PlayerScreen"],
  "prerequisites": {
    "imports": ["LoginScreen", "HomeScreen", "PlayerScreen"],
    "setupSequence": [
      {"method": "launchApp", "class": "BaseTest"},
      {"method": "login", "class": "LoginScreen"},
      {"method": "waitForHomeScreen", "class": "HomeScreen"}
    ],
    "navigationToTarget": [
      {"method": "navigateToContent", "class": "HomeScreen"},
      {"method": "navigateToPlayer", "class": "ContentScreen"}
    ]
  }
}
```

#### Screen Navigation Graph

The agent uses a graph with BFS (Breadth-First Search) to find the shortest path:

```javascript
screenGraph = {
  'app_launch': ['splash', 'login', 'home'],
  'login': ['home', 'profile', 'onboarding'],
  'home': ['search', 'browse', 'profile', 'settings', 'content', 'live'],
  'search': ['content', 'search_results'],
  'content': ['player', 'series', 'episode_picker'],
  'player': ['home', 'content'],
  // ... 15+ screens supported
}
```

#### Supported Screens

| Screen | Class Name | Common Navigation |
|--------|------------|-------------------|
| login | LoginScreen | app_launch → login |
| home | HomeScreen | login → home |
| search | SearchScreen | home → search |
| browse | BrowseScreen | home → browse |
| content | ContentScreen | search/browse → content |
| player | PlayerScreen | content → player |
| settings | SettingsScreen | home → settings |
| profile | ProfileScreen | home → profile |
| live | LiveTVScreen | home → live |

---

### 4. Test Composer Agent

**File**: `backend/src/agents/testComposerAgent.js`
**Lines**: ~830

#### Purpose
Generates complete, runnable Java/TestNG test classes in the **mqe-unified-oao-tests** format.

#### Input
```json
{
  "scenario": {"title": "Search and playback test"},
  "decomposition": {...},
  "mappingResult": {...},
  "prerequisites": {...},
  "options": {
    "platform": "ctv",
    "brand": "betplus",
    "testType": "functional"
  }
}
```

#### Output
```java
/*
 * Copyright (c) 2025 ViacomCBS MQE Automation Team...
 */

package com.viacom.unified.tests.player.playback;

import com.viacom.unified.annotations.*;
import com.viacom.unified.constants.*;
import com.viacom.unified.support.*;
import com.viacom.unified.tests.common.BaseTest;
import org.testng.annotations.*;
import org.testng.asserts.SoftAssert;

public class SearchAndPlaybackTest extends BaseTest {

    @Factory(dataProvider = "defaultDataProvider", dataProviderClass = DataProviderManager.class)
    public SearchAndPlaybackTest(TestParams runParams) {
        super(runParams);
    }

    @Test(groups = {GroupConstants.FULL, GroupConstants.REGRESSION})
    @TmsLink("TODO_ADD_TMS_LINK")
    @Description("Search and playback test")
    @Feature(FeatureConstants.PLAYBACK)
    @Platforms({PlatformType.ANDROID_TV, PlatformType.FIRE_TV, PlatformType.ROKU})
    @Locales({ALL_LOCALES})
    @AppBrand({Brand.BET_PLUS, Brand.VH1, Brand.BET})
    public void searchAndPlaybackTest() {
        SoftAssert softAssert = new SoftAssert();
        TestData data = getDefaultTestData();
        try {
            launchAppAndNavigateToHomeScreen();
            searchScreen().searchText("show name");
            containerScreen().selectContent(data);
            playerScreen().waitForVideoLoaded();
            softAssert.assertAll();
        } finally {
            TestDataProvider.cleanupTestData(data);
        }
    }
}
```

#### Generated Test Features

| Feature | Implementation |
|---------|----------------|
| **Package** | Auto-inferred from scenario (e.g., `tests.player.playback`) |
| **Constructor** | @Factory with TestParams/DataProviderManager |
| **Annotations** | @Platforms, @AppBrand, @Locales, @TmsLink, @Feature, @Description |
| **Screen Access** | Accessor methods: `homeScreen()`, `playerScreen()` |
| **Assertions** | SoftAssert with `assertAll()` |
| **Cleanup** | try/finally with TestDataProvider |
| **Copyright** | ViacomCBS header |

#### Platform Mappings

| Input | Generated Platforms |
|-------|---------------------|
| `ctv` | ANDROID_TV, FIRE_TV, ROKU, APPLE_TV |
| `mobile` | ANDROID, IOS |
| `web` | TIZEN_TV, LG_WEBOS, VIZIO, HISENSE_TV |

#### Feature to Package Mappings

| Feature Keyword | Package |
|-----------------|---------|
| playback, video, episode | `tests.player.playback` |
| search | `tests.search` |
| login, authentication | `tests.account.authentication` |
| settings | `tests.settings` |
| navigation | `tests.navigation` |

---

### 5. Component Generator Agent

**File**: `backend/src/agents/componentGeneratorAgent.js`
**Lines**: ~500

#### Purpose
Generates new Page Object methods, locators, and property entries for actions that couldn't be mapped to existing code.

#### When It Runs
Only when the Action Mapper has unmapped actions (mappingRate < 100%).

#### Input
```json
{
  "unmappedActions": [
    {"action": "swipe", "target": "carousel", "details": "left"}
  ],
  "platform": "ctv",
  "targetScreen": "HomeScreen"
}
```

#### Output
```json
{
  "success": true,
  "newMethods": [
    {
      "class": "HomeScreen",
      "method": {
        "name": "swipeCarousel",
        "returnType": "void",
        "body": "swipeElement(carousel, SwipeDirection.LEFT);",
        "javadoc": "/** Swipe carousel left */"
      }
    }
  ],
  "newLocators": [
    {
      "element": "carousel",
      "strategies": {
        "android": ["//android.widget.HorizontalScrollView[@resource-id=\"carousel\"]"],
        "ios": ["//XCUIElementTypeScrollView[@name=\"carousel\"]"]
      }
    }
  ],
  "newProperties": [
    {
      "file": "home.properties",
      "entries": [
        {"key": "home.carousel.android", "value": "//android.widget..."}
      ]
    }
  ]
}
```

#### Action Pattern Templates

| Action | Method Prefix | Template |
|--------|---------------|----------|
| click | click | `clickElement({element});` |
| tap | tap | `tapElement({element});` |
| verify | verify | `verifyElementDisplayed({element});` |
| wait | waitFor | `waitForElement({element}, {timeout});` |
| enter | enter | `enterText({element}, {text});` |
| scroll | scroll | `scrollTo({element});` |
| select | select | `selectElement({element});` |

#### Platform Locator Strategies

| Platform | Primary Strategy | Fallbacks |
|----------|------------------|-----------|
| Android/CTV | resource-id | content-desc, text, class |
| iOS | accessibility-id | name, label, value |
| Web | data-testid | id, class, name |

---

## Services

### Action Knowledge Base Service

**File**: `backend/src/services/actionKnowledgeBaseService.js`

A 4-layer ChromaDB-powered semantic database:

| Layer | Collection | Purpose |
|-------|------------|---------|
| 1 | `atomic_actions` | Single method mappings |
| 2 | `composite_actions` | Multi-step action chains |
| 3 | `user_terminology` | Informal → formal term mappings |
| 4 | `learned_patterns` | AI-generated patterns (permanent storage) |

### Hybrid RAG Service

**File**: `backend/src/services/hybridRAGService.js`

Semantic code search using ChromaDB:

| Collection | Content |
|------------|---------|
| `page_objects` | Screen/Page classes |
| `properties` | Locator property files |
| `tests` | Existing test files |
| `methods` | Individual method definitions |

### OpenRouter Service

**File**: `backend/src/services/openrouterService.js`

Multi-model LLM access with:
- API key rotation (multiple keys)
- Model fallback
- Token usage tracking

---

## Pipeline Flow

### Full Pipeline Endpoint

```bash
POST /api/multi-agent/generate
```

### Request
```json
{
  "scenario": "Verify user can search for a show and start playback",
  "platform": "ctv",
  "brand": "betplus",
  "testType": "functional",
  "includeLogin": true,
  "debug": false
}
```

### Response
```json
{
  "success": true,
  "code": "package com.viacom.unified.tests...",
  "className": "SearchAndPlaybackTest",
  "fullClassName": "com.viacom.unified.tests.player.playback.SearchAndPlaybackTest",
  "warnings": [
    {"type": "unmapped_actions", "message": "2 actions could not be mapped"}
  ],
  "generatedComponents": {
    "newMethods": [...],
    "newLocators": [...]
  },
  "pipeline": {
    "stages": {
      "decomposition": {"success": true, "stepsCount": 8},
      "mapping": {"success": true, "mapped": 6, "unmapped": 2},
      "prerequisites": {"success": true, "screensInPath": 4},
      "composition": {"success": true, "linesOfCode": 65}
    }
  },
  "timing": {"totalMs": 2340}
}
```

---

## API Reference

### Multi-Agent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/multi-agent/generate` | POST | Full pipeline execution |
| `/api/multi-agent/info` | GET | Pipeline capabilities |
| `/api/multi-agent/stats` | GET | Agent statistics |
| `/api/multi-agent/map` | POST | Action Mapper only |
| `/api/multi-agent/prerequisites` | POST | Prerequisite Builder only |
| `/api/multi-agent/compose` | POST | Test Composer only |
| `/api/multi-agent/generate-components` | POST | Component Generator only |

### Knowledge Base Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge-base/initialize` | POST | Initialize collections |
| `/api/knowledge-base/index-methods` | POST | Index repository methods |
| `/api/knowledge-base/stats` | GET | Collection statistics |
| `/api/knowledge-base/atomic-actions/search` | POST | Search atomic actions |

### Scenario Decomposer Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scenario-decomposer/decompose` | POST | Decompose scenario |
| `/api/scenario-decomposer/info` | GET | Agent capabilities |

---

## Configuration

### Environment Variables

```bash
# OpenRouter (required)
OPENROUTER_API_KEYS=sk-or-v1-xxx,sk-or-v1-yyy
OPENROUTER_DEFAULT_MODEL=google/gemini-2.0-flash-001

# ChromaDB (required)
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Starting the System

```bash
# Terminal 1: Start ChromaDB
chroma run --host localhost --port 8000

# Terminal 2: Start Backend
cd backend && npm run dev

# Terminal 3 (optional): Start Frontend
cd frontend && npm run dev
```

### Indexing Your Repository

Before generating tests, index your test repository:

```bash
curl -X POST http://localhost:3001/api/hybrid-rag/index \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/mqe-unified-oao-tests"}'
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "ChromaDB connection failed" | Ensure `chroma run` is running on port 8000 |
| "No methods found" | Index your repository first |
| "All actions unmapped" | Check Knowledge Base has atomic actions |
| "Wrong test format" | Verify Test Composer v2.0 is deployed |

### Debug Mode

Add `"debug": true` to any pipeline request to get full intermediate outputs:

```bash
curl -X POST http://localhost:3001/api/multi-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "...", "debug": true}'
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Dec 22, 2025 | Test Composer updated to mqe-unified format |
| 1.0 | Dec 21, 2025 | Initial multi-agent pipeline |

---

*For questions or issues, contact the QA Automation Team.*
