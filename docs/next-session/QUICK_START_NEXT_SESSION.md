# QA-Copilot: Quick Start for Next Session

**Last Updated**: December 21, 2024
**Branch**: `feature/hybrid-rag-intelligent-generation`

---

## Session Context

We implemented a **Hybrid RAG (Retrieval Augmented Generation)** system that:
1. Automatically retrieves relevant context (Page Objects, Properties, Tests)
2. Accepts optional user hints for improved accuracy
3. Generates multi-file output (Test Class + PO updates + Property updates)

---

## Quick Start Commands

### 1. Start Services

```bash
# Terminal 1: Start ChromaDB (required for RAG)
cd /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/backend
chroma run --host localhost --port 8000

# Terminal 2: Start Backend
cd /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/backend
npm run dev

# Terminal 3: Start Frontend (optional)
cd /Users/alpinro/CodePrjects/qa-copilot/qa-copilot/frontend
npm run dev
```

### 2. Verify Services

```bash
# Check backend health
curl http://localhost:3001/api/health

# Check RAG status
curl http://localhost:3001/api/hybrid-rag/stats

# Initialize RAG (if not initialized)
curl -X POST http://localhost:3001/api/hybrid-rag/initialize
```

---

## What Was Implemented

### New Files Created

| File | Purpose |
|------|---------|
| `backend/src/services/hybridRAGService.js` | RAG indexing and retrieval |
| `backend/src/services/contextAwareCodeGenerationAgent.js` | Multi-file code generation |
| `backend/src/services/openrouterService.js` | AI with multi-key rotation |
| `backend/src/routes/hybridRAG.routes.js` | RAG API endpoints |
| `backend/src/routes/contextAwareAgent.routes.js` | Generation API endpoints |
| `backend/src/controllers/contextAwareAgentController.js` | API controller |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hybrid-rag/initialize` | POST | Connect to ChromaDB |
| `/api/hybrid-rag/index` | POST | Index repository |
| `/api/hybrid-rag/retrieve` | POST | Get relevant context |
| `/api/hybrid-rag/stats` | GET | Check index status |
| `/api/context-aware-agent/generate` | POST | Generate multi-file output |
| `/api/context-aware-agent/analyze` | POST | Analyze files only |
| `/api/context-aware-agent/parse-categories` | POST | Parse category file |

---

## TODO List for Next Sessions

### Priority 1: Core Functionality Testing (Day 1-2)

- [ ] **Index a real repository**
  ```bash
  curl -X POST http://localhost:3001/api/hybrid-rag/index \
    -H "Content-Type: application/json" \
    -d '{"repositoryPath": "/path/to/mqe-unified-oao-tests"}'
  ```

- [ ] **Test RAG retrieval with different scenarios**
  - Playback tests
  - Container tests
  - Navigation tests
  - Search tests

- [ ] **Test full generation flow**
  ```bash
  curl -X POST http://localhost:3001/api/context-aware-agent/generate \
    -H "Content-Type: application/json" \
    -d '{
      "testScenario": {
        "title": "Restart Button Visibility",
        "description": "Verify restart button appears during playback",
        "steps": ["Start playback", "Verify restart button visible"]
      },
      "hints": {"primaryScreen": "player"}
    }'
  ```

- [ ] **Validate generated code quality**
  - Check method reuse
  - Verify correct screen references
  - Test compilation

### Priority 2: UI Integration (Day 2-3)

- [ ] **Add "Similar Test" hint field to existing UI**
  - Location: Training Examples section
  - Allow user to select one test file as hint

- [ ] **Add "Primary Screen" dropdown**
  - Options: player, container, home, movies, series, navigation
  - Auto-detected from scenario but overridable

- [ ] **Show RAG confidence scores**
  - Display retrieved context before generation
  - Show confidence percentage per category

- [ ] **Preview mode**
  - Let user review RAG-retrieved files
  - Allow modification before generation

### Priority 3: Quality Improvements (Day 3-4)

- [ ] **Improve method matching**
  - Better keyword extraction from scenarios
  - Handle synonyms (click/tap, verify/check, etc.)

- [ ] **Better locator generation**
  - Learn from existing properties patterns
  - Support multiple locator strategies

- [ ] **Validation improvements**
  - Check for invented methods
  - Verify imports are correct
  - Validate screen accessor names

### Priority 4: Advanced Features (Day 4-5)

- [ ] **Incremental indexing**
  - Only re-index changed files
  - Git-aware updates

- [ ] **Method-level retrieval**
  - Find specific methods, not just files
  - Better matching for action types

- [ ] **Template learning**
  - Learn test structure from examples
  - Generate similar structure for new tests

---

## Architecture Reference

See: `/docs/architecture/intelligent-test-generation-architecture.md` (Section 14)

```
User Input                    Hybrid RAG                    Output
───────────                   ──────────                    ──────
Test Scenario     ──────►    ChromaDB Search    ──────►    Test Class
+ Optional Hints             (auto-retrieve)               + PO Updates
                                                           + Property Updates
