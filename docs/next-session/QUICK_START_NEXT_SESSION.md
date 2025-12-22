# QA-Copilot: Multi-Agent Test Generation - Implementation Tracker

**Last Updated**: December 22, 2025
**Version**: 2.0 (Multi-Agent Architecture)
**Branch**: `feature/multi-agent-test-generation`
**Architecture Doc**: `/docs/architecture/multi-agent-test-generation-architecture.md`

---

## Session Start Instructions

**To start a new session, say:**

```
Start QA-Copilot session. Review /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/docs/next-session/QUICK_START_NEXT_SESSION.md and show me current status and top priority tasks.
```

Or simply:
```
/qa-copilot-status
```

The session agent will:
1. Read this document
2. Show current phase progress
3. Display top 3 priority tasks
4. Summarize what was done last session
5. Ask if ready to continue with priority #1

---

## Project Vision

Transform test generation from a monolithic AI approach to a **specialized multi-agent pipeline** with:
- 6 specialized agents (each with dedicated model selection)
- Action Knowledge Base (3-layer terminology learning)
- Dynamic model selection (no hardcoded models)
- Quarterly auto-update via Research Agent (CodeQual pattern)

---

## Quick Start Commands

```bash
# Terminal 1: Start ChromaDB
cd /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/backend
chroma run --host localhost --port 8000

# Terminal 2: Start Backend
cd /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/backend
npm run dev

# Terminal 3: Start Frontend (optional)
cd /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/frontend
npm run dev
```

---

## Implementation Plan Overview

```
Phase 1: Foundation          Phase 2: Core Agents       Phase 3: Learning
──────────────────          ─────────────────────      ─────────────────
[■■■■■■■■■■] 100%           [■■■■■■░░░░] 60%           [■■■■░░░░░░] 40%
• Hybrid RAG ✓              • Scenario Decomposer ✓    • Learned Patterns ✓
• OpenRouter ✓              • Action Knowledge Base ✓  • Terminology Translator
• Context Agent ✓           • Action Mapper            • Learning Loop (partial ✓)
• Architecture Doc ✓        • Prerequisite Builder     • Keyword Enrichment
                            • Test Composer            • User Feedback UI

Phase 4: Generation          Phase 5: Dynamic Models    Phase 6: Integration
───────────────────         ──────────────────────     ────────────────────
[░░░░░░░░░░] 0%             [░░░░░░░░░░] 0%            [░░░░░░░░░░] 0%
• Component Generator       • Supabase Setup           • End-to-End Testing
• Smart Locator             • Research Agent           • UI Integration
• Code Validation           • Model Auto-Update        • Production Deploy
```

---

## Phase 1: Foundation (COMPLETED)

### Status: ✅ DONE

| Task | Status | Notes |
|------|--------|-------|
| Hybrid RAG Service | ✅ Done | `hybridRAGService.js` |
| ChromaDB Integration | ✅ Done | 4 collections: page_objects, properties, tests, methods |
| OpenRouter Multi-Key | ✅ Done | `openrouterService.js` with rotation |
| Context-Aware Agent | ✅ Done | `contextAwareCodeGenerationAgent.js` |
| Architecture Doc v1 | ✅ Done | `intelligent-test-generation-architecture.md` |
| Architecture Doc v2 | ✅ Done | `multi-agent-test-generation-architecture.md` |

---

## Phase 2: Core Agents (IN PROGRESS)

### Status: 🔄 60% Complete

### 2.1 Action Knowledge Base Service ✅ COMPLETED
**Priority**: HIGH | **Effort**: 2-3 days | **Status**: DONE

- [x] Create `actionKnowledgeBaseService.js`
  - [x] Initialize 4 ChromaDB collections (atomic_actions, composite_actions, user_terminology, learned_decompositions)
  - [x] Implement `addAtomicAction()` - store method-level mappings
  - [x] Implement `findAtomicAction()` - semantic search for actions
  - [x] Implement `addCompositeAction()` - store action chains
  - [x] Implement `expandCompositeAction()` - expand to atomic steps
  - [x] Implement `translateUserTerm()` - lookup user terminology
  - [x] Implement `learnFromUser()` - store new terminology
  - [x] **NEW**: Implement `learnActionPatterns()` - learn from AI decompositions
  - [x] **NEW**: Implement `findLearnedPattern()` - semantic pattern matching
  - [x] Multi-platform support (ctv, mobile, web, html5, hdmi)
  - [x] Multi-brand support (pplus, plutotv)

