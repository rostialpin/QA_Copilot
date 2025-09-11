import express from 'express';
import codebaseController from '../controllers/codebaseController.js';

const router = express.Router();

// Indexing routes
router.post('/index', codebaseController.indexRepository.bind(codebaseController));
router.get('/status', codebaseController.getIndexStatus.bind(codebaseController));
router.post('/update', codebaseController.updateIndex.bind(codebaseController));

// Search routes
router.post('/search/similar-tests', codebaseController.findSimilarTests.bind(codebaseController));
router.get('/page-objects', codebaseController.findPageObjects.bind(codebaseController));
router.post('/search/code', codebaseController.searchCode.bind(codebaseController));
router.get('/page-object/methods', codebaseController.getPageObjectMethods.bind(codebaseController));

export default router;