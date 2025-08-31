# QA Copilot 🤖

An AI-powered QA automation assistant that streamlines test case generation, TestRail integration, and Cypress test automation.

## Features ✨

- **JIRA Integration**: Pull tickets directly from JIRA boards and sprints
- **AI Test Generation**: Generate comprehensive test cases using Google Gemini 2.5 AI models
- **TestRail Integration**: Push test cases to TestRail with full traceability and visual confirmation
- **Cypress Automation**: Convert test cases to executable Cypress tests with TestRail references
- **Mock Mode**: Full functionality with mock data when APIs aren't configured
- **Smart Model Selection**: Choose between Gemini 2.5 Flash (fast) or Pro (highest quality)
- **Complete Workflow**: Seamless flow from JIRA → AI Test Cases → TestRail → Cypress
- **Visual Feedback**: Success confirmations, test case IDs, and direct TestRail links

## Quick Start 🚀

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone <your-new-repo-url>
cd qa-copilot
```

2. Install dependencies:
```bash
npm run setup
```

3. Configure environment variables:

**Primary Method: Using shell configuration (Recommended)**
```bash
# Add to ~/.zshrc or ~/.bashrc
export JIRA_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-jira-api-token"
export TESTRAIL_URL="https://your-company.testrail.io"
export TESTRAIL_EMAIL="your-email@company.com"
export TESTRAIL_TOKEN="your-testrail-api-token"
export GOOGLE_API_KEY="your-google-api-key"
export GEMINI_MODEL="gemini-2.5-flash"  # or gemini-2.5-pro

# Reload shell configuration
source ~/.zshrc
```

**Alternative: Using .env files (Optional)**
```bash
# Only if you prefer .env files over shell configuration
# Copy the example files
cp .env.example backend/.env
cp .env.example frontend/.env

# Edit the files with your API credentials
# Note: Shell environment variables take precedence over .env files
```

4. Start the application:
```bash
npm run dev
```

5. Open your browser to http://localhost:5173

## Project Structure 📁

```
qa-copilot/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/    # Main application pages
│   │   ├── services/ # API service layers
│   │   └── components/
├── backend/           # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/ # Business logic
│   │   └── routes/   # API endpoints
├── cypress-templates/ # Cypress test templates
└── scripts/          # Utility scripts
```

## Configuration 🔧

### API Credentials

The application integrates with multiple services. Configure these using environment variables in your shell configuration (`~/.zshrc` or `~/.bashrc`):

#### JIRA/Atlassian
- Get API token: https://id.atlassian.com/manage-profile/security/api-tokens
- Required: `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`

#### TestRail
- Get API key from TestRail: My Settings → API Keys
- Required: `TESTRAIL_URL`, `TESTRAIL_EMAIL`, `TESTRAIL_TOKEN`

#### Google Gemini AI (Optional but Recommended)
- Get API key: https://makersuite.google.com/app/apikey
- Required: `GOOGLE_API_KEY`
- Model selection: `GEMINI_MODEL` (options: `gemini-2.5-flash` or `gemini-2.5-pro`)
  - **gemini-2.5-flash** (default): Faster responses, great quality, cost-effective
  - **gemini-2.5-pro**: Highest quality, better for complex test scenarios

### Mock Mode

The application automatically falls back to mock data when APIs are not configured:
- 3 demo JIRA boards with sample issues
- AI-generated test cases (3 per request)
- Mock TestRail projects and suites
- Sample Cypress test generation

## Usage Workflow 📋

1. **Dashboard**: View JIRA boards and select issues
2. **Generate Tests**: Click "Generate Tests" on any JIRA issue
3. **Review Test Cases**: AI generates comprehensive test cases
4. **Push to TestRail**: Select project/suite and push test cases
5. **Generate Cypress**: Select test cases and generate automation code
6. **Export**: Download or copy Cypress tests to your project

## Development 💻

### Available Scripts

```bash
# Install all dependencies
npm run setup

# Start development servers
npm run dev

# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend

# Run tests
npm test
```

### Technology Stack

**Frontend:**
- React 18
- Vite
- TanStack Query
- Tailwind CSS
- React Router

**Backend:**
- Node.js
- Express
- Sequelize ORM
- Google Gemini AI (2.5 Flash/Pro models)
- Axios

## API Endpoints 🔌

### JIRA
- `GET /api/jira/boards` - List all boards
- `GET /api/jira/current-sprint/:boardId` - Get active sprint
- `GET /api/jira/sprint/:sprintId/issues` - Get sprint issues

### Test Generation
- `POST /api/gemini/generate-test-cases` - Generate test cases from ticket
- `POST /api/gemini/analyze-duplicate` - Check for duplicate tests

### TestRail
- `GET /api/testrail/projects` - List projects
- `GET /api/testrail/suites/:projectId` - List test suites
- `POST /api/testrail/test-case` - Create test case

### Cypress
- `POST /api/cypress/generate-test` - Generate Cypress code
- `GET /api/cypress/templates` - List available templates

## Troubleshooting 🔍

### Common Issues

1. **"Network Error" on frontend**
   - Ensure both servers are running (`npm run dev`)
   - Check that backend is on port 3001

2. **API Authentication Failures**
   - System automatically switches to mock mode
   - Check your API credentials in `.env` files

3. **Port Already in Use**
   ```bash
   # Kill process on port 3001
   lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
   ```

## Contributing 🤝

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License.

## Support 💬

For issues and questions, please open an issue in the GitHub repository.

---

Built with ❤️ for QA Engineers