- [x] Create `actionKnowledgeBase.routes.js`
  - [x] POST `/api/knowledge-base/initialize` - init collections
  - [x] POST `/api/knowledge-base/index-methods` - mine methods from repo
  - [x] POST `/api/knowledge-base/atomic-actions` - add atomic action
  - [x] POST `/api/knowledge-base/atomic-actions/search` - semantic search
  - [x] POST `/api/knowledge-base/composite-actions` - add action chain
  - [x] POST `/api/knowledge-base/translate` - translate user term
  - [x] GET `/api/knowledge-base/stats` - collection statistics
  - [x] **NEW**: GET `/api/knowledge-base/learned-patterns` - view learned patterns
  - [x] **NEW**: POST `/api/knowledge-base/learned-patterns/search` - search patterns

### 2.2 Scenario Decomposer Agent ✅ COMPLETED
**Priority**: HIGH | **Effort**: 1-2 days | **Status**: DONE

- [x] Create `agents/scenarioDecomposerAgent.js`
  - [x] System prompt for decomposition
  - [x] Parse natural language to atomic steps
  - [x] Identify implicit prerequisites (login, navigation)
  - [x] Detect test type (functional, smoke, e2e)
  - [x] Identify primary screen
  - [x] **Rules-first approach** (free) with AI fallback (tokens)
  - [x] **AI Learning**: Patterns from AI decomposition stored permanently
  - [x] **Pattern reuse**: Learned patterns enhance rule engine forever

- [x] Create `scenarioDecomposer.routes.js`
  - [x] POST `/api/scenario-decomposer/decompose` - decompose scenario
  - [x] POST `/api/scenario-decomposer/decompose-batch` - batch decomposition
  - [x] POST `/api/scenario-decomposer/validate` - validate steps
  - [x] GET `/api/scenario-decomposer/info` - agent capabilities

**Cost Optimization Flow**:
```
1. Learned Patterns (FREE) → Check patterns learned from previous AI calls
2. Rule Engine (FREE)      → Regex + learned patterns
3. AI (TOKENS)             → Only when rules not confident
   └→ Patterns learned PERMANENTLY for future use
```

**Example**:
```bash
# First call: AI used, patterns learned
curl -X POST .../decompose -d '{"scenario": "click play button"}'
# → decomposition_method: "ai", learned 6 patterns

# Future call: Uses learned pattern (no AI needed!)
curl -X POST .../decompose -d '{"scenario": "press play button"}'
# → decomposition_method: "rules_with_learning", learned_patterns_used: 1
```

### 2.3 Action-to-Method Mapper Agent
**Priority**: HIGH | **Effort**: 1-2 days

- [ ] Create `agents/actionMapperAgent.js`
  - [ ] Query Action Knowledge Base for each step
  - [ ] Semantic search fallback for unknown actions
  - [ ] Confidence scoring
  - [ ] Mark unmapped actions for Component Generator

- [ ] Mapping logic:
  ```javascript
  // For each decomposed step:
  // 1. Direct lookup in Knowledge Base
  // 2. Semantic search if not found
  // 3. Mark as "unmapped" if confidence < 0.6
  ```

### 2.4 Prerequisite Builder Agent
**Priority**: MEDIUM | **Effort**: 1 day

- [ ] Create `agents/prerequisiteBuilderAgent.js`
  - [ ] Build navigation path to target screen
  - [ ] Collect required imports
  - [ ] Identify test data requirements
  - [ ] Generate @BeforeMethod setup code

### 2.5 Test Composer Agent
**Priority**: MEDIUM | **Effort**: 1-2 days

- [ ] Create `agents/testComposerAgent.js`
  - [ ] Assemble complete test class
  - [ ] Apply code patterns from existing tests
  - [ ] Format with proper indentation
  - [ ] Add TestNG annotations
  - [ ] Generate JavaDoc comments

---

## Phase 3: Learning System

### Status: ⏳ PENDING

### 3.1 Terminology Translation Agent
**Priority**: HIGH | **Effort**: 2 days

- [ ] Create `agents/terminologyTranslatorAgent.js`
  - [ ] Search learned terminology first
  - [ ] Web search for unknown terms
  - [ ] Code documentation search
  - [ ] Ask user only as last resort
  - [ ] Store learned mappings

### 3.2 Learning Loop Service
**Priority**: MEDIUM | **Effort**: 2 days

- [ ] Create `learningLoopService.js`
  - [ ] Track unknown terms
  - [ ] Suggest interpretations
  - [ ] Collect user confirmations
  - [ ] Update Knowledge Base

