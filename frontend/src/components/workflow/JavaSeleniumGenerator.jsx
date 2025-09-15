import React, { useState, useEffect } from 'react';
import { 
  Code, Loader2, FolderOpen, Save, 
  GitBranch, ExternalLink, CheckCircle, 
  AlertCircle, FolderTree, FileCode, Copy, X, Zap,
  ChevronRight, ChevronDown, Folder, Globe, Search,
  Database, Brain, ChevronLeft, List, PlayCircle
} from 'lucide-react';
import axios from 'axios';
import SuccessAnimation from '../SuccessAnimation';
import AIModelSelector from './AIModelSelector';
import PageObjectSelector from './PageObjectSelector';
import SimilarTestsViewer from './SimilarTestsViewer';
import EnhancedCodeSelector from './EnhancedCodeSelector';
import TestCompletionFeedback from './TestCompletionFeedback';
import MissingDataCollector from './MissingDataCollector';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function JavaSeleniumGenerator({ 
  tests, 
  ticket, 
  onGenerated, 
  generatedCode,
  isLoading: parentLoading,
  onSkip
}) {
  // Flatten tests if they are grouped arrays
  const flattenedTests = React.useMemo(() => {
    if (!tests) return [];
    
    // Check if tests are already flattened (single test objects)
    if (tests.length > 0 && tests[0].title && !Array.isArray(tests[0].title)) {
      // Check if titles are concatenated (contain multiple test scenarios)
      const allTests = [];
      tests.forEach(test => {
        // Check if this is a grouped test with concatenated title
        if (test.title && test.title.includes('][')) {
          // This appears to be multiple tests concatenated
          // Try to split based on the pattern
          const titleParts = test.title.split(/(?=\[)/);
          if (titleParts.length > 1) {
            // Create individual tests from the parts
            titleParts.forEach((part, idx) => {
              if (part.trim()) {
                allTests.push({
                  title: part.trim(),
                  description: test.description ? `${test.description} (Part ${idx + 1})` : part.trim(),
                  steps: test.steps ? [test.steps[idx] || `Step for ${part.trim()}`] : [],
                  preconditions: test.preconditions,
                  category: test.category
                });
              }
            });
          } else {
            allTests.push(test);
          }
        } else {
          allTests.push(test);
        }
      });
      return allTests;
    }
    
    // If tests are arrays of arrays, flatten them
    return tests.flat();
  }, [tests]);

  const [repoPath, setRepoPath] = useState(localStorage.getItem('lastRepoPath') || '');
  const [isValidRepo, setIsValidRepo] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [pathType, setPathType] = useState('local'); // 'local' or 'github'
  
  // Test selection states
  const [selectedTestIndex, setSelectedTestIndex] = useState(0);
  const [showTestSelector, setShowTestSelector] = useState(true);
  const [cachedGeneratedTests, setCachedGeneratedTests] = useState(() => {
    // Load cached tests from localStorage on mount
    try {
      const cached = localStorage.getItem('qa-copilot-cached-tests');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  
  const [directoryTree, setDirectoryTree] = useState([]);
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [propertiesPath, setPropertiesPath] = useState(localStorage.getItem('lastPropertiesPath') || '');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState(generatedCode || null);
  const [patterns, setPatterns] = useState(null);
  const [generationStep, setGenerationStep] = useState(''); // 'indexing', 'learning', 'generating'
  const [testAnalysis, setTestAnalysis] = useState(null);
  const [feedbackReport, setFeedbackReport] = useState(null);
  
  const [saveOptions, setSaveOptions] = useState({
    createBranch: true,
    openInIDE: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [showPathInstructions, setShowPathInstructions] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(true); // Changed to true to show by default
  
  // DOM Analysis states
  const [applicationUrl, setApplicationUrl] = useState(localStorage.getItem('lastApplicationUrl') || '');
  const [isAnalyzingDom, setIsAnalyzingDom] = useState(false);
  const [domElements, setDomElements] = useState(null);
  const [domAnalysisSuccess, setDomAnalysisSuccess] = useState('');
  
  // Intelligent indexing states
  const [isIndexed, setIsIndexed] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexStats, setIndexStats] = useState(null);
  const [selectedPageObjects, setSelectedPageObjects] = useState([]);
  const [similarTests, setSimilarTests] = useState([]);
  const [extractedPatterns, setExtractedPatterns] = useState(null);
  const [showIntelligentMode, setShowIntelligentMode] = useState(true);
  
  // Pre-generation analysis states
  const [showMissingDataCollector, setShowMissingDataCollector] = useState(false);
  const [missingPatterns, setMissingPatterns] = useState({});
  const [generationSessionId, setGenerationSessionId] = useState(null);
  const [additionalFiles, setAdditionalFiles] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Validate repository when path changes
  useEffect(() => {
    if (repoPath && repoPath.length > 3) {
      validateRepository();
    }
  }, [repoPath]);
  
  // Update generated test when prop changes
  useEffect(() => {
    if (generatedCode && !generatedTest) {
      setGeneratedTest(generatedCode);
    }
  }, [generatedCode]);

  const validateRepository = async () => {
    setIsValidating(true);
    setValidationError('');
    setDirectoryTree([]); // Clear any previous tree
    
    try {
      // Handle GitHub URL
      let actualPath = repoPath.trim();
      if (pathType === 'github' && repoPath.includes('github.com')) {
        setValidationError('GitHub integration in progress. For now, please clone the repository locally and use the local path.');
        setIsValidating(false);
        return;
      }
      
      console.log('Validating repository path:', actualPath);
      
      const response = await axios.post(`${API_URL}/api/java-selenium/validate`, {
        repoPath: actualPath,
        isGitHub: pathType === 'github'
      });
      
      console.log('Validation response:', response.data);
      
      if (response.data.valid) {
        setIsValidRepo(true);
        localStorage.setItem('lastRepoPath', repoPath);
        // Load directory tree after successful validation
        await loadDirectoryTree();
        // Check if repository is indexed
        await checkIndexStatus();
        // Auto-discover properties path
        await autoDiscoverProperties();
        // Auto-select default test directory
        setSelectedDirectory('src/test/java');
        console.log('Auto-selected test directory: src/test/java');
      } else {
        setIsValidRepo(false);
        setValidationError(response.data.error || 'Invalid repository. Please ensure the path exists and contains Java files.');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setIsValidRepo(false);
      setValidationError(
        error.response?.data?.error || 
        'Failed to validate repository. Please check the path exists and the backend server is running.'
      );
    } finally {
      setIsValidating(false);
    }
  };

  const autoDiscoverProperties = async () => {
    try {
      // Common locations for properties files in Java projects
      const commonPaths = [
        'src/main/resources/elements',
        'src/main/resources/properties',
        'src/test/resources/elements',
        'src/test/resources/properties',
        'mqe-unified-oao-tests-common/src/main/resources/elements'
      ];
      
      // Try to find properties path automatically
      for (const path of commonPaths) {
        const fullPath = `${repoPath.trim()}/${path}`;
        // In a real implementation, we'd check if this path exists
        // For now, we'll set a likely path for the unified tests
        if (repoPath.includes('mqe-unified-oao-tests')) {
          const autoPath = `${repoPath.trim()}/mqe-unified-oao-tests-common/src/main/resources/elements/unified`;
          setPropertiesPath(autoPath);
          console.log('Auto-discovered properties path:', autoPath);
          break;
        }
      }
    } catch (error) {
      console.log('Could not auto-discover properties, user can specify manually if needed');
    }
  };

  const checkIndexStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/codebase/status`, {
        params: { repoPath: repoPath.trim() }
      });
      
      setIsIndexed(response.data.indexed);
      if (response.data.indexed) {
        setIndexStats(response.data.stats);
        console.log('Repository already indexed:', response.data.stats);
      } else {
        // Proactively start indexing in the background
        console.log('Repository not indexed. Starting background indexing...');
        indexRepository(); // Don't await - let it run in background
      }
    } catch (error) {
      console.error('Error checking index status:', error);
      setIsIndexed(false);
      // Try to index anyway if status check fails
      console.log('Status check failed. Attempting to index repository...');
      indexRepository(); // Don't await - let it run in background
    }
  };
  
  const indexRepository = async () => {
    setIsIndexing(true);
    setValidationError('');
    
    try {
      const response = await axios.post(`${API_URL}/api/codebase/index`, {
        repoPath: repoPath.trim(),
        forceReindex: false
      });
      
      setIsIndexed(true);
      setIndexStats(response.data.stats);
      return true;
    } catch (error) {
      console.error('Error indexing repository:', error);
      setValidationError('Failed to index repository');
      return false;
    } finally {
      setIsIndexing(false);
    }
  };
  
  const analyzeDom = async () => {
    if (!applicationUrl) {
      setValidationError('Please enter a URL to analyze');
      return;
    }
    
    setIsAnalyzingDom(true);
    setValidationError('');
    
    try {
      const response = await axios.post(`${API_URL}/api/dom-analyzer/analyze`, {
        url: applicationUrl
      });
      
      if (response.data.success && response.data.analysis) {
        const analysis = response.data.analysis;
        
        // Calculate stats from the analysis
        const stats = analysis.stats || {
          totalElements: analysis.elementCount || analysis.elements?.length || 0,
          buttons: analysis.groupedElements?.buttons?.length || 0,
          inputs: analysis.groupedElements?.inputs?.length || 0,
          links: analysis.groupedElements?.links?.length || 0,
          elementsWithTestId: analysis.elements?.filter(e => e.attributes?.['data-testid'])?.length || 0,
          elementsWithAriaLabel: analysis.elements?.filter(e => e.attributes?.['aria-label'])?.length || 0,
          focusableElements: analysis.elements?.filter(e => 
            e.attributes?.tabindex !== undefined && e.attributes?.tabindex !== '-1'
          )?.length || 0
        };
        
        // Store both analysis and stats
        setDomElements({
          ...analysis,
          stats,
          totalElements: stats.totalElements,
          buttons: stats.buttons,
          inputs: stats.inputs,
          links: stats.links,
          elementsWithTestId: stats.elementsWithTestId,
          elementsWithAriaLabel: stats.elementsWithAriaLabel,
          focusableElements: stats.focusableElements
        });
        
        localStorage.setItem('lastApplicationUrl', applicationUrl);
        console.log('DOM Analysis Results:', analysis);
        console.log('DOM Stats:', stats);
        
        // Show success message with details
        const msg = `✅ DOM analyzed successfully! Found ${stats.totalElements} elements`;
        const details = [];
        if (stats.elementsWithTestId > 0) details.push(`${stats.elementsWithTestId} with test-ids`);
        if (stats.buttons > 0) details.push(`${stats.buttons} buttons`);
        if (stats.elementsWithAriaLabel > 0) details.push(`${stats.elementsWithAriaLabel} with aria-labels`);
        
        setDomAnalysisSuccess(msg + (details.length ? ` (${details.join(', ')})` : ''));
        setValidationError('');
        
        // Clear success message after 5 seconds
        setTimeout(() => setDomAnalysisSuccess(''), 5000);
      } else {
        setValidationError('Failed to analyze DOM. Please check the URL.');
      }
    } catch (error) {
      console.error('Error analyzing DOM:', error);
      setValidationError(`Failed to analyze DOM: ${error.response?.data?.error || 'Please check the URL and try again.'}`);
      setDomAnalysisSuccess('');
    } finally {
      setIsAnalyzingDom(false);
    }
  };

  const loadDirectoryTree = async () => {
    if (!repoPath) {
      console.log('No repository path provided');
      return;
    }
    
    setIsLoadingTree(true);
    console.log('Loading directory tree for:', repoPath);
    
    try {
      const response = await axios.get(`${API_URL}/api/java-selenium/directory-tree`, {
        params: { repoPath: repoPath.trim() }
      });
      
      console.log('Directory tree response:', response.data);
      setDirectoryTree(response.data || []);
      
      // Auto-expand all nodes for easier navigation
      const allPaths = new Set();
      const collectPaths = (nodes, parentPath = '') => {
        nodes.forEach(node => {
          const fullPath = node.path.startsWith('/') ? 
            node.path : 
            `${repoPath}/${node.path}`.replace(/\/+/g, '/');
          allPaths.add(fullPath);
          if (node.children && node.children.length > 0) {
            collectPaths(node.children, node.path);
          }
        });
      };
      
      if (response.data && response.data.length > 0) {
        collectPaths(response.data);
        setExpandedNodes(allPaths);
      }
      
      if (!response.data || response.data.length === 0) {
        console.warn('No directories found in the repository');
      }
    } catch (error) {
      console.error('Error loading directory tree:', error);
      setValidationError('Failed to load directory structure. Please check if the path is accessible.');
      setDirectoryTree([]);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const generateSeleniumTest = async () => {
    if (!tests || tests.length === 0) {
      setValidationError('No manual tests available to convert');
      return;
    }
    
    setIsAnalyzing(true);
    setSaveResult(null);
    setShowMissingDataCollector(false);
    setGenerationStep('analyzing');
    setShowTestSelector(false); // Hide selector when generating
    
    try {
      // Use the selected test index
      const manualTest = tests[selectedTestIndex] || {
        title: 'Generated Test',
        description: 'Automated test',
        steps: [],
        preconditions: 'Standard test preconditions',
        ticket: ticket
      };
      
      console.log(`Processing test ${selectedTestIndex + 1} of ${tests.length} with ${manualTest.steps.length} steps`);
      
      // Step 1: Analyze requirements first
      setGenerationStep('analyzing');
      console.log('Analyzing test requirements...');
      
      // Collect existing code from selected files
      const existingCode = [];
      if (selectedPageObjects && selectedPageObjects.length > 0) {
        existingCode.push(...selectedPageObjects.map(po => ({
          name: po.name,
          content: po.content
        })));
      }
      
      const analysisResponse = await axios.post(`${API_URL}/api/java-selenium/analyze-requirements`, {
        manualTest,
        existingCode
      });
      
      if (!analysisResponse.data.success) {
        throw new Error('Failed to analyze test requirements');
      }
      
      const { sessionId, missingPatterns: patterns, canGenerateComplete } = analysisResponse.data;
      setGenerationSessionId(sessionId);
      
      // Check if we need to show missing data collector
      if (!canGenerateComplete && Object.keys(patterns).length > 0) {
        setMissingPatterns(patterns);
        setShowMissingDataCollector(true);
        setIsAnalyzing(false);
        setIsGenerating(false); // Important: set this to false
        console.log('Missing patterns detected:', patterns);
        return; // Stop here and wait for user decision
      }
      
      // If we have all patterns, proceed directly to generation
      console.log('All patterns available, proceeding to generation');
      await completeGeneration(sessionId, false);
    } catch (error) {
      console.error('Error generating test:', error);
      setValidationError(error.message || 'Failed to generate test. Please check console for details.');
    } finally {
      setIsAnalyzing(false);
      setIsGenerating(false);
      setGenerationStep('');
    }
  };
  
  /**
   * Complete generation after user decision on missing patterns
   */
  const completeGeneration = async (sessionId, includeAdditionalData, uploadedFiles = null) => {
    setIsGenerating(true);
    setShowMissingDataCollector(false);
    setGenerationStep('generating');
    
    try {
      console.log('Completing generation with session:', sessionId);
      const response = await axios.post(`${API_URL}/api/java-selenium/complete-generation`, {
        sessionId,
        includeAdditionalData,
        additionalFiles: uploadedFiles
      });
      
      console.log('Complete generation response:', response.data);
      
      // Check if we got a test result
      const generatedCode = response.data.test || response.data.generatedTest || response.data.code;
      
      if (!generatedCode) {
        throw new Error('No test code was generated. Please try again.');
      }
      
      setGeneratedTest(generatedCode);
      
      // Cache the generated test for navigation
      const newCachedTests = [...cachedGeneratedTests];
      newCachedTests[selectedTestIndex] = generatedCode;
      setCachedGeneratedTests(newCachedTests);
      localStorage.setItem('qa-copilot-cached-tests', JSON.stringify(newCachedTests));
      
      // Clear the session since we're done
      setGenerationSessionId(null);
      setMissingPatterns({});
      
      // Set analysis and feedback if available
      if (response.data.analysis) {
        setTestAnalysis(response.data.analysis);
      }
      if (response.data.feedbackReport) {
        setFeedbackReport(response.data.feedbackReport);
      }
      
      onGenerated && onGenerated(generatedCode);
      setShowSuccessAnimation(true);
    } catch (error) {
      console.error('Error completing generation:', error);
      // Instead of showing error, reset state to allow retry
      setShowMissingDataCollector(false);
      setGenerationSessionId(null);
      setMissingPatterns({});
      setValidationError('Failed to generate test. Please try again.');
      // Don't stay in loading state
      setIsGenerating(false);
      setGenerationStep('');
    }
  };
  
  /**
   * Handle file upload for missing patterns
   */
  const handlePatternFileUpload = async (category, files) => {
    console.log('Files uploaded for category:', category, files);
    setAdditionalFiles(prev => ({
      ...prev,
      [category]: files
    }));
    
    // Update session on backend
    if (generationSessionId) {
      try {
        await axios.post(`${API_URL}/api/java-selenium/update-session`, {
          sessionId: generationSessionId,
          category,
          files: files.map(f => ({ name: f.name, size: f.size }))
        });
      } catch (error) {
        console.error('Error updating session:', error);
      }
    }
  };
  
  /**
   * Handle user decision to provide additional data
   */
  const handleProvideData = async (uploadedFiles) => {
    console.log('User provided additional data:', uploadedFiles);
    
    // Process uploaded files
    const processedFiles = [];
    for (const [category, files] of Object.entries(uploadedFiles)) {
      for (const file of files) {
        const content = await file.text();
        processedFiles.push({
          name: file.name,
          category,
          content
        });
      }
    }
    
    await completeGeneration(generationSessionId, true, processedFiles);
  };
  
  /**
   * Handle user decision to skip and generate with TODOs
   */
  const handleSkipData = async () => {
    console.log('handleSkipData called - User chose to generate with TODOs');
    console.log('Current sessionId:', generationSessionId);
    setShowMissingDataCollector(false);
    setIsGenerating(true);
    setGenerationStep('generating');
    
    try {
      // Use selected test to avoid combining issues
      const manualTest = tests[selectedTestIndex] || {
        title: 'Generated Test',
        description: 'Automated test',
        steps: []
      };
      
      console.log('Completing generation with TODOs, session:', generationSessionId);
      
      // Prepare existing code from selectedPageObjects
      const existingCode = selectedPageObjects.map(po => ({
        name: po.name,
        content: po.content
      }));
      
      const response = await axios.post(`${API_URL}/api/java-selenium/complete-generation`, {
        sessionId: generationSessionId,
        includeAdditionalData: false,
        skipMissingPatterns: true,
        manualTest,
        selectedCode: existingCode
      });
      
      console.log('Complete generation response:', response.data);
      
      const generatedCode = response.data.test || response.data.generatedTest || response.data.code;
      
      if (!generatedCode) {
        throw new Error('No test code was generated.');
      }
      
      // Save configuration for future use
      try {
        const config = {
          selectedFiles: selectedPageObjects.map(po => ({ 
            name: po.name, 
            path: po.path || po.name 
          })),
          timestamp: new Date().toISOString(),
          framework: 'selenium'
        };
        
        localStorage.setItem('qa-copilot-last-config', JSON.stringify(config));
        
        const recentConfigs = JSON.parse(localStorage.getItem('qa-copilot-recent-configs') || '[]');
        recentConfigs.unshift(config);
        if (recentConfigs.length > 5) {
          recentConfigs.pop();
        }
        localStorage.setItem('qa-copilot-recent-configs', JSON.stringify(recentConfigs));
        
        console.log('Configuration saved:', config);
      } catch (saveError) {
        console.error('Error saving configuration:', saveError);
      }
      
      setGeneratedTest(generatedCode);
      setGenerationSessionId(null);
      setMissingPatterns({});
      
      if (response.data.analysis) {
        setTestAnalysis(response.data.analysis);
      }
      if (response.data.feedbackReport) {
        setFeedbackReport(response.data.feedbackReport);
      }
      
      onGenerated && onGenerated(generatedCode);
      setShowSuccessAnimation(true);
      setIsGenerating(false);
      setGenerationStep('');
    } catch (error) {
      console.error('Error completing generation:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Check if it's a session expiry or other specific error
      if (error.response?.status === 404 || error.response?.data?.error?.includes('session')) {
        setValidationError('Session expired. Starting fresh generation...');
        // Try to generate without session (backend will handle it)
        setGenerationSessionId(null);
        // Don't reset the UI state - keep trying
        setTimeout(() => handleSkipData(), 1000);
      } else {
        setValidationError(`Failed to generate test: ${error.response?.data?.error || error.message}`);
        setShowMissingDataCollector(false);
        setIsGenerating(false);
        setGenerationStep('');
      }
    }
  };

  const saveGeneratedTest = async () => {
    if (!generatedTest) return;
    
    setIsSaving(true);
    setSaveResult(null);
    
    try {
      // Use the selected directory or default
      const testDir = selectedDirectory || `${repoPath}/src/test/java`;
      
      const response = await axios.post(`${API_URL}/api/java-selenium/save`, {
        repoPath,
        testDirectory: testDir,
        generatedTest,
        createBranch: saveOptions.createBranch,
        ticketId: ticket?.key
      });
      
      setSaveResult(response.data);
      
      // Don't show animation on save anymore - moved to generation
      
      // Open in IDE if requested
      if (saveOptions.openInIDE && response.data.path) {
        try {
          await axios.post(`${API_URL}/api/java-selenium/open-ide`, {
            filePath: response.data.path
          });
        } catch (error) {
          console.log('Could not open in IDE:', error);
        }
      }
    } catch (error) {
      console.error('Error saving test:', error);
      setValidationError('Failed to save test');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedbackAction = async (action) => {
    console.log('Handling feedback action:', action);
    // Could implement automatic search for missing examples here
    // For now, just log the action
    alert(`Please search for and upload files matching: ${action.expectedFiles.join(', ')}`);
  };

  const renderDirectoryNode = (node, level = 0) => {
    if (node.type === 'directory') {
      // Create full path for this node
      const fullPath = node.path.startsWith('/') ? 
        node.path : 
        `${repoPath}/${node.path}`.replace(/\/+/g, '/');
      const isSelected = selectedDirectory === fullPath;
      const hasTests = node.hasTests;
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(fullPath);
      
      return (
        <div key={node.path} style={{ marginLeft: `${level * 15}px` }}>
          <div
            className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 ${
              isSelected ? 'bg-indigo-100' : ''
            }`}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newExpanded = new Set(expandedNodes);
                  if (isExpanded) {
                    newExpanded.delete(fullPath);
                  } else {
                    newExpanded.add(fullPath);
                  }
                  setExpandedNodes(newExpanded);
                }}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {isExpanded ? 
                  <ChevronDown className="h-3 w-3" /> : 
                  <ChevronRight className="h-3 w-3" />
                }
              </button>
            )}
            {!hasChildren && <span className="w-4" />}
            
            <div
              onClick={() => setSelectedDirectory(fullPath)}
              className="flex items-center gap-1.5 flex-1"
            >
              {isExpanded ? 
                <FolderOpen className="h-4 w-4 text-yellow-600" /> :
                <Folder className="h-4 w-4 text-yellow-600" />
              }
              <span className={`text-sm ${hasTests ? 'font-medium' : ''}`}>
                {node.name}
              </span>
              {hasTests && (
                <span className="text-xs bg-green-100 text-green-700 px-1 rounded ml-1">
                  tests
                </span>
              )}
            </div>
          </div>
          {hasChildren && isExpanded && (
            <div>
              {node.children.map(child => renderDirectoryNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  // If no tests provided, show error
  if (!tests || tests.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-900">No manual tests available to convert to Selenium</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Test Selection UI */}
      {tests && tests.length > 1 && showTestSelector && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <List className="h-5 w-5 text-indigo-600" />
              Select Test to Automate
            </h4>
            <span className="text-sm text-gray-600">
              {tests.length} tests available
            </span>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tests.map((test, index) => (
              <div
                key={index}
                onClick={() => setSelectedTestIndex(index)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedTestIndex === index
                    ? 'bg-white border-2 border-indigo-500 shadow-md'
                    : 'bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {selectedTestIndex === index && (
                        <CheckCircle className="h-4 w-4 text-indigo-600" />
                      )}
                      <span className="font-medium text-gray-900">
                        Test {index + 1}: {test.title || `Test Case ${index + 1}`}
                      </span>
                    </div>
                    {test.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {test.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {test.steps?.length || 0} steps
                      {cachedGeneratedTests[index] && (
                        <span className="ml-2 text-green-600">✓ Generated</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Navigation buttons */}
          {tests.length > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-indigo-200">
              <button
                onClick={() => {
                  const newIndex = selectedTestIndex > 0 ? selectedTestIndex - 1 : tests.length - 1;
                  setSelectedTestIndex(newIndex);
                  if (cachedGeneratedTests[newIndex]) {
                    setGeneratedTest(cachedGeneratedTests[newIndex]);
                  } else {
                    setGeneratedTest(null);
                  }
                }}
                className="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Test {selectedTestIndex + 1} of {tests.length}
              </span>
              
              <button
                onClick={() => {
                  const newIndex = selectedTestIndex < tests.length - 1 ? selectedTestIndex + 1 : 0;
                  setSelectedTestIndex(newIndex);
                  if (cachedGeneratedTests[newIndex]) {
                    setGeneratedTest(cachedGeneratedTests[newIndex]);
                  } else {
                    setGeneratedTest(null);
                  }
                }}
                className="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-sm"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI Model Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Generate Selenium Test</h3>
          <p className="text-sm text-gray-600">
            {tests?.length > 1 ? (
              <>Selected: Test {selectedTestIndex + 1} of {tests.length}</>
            ) : (
              <>Processing {tests?.length || 0} manual test</>
            )}
          </p>
        </div>
        <AIModelSelector 
          onModelChange={(selection) => console.log('Model changed:', selection)}
          className=""
        />
      </div>

      {/* Intelligent Mode Toggle */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-indigo-600" />
            <div>
              <h4 className="font-medium text-gray-900">Intelligent Test Generation</h4>
              <p className="text-xs text-gray-600">Powered by Voyage AI • Learns from your codebase</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showIntelligentMode}
              onChange={(e) => setShowIntelligentMode(e.target.checked)}
              className="rounded text-indigo-600"
            />
            <span className="text-sm">Enable AI Analysis</span>
          </label>
        </div>
      </div>

      {/* Repository Path Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Repository Path
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPathType('local')}
              className={`px-3 py-1 text-xs rounded-md ${
                pathType === 'local' 
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' 
                  : 'bg-white text-gray-600 border border-gray-300'
              }`}
            >
              Local Path
            </button>
            <button
              type="button"
              onClick={() => setPathType('github')}
              className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 ${
                pathType === 'github' 
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' 
                  : 'bg-white text-gray-600 border border-gray-300'
              }`}
            >
              <GitBranch className="h-3 w-3" />
              GitHub URL
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder={
                pathType === 'github' 
                  ? "https://github.com/username/selenium-tests"
                  : "/Users/username/IdeaProjects/selenium-tests"
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            
            {pathType === 'local' && (
              <button
                type="button"
                onClick={() => setShowPathInstructions(!showPathInstructions)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Help
              </button>
            )}
            
            {isValidating && (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mt-2" />
            )}
            {isValidRepo && (
              <CheckCircle className="h-5 w-5 text-green-500 mt-2" />
            )}
          </div>
          
          {/* Inline path instructions */}
          {showPathInstructions && pathType === 'local' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <h4 className="font-semibold text-blue-900 mb-2">How to get your project path:</h4>
              <div className="space-y-2 text-blue-800">
                <div>
                  <strong>Option 1 - IntelliJ IDEA:</strong>
                  <div className="ml-4 text-xs">Right-click your project folder → Copy Path → Absolute Path</div>
                </div>
                <div>
                  <strong>Option 2 - Mac Finder:</strong>
                  <div className="ml-4 text-xs">Right-click folder → Get Info → Copy "Where:" path + add folder name</div>
                </div>
                <div>
                  <strong>Option 3 - Windows Explorer:</strong>
                  <div className="ml-4 text-xs">Click address bar → Copy full path</div>
                </div>
                <div>
                  <strong>Option 4 - Terminal/Command Line:</strong>
                  <div className="ml-4 text-xs font-mono">cd to your project → pwd (Mac/Linux) or cd (Windows)</div>
                </div>
              </div>
            </div>
          )}
        </div>
        {validationError && (
          <p className="text-sm text-red-600 mt-1">{validationError}</p>
        )}
        
        {/* Help text */}
        {pathType === 'local' && (
          <p className="text-xs text-gray-500 mt-1">
            💡 Tip: Use the full path to your local Selenium project directory
          </p>
        )}
        {pathType === 'github' && (
          <p className="text-xs text-amber-600 mt-1">
            ⚠️ GitHub URL support coming soon. Please clone the repository locally for now.
          </p>
        )}
      </div>

      {/* Repository Indexing Status */}
      {isValidRepo && showIntelligentMode && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Repository Index</span>
            </div>
            {isIndexed ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Indexed • {indexStats?.totalFiles || 0} files • {indexStats?.pageObjects || 0} Page Objects
                </span>
                <button
                  onClick={indexRepository}
                  disabled={isIndexing}
                  className="text-xs text-indigo-600 hover:text-indigo-700 ml-2"
                >
                  Re-index
                </button>
              </div>
            ) : (
              <button
                onClick={indexRepository}
                disabled={isIndexing}
                className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Indexing...
                  </>
                ) : (
                  <>
                    <Database className="h-3 w-3" />
                    Index Repository
                  </>
                )}
              </button>
            )}
          </div>
          {isIndexing && (
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-1">Analyzing code with Voyage AI...</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Intelligent Components - Similar Tests & Page Objects */}
      {isValidRepo && showIntelligentMode && isIndexed && flattenedTests && flattenedTests.length > 0 && (
        <div className="space-y-4">
          {/* Similar Tests Viewer */}
          <SimilarTestsViewer
            repoPath={repoPath}
            testScenario={flattenedTests[selectedTestIndex]?.description || flattenedTests[selectedTestIndex]?.steps?.join(' ')}
            onTestsFound={(foundTests, patterns) => {
              setSimilarTests(foundTests);
              setExtractedPatterns(patterns);
            }}
          />
          
          {/* Page Object Selector - Hidden in favor of EnhancedCodeSelector */}
          {false && flattenedTests.length > 0 && (
          <PageObjectSelector
            repoPath={repoPath}
            testScenario={flattenedTests[0]?.description || flattenedTests[0]?.steps?.join(' ') || ''}
            onPageObjectsSelected={setSelectedPageObjects}
            selectedPageObjects={selectedPageObjects}
          />
          )}
        </div>
      )}

      {/* Enhanced Code Selector with Caching */}
      {isValidRepo && (
        <EnhancedCodeSelector
          repoPath={repoPath}
          functionalityName={flattenedTests?.[0]?.category || ''}
          onSelectionChange={(folders) => {
            setSelectedDirectory(folders.tests);
            setPropertiesPath(folders.properties);
            localStorage.setItem('lastTestDirectory', folders.tests);
            localStorage.setItem('lastPropertiesPath', folders.properties);
            localStorage.setItem('lastPageObjectsPath', folders.pageObjects);
          }}
        />
      )}

      {/* Original Directory Browser - Now Hidden */}
      {false && isValidRepo && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Directory Path
          </label>
          
          {/* Manual directory input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={selectedDirectory}
              onChange={(e) => setSelectedDirectory(e.target.value)}
              placeholder="e.g., src/test/java/com/company/tests"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            {selectedDirectory && (
              <button
                onClick={() => setSelectedDirectory('')}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600">Or select from project structure:</label>
              <div className="flex items-center gap-2">
                {isLoadingTree && (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                )}
                <button
                  onClick={loadDirectoryTree}
                  disabled={isLoadingTree}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  title="Refresh directory tree"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
            
            <div className="border border-gray-300 rounded-lg p-3 max-h-96 overflow-y-auto bg-gray-50">
              {isLoadingTree ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-sm text-gray-500">Loading directory structure...</span>
                </div>
              ) : directoryTree.length > 0 ? (
                directoryTree.map(node => renderDirectoryNode(node))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No Java directories found
                </p>
              )}
            </div>
          </div>
          
          {selectedDirectory && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <span className="text-green-700 font-medium">Selected: </span>
              <code className="text-green-900">{selectedDirectory}</code>
            </div>
          )}
        </div>
      )}

      {/* Pattern Analysis */}
      {patterns && (
        <div className={`border rounded-lg p-4 ${
          patterns.importsCount === 0 && patterns.annotationsCount === 0 
            ? 'bg-yellow-50 border-yellow-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <h4 className={`text-sm font-medium mb-2 ${
            patterns.importsCount === 0 && patterns.annotationsCount === 0 
              ? 'text-yellow-900' 
              : 'text-blue-900'
          }`}>
            Pattern Analysis Complete
          </h4>
          <div className={`text-sm space-y-1 ${
            patterns.importsCount === 0 && patterns.annotationsCount === 0 
              ? 'text-yellow-700' 
              : 'text-blue-700'
          }`}>
            {patterns.importsCount === 0 && patterns.annotationsCount === 0 ? (
              <>
                <p>⚠️ No existing test patterns found in selected directory</p>
                <p>• Using default Selenium WebDriver patterns</p>
                <p>• Test will use standard JUnit annotations</p>
                <p className="text-xs mt-2">Tip: Select a directory with existing tests for better pattern matching</p>
              </>
            ) : (
              <>
                <p>• Found {patterns.importsCount} common imports</p>
                <p>• Detected {patterns.annotationsCount} test annotations</p>
                <p>• Analyzed {patterns.assertionsCount} assertion patterns</p>
              </>
            )}
            {patterns.metadata && (
              <>
                <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
                  {patterns.metadata.usedCache ? (
                    <>⚡ Used cached index ({patterns.metadata.cacheAge}h old) • </>
                  ) : (
                    <>✨ Fresh index created • </>
                  )}
                  Analyzed {patterns.metadata.indexedFiles} test files
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Application URL for DOM Analysis - HIDDEN FOR NOW */}
      {false && (
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Globe className="inline h-4 w-4 mr-1" />
          Application URL
          <span className="text-xs text-gray-500 ml-2">
            Analyze actual DOM to identify real locators
          </span>
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={applicationUrl}
            onChange={(e) => {
              setApplicationUrl(e.target.value);
              if (e.target.value) {
                localStorage.setItem('lastApplicationUrl', e.target.value);
              }
            }}
            placeholder="https://example.com/login"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={analyzeDom}
            disabled={!applicationUrl || isAnalyzingDom}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAnalyzingDom ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Analyze DOM
              </>
            )}
          </button>
          {applicationUrl && !isAnalyzingDom && (
            <button
              onClick={() => {
                setApplicationUrl('');
                setDomElements(null);
                localStorage.removeItem('lastApplicationUrl');
              }}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
              title="Clear URL"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* DOM Analysis Success Message */}
        {domAnalysisSuccess && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg animate-pulse">
            <p className="text-sm text-green-900 font-medium">{domAnalysisSuccess}</p>
          </div>
        )}
        
        {/* DOM Analysis Error */}
        {validationError && validationError.includes('DOM') && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-900">{validationError}</p>
          </div>
        )}
        
        {/* DOM Analysis Results */}
        {domElements && !domAnalysisSuccess && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-900">
              <p className="font-medium mb-1">✅ DOM Analysis Complete</p>
              <div className="text-xs text-green-700 space-y-1">
                <p>• Found {domElements.stats?.totalElements || domElements.totalElements || domElements.elementCount || 0} interactive elements</p>
                <p>• {domElements.stats?.buttons || domElements.buttons || 0} buttons</p>
                <p>• {domElements.stats?.inputs || domElements.inputs || 0} input fields</p>
                <p>• {domElements.stats?.links || domElements.links || 0} links</p>
                {(domElements.stats?.elementsWithTestId || domElements.elementsWithTestId) > 0 && (
                  <p className="text-green-800 font-medium">
                    • {domElements.stats?.elementsWithTestId || domElements.elementsWithTestId} elements with test IDs (excellent for automation!)
                  </p>
                )}
                {domElements.stats?.elementsWithAriaLabel > 0 && (
                  <p className="text-green-700">
                    • {domElements.stats.elementsWithAriaLabel} elements with ARIA labels
                  </p>
                )}
                {domElements.stats?.focusableElements > 0 && (
                  <p className="text-green-700">
                    • {domElements.stats.focusableElements} focusable elements
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-1">
          🎯 The AI will use real DOM structure to generate accurate locators
        </p>
      </div>
      )}

      {/* Advanced Options Toggle */}
      {isValidRepo && (
        <div className="mt-4">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {showAdvancedOptions ? (
              <><ChevronDown className="h-4 w-4" /> Hide Advanced Options</>
            ) : (
              <><ChevronRight className="h-4 w-4" /> Show Advanced Options (Optional)</>
            )}
          </button>
        </div>
      )}

      {/* Properties File Path - Now managed by Enhanced Code Selector */}
      {false && showAdvancedOptions && isValidRepo && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Properties File Path (Optional)
            <span className="text-xs text-gray-500 ml-2">
              For training AI on existing locators
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={propertiesPath}
              onChange={(e) => {
                setPropertiesPath(e.target.value);
                if (e.target.value) {
                  localStorage.setItem('lastPropertiesPath', e.target.value);
                }
              }}
              placeholder="e.g., src/main/resources/locators.properties"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            {propertiesPath && (
              <button
                onClick={() => {
                  setPropertiesPath('');
                  localStorage.removeItem('lastPropertiesPath');
                }}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                title="Clear properties path"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            💡 Provide the path to your properties file containing page object locators
          </p>
        </div>
      )}

      {/* Missing Data Collector - Shows when patterns are missing */}
      {showMissingDataCollector && (
        <MissingDataCollector
          missingPatterns={missingPatterns}
          onGoBack={() => {
            setShowMissingDataCollector(false);
            // Don't clear the session - user might come back
            // setGenerationSessionId(null);
            setIsAnalyzing(false);
          }}
          onProceedWithTodos={handleSkipData}
        />
      )}

      {/* Loading indicator when generating with TODOs */}
      {isGenerating && !showMissingDataCollector && !generatedTest && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-blue-900 font-medium">
              {generationStep === 'generating' && 'Generating test with TODO comments for missing patterns...'}
              {!generationStep && 'Processing...'}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons Section */}
      {isValidRepo && !generatedTest && !showMissingDataCollector && !isGenerating && (
        <div className="border-t pt-4 mt-4">
          <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-green-900 text-sm">
                    Ready to generate! Repository validated and test directory selected.
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h5 className="text-sm font-medium text-blue-900 mb-2">What will happen:</h5>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>1️⃣ Index all Java files in your repository (may use cache if recent)</li>
                  <li>2️⃣ Analyze test patterns from: <code className="bg-blue-100 px-1 rounded">{selectedDirectory ? selectedDirectory.split('/').slice(-2).join('/') : 'src/test/java'}</code></li>
                  <li>3️⃣ Extract imports, annotations, and assertion styles</li>
                  <li>4️⃣ Generate smart locators based on element names (e.g., "Resume button" → find by text "Resume")</li>
                  <li>5️⃣ Create Selenium test for: <strong>{flattenedTests[selectedTestIndex]?.title || 'selected test'}</strong></li>
                </ul>
              </div>
              
              <button
                onClick={generateSeleniumTest}
                disabled={isAnalyzing || isGenerating}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg transform transition hover:scale-105"
              >
                {(isAnalyzing || isGenerating) ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {generationStep === 'analyzing' && 'Analyzing test requirements...'}
                    {generationStep === 'indexing' && 'Indexing repository...'}
                    {generationStep === 'learning' && 'Learning from existing tests...'}
                    {generationStep === 'generating' && 'Generating Selenium test...'}
                    {!generationStep && 'Processing...'}
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5" />
                    Generate Test {selectedTestIndex + 1}
                  </>
                )}
              </button>
              
              <div className="text-xs text-gray-500 text-center space-y-1 mt-2">
                <p>This will analyze your existing patterns and generate production-ready Selenium tests</p>
                {selectedDirectory && (
                  <p className="text-gray-400">
                    Will scan: {selectedDirectory.split('/').slice(-3).join('/')}
                  </p>
                )}
              </div>
            </div>
        </div>
      )}

      {/* Generated Test Preview */}
      {generatedTest && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                {generatedTest.fileName}
              </h4>
              {generatedTest.packageName && (
                <span className="text-sm text-gray-600">
                  Package: {generatedTest.packageName}
                </span>
              )}
            </div>
            
            <div className="bg-white border border-gray-200 rounded p-3 max-h-96 overflow-y-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                <code>{generatedTest.code}</code>
              </pre>
            </div>
          </div>

          {/* Test Completeness Feedback */}
          {testAnalysis && feedbackReport && (
            <TestCompletionFeedback 
              analysis={testAnalysis}
              feedbackReport={feedbackReport}
              onActionClick={handleFeedbackAction}
            />
          )}

          {/* Save Options */}
          {!saveResult && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Save Options</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={saveOptions.createBranch}
                    onChange={(e) => setSaveOptions({
                      ...saveOptions,
                      createBranch: e.target.checked
                    })}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-sm">Create git branch</span>
                  {ticket?.key && (
                    <span className="text-xs text-gray-500">
                      (qa-copilot/{ticket.key.toLowerCase()})
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={saveOptions.openInIDE}
                    onChange={(e) => setSaveOptions({
                      ...saveOptions,
                      openInIDE: e.target.checked
                    })}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-sm">Open in IntelliJ IDEA</span>
                </label>
              </div>

              <button
                onClick={saveGeneratedTest}
                disabled={isSaving}
                className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save to Repository
                  </>
                )}
              </button>
            </div>
          )}

          {/* Save Result */}
          {saveResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900">Test Saved Successfully!</h4>
                  <p className="text-sm text-green-700 mt-1">{saveResult.message}</p>
                  <p className="text-xs text-green-600 mt-2">
                    Path: <code className="bg-green-100 px-1 rounded">{saveResult.path}</code>
                  </p>
                  {saveResult.branch && saveResult.branch.success && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      Branch: {saveResult.branch.branchName}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setGeneratedTest(null);
                    setSaveResult(null);
                    setPatterns(null);
                    setShowTestSelector(true);
                    // Move to next test if available
                    if (flattenedTests.length > 1 && selectedTestIndex < flattenedTests.length - 1) {
                      setSelectedTestIndex(selectedTestIndex + 1);
                    }
                  }}
                  className="flex-1 bg-white text-gray-700 py-2 px-4 rounded border border-gray-300 hover:bg-gray-50 text-sm"
                >
                  {flattenedTests.length > 1 && selectedTestIndex < flattenedTests.length - 1 
                    ? 'Generate Next Test' 
                    : 'Generate Another Test'}
                </button>
                {saveOptions.openInIDE && (
                  <button
                    onClick={() => window.open('idea://open?file=' + saveResult.path)}
                    className="flex items-center gap-1 bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in IDE
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Animation */}
      <SuccessAnimation
        type="automation"
        testCount={1}
        show={showSuccessAnimation}
        onComplete={() => setShowSuccessAnimation(false)}
      />
    </div>
  );
}