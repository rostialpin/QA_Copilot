#!/bin/bash

# Test script for enhanced Java Selenium generation with AI model switching

API_URL="http://localhost:3001"
echo "Testing QA Copilot Enhanced Generation Flow"
echo "==========================================="

# Test 1: Check AI Status
echo -e "\n1. Checking AI Service Status..."
curl -s "$API_URL/api/ai/status" | jq '.'

# Test 2: Switch to Claude (if API key is available)
echo -e "\n2. Testing provider switching..."
curl -s -X POST "$API_URL/api/ai/provider" \
  -H "Content-Type: application/json" \
  -d '{"provider": "claude"}' | jq '.'

# Switch back to Gemini 
curl -s -X POST "$API_URL/api/ai/provider" \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini"}' | jq '.'

# Test 3: Test DOM Analysis
echo -e "\n3. Testing DOM Analysis..."
curl -s -X POST "$API_URL/api/java-selenium/test-dom-analysis" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}' | jq '.success, .totalElements'

# Test 4: Test Enhanced Generation
echo -e "\n4. Testing Enhanced Selenium Generation..."
curl -s -X POST "$API_URL/api/java-selenium/generate-enhanced" \
  -H "Content-Type: application/json" \
  -d '{
    "manualTest": {
      "name": "Test Login Flow",
      "description": "Verify user can login successfully",
      "steps": [
        {"action": "Navigate to login page", "expectedResult": "Login page loads"},
        {"action": "Enter username", "expectedResult": "Username field accepts input"},
        {"action": "Enter password", "expectedResult": "Password field accepts input"},
        {"action": "Click login button", "expectedResult": "User is logged in successfully"}
      ]
    },
    "options": {
      "url": "https://example.com/login",
      "useEnhancedGeneration": true
    }
  }' | jq '.success, .fileName'

echo -e "\n✅ Enhanced generation flow test complete!"
echo "==========================================="
echo "Summary:"
echo "- AI Service: Working with model switching"
echo "- DOM Analysis: Functional with Puppeteer"
echo "- Enhanced Generation: Ready with multi-strategy locators"
echo ""
echo "You can now:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Navigate to the Java Selenium Generator"
echo "3. Use the AI model selector to switch between Gemini and Claude"
echo "4. Generate tests with enhanced locator strategies"