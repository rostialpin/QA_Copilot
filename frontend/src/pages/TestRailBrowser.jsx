import { useState, useEffect } from 'react';
import { Search, ChevronRight, FolderOpen, FileText, Plus, RefreshCw, Check, ChevronDown, Eye, Save, Play } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function TestRailBrowser() {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [sectionTestCases, setSectionTestCases] = useState({});
  const [selectedTestCases, setSelectedTestCases] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('browse'); // browse, review, save, automate

  // Load saved project from localStorage
  useEffect(() => {
    const savedProject = localStorage.getItem('testrail_selected_project');
    const savedMode = localStorage.getItem('testrail_mode');
    if (savedProject) {
      const project = JSON.parse(savedProject);
      setSelectedProject(project);
      fetchSuites(project.id);
    }
    if (savedMode) {
      setMode(savedMode);
    }
    fetchProjects();
  }, []);

  // Save mode to localStorage
  useEffect(() => {
    localStorage.setItem('testrail_mode', mode);
  }, [mode]);

  // Fetch all projects
  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/testrail/projects`);
      setProjects(response.data);
      setFilteredProjects(response.data);
    } catch (error) {
      console.error('Error fetching TestRail projects:', error);
      setError('Failed to fetch TestRail projects. Please check your TestRail configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects based on search
  useEffect(() => {
    if (searchTerm) {
      const filtered = projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [searchTerm, projects]);

  // Fetch suites for selected project
  const fetchSuites = async (projectId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/testrail/suites/${projectId}`);
      setSuites(response.data);
    } catch (error) {
      console.error('Error fetching suites:', error);
      setError('Failed to fetch test suites.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch sections and test cases for selected suite
  const fetchSuiteContents = async (projectId, suiteId) => {
    setLoading(true);
    setError(null);
    try {
      const [sectionsResponse, testCasesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/testrail/sections/${projectId}/${suiteId}`),
        axios.get(`${API_URL}/api/testrail/test-cases/${projectId}/${suiteId}`)
      ]);
      
      const sectionsData = sectionsResponse.data;
      const testCasesData = testCasesResponse.data;
      
      setSections(sectionsData);
      setTestCases(testCasesData);
      
      // Group test cases by section
      const grouped = {};
      testCasesData.forEach(testCase => {
        const sectionId = testCase.section_id || 'root';
        if (!grouped[sectionId]) {
          grouped[sectionId] = [];
        }
        grouped[sectionId].push(testCase);
      });
      setSectionTestCases(grouped);
    } catch (error) {
      console.error('Error fetching suite contents:', error);
      setError('Failed to fetch test cases.');
    } finally {
      setLoading(false);
    }
  };

  // Handle project selection
  const selectProject = (project) => {
    setSelectedProject(project);
    localStorage.setItem('testrail_selected_project', JSON.stringify(project));
    setSuites([]);
    setSections([]);
    setTestCases([]);
    setSelectedSuite(null);
    setSelectedSection(null);
    setSelectedTestCases([]);
    fetchSuites(project.id);
  };

  // Handle suite selection
  const selectSuite = (suite) => {
    setSelectedSuite(suite);
    localStorage.setItem('testrail_selected_suite', JSON.stringify(suite));
    setSelectedSection(null);
    setSelectedTestCases([]);
    fetchSuiteContents(selectedProject.id, suite.id);
  };

  // Handle section selection
  const selectSection = (section) => {
    setSelectedSection(section);
    localStorage.setItem('testrail_selected_section', JSON.stringify(section));
    
    // If in review mode, export selected section for AI review
    if (mode === 'review') {
      const sectionTests = sectionTestCases[section.id] || [];
      localStorage.setItem('testrail_review_tests', JSON.stringify({
        project: selectedProject,
        suite: selectedSuite,
        section: section,
        tests: sectionTests
      }));
    }
  };

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Handle test case selection
  const toggleTestSelection = (testCase) => {
    setSelectedTestCases(prev => {
      const isSelected = prev.some(tc => tc.id === testCase.id);
      const newSelection = isSelected 
        ? prev.filter(tc => tc.id !== testCase.id)
        : [...prev, testCase];
      
      // Save selection for automation mode
      if (mode === 'automate') {
        localStorage.setItem('testrail_automate_tests', JSON.stringify({
          project: selectedProject,
          suite: selectedSuite,
          tests: newSelection
        }));
      }
      
      return newSelection;
    });
  };

  // Select all tests in a section
  const selectAllInSection = (sectionId) => {
    const sectionTests = sectionTestCases[sectionId] || [];
    const allSelected = sectionTests.every(test => 
      selectedTestCases.some(tc => tc.id === test.id)
    );
    
    if (allSelected) {
      // Deselect all
      setSelectedTestCases(prev => 
        prev.filter(tc => !sectionTests.some(st => st.id === tc.id))
      );
    } else {
      // Select all
      setSelectedTestCases(prev => {
        const newTests = sectionTests.filter(test => 
          !prev.some(tc => tc.id === test.id)
        );
        return [...prev, ...newTests];
      });
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedProject(null);
    setSelectedSuite(null);
    setSelectedSection(null);
    setSuites([]);
    setSections([]);
    setTestCases([]);
    setSelectedTestCases([]);
    localStorage.removeItem('testrail_selected_project');
    localStorage.removeItem('testrail_selected_suite');
    localStorage.removeItem('testrail_selected_section');
  };

  // Build section hierarchy
  const buildSectionHierarchy = () => {
    const hierarchy = [];
    const sectionMap = {};
    
    sections.forEach(section => {
      sectionMap[section.id] = { ...section, children: [] };
    });
    
    sections.forEach(section => {
      if (section.parent_id && sectionMap[section.parent_id]) {
        sectionMap[section.parent_id].children.push(sectionMap[section.id]);
      } else if (!section.parent_id) {
        hierarchy.push(sectionMap[section.id]);
      }
    });
    
    return hierarchy;
  };

  // Render section with hierarchy
  const renderSection = (section, level = 0) => {
    const hasTests = sectionTestCases[section.id]?.length > 0;
    const isExpanded = expandedSections[section.id];
    const sectionTests = sectionTestCases[section.id] || [];
    const allSelected = sectionTests.length > 0 && sectionTests.every(test => 
      selectedTestCases.some(tc => tc.id === test.id)
    );
    
    return (
      <div key={section.id} className={`ml-${level * 4}`}>
        <div
          className={`p-2 rounded flex items-center justify-between hover:bg-gray-100 cursor-pointer ${
            selectedSection?.id === section.id ? 'bg-blue-50 border-blue-300 border' : ''
          }`}
        >
          <div 
            className="flex items-center flex-1"
            onClick={() => {
              selectSection(section);
              if (hasTests || section.children?.length > 0) {
                toggleSection(section.id);
              }
            }}
          >
            {(hasTests || section.children?.length > 0) && (
              <ChevronRight 
                className={`mr-1 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                size={16} 
              />
            )}
            <FolderOpen className="mr-2 text-gray-500" size={16} />
            <span className="text-sm font-medium">{section.name}</span>
            {hasTests && (
              <span className="ml-2 text-xs text-gray-500">({sectionTests.length})</span>
            )}
          </div>
          
          {mode === 'automate' && hasTests && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectAllInSection(section.id);
              }}
              className={`p-1 rounded ${allSelected ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              title="Select all tests in this section"
            >
              <Check size={14} />
            </button>
          )}
        </div>
        
        {isExpanded && (
          <div className="ml-4">
            {/* Render test cases in this section */}
            {sectionTests.map(testCase => (
              <div
                key={testCase.id}
                className={`p-2 ml-4 border-l-2 border-gray-200 hover:bg-gray-50 flex items-center justify-between ${
                  selectedTestCases.some(tc => tc.id === testCase.id) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center flex-1">
                  <FileText className="mr-2 text-gray-400" size={14} />
                  <span className="text-sm">{testCase.title}</span>
                  {testCase.priority_id && (
                    <span className="ml-2 text-xs px-2 py-1 bg-gray-100 rounded">
                      P{testCase.priority_id}
                    </span>
                  )}
                </div>
                
                {mode === 'automate' && (
                  <input
                    type="checkbox"
                    checked={selectedTestCases.some(tc => tc.id === testCase.id)}
                    onChange={() => toggleTestSelection(testCase)}
                    className="ml-2"
                  />
                )}
              </div>
            ))}
            
            {/* Render child sections */}
            {section.children?.map(child => renderSection(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">TestRail Browser</h1>
            <p className="mt-2 text-gray-600">
              Browse projects, select folders for review, and choose tests for automation
            </p>
          </div>
          
          {/* Mode Selector */}
          <div className="flex space-x-2">
            <button
              onClick={() => setMode('browse')}
              className={`px-4 py-2 rounded-lg flex items-center ${
                mode === 'browse' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <Eye className="mr-2" size={16} />
              Browse
            </button>
            <button
              onClick={() => setMode('review')}
              className={`px-4 py-2 rounded-lg flex items-center ${
                mode === 'review' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              title="Select folder to review similar tests before creating new ones"
            >
              <Search className="mr-2" size={16} />
              Review for Duplicates
            </button>
            <button
              onClick={() => setMode('save')}
              className={`px-4 py-2 rounded-lg flex items-center ${
                mode === 'save' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              title="Select destination folder for new tests"
            >
              <Save className="mr-2" size={16} />
              Save Location
            </button>
            <button
              onClick={() => setMode('automate')}
              className={`px-4 py-2 rounded-lg flex items-center ${
                mode === 'automate' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              title="Select tests to convert to Cypress"
            >
              <Play className="mr-2" size={16} />
              Automate Tests
            </button>
          </div>
        </div>
        
        {/* Mode description */}
        {mode !== 'browse' && (
          <div className={`mt-4 p-3 rounded-lg ${
            mode === 'review' ? 'bg-green-50 border border-green-200' :
            mode === 'save' ? 'bg-purple-50 border border-purple-200' :
            'bg-orange-50 border border-orange-200'
          }`}>
            {mode === 'review' && (
              <p className="text-sm text-green-700">
                <strong>Review Mode:</strong> Select a folder to review existing tests. AI will analyze these tests to avoid creating duplicates.
              </p>
            )}
            {mode === 'save' && (
              <p className="text-sm text-purple-700">
                <strong>Save Mode:</strong> Select the destination folder where new test cases will be saved in TestRail.
              </p>
            )}
            {mode === 'automate' && (
              <p className="text-sm text-orange-700">
                <strong>Automation Mode:</strong> Select test cases to convert to Cypress automated tests. Use checkboxes to select multiple tests.
                {selectedTestCases.length > 0 && (
                  <span className="ml-2 font-semibold">
                    ({selectedTestCases.length} tests selected)
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Project Selection */}
      {!selectedProject ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-4">Select TestRail Project</h2>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project)}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
                  disabled={project.is_completed}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      {project.is_completed && (
                        <span className="text-xs text-gray-500">Completed</span>
                      )}
                    </div>
                    <ChevronRight className="text-gray-400" size={20} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center space-x-2 text-sm">
            <button
              onClick={clearSelection}
              className="text-blue-600 hover:text-blue-800"
            >
              Projects
            </button>
            <span className="text-gray-500">/</span>
            <span className="font-medium">{selectedProject.name}</span>
            {selectedSuite && (
              <>
                <span className="text-gray-500">/</span>
                <span className="font-medium">{selectedSuite.name}</span>
              </>
            )}
            {selectedSection && (
              <>
                <span className="text-gray-500">/</span>
                <span className="font-medium text-blue-600">{selectedSection.name}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Suites Panel */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <FolderOpen className="mr-2" size={20} />
                Test Suites
              </h2>
              
              {loading && !suites.length ? (
                <div className="flex justify-center py-4">
                  <RefreshCw className="animate-spin text-blue-500" size={24} />
                </div>
              ) : suites.length === 0 ? (
                <p className="text-gray-500 text-sm">No test suites found</p>
              ) : (
                <div className="space-y-2">
                  {suites.map((suite) => (
                    <button
                      key={suite.id}
                      onClick={() => selectSuite(suite)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedSuite?.id === suite.id
                          ? 'bg-blue-50 border-blue-300 border'
                          : 'hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{suite.name}</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                      {suite.description && (
                        <p className="text-xs text-gray-500 mt-1">{suite.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sections and Test Cases Panel */}
            {selectedSuite && (
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold flex items-center">
                    <FolderOpen className="mr-2" size={20} />
                    Sections & Test Cases
                  </h2>
                  <div className="flex space-x-2">
                    {mode === 'automate' && selectedTestCases.length > 0 && (
                      <button
                        onClick={() => {
                          // Navigate to Cypress generator with selected tests
                          window.location.href = '/cypress-generator';
                        }}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-sm flex items-center"
                      >
                        <Play className="mr-1" size={14} />
                        Convert {selectedTestCases.length} Tests
                      </button>
                    )}
                    <button
                      onClick={() => fetchSuiteContents(selectedProject.id, selectedSuite.id)}
                      className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw size={20} />
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="animate-spin text-blue-500" size={32} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Render root level tests */}
                    {sectionTestCases['root']?.map(testCase => (
                      <div
                        key={testCase.id}
                        className={`p-2 border border-gray-200 rounded hover:bg-gray-50 flex items-center justify-between ${
                          selectedTestCases.some(tc => tc.id === testCase.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center flex-1">
                          <FileText className="mr-2 text-gray-400" size={14} />
                          <span className="text-sm">{testCase.title}</span>
                          {testCase.priority_id && (
                            <span className="ml-2 text-xs px-2 py-1 bg-gray-100 rounded">
                              P{testCase.priority_id}
                            </span>
                          )}
                        </div>
                        
                        {mode === 'automate' && (
                          <input
                            type="checkbox"
                            checked={selectedTestCases.some(tc => tc.id === testCase.id)}
                            onChange={() => toggleTestSelection(testCase)}
                            className="ml-2"
                          />
                        )}
                      </div>
                    ))}
                    
                    {/* Render sections hierarchy */}
                    {buildSectionHierarchy().map(section => renderSection(section))}
                    
                    {sections.length === 0 && testCases.length === 0 && (
                      <p className="text-gray-500 text-center py-8">
                        No sections or test cases found in this suite
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TestRailBrowser;