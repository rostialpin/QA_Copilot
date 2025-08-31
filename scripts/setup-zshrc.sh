#!/bin/bash

# QA Copilot Environment Setup Helper

echo "🔐 QA Copilot Environment Variables Setup"
echo "========================================="
echo ""
echo "Add the following lines to your ~/.zshrc file:"
echo "(You can edit it with: nano ~/.zshrc or code ~/.zshrc)"
echo ""
echo "# ===== QA Copilot Environment Variables ====="

cat << 'EOF'
# TestRail Configuration (optional)
export TESTRAIL_URL="https://your-company.testrail.io"
export TESTRAIL_EMAIL="your-email@company.com"
export TESTRAIL_TOKEN="your-testrail-api-key"

# Atlassian/JIRA Configuration (required)
export ATLASSIAN_URL="https://your-company.atlassian.net"
export ATLASSIAN_EMAIL="your-email@company.com"
export ATLASSIAN_TOKEN="your-jira-api-token"

# GitHub Configuration (optional)
export GITHUB_TOKEN="ghp_your_github_token"
export GITHUB_OWNER="your-github-username"
export GITHUB_REPO="your-cypress-tests-repo"

# Google/Gemini Configuration (required)
export GOOGLE_API_KEY="your-gemini-api-key"
# OR for Vertex AI (choose one):
# export GOOGLE_APPLICATION_CREDENTIALS="$HOME/path-to-service-account-key.json"
EOF

echo ""
echo "# ===== After adding the variables ====="
echo "1. Save the file"
echo "2. Reload your shell configuration:"
echo "   source ~/.zshrc"
echo ""
echo "3. Verify the variables are set:"
echo "   echo \$ATLASSIAN_URL"
echo "   echo \$GOOGLE_API_KEY"
echo ""
echo "4. Then run the backend without needing .env files:"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "# ===== Benefits of this approach ====="
echo "✅ More secure - credentials not in project files"
echo "✅ Works across all projects"
echo "✅ No risk of committing secrets to git"
echo "✅ Easy to update in one place"
