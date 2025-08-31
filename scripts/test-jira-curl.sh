#!/bin/bash

# Test JIRA API with curl
echo "🔍 Testing JIRA API with curl..."
echo "================================"

# Get credentials from environment
URL="${ATLASSIAN_URL%/}"  # Remove trailing slash if present
EMAIL="$ATLASSIAN_EMAIL"
TOKEN="$ATLASSIAN_TOKEN"

echo "URL: $URL"
echo "Email: $EMAIL"
echo "Token starts with: ${TOKEN:0:10}..."
echo "================================"
echo ""

# Test the connection
echo "📝 Testing /rest/api/2/myself endpoint..."
echo ""

# Make the request
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -u "${EMAIL}:${TOKEN}" \
  -X GET \
  -H "Accept: application/json" \
  "${URL}/rest/api/2/myself")

# Extract HTTP status code
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed -n '1,/HTTP_STATUS/p' | sed '$d')

echo "HTTP Status: $http_status"
echo ""

if [ "$http_status" -eq 200 ]; then
    echo "✅ Authentication successful!"
    echo "Response:"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo "❌ Authentication failed!"
    echo "Response body:"
    echo "$body"
    echo ""
    
    if [ "$http_status" -eq 403 ]; then
        echo "🔐 403 Forbidden - Possible issues:"
        echo "1. API token might be expired or invalid"
        echo "2. Generate a new token at:"
        echo "   https://id.atlassian.com/manage-profile/security/api-tokens"
        echo "3. Make sure you're using an API token, not your password"
        echo "4. Check if the service account has proper permissions"
    elif [ "$http_status" -eq 401 ]; then
        echo "🔐 401 Unauthorized - Invalid credentials"
        echo "Check your email and API token"
    fi
fi

echo ""
echo "================================"
echo "🔧 To generate a new API token:"
echo "1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens"
echo "2. Click 'Create API token'"
echo "3. Give it a label (e.g., 'QA Copilot')"
echo "4. Copy the token"
echo "5. Update your ~/.zshrc with:"
echo "   export ATLASSIAN_TOKEN='your-new-token'"
echo "6. Run: source ~/.zshrc"
