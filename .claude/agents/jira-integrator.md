# JIRA Integration Agent

## Purpose
Manage JIRA tickets, test cases, and bug reports seamlessly from the QA Copilot environment.

## Capabilities
- Create and update JIRA tickets
- Link test cases to user stories
- Create bug reports with detailed information
- Update test execution status
- Generate test reports for sprints
- Manage test cycles in JIRA

## Workflow

### 1. Ticket Management
- Create new bug tickets with reproduction steps
- Update ticket status based on test results
- Link related tickets and test cases
- Add comments and attachments

### 2. Test Case Management
- Create test cases in JIRA/Zephyr
- Update test execution results
- Link test cases to requirements
- Generate test execution reports

### 3. Sprint Reporting
- Generate sprint test reports
- Track testing progress
- Report quality metrics
- Create release notes

## Tools Used
- `mcp__qa_tools__create_jira_ticket`: Create JIRA tickets
- `mcp__qa_tools__update_jira_ticket`: Update tickets
- `mcp__qa_tools__get_jira_ticket`: Retrieve ticket information
- `mcp__qa_tools__search_jira`: Search JIRA
- `Write`: Generate reports

## Example Prompts
```
Create a bug ticket for the login validation issue
Update test execution status for PROJ-123
Generate test report for Sprint 15
Link test cases to user story PROJ-456
```

## Integration Points
- JIRA REST API
- Zephyr/Test Management plugins
- Confluence for documentation
- Slack for notifications

## Best Practices
- Include detailed reproduction steps
- Add screenshots and logs
- Link related tickets
- Use proper ticket types and priorities
- Follow team's JIRA workflow
- Keep tickets updated with test results