### 3.3 Keyword Enrichment
**Priority**: LOW | **Effort**: 1 day

- [ ] Enhance method keywords over time
- [ ] Detect co-occurring methods
- [ ] Suggest composite actions

---

## Phase 4: Code Generation

### Status: ⏳ PENDING

### 4.1 Component Generator Agent
**Priority**: HIGH | **Effort**: 2-3 days

- [ ] Create `agents/componentGeneratorAgent.js`
  - [ ] Generate new Page Object methods
  - [ ] Generate property file entries
  - [ ] Smart locator generation (Android/iOS/Web)
  - [ ] Follow existing code patterns

### 4.2 Code Validation Service
**Priority**: MEDIUM | **Effort**: 1-2 days

- [ ] Create `codeValidationService.js`
  - [ ] Verify method calls exist
  - [ ] Check imports are valid
  - [ ] Validate screen accessors
  - [ ] Syntax validation

---

## Phase 5: Dynamic Model Selection

### Status: ⏳ PENDING

### 5.1 Supabase Setup
**Priority**: HIGH | **Effort**: 1 day

- [ ] Create Supabase project (or local PostgreSQL)
- [ ] Run schema migration:
  ```sql
  -- model_configurations
  -- model_research_metadata
  -- model_usage_log
  ```
- [ ] Seed initial model configurations

### 5.2 Dynamic Model Service
**Priority**: HIGH | **Effort**: 1-2 days

- [ ] Create `dynamicModelService.js`
  - [ ] `getModelForRole(role)` - fetch from DB with cache
  - [ ] `executeWithFallback(role, operation)` - try primary, then fallback
  - [ ] `logUsage(role, model, tokens)` - track usage
  - [ ] `requestReEvaluation(role)` - trigger research

### 5.3 Research Agent (from CodeQual)
**Priority**: MEDIUM | **Effort**: 2-3 days

- [ ] Port `modelResearcherService.js` from CodeQual
- [ ] Adapt role definitions for QA-Copilot agents
- [ ] Configure quarterly schedule
- [ ] Set up admin notifications

---

## Phase 6: Integration & Polish

### Status: ⏳ PENDING

### 6.1 Agent Orchestrator
**Priority**: HIGH | **Effort**: 2 days

- [ ] Create `agentOrchestrator.js`
  - [ ] Pipeline execution (sequential agents)
  - [ ] Error handling and recovery
  - [ ] Progress reporting
  - [ ] Partial result caching

### 6.2 UI Integration
**Priority**: MEDIUM | **Effort**: 2-3 days

- [ ] Add terminology feedback UI
- [ ] Show agent pipeline progress
- [ ] Display confidence scores
- [ ] Enable manual corrections

### 6.3 End-to-End Testing
**Priority**: HIGH | **Effort**: 2 days

- [ ] Test with real repository
- [ ] Validate generated code compiles
- [ ] Performance benchmarks
- [ ] Edge case handling

---

## Current Session Progress

### Session: December 22, 2025 (CURRENT)

**Completed**:
- [x] **Action Knowledge Base Service** - Full implementation with 4 layers
  - Atomic actions, composite actions, user terminology, learned patterns
  - Multi-platform/brand support (ctv, mobile, web + pplus, plutotv)
  - Custom OpenRouter embedding function (fixed M1 Mac ONNX issue)
- [x] **Scenario Decomposer Agent** - Rules-first with AI learning
  - Rule-based decomposition with confidence scoring
  - AI fallback when rules not confident (< 0.7)
  - **AI Learning**: Patterns from AI stored permanently as new rules
  - Learned patterns enhance rule engine for all future scenarios
- [x] **Routes** - Full API for both services
  - `/api/knowledge-base/*` - 12 endpoints
  - `/api/scenario-decomposer/*` - 4 endpoints
- [x] **Testing** - End-to-end learning flow verified
  - AI decomposition → patterns learned → reused in different scenario

**Key Innovation**: One AI call teaches the system forever
- AI used once → patterns extracted → stored in ChromaDB
- Future scenarios match against learned patterns (no AI needed)
- Cost optimization: ~90% reduction after initial learning

**Files Created/Modified**:
- `backend/src/services/actionKnowledgeBaseService.js` (NEW - 1100+ lines)
- `backend/src/routes/actionKnowledgeBase.routes.js` (NEW - 460+ lines)
- `backend/src/agents/scenarioDecomposerAgent.js` (NEW - 650+ lines)
- `backend/src/routes/scenarioDecomposer.routes.js` (NEW - 165 lines)
- `backend/src/routes/index.js` (MODIFIED - added new routes)

