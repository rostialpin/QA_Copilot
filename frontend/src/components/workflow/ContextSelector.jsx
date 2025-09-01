import { useState, useEffect } from 'react';
import { 
  FolderOpen, Folder, FileText, ChevronRight, ChevronDown, 
  Search, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import axios from 'axios';
import { cachedApi } from '../../services/cacheService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ContextSelector({ ticket, onSelect, selected }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [sections, setSections] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [selectedSection, setSelectedSection] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    loadProjects();
    generateRecommendation();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.project-search-container')) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await cachedApi.getTestRailProjects();
      setProjects(data || []);
      
      // Auto-select Unified OAO if available
      const unifiedOAO = data?.find(p => 
        p.name.includes('Unified OAO') || p.id === 167
      );
      if (unifiedOAO) {
        setSelectedProject(unifiedOAO);
        loadSuites(unifiedOAO.id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuites = async (projectId) => {
    try {
      setIsLoading(true);
      const data = await cachedApi.getTestRailSuites(projectId);
      setSuites(data || []);
      
      // Auto-select Master suite if available
      const masterSuite = data?.find(s => 
        s.name.includes('Master') || s.is_master === true
      );
      if (masterSuite) {
        setSelectedSuite(masterSuite);
        loadSections(projectId, masterSuite.id);
      }
    } catch (error) {
      console.error('Error loading suites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSections = async (projectId, suiteId) => {
    try {
      setIsLoading(true);
      console.log(`Loading sections for project ${projectId}, suite ${suiteId}`);
      
      // Clear cache for this specific key to force fresh data
      const cacheKey = `testrail_sections_${projectId}_${suiteId}`;
      localStorage.removeItem(`cache_${cacheKey}`);
      
      const response = await axios.get(
        `${API_URL}/api/testrail/sections/${projectId}/${suiteId}`
      );
      const data = response.data;
      console.log(`Received ${data.length} sections from API`);
      
      // Check if Property Detail Screen is in the data
      const propertySection = data.find(s => s.name && s.name.includes('Property Detail'));
      if (propertySection) {
        console.log('Found Property Detail Screen:', propertySection);
      }
      
      const tree = buildSectionTree(data);
      console.log(`Built tree with ${tree.length} root sections`);
      console.log('Root sections:', tree.map(s => s.name).slice(0, 10));
      
      // Check if Feature Master is in the tree
      const featureMaster = tree.find(s => s.name === 'Feature Master');
      if (featureMaster) {
        console.log('Feature Master has', featureMaster.children?.length || 0, 'children');
      }
      
      setSections(tree);
    } catch (error) {
      console.error('Error loading sections:', error);
      // Only use demo sections if API completely fails
      setSections([
        {
          id: 1,
          name: 'Authentication Tests',
          children: [],
          testCount: 15
        },
        {
          id: 2,
          name: 'Video Player Controls',
          children: [
            { id: 21, name: 'Playback Controls', testCount: 8 },
            { id: 22, name: 'Skip Features', testCount: 5 },
            { id: 23, name: 'Quality Settings', testCount: 4 }
          ],
          testCount: 17,
          recommended: true
        },
        {
          id: 3,
          name: 'Navigation Tests',
          children: [],
          testCount: 12
        },
        {
          id: 4,
          name: 'Search Functionality',
          children: [],
          testCount: 10
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTestCases = async (sectionId) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${API_URL}/api/testrail/test-cases/${selectedProject.id}/${selectedSuite.id}`,
        { params: { section_id: sectionId } }
      );
      setTestCases(response.data.slice(0, 5)); // Show first 5 as preview
    } catch (error) {
      console.error('Error loading test cases:', error);
      // Use demo test cases
      setTestCases([
        { id: 1, title: 'Video Player - Play/Pause Toggle' },
        { id: 2, title: 'Video Player - Skip Ad Button' },
        { id: 3, title: 'Video Player - Seek Bar Navigation' },
        { id: 4, title: 'Video Player - Volume Control' },
        { id: 5, title: 'Video Player - Fullscreen Toggle' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const buildSectionTree = (sections) => {
    const sectionMap = {};
    const rootSections = [];
    
    // First pass: create all sections
    sections.forEach(section => {
      sectionMap[section.id] = {
        ...section,
        children: []
      };
    });
    
    // Second pass: build hierarchy
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

  const generateRecommendation = () => {
    if (!ticket) return;
    
    const summary = ticket.summary.toLowerCase();
    let recommended = null;
    
    if (summary.includes('video') || summary.includes('player')) {
      recommended = 'Video Player Controls';
    } else if (summary.includes('navigation') || summary.includes('browse')) {
      recommended = 'Navigation Tests';
    } else if (summary.includes('search')) {
      recommended = 'Search Functionality';
    } else if (summary.includes('login') || summary.includes('auth')) {
      recommended = 'Authentication Tests';
    }
    
    setRecommendation(recommended);
  };

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleSectionSelect = (section) => {
    setSelectedSection(section);
    loadTestCases(section.id);
    onSelect({
      projectId: selectedProject.id,
      suiteId: selectedSuite.id,
      sectionId: section.id,
      sectionName: section.name
    });
  };

  const renderSection = (section, level = 0) => {
    const isExpanded = expandedSections.has(section.id);
    const isSelected = selectedSection?.id === section.id;
    const isRecommended = section.name === recommendation || section.recommended;
    const hasChildren = section.children && section.children.length > 0;
    
    return (
      <div key={section.id}>
        <div
          className={`
            flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-all
            ${isSelected 
              ? 'bg-indigo-100 text-indigo-700 font-medium' 
              : 'hover:bg-gray-50'}
            ${level > 0 ? 'ml-6' : ''}
          `}
          onClick={() => {
            if (hasChildren) {
              toggleSection(section.id);
            }
            handleSectionSelect(section);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )
          ) : (
            <div className="w-4" />
          )}
          
          {hasChildren ? (
            <FolderOpen className="h-4 w-4 text-yellow-600" />
          ) : (
            <Folder className="h-4 w-4 text-gray-400" />
          )}
          
          <span className="flex-1">{section.name}</span>
          
          {section.testCount && (
            <span className="text-xs text-gray-500">
              {section.testCount} tests
            </span>
          )}
          
          {isRecommended && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              Recommended
            </span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {section.children.map(child => renderSection(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredSections = sections.filter(section =>
    searchTerm === '' || 
    section.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Recommendation Banner */}
      {recommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Recommendation based on ticket
              </p>
              <p className="text-sm text-blue-700 mt-1">
                For "{ticket?.summary}", we recommend selecting tests from 
                <strong className="ml-1">{recommendation}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project and Suite Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative project-search-container">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            TestRail Project
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
            <input
              type="text"
              placeholder="Search projects..."
              value={selectedProject ? selectedProject.name : projectSearchTerm}
              onChange={(e) => {
                setProjectSearchTerm(e.target.value);
                setSelectedProject(null);
                setShowProjectDropdown(true);
              }}
              onFocus={() => setShowProjectDropdown(true)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {showProjectDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {projects
                  .filter(p => 
                    projectSearchTerm === '' || 
                    p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
                  )
                  .map(project => (
                    <button
                      key={project.id}
                      onClick={() => {
                        setSelectedProject(project);
                        setProjectSearchTerm('');
                        setShowProjectDropdown(false);
                        loadSuites(project.id);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <div className="font-medium text-sm">{project.name}</div>
                      {project.id === 167 && (
                        <span className="text-xs text-green-600">Recommended for ESWCTV</span>
                      )}
                    </button>
                  ))}
                {projects.filter(p => 
                  projectSearchTerm === '' || 
                  p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No projects found</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test Suite
          </label>
          <select
            value={selectedSuite?.id || ''}
            onChange={(e) => {
              const suite = suites.find(s => s.id === parseInt(e.target.value));
              setSelectedSuite(suite);
              if (suite) loadSections(selectedProject.id, suite.id);
            }}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            disabled={!selectedProject}
          >
            <option value="">Select suite...</option>
            {suites.map(suite => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search folders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      {/* Section Tree */}
      <div className="border border-gray-200 rounded-lg p-2 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            Loading folders...
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No folders found
          </div>
        ) : (
          filteredSections.map(section => renderSection(section))
        )}
      </div>

      {/* Test Case Preview */}
      {selectedSection && testCases.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Sample tests from {selectedSection.name}:
          </h4>
          <ul className="space-y-1">
            {testCases.map(test => (
              <li key={test.id} className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-3 w-3 text-gray-400" />
                {test.title}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            These patterns will be used to generate similar tests
          </p>
        </div>
      )}

      {/* Selected Context Summary */}
      {selected && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-indigo-600" />
            <h4 className="text-sm font-medium text-indigo-900">
              Context Selected
            </h4>
          </div>
          <div className="text-sm text-indigo-700">
            <p>Project: <strong>{selectedProject?.name}</strong></p>
            <p>Suite: <strong>{selectedSuite?.name}</strong></p>
            <p>Folder: <strong>{selected.sectionName}</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}