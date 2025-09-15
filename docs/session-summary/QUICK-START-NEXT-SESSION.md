# Quick Start Guide - Next Session
**Last Updated**: December 2024  
**Session Status**: Test Selection Interface Complete, Ready for Testing
**Achievement Target**: Individual test selection and navigation with caching

## 🚨 CRITICAL - New Features to Test
**Test Selection Interface Just Implemented**
- Test flattening logic splits concatenated tests
- Individual test selection with visual feedback
- Navigation controls (Previous/Next buttons)
- LocalStorage caching for generated tests

## 🚀 Quick Setup Commands (In Order)

```bash
# 1. Start ChromaDB Server (REQUIRED FIRST!)
cd "/Users/alpinro/Code Prjects/qa-copilot/qa-copilot"
./start-chromadb.sh
# Should show: ChromaDB running on port 8000

# 2. Start Backend (New Terminal) - Will load indexing fix
cd backend
npm start
# Should show: QA Copilot API running on http://localhost:3001

# 3. Start Frontend (New Terminal)  
cd frontend
npm run dev
# Should show: Running on http://localhost:5173

# 4. TEST INDEXING IMMEDIATELY
curl -X POST http://localhost:3001/api/codebase/index \
  -H "Content-Type: application/json" \
  -d '{"repoPath": "/Users/alpinro/Code Prjects/qa-copilot/qa-copilot", "forceReindex": true}'
# Should show: "Found X test files to index" (NOT 0)
```

## 📋 Complete TODO List for Next Session

### Priority 0: TEST SELECTION INTERFACE
- [ ] Test with single test (selector should not show)
- [ ] Test with multiple tests (selector should appear)
- [ ] Verify concatenated tests split correctly (][  pattern)
- [ ] Check Previous/Next navigation with wraparound
- [ ] Confirm cache persists across page refreshes
- [ ] Verify "✓ Generated" indicator appears correctly

### Priority 1: Core Functionality Testing
- [ ] Load JavaSeleniumGenerator component
- [ ] Verify test flattening logic works correctly
- [ ] Check individual test selection and highlighting
- [ ] Test navigation between cached tests
- [ ] Validate localStorage caching mechanism

### Priority 2: Edge Cases & Performance
- [ ] Test with very long concatenated titles
- [ ] Verify step distribution when splitting tests
- [ ] Check cache size limits (consider cleanup)
- [ ] Test with malformed test data
- [ ] Verify memoization performance

### Priority 3: Future Enhancements
- [ ] Consider "Generate All" button implementation
- [ ] Add test filtering/search capability
- [ ] Implement export functionality
- [ ] Add pagination for large test sets

## 🔄 Current System State - Complete Picture

### ✅ WORKING Components
1. **Test Selection UI** - Visual interface with checkmarks and borders
2. **Test Flattening Logic** - Splits concatenated tests on ][ pattern
3. **Navigation Controls** - Previous/Next buttons with wraparound
4. **LocalStorage Caching** - Persistent test storage across sessions
5. **Memoization** - React.useMemo for performance optimization
6. **Progress Indicators** - "✓ Generated" status for completed tests

### 🔧 KEY IMPLEMENTATIONS
1. **Test Flattening** - Lines 29-67 in JavaSeleniumGenerator.jsx
2. **Selection States** - Lines 75-86 with localStorage initialization
3. **Selection UI** - Lines 754-846 with visual feedback
4. **Cache Management** - Automatic save/restore from localStorage

### ❓ NOT YET TESTED
1. Full workflow with real manual tests
2. Edge cases with malformed data
3. Performance with large test sets
4. Cache cleanup mechanisms

## 📁 Key Files & Locations

### Configuration Files
```
backend/.env                                    # Voyage API key: pa-O_3uAU74y6RroSazOpUCHOaP_1dO1asFKmd-fYX55hZ
start-chromadb.sh                               # ChromaDB startup script
```

### Core Services (Modified This Session)
```
frontend/src/components/workflow/JavaSeleniumGenerator.jsx # Test selection UI, flattening, caching
frontend/src/services/cacheService.js                      # Existing caching infrastructure
```

### Documentation
```
docs/session-summary/2024-12-session-summary.md  # Detailed December session summary
docs/session-summary/QUICK-START-NEXT-SESSION.md # This file
docs/architecture/intelligent-test-generation-architecture.md # Architecture doc (needs update)
```

## 🧪 Test Data & Resources

### Sample BET+ Manual Test Format
```json
{
  "name": "Verify Resume button functionality",
  "preconditions": "User logged in with active subscription",
  "steps": [
    "Navigate to video player",
    "Click Resume button",
    "Verify playback continues from last position"
  ],
  "expectedResults": "Video resumes from last watched position"
}
```

### Test URLs
- **BET+ Deeplink** (requires auth): `https://vizio-bet-com-10558-webplex-app.webplex.vmn.io/?mgid=mgid:arc:episode:bet.com:d4c7b7f9-5e97-11ef-ad8f-9b7fe2f5096a`
- **Public Alternatives**: 
  - `https://www.paramountplus.com` (169+ elements)
  - `https://pluto.tv` (free, no auth needed)

### Expected Output Format
```java
// Smart locator with multiple strategies
private WebElement findElement_resumeButton() {
    List<By> locators = Arrays.asList(
        By.cssSelector("[data-testid='resume-button']"),
        By.id("resumeButton"),
        By.xpath("//*[contains(text(), 'Resume')]"),
        By.cssSelector("[aria-label*='resume']"),
        By.cssSelector("button.resume-button"),
        By.xpath("//button[contains(@class, 'resume')]"),
        By.partialLinkText("Resume")
    );
    return findElementWithFallbacks("Resume button", locators);
}
```

## 💡 Quick Debugging Commands

### Check ChromaDB Status
```bash
# Is ChromaDB running?
lsof -i:8000

# Check ChromaDB health
curl http://localhost:8000/api/v1
```

### Test Repository Indexing
```bash
# Index with force reindex
curl -X POST http://localhost:3001/api/codebase/index \
  -H "Content-Type: application/json" \
  -d '{"repoPath": "/Users/alpinro/Code Prjects/qa-copilot/qa-copilot", "forceReindex": true}'
```

### Check Backend Logs
```bash
# Watch backend logs for indexing
# Should see: "Found X test files to index"
# Should see: "Indexed X/X files"
```

### Test Smart Locator Generation
```bash
curl -X POST http://localhost:3001/api/java-selenium/test-locator \
  -H "Content-Type: application/json" \
  -d '{"elementDescription": "Resume button"}'
```

## 🐛 Troubleshooting Guide

### Problem: "Found 0 files to index"
**Solution**: 
1. Ensure backend was restarted after code changes
2. Check path exists and contains JS/TS files
3. Verify no permission issues

### Problem: ChromaDB connection fails
**Solution**:
```bash
# Kill any stale ChromaDB processes
lsof -ti:8000 | xargs kill -9

# Restart ChromaDB
./start-chromadb.sh
```

### Problem: Voyage API errors
**Solution**:
1. Check backend/.env has correct API key
2. Verify internet connection
3. Check Voyage AI service status

### Problem: Only 2 tests generated instead of 16
**Solution**: Already fixed in code - ensure using latest frontend code

## 📊 Success Metrics

### Minimum Viable Success
- [ ] Repository indexing finds > 0 files
- [ ] Generate at least 1 compilable test
- [ ] Smart locators have 5+ strategies

### Target Success (60-70% Quality)
- [ ] All 16 tests generated
- [ ] 10+ tests compile without errors
- [ ] Proper Page Object pattern used
- [ ] Navigation code is actual WebDriver (not TODOs)

### Stretch Goals
- [ ] 14+ tests compile successfully
- [ ] Authentication working for BET+ pages
- [ ] DOM analysis provides real element attributes

## 🎯 Session Goals Summary

**Primary Goal**: Get repository indexing working and verify full test generation workflow

**Key Deliverables**:
1. Working repository indexing with JS/TS files
2. 16 BET+ tests generated from manual tests
3. Compilable Java Selenium code with smart locators
4. Verified 60-70% automation quality

**Critical Path**:
1. Fix indexing (restart backend) → 
2. Test with repository → 
3. Generate BET+ tests → 
4. Validate quality

## 📝 Notes from Previous Session

### What Worked Well
- ChromaDB v1.0.20 upgrade successful
- Voyage API key properly configured
- UI simplified from 6 to 3 fields
- Smart locator generation without DOM
- Test combination logic (16 tests)

### What Needs Attention
- Repository indexing (code updated, needs testing)
- Full workflow validation
- Authentication for BET+ pages
- Test compilation verification

### Key Decisions Made
- Paused DOM analysis feature (authentication issues)
- Focus on smart locator generation
- No fallback for ChromaDB (fail fast)
- Auto-index on test generation

## 🔗 Quick References

- **Previous Session**: `/docs/session-summary/session-2025-09-11.md`
- **Architecture**: `/docs/architecture/intelligent-test-generation-architecture.md`
- **DOM Auth Guide**: `/docs/dom-analysis-auth-guide.md`
- **ChromaDB Docs**: https://docs.trychroma.com
- **Voyage AI Docs**: https://docs.voyageai.com

---

## ⚡ Quick Start Checklist

- [ ] ChromaDB running on port 8000
- [ ] Backend restarted (to load indexing fix)
- [ ] Frontend running on port 5173
- [ ] Test indexing shows > 0 files
- [ ] Ready to test with BET+ manual tests

**Remember**: Cannot proceed with ANY testing until indexing is fixed!

---
*This document contains everything needed to continue work immediately in the next session.*