---

### Session: December 21, 2025 (COMPLETE)

**Completed**:
- [x] Designed multi-agent architecture (6 agents)
- [x] Designed Action Knowledge Base (3 layers → now 4 layers)
- [x] Designed Terminology Translation Agent with search-based resolution
- [x] Designed dynamic model selection (CodeQual pattern)
- [x] Created comprehensive architecture document

**Session Closed**: December 21, 2025 @ 20:05

---

## TOP PRIORITY FOR NEXT SESSION

### Priority #1: Action-to-Method Mapper Agent (Phase 2.3)
**File**: `backend/src/agents/actionMapperAgent.js`
**Effort**: 1-2 hours

Tasks:
- [ ] Query Action Knowledge Base for each decomposed step
- [ ] Semantic search fallback for unknown actions
- [ ] Confidence scoring for matches
- [ ] Mark unmapped actions for Component Generator

### Priority #2: Prerequisite Builder Agent (Phase 2.4)
**File**: `backend/src/agents/prerequisiteBuilderAgent.js`
**Effort**: 1-2 hours

Tasks:
- [ ] Build navigation path to target screen
- [ ] Collect required imports
- [ ] Identify test data requirements
- [ ] Generate @BeforeMethod setup code

### Priority #3: Test Composer Agent (Phase 2.5)
**File**: `backend/src/agents/testComposerAgent.js`
**Effort**: 1-2 hours

Tasks:
- [ ] Assemble complete test class from mapped steps
- [ ] Apply code patterns from existing tests
- [ ] Add TestNG annotations and JavaDoc

---

## File Structure (Target)

```
backend/src/
├── agents/
│   ├── scenarioDecomposerAgent.js      # Phase 2.2
│   ├── terminologyTranslatorAgent.js   # Phase 3.1
│   ├── actionMapperAgent.js            # Phase 2.3
│   ├── prerequisiteBuilderAgent.js     # Phase 2.4
│   ├── componentGeneratorAgent.js      # Phase 4.1
│   ├── testComposerAgent.js            # Phase 2.5
│   └── agentOrchestrator.js            # Phase 6.1
├── services/
│   ├── actionKnowledgeBaseService.js   # Phase 2.1
│   ├── learningLoopService.js          # Phase 3.2
│   ├── dynamicModelService.js          # Phase 5.2
│   ├── codeValidationService.js        # Phase 4.2
│   ├── hybridRAGService.js             # ✅ Done
│   ├── openrouterService.js            # ✅ Done
│   └── contextAwareCodeGenerationAgent.js  # ✅ Done (to be refactored)
├── routes/
│   ├── multiAgent.routes.js            # Phase 6.1
│   ├── actionKnowledgeBase.routes.js   # Phase 2.1
│   └── ... (existing)
└── config/
    └── modelConfig.js                  # Phase 5.1
```

---

## Metrics & Success Criteria

| Metric | Target | Current |
|--------|--------|---------|
| Test generation accuracy | > 85% | TBD |
| Method reuse rate | > 90% | TBD |
| Unknown term resolution (auto) | > 70% | TBD |
| Cost per test generated | < $0.02 | TBD |
| End-to-end latency | < 30s | TBD |
| Fallback usage rate | < 10% | TBD |

---

## Session Handoff Template

When ending a session, update this section:

```markdown
### Session End: [DATE]

**What was done**:
- [ ] Task 1
- [ ] Task 2

**What's next** (priority order):
1. Next task 1
2. Next task 2

**Blockers/Issues**:
- Issue 1

**Files modified**:
- file1.js
- file2.js
```

---

## Environment Setup

```bash
# Required environment variables (.env)
OPENROUTER_API_KEYS=sk-or-v1-xxx,sk-or-v1-yyy
OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash-preview

# For Phase 5 (Dynamic Models)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

---

## Quick Reference

### Test the Pipeline

```bash
# 1. Index repository
curl -X POST http://localhost:3001/api/hybrid-rag/index \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/test-repo"}'

# 2. Generate test (current implementation)
curl -X POST http://localhost:3001/api/context-aware-agent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "testScenario": {
      "title": "Video playback test",
      "steps": ["Start playback", "Wait 30 seconds", "Verify playing"]
    },
    "hints": {"primaryScreen": "player"}
  }'

# 3. Future: Multi-agent pipeline
curl -X POST http://localhost:3001/api/multi-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "Verify user can watch video for 30 seconds"}'
```

---

*Last session update: December 21, 2025*
*Next priority: Phase 2.1 - Action Knowledge Base Service*
