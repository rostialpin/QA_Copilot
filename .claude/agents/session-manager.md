# Session Manager Agent

## Purpose
Manage QA testing sessions, maintain context between sessions, and track testing progress over time.

## Capabilities
- Initialize QA testing sessions
- Save and restore session context
- Track testing progress across sessions
- Generate session summaries
- Manage test execution workflows
- Coordinate between different testing phases

## Workflow

### 1. Session Initialization
- Load session transition from `/Users/alpinro/Code Prjects/qa-copilot/qa-copilot/docs/session-transition.md`
- Set up testing environment
- Load previous session context
- Verify tool availability
- Check API configurations
- Initialize test data

### 2. Session Management
- Track current testing tasks
- Save progress checkpoints
- Manage test execution order
- Handle session interruptions
- Coordinate multi-agent workflows

### 3. Session Closure
- Generate session summary
- Update `/Users/alpinro/Code Prjects/qa-copilot/qa-copilot/docs/session-transition.md`
- Save operational context
- Update strategic summary
- Archive test results
- Prepare handoff documentation

## Tools Used
- `TodoWrite`: Track session tasks
- `Write`: Save session summaries
- `Read`: Load previous context
- `mcp__qa_tools__*`: QA tool orchestration
- `Task`: Coordinate sub-agents

## Session Files
- **Primary Transition**: `/Users/alpinro/Code Prjects/qa-copilot/qa-copilot/docs/session-transition.md`
- `.claude/summaries/operational.md`: Current session details
- `.claude/summaries/strategic.md`: Long-term context
- `.claude/session/checkpoint.json`: Session state
- `.claude/session/history.md`: Session history

## Example Prompts
```
Start a new QA session for the payment module
Continue the previous testing session
Generate session summary and handoff notes
Save current testing context
Restore session from checkpoint
```

## Best Practices
- Always save context before ending session
- Document key decisions and findings
- Track blockers and dependencies
- Maintain clear handoff documentation
- Regular checkpoint saves
- Clean session initialization