import { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ChevronDown,
  Search,
  Check,
  X
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TestRailSelector({ 
  onSelect, 
  allowMultiple = false, 
  showPreview = true 
}) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [sections, setSections] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [testCases, setTestCases] = useState({});
  const [selectedTests, setSelectedTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [previewTest, setPreviewTest] = useState(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/testrail/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/testrail/suites/${project.id}`);
      setSuites(response.data);
    } catch (error) {
      console.error('Error loading suites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuiteSelect = async (suite) => {
    setSelectedSuite(suite);
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/testrail/sections/${selectedProject.id}/${suite.id}`
      );
      setSections(buildSectionTree(response.data));
    } catch (error) {
      console.error('Error loading sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildSectionTree = (sections) => {
    const sectionMap = {};
    const rootSections = [];

    sections.forEach(section => {
      sectionMap[section.id] = { ...section, children: [] };
    });

    sections.forEach(section => {
      if (section.parent_id) {
        if (sectionMap[section.parent_id]) {
          sectionMap[section.parent_id].children.push(sectionMap[section.id]);
        }
      } else {
        rootSections.push(sectionMap[section.id]);
      }
    });

    return rootSections;
  };

  const toggleSection = async (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
      
      // Load test cases if not already loaded
      if (!testCases[sectionId]) {
        setLoading(true);
        try {
          const response = await axios.get(
            `${API_URL}/api/testrail/test-cases/${selectedProject.id}/${selectedSuite.id}?section_id=${sectionId}`
          );
          setTestCases(prev => ({
            ...prev,
            [sectionId]: response.data
          }));
        } catch (error) {
          console.error('Error loading test cases:', error);
        } finally {
          setLoading(false);
        }
      }
    }
    setExpandedSections(newExpanded);
  };

  const handleTestSelect = (test) => {
    if (allowMultiple) {
      const isSelected = selectedTests.some(t => t.id === test.id);
      if (isSelected) {
        setSelectedTests(prev => prev.filter(t => t.id !== test.id));
      } else {
        setSelectedTests(prev => [...prev, test]);
      }
    } else {
      setSelectedTests([test]);
      onSelect([test]);
    }
  };

  const handleConfirmSelection = () => {
    onSelect(selectedTests);
  };

  const renderSection = (section, level = 0) => {
    const isExpanded = expandedSections.has(section.id);
    const sectionTests = testCases[section.id] || [];
    const hasChildren = section.children && section.children.length > 0;
    const hasTests = sectionTests.length > 0;

    return (
      <div key={section.id} style={{ marginLeft: `${level * 20}px` }}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 cursor-pointer rounded"
          onClick={() => toggleSection(section.id)}
        >
          {(hasChildren || hasTests) ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4" />
          )}
          <FolderOpen className="w-4 h-4 text-blue-600" />
          <span className="text-sm">{section.name}</span>
          {hasTests && (
            <span className="text-xs text-gray-500">({sectionTests.length})</span>
          )}
        </div>

        {isExpanded && (
          <>
            {sectionTests.map(test => {
              const isSelected = selectedTests.some(t => t.id === test.id);
              return (
                <div
                  key={test.id}
                  style={{ marginLeft: `${(level + 1) * 20}px` }}
                  className={`
                    flex items-center gap-2 py-2 px-3 hover:bg-gray-50 cursor-pointer rounded
                    ${isSelected ? 'bg-blue-50' : ''}
                  `}
                  onClick={() => handleTestSelect(test)}
                  onMouseEnter={() => showPreview && setPreviewTest(test)}
                >
                  {allowMultiple && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-gray-300"
                    />
                  )}
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span className="text-sm flex-1">{test.title}</span>
                  {test.priority_id && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      test.priority_id === 4 ? 'bg-red-100 text-red-700' :
                      test.priority_id === 3 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      P{test.priority_id}
                    </span>
                  )}
                </div>
              );
            })}
            
            {section.children?.map(child => renderSection(child, level + 1))}
          </>
        )}
      </div>
    );
  };

  // Filter projects based on search term
  const filteredProjects = projects.filter(project => 
    !projectSearchTerm || 
    project.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left Panel - Navigation */}
      <div className="col-span-2 space-y-4">
        {/* Project Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Project
          </label>
          
          {/* Project Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={projectSearchTerm}
              onChange={(e) => setProjectSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md"
            />
          </div>
          
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === parseInt(e.target.value));
              if (project) handleProjectSelect(project);
            }}
            className="w-full p-2 border rounded-md"
            size={projectSearchTerm ? Math.min(filteredProjects.length + 1, 8) : 1}
          >
            <option value="">Choose a project...</option>
            {filteredProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Suite Selection */}
        {selectedProject && suites.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Test Suite
            </label>
            <select
              value={selectedSuite?.id || ''}
              onChange={(e) => {
                const suite = suites.find(s => s.id === parseInt(e.target.value));
                if (suite) handleSuiteSelect(suite);
              }}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Choose a suite...</option>
              {suites.map(suite => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        {selectedSuite && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search test cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md"
            />
          </div>
        )}

        {/* Section Tree */}
        {selectedSuite && (
          <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : sections.length > 0 ? (
              sections.map(section => renderSection(section))
            ) : (
              <p className="text-gray-500 text-center py-8">No sections found</p>
            )}
          </div>
        )}

        {/* Selection Actions */}
        {allowMultiple && selectedTests.length > 0 && (
          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-blue-900">
              {selectedTests.length} test(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTests([])}
                className="px-3 py-1 text-sm bg-white text-gray-600 rounded hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                onClick={handleConfirmSelection}
                className="px-4 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Confirm Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Preview */}
      {showPreview && (
        <div className="col-span-1">
          <div className="sticky top-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Test Preview</h3>
            {previewTest ? (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-2">{previewTest.title}</h4>
                
                {previewTest.custom_preconds && (
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-500">Preconditions</label>
                    <p className="text-sm text-gray-700 mt-1">{previewTest.custom_preconds}</p>
                  </div>
                )}

                {previewTest.custom_steps && (
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-500">Steps</label>
                    <div className="text-sm text-gray-700 mt-1 space-y-1">
                      {previewTest.custom_steps.split('\n').map((step, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-gray-500">{idx + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewTest.custom_expected && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Expected Result</label>
                    <p className="text-sm text-gray-700 mt-1">{previewTest.custom_expected}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Hover over a test case to preview
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}