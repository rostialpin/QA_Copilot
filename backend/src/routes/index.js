import express from 'express';
import { jiraRouter } from './jira.routes.js';
import { testRailRouter } from './testRail.routes.js';
import { geminiRouter } from './gemini.routes.js';
import { cypressRouter } from './cypress.routes.js';
import { workflowRouter } from './workflow.routes.js';
import javaSeleniumRouter from './javaSelenium.routes.js';
import playwrightRouter from './playwright.routes.js';
import domAnalyzerRouter from './domAnalyzer.routes.js';
import smartTestGeneratorRouter from './smartTestGenerator.routes.js';
import aiRouter from './ai.routes.js';
import patternLearningRouter from './patternLearning.routes.js';
import contextAwareAgentRouter from './contextAwareAgent.routes.js';
import hybridRAGRouter from './hybridRAG.routes.js';
import actionKnowledgeBaseRouter from './actionKnowledgeBase.routes.js';
import scenarioDecomposerRouter from './scenarioDecomposer.routes.js';

export const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount sub-routers
router.use('/jira', jiraRouter);
router.use('/testrail', testRailRouter);
router.use('/gemini', geminiRouter);
router.use('/cypress', cypressRouter);
router.use('/workflow', workflowRouter);
router.use('/java-selenium', javaSeleniumRouter);
router.use('/playwright', playwrightRouter);
router.use('/dom-analyzer', domAnalyzerRouter);
router.use('/smart-test', smartTestGeneratorRouter);
router.use('/ai', aiRouter);
router.use('/pattern-learning', patternLearningRouter);
router.use('/context-aware-agent', contextAwareAgentRouter);
router.use('/hybrid-rag', hybridRAGRouter);
router.use('/knowledge-base', actionKnowledgeBaseRouter);
router.use('/scenario-decomposer', scenarioDecomposerRouter);
