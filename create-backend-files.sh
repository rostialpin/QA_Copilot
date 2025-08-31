#!/bin/bash

# This script creates all remaining backend files

cat > backend/src/routes/testRail.routes.js << 'EOF'
import express from 'express';
import { TestRailController } from '../controllers/testRailController.js';

export const testRailRouter = express.Router();
const controller = new TestRailController();

testRailRouter.get('/projects', controller.getProjects.bind(controller));
testRailRouter.get('/suites/:projectId', controller.getSuites.bind(controller));
testRailRouter.post('/test-case', controller.createTestCase.bind(controller));
testRailRouter.get('/test-cases/:suiteId', controller.getTestCases.bind(controller));
EOF

cat > backend/src/routes/gemini.routes.js << 'EOF'
import express from 'express';
import { GeminiController } from '../controllers/geminiController.js';

export const geminiRouter = express.Router();
const controller = new GeminiController();

geminiRouter.post('/generate-test-cases', controller.generateTestCases.bind(controller));
geminiRouter.post('/analyze-duplicate', controller.analyzeDuplicate.bind(controller));
EOF

cat > backend/src/routes/cypress.routes.js << 'EOF'
import express from 'express';
import { CypressController } from '../controllers/cypressController.js';

export const cypressRouter = express.Router();
const controller = new CypressController();

cypressRouter.post('/generate-test', controller.generateCypressTest.bind(controller));
cypressRouter.get('/templates', controller.getTemplates.bind(controller));
cypressRouter.post('/analyze-existing', controller.analyzeExistingTests.bind(controller));
EOF

echo "Routes created!"