```

---

## Known Issues / Considerations

1. **ChromaDB must be running** for RAG to work
2. **Repository must be indexed first** before RAG retrieval
3. **OpenRouter API keys** in `.env` for AI generation
4. **Fallback to template** if AI fails

---

## Environment Variables

```bash
# .env file
OPENROUTER_API_KEYS=sk-or-v1-xxx,sk-or-v1-yyy,sk-or-v1-zzz
OPENROUTER_DEFAULT_MODEL=google/gemini-3-flash-preview
DEFAULT_AI_PROVIDER=openrouter
```

---

## Test Scenarios to Try

### Scenario 1: Player Controls
```json
{
  "testScenario": {
    "title": "Verify playback controls visibility",
    "steps": [
      "Navigate to content",
      "Start playback",
      "Verify play/pause button displayed",
      "Verify progress bar displayed"
    ]
  },
  "hints": {"primaryScreen": "player"}
}
```

### Scenario 2: Container Navigation
```json
{
  "testScenario": {
    "title": "Container detail navigation",
    "steps": [
      "Open container page",
      "Verify container title displayed",
      "Navigate to season selector",
      "Select episode"
    ]
  },
  "hints": {"primaryScreen": "container"}
}
```

### Scenario 3: Home Screen Carousel
```json
{
  "testScenario": {
    "title": "Featured carousel validation",
    "steps": [
      "Open app to home screen",
      "Verify featured carousel displayed",
      "Swipe through carousel items",
      "Verify carousel item content"
    ]
  },
  "hints": {"primaryScreen": "home"}
}
```

---

## Files Modified in This Session

```
backend/
├── src/
│   ├── services/
│   │   ├── hybridRAGService.js          # NEW
│   │   ├── contextAwareCodeGenerationAgent.js  # NEW
│   │   ├── openrouterService.js         # MODIFIED (multi-key)
│   │   ├── aiService.js                 # MODIFIED (fallback)
│   │   └── geminiService.js             # MODIFIED (Eden fix)
│   ├── routes/
│   │   ├── hybridRAG.routes.js          # NEW
│   │   ├── contextAwareAgent.routes.js  # NEW
│   │   └── index.js                     # MODIFIED
│   └── controllers/
│       └── contextAwareAgentController.js  # NEW
├── .env                                 # MODIFIED (OpenRouter keys)
└── server.js                            # MODIFIED (CORS, dotenv)

docs/
├── architecture/
│   └── intelligent-test-generation-architecture.md  # UPDATED (v3.0)
└── next-session/
    └── QUICK_START_NEXT_SESSION.md      # NEW (this file)
```

---

## Git Commands

```bash
# Check current branch
git branch

# See all changes
git status

# Commit changes
git add .
git commit -m "feat: Implement Hybrid RAG for intelligent test generation

- Add HybridRAGService for repository indexing and context retrieval
- Add ContextAwareCodeGenerationAgent for multi-file output
- Add OpenRouterService with multi-key rotation
- Integrate RAG with existing test generation flow
- Update architecture documentation"

# Push to remote
git push -u origin feature/hybrid-rag-intelligent-generation
```

---

*Ready to continue? Start with the Quick Start Commands above!*
