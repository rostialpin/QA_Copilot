#!/bin/bash

# Script to add QA Copilot environment variables to ~/.zshrc

echo ""
echo "# ===== QA Copilot Environment Variables ====="
echo "# Add these lines to your ~/.zshrc file:"
echo ""

cat << 'EOF'
# QA Copilot Environment Variables
# TestRail Configuration
export TESTRAIL_URL="https://your-company.testrail.io"
export TESTRAIL_EMAIL="your-email@company.com"
export TESTRAIL_TOKEN="your-testrail-api-key"

# Atlassian/JIRA Configuration
export ATLASSIAN_URL="https://your-company.atlassian.net"
export ATLASSIAN_EMAIL="your-email@company.com"
export ATLASSIAN_TOKEN="your-jira-api-token"

# GitHub Configuration
export GITHUB_TOKEN="ghp_your_github_token"
export GITHUB_OWNER="your-github-username"
export GITHUB_REPO="your-cypress-tests-repo"

# Google/Gemini Configuration
export GOOGLE_API_KEY="your-gemini-api-key"
# Or for Vertex AI:
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/path-to-service-account-key.json"

# Optional: Set project-specific NODE_ENV
export NODE_ENV="development"
EOF

echo ""
echo "# ===== Instructions ====="
echo "1. Copy the above lines to your ~/.zshrc file"
echo "2. Replace the placeholder values with your actual credentials"
echo "3. Run: source ~/.zshrc"
echo "4. Verify with: echo \$ATLASSIAN_URL"
