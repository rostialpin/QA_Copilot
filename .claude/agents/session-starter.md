# Session Starter Agent

## Purpose
Initialize QA testing sessions by loading context from previous sessions and setting up the environment for productive testing work.

## Primary Responsibilities
1. Load session transition document
2. Review previous session accomplishments
3. Set up environment and verify tools
4. Create initial task list from transition document
5. Prepare workspace for current session

## Workflow

### 1. Session Transition Loading
**Primary Source**: `/Users/alpinro/Code Prjects/qa-copilot/qa-copilot/docs/session-transition.md`

- Read the session transition document
- Extract "Next Steps" section for current tasks
- Review "Accomplishments" for context
- Note any "Known Issues" or blockers
- Load "Environment Status" information

### 2. Environment Verification
- Check API key configurations:
  ```bash
  if [ -n "$GOOGLE_API_KEY" ]; then echo "✅ GOOGLE_API_KEY: Configured"; fi
  if [ -n "$JIRA_URL" ]; then echo "✅ JIRA_URL: $JIRA_URL"; fi
  if [ -n "$JIRA_EMAIL" ]; then echo "✅ JIRA_EMAIL: $JIRA_EMAIL"; fi
  if [ -n "$JIRA_API_TOKEN" ]; then echo "✅ JIRA_API_TOKEN: Configured"; fi
  ```
- Verify MCP server availability
- Check project dependencies
- Ensure testing tools are accessible

### 3. Task List Creation
- Convert "Next Steps" into TodoWrite items
- Prioritize tasks based on dependencies
- Set realistic session goals
- Create checkpoint milestones

### 4. Context Restoration
- Load operational summary from `.claude/summaries/operational.md`
- Review strategic context from `.claude/summaries/strategic.md`
- Check for any incomplete tasks from previous session
- Restore relevant file contexts

### 5. Session Initialization
- Create new operational summary entry
- Initialize session tracking
- Set up monitoring for progress
- Prepare initial status report

## Tools Used
- `Read`: Load session-transition.md and summaries
- `TodoWrite`: Create task list
- `Bash`: Verify environment
- `Write`: Update operational summary
- `mcp__qa_tools__*`: Initialize QA tools

## File Locations
- **Transition Document**: `/Users/alpinro/Code Prjects/qa-copilot/qa-copilot/docs/session-transition.md`
- **Operational Summary**: `.claude/summaries/operational.md`
- **Strategic Summary**: `.claude/summaries/strategic.md`
- **Session State**: `.claude/session/checkpoint.json`

## Example Usage
```
Start a new QA session
Initialize testing environment
Load previous session context
Continue from session transition document
```

## Session Startup Checklist
- [ ] Read session-transition.md
- [ ] Verify environment variables
- [ ] Check tool availability
- [ ] Create task list from "Next Steps"
- [ ] Update operational summary
- [ ] Initialize progress tracking
- [ ] Notify session ready status

## Best Practices
- Always start by reading the transition document
- Verify all tools before beginning work
- Create clear, actionable tasks
- Document session initialization
- Set realistic session goals
- Maintain continuity with previous sessions