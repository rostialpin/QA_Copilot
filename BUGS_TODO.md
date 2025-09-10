# QA Copilot - Bug List and TODO Items

## Date: 2025-09-10
## Session Summary: Multiple features implemented but not functioning as expected

---

## 🐛 BUGS TO FIX

### 1. Add New Test Cases Feature Not Working
**Issue**: The "Add new test cases" functionality for performance, security, accessibility tests is not working despite implementation
**Expected**: Should allow users to add different types of test cases beyond functional tests
**Status**: Feature implemented but UI/functionality broken
**Files to check**:
- Test generator components
- Test case type selection UI
- Backend test generation endpoints

### 2. Element Locator Training UI Missing
**Issue**: No UI exists to train the agent on element locator syntax and reuse existing elements
**Expected**: 
- UI to select and provide element locator patterns as additional training source
- Ability to train agent to use existing element locators instead of creating duplicates
**Status**: Feature discussed but UI not implemented
**Required**:
- Create UI component for element locator pattern selection
- Add training data input mechanism
- Implement logic to reuse existing locators

### 3. Navigation Pattern Learning Not Working
**Issue**: Agent should learn navigation patterns from similar tests but this is not happening
**Context**: When generating tests, the agent should use navigation patterns from provided similar tests
**Expected**: Agent reuses navigation logic from training examples
**Status**: Not implemented or not working
**Note**: Need to determine if this is a technical limitation or implementation issue

### 4. Page DOM Structure Usage Unclear
**Issue**: Uncertainty about whether real Page DOM structure is being used for element locators
**Two Options Discussed**:
1. **Option 1** (Preferred): Use project structure to automatically figure out page URLs and find missing elements
2. **Option 2**: Ask user to provide endpoint URL for each page
**Required Actions**:
- Debug and confirm which approach is actually implemented
- Verify actual URL endpoints are being used correctly
- Provide clear documentation on how DOM structure is accessed

---

## ✅ WORKING FEATURES (From This Session)

1. **JIRA Project Search**: Fixed ESWCTV project search - now appearing in project list with 500+ projects
2. **TestRail Project Search**: Added search functionality to TestRailSelector component
3. **Dashboard Project Selection**: Project-first selection with automatic board discovery working

---

## 📋 TODO FOR NEXT SESSION

### Priority 1 - Fix Critical Bugs
- [ ] Fix "Add new test cases" functionality for non-functional tests
- [ ] Verify and fix DOM structure usage for element locators
- [ ] Debug URL endpoint resolution mechanism

### Priority 2 - Implement Missing Features  
- [ ] Create UI for element locator training
- [ ] Implement navigation pattern learning from similar tests
- [ ] Add validation for reused vs new element locators

### Priority 3 - Testing & Validation
- [ ] Test all test case types (performance, security, accessibility)
- [ ] Validate element locator reuse
- [ ] Confirm navigation pattern learning works

### Priority 4 - Build & Deploy
- [ ] Run full test suite
- [ ] Fix any build issues
- [ ] Commit all changes
- [ ] Create PR and merge to main branch

---

## 🔍 INVESTIGATION NEEDED

1. **DOM Access Method**: Need to confirm exact mechanism for accessing page DOM
2. **URL Resolution**: Verify how URLs are determined from project structure
3. **Training Data Flow**: Trace how training data flows from UI to agent
4. **Element Locator Storage**: Where and how are existing locators stored/retrieved

---

## 💡 NOTES FOR DEVELOPER

- The session involved significant refactoring of the Dashboard component
- JIRA API now fetches up to 500 projects and ensures key projects (ESWCTV, ESW, ESR) are always included
- TestRail components have been split between TestRailBrowser (has search) and TestRailSelector (now has search too)
- Multiple backend processes are running - may need cleanup in next session

---

## 🚀 QUICK START FOR NEXT SESSION

1. Review this bug list
2. Check backend logs for any errors
3. Verify all services are running correctly
4. Start with Priority 1 bugs
5. Test each fix before moving to next item

---

## 📝 SESSION END STATE

- Backend running on port 3001
- Frontend running on port 5173  
- Multiple background processes active
- Changes made but not committed
- PR not created yet