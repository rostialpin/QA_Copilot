#!/bin/bash

echo "Testing Enhanced Test Generation with Comprehensive Coverage"
echo "============================================================"

# First, start a workflow
echo -e "\n1. Starting workflow..."
WORKFLOW_RESPONSE=$(curl -s -X POST http://localhost:3001/api/workflow/start \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}')

WORKFLOW_ID=$(echo "$WORKFLOW_RESPONSE" | jq -r '.workflow.id')
echo "Workflow ID: $WORKFLOW_ID"

# Now generate tests with comprehensive coverage
echo -e "\n2. Generating tests with comprehensive coverage..."
TEST_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/workflow/$WORKFLOW_ID/step" \
  -H "Content-Type: application/json" \
  -d '{
    "step": "generateTests",
    "data": {
      "ticket": {
        "key": "PARA-12345",
        "summary": "Implement password reset functionality",
        "description": "As a user, I want to reset my password when I forget it. The system should send a reset link to my registered email.",
        "type": "Story",
        "acceptanceCriteria": "User can request password reset. Email with reset link is sent.",
        "qaScenarios": ["Verify password reset email is sent", "Verify link expiration after 24 hours"]
      },
      "context": {
        "patterns": [],
        "examples": []
      },
      "testCount": 10,
      "coverageLevel": "comprehensive",
      "includePerformance": true,
      "includeSecurity": true,
      "includeAccessibility": true,
      "testTypes": ["functional", "performance", "security", "accessibility"]
    }
  }')

# Count the tests
TEST_COUNT=$(echo "$TEST_RESPONSE" | jq '.tests | length')
echo "Total tests generated: $TEST_COUNT"

# Show test titles and types
echo -e "\n3. Test details:"
echo "$TEST_RESPONSE" | jq -r '.tests[] | "  - \(.title) [\(.testType // "functional")]"'

# Summary
echo -e "\n============================================================"
if [ "$TEST_COUNT" -ge 10 ]; then
  echo "✅ SUCCESS: Generated $TEST_COUNT tests"
  echo "   Expected: 10+ tests (10 functional + non-functional)"
else
  echo "❌ FAILURE: Only generated $TEST_COUNT tests"
  echo "   Expected: 10+ tests (10 functional + non-functional)"
fi

# Show if options were properly received
echo -e "\nDebugging: Check server logs for:"
echo "  - '=== ENTERING generateTestCases ===' "
echo "  - 'Options received:' (should show testCount:10, etc.)"
echo "  - '=== ENTERING generateMockTestCases ===' "
echo "  - 'Options:' (should show the same options)"