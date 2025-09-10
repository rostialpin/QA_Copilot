import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export default function Dashboard() {
  // Load saved project from localStorage
  const savedProject = localStorage.getItem('selectedJiraProject');
  const savedProjectData = savedProject ? JSON.parse(savedProject) : null;
  
  console.log('Loading Dashboard - Saved project data:', savedProjectData);
  
  const [selectedProject, setSelectedProject] = useState(savedProjectData?.key || '');
  const [selectedProjectInfo, setSelectedProjectInfo] = useState(savedProjectData || null);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTickets, setExpandedTickets] = useState(new Set());
  const navigate = useNavigate();

  // Fetch all available projects
  const { data: projects, isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } = useQuery({
    queryKey: ['allProjects'],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/jira/projects/search?query=`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('Fetched all projects:', data);
      return data || [];
    },
    staleTime: 30 * 1000, // Reduced to 30 seconds for fresher data
    refetchOnWindowFocus: true,
    cacheTime: 60 * 1000, // Cache for only 1 minute
  });

  // Fetch demo tickets (includes ESWCTV-1124)
  const { data: demoTickets, isLoading: demoLoading, refetch: refetchDemo } = useQuery({
    queryKey: ['demoTickets'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/api/jira/demo-tickets');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('Fetched demo tickets:', data);
      return data.tickets || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch board for selected project
  const { data: boardInfo, isLoading: boardLoading } = useQuery({
    queryKey: ['projectBoard', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return null;
      
      try {
        // Try to get boards for the project
        const response = await fetch(`http://localhost:3001/api/jira/boards?projectKey=${selectedProject}`);
        if (!response.ok) {
          console.log('Boards endpoint failed, using fallback');
          return {
            board: { 
              id: selectedProject, 
              name: `${selectedProject} Board`,
              projectKey: selectedProject 
            },
            sprint: null
          };
        }
        
        const data = await response.json();
        const boards = data.boards || data || [];
        
        // Find board for this project
        const projectBoard = boards.find(b => 
          b.location?.projectKey === selectedProject || 
          b.projectKey === selectedProject ||
          b.name?.includes(selectedProject)
        ) || { 
          id: selectedProject, 
          name: `${selectedProject} Board`,
          projectKey: selectedProject 
        };

        // Try to get active sprint for the board
        let sprint = null;
        try {
          const sprintResponse = await fetch(`http://localhost:3001/api/jira/current-sprint/${projectBoard.id}`);
          if (sprintResponse.ok) {
            sprint = await sprintResponse.json();
            console.log('Found active sprint:', sprint);
          }
        } catch (err) {
          console.log('No active sprint found');
        }

        return { board: projectBoard, sprint };
      } catch (error) {
        console.log('Error fetching board info:', error);
        return {
          board: { 
            id: selectedProject, 
            name: `${selectedProject} Board`,
            projectKey: selectedProject 
          },
          sprint: null
        };
      }
    },
    enabled: !!selectedProject,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch issues for the project/sprint
  const { data: projectIssues, isLoading: issuesLoading } = useQuery({
    queryKey: ['projectIssues', selectedProject, boardInfo?.sprint?.id],
    queryFn: async () => {
      if (!selectedProject) return [];
      
      // If we have a sprint, get sprint issues
      if (boardInfo?.sprint?.id) {
        try {
          const response = await fetch(`http://localhost:3001/api/jira/sprint/${boardInfo.sprint.id}/issues`);
          if (response.ok) {
            const data = await response.json();
            console.log(`Fetched ${data.length} sprint issues`);
            return data;
          }
        } catch (error) {
          console.log('Sprint issues fetch error:', error);
        }
      }
      
      // Otherwise, get recent project issues
      try {
        const response = await fetch(`http://localhost:3001/api/jira/project/${selectedProject}/issues`);
        if (response.ok) {
          const data = await response.json();
          console.log(`Fetched ${data.length} project issues`);
          return data;
        }
      } catch (error) {
        console.log('Project issues fetch error:', error);
      }
      
      return [];
    },
    enabled: !!selectedProject,
    staleTime: 5 * 60 * 1000,
  });

  // Combine project issues with demo ticket (ESWCTV-1124) if needed
  const allIssues = useMemo(() => {
    const issues = projectIssues || [];
    const demoTicket = demoTickets?.find(t => t.key === 'ESWCTV-1124');
    
    // If this is ESWCTV project and demo ticket not already present, add it
    if (selectedProject?.includes('WCTV') && demoTicket && !issues.find(i => i.key === 'ESWCTV-1124')) {
      return [demoTicket, ...issues];
    }
    
    return issues;
  }, [projectIssues, demoTickets, selectedProject]);

  // Filter tickets based on search
  const filteredTickets = useMemo(() => {
    if (!allIssues) return [];
    if (!searchTerm.trim()) return allIssues;
    
    const searchLower = searchTerm.toLowerCase();
    return allIssues.filter(ticket => 
      ticket.key.toLowerCase().includes(searchLower) ||
      ticket.summary.toLowerCase().includes(searchLower) ||
      (ticket.description && ticket.description.toLowerCase().includes(searchLower)) ||
      ticket.status.toLowerCase().includes(searchLower) ||
      ticket.type.toLowerCase().includes(searchLower)
    );
  }, [allIssues, searchTerm]);

  // Handle project selection
  const handleProjectSelect = (projectKey) => {
    if (!projectKey) {
      localStorage.removeItem('selectedJiraProject');
      setSelectedProject('');
      setSelectedProjectInfo(null);
      return;
    }

    const project = projects?.find(p => 
      p.projectKey === projectKey || 
      p.key === projectKey
    );
    
    if (project) {
      const projectInfo = {
        key: project.projectKey || project.key,
        name: project.name,
        id: project.id
      };
      localStorage.setItem('selectedJiraProject', JSON.stringify(projectInfo));
      setSelectedProjectInfo(projectInfo);
      setSelectedProject(projectInfo.key);
    }
  };

  // Filter projects based on search
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!projectSearchTerm.trim()) return projects;
    
    const searchLower = projectSearchTerm.toLowerCase();
    return projects.filter(project => 
      (project.name && project.name.toLowerCase().includes(searchLower)) ||
      (project.projectKey && project.projectKey.toLowerCase().includes(searchLower)) ||
      (project.key && project.key.toLowerCase().includes(searchLower))
    );
  }, [projects, projectSearchTerm]);

  const isLoading = projectsLoading || (selectedProject && (boardLoading || issuesLoading || demoLoading));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">Sprint Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          Select a JIRA project to view active board and tickets
        </p>
      </div>

      {/* Project Selection */}
      <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-4 card-hover border border-blue-100/50">
        <div className="space-y-3">
          {/* Project Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Projects
            </label>
            <input
              type="text"
              value={projectSearchTerm}
              onChange={(e) => setProjectSearchTerm(e.target.value)}
              placeholder="Type to search... (e.g., 'WCTV', 'ESW', 'BET')"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
            {projectSearchTerm && (
              <p className="text-xs text-gray-500 mt-1">
                Found {filteredProjects.length} projects matching "{projectSearchTerm}"
              </p>
            )}
          </div>
          
          {/* Project Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select JIRA Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectSelect(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              size={projectSearchTerm ? Math.min(8, filteredProjects.length + 1) : 1}
            >
              <option value="">-- Select a project --</option>
              {filteredProjects && filteredProjects.map((project) => (
                <option key={project.id} value={project.projectKey || project.key}>
                  {project.name} ({project.projectKey || project.key})
                </option>
              ))}
            </select>
            {projectSearchTerm && filteredProjects.length === 0 && (
              <p className="text-sm text-red-500 mt-1">
                No projects found matching "{projectSearchTerm}"
              </p>
            )}
          </div>
        </div>
        
        {/* Display Board and Sprint Info when project is selected */}
        {selectedProject && boardInfo && (
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-700">📋 Active Board: </span>
              <span className="text-sm text-gray-900">{boardInfo.board?.name}</span>
            </div>
            {boardInfo.sprint ? (
              <>
                <div className="mb-1">
                  <span className="text-sm font-semibold text-gray-700">🏃 Sprint: </span>
                  <span className="text-sm text-gray-900">{boardInfo.sprint.name}</span>
                </div>
                {boardInfo.sprint.startDate && boardInfo.sprint.endDate && (
                  <div>
                    <span className="text-sm font-semibold text-gray-700">📅 Duration: </span>
                    <span className="text-sm text-gray-600">
                      {new Date(boardInfo.sprint.startDate).toLocaleDateString()} - {new Date(boardInfo.sprint.endDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-yellow-600">
                ⚠️ No active sprint - showing recent project tickets
              </div>
            )}
            {selectedProject?.includes('WCTV') && allIssues?.find(t => t.key === 'ESWCTV-1124') && (
              <div className="mt-2 text-sm text-green-600">
                ✅ Demo ticket ESWCTV-1124 included
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search and Tickets */}
      {selectedProject && (
        <>
          {/* Search */}
          <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-4 card-hover border border-blue-100/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900">
                {boardInfo?.sprint ? `Sprint: ${boardInfo.sprint.name}` : `Project: ${selectedProject}`}
              </h3>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-indigo-600 hover:text-indigo-700 bg-white px-3 py-1 rounded border border-indigo-300 hover:border-indigo-400"
              >
                Refresh
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Tickets
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ticket key (e.g., 1124), summary, status, or type..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
              {searchTerm && (
                <p className="text-xs text-gray-500 mt-1">
                  Found {filteredTickets.length} of {allIssues.length} tickets matching "{searchTerm}"
                </p>
              )}
            </div>
          </div>

          {/* Tickets List */}
          {filteredTickets.length > 0 ? (
            <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl card-hover overflow-hidden">
              <div className="p-4">
                <h3 className="text-lg font-medium mb-4">
                  Tickets ({filteredTickets.length})
                </h3>
                <div className="space-y-2">
                  {filteredTickets.map((issue) => {
                    const isExpanded = expandedTickets.has(issue.key);
                    const isDemoTicket = issue.key === 'ESWCTV-1124';
                    
                    return (
                      <div 
                        key={issue.key} 
                        className={`border ${isDemoTicket ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'} rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-blue-300 card-hover`}
                      >
                        <div 
                          className="p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => {
                            const newExpanded = new Set(expandedTickets);
                            if (isExpanded) {
                              newExpanded.delete(issue.key);
                            } else {
                              newExpanded.add(issue.key);
                            }
                            setExpandedTickets(newExpanded);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-indigo-600">{issue.key}</span>
                              {isDemoTicket && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                                  Demo Ticket
                                </span>
                              )}
                              {isExpanded ? 
                                <ChevronUpIcon className="h-4 w-4 text-gray-500" /> : 
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              }
                            </div>
                            <div className="flex gap-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                issue.type === 'Bug' ? 'bg-red-100 text-red-700' :
                                issue.type === 'Story' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {issue.type}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                issue.status === 'Done' || issue.status === 'Resolved' || issue.status === 'Complete' 
                                  ? 'bg-green-100 text-green-700' :
                                issue.status === 'In Progress' || issue.status.includes('In Progress') 
                                  ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {issue.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{issue.summary}</p>
                          {issue.assignee && (
                            <p className="text-xs text-gray-500 mt-1">Assigned to: {issue.assignee}</p>
                          )}
                        </div>
                        
                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="bg-gray-50 p-3 border-t">
                            {issue.description && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">Description:</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                  {issue.description.substring(0, 500)}
                                  {issue.description.length > 500 && '...'}
                                </p>
                              </div>
                            )}
                            
                            {issue.acceptanceCriteria && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">Acceptance Criteria:</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                  {issue.acceptanceCriteria}
                                </p>
                              </div>
                            )}
                            
                            {issue.priority && (
                              <div className="mb-3">
                                <span className="text-xs font-semibold text-gray-700">Priority: </span>
                                <span className="text-sm text-gray-600">{issue.priority}</span>
                              </div>
                            )}
                            
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/workflow', { 
                                    state: { 
                                      ticket: {
                                        key: issue.key,
                                        summary: issue.summary,
                                        description: issue.description || '',
                                        type: issue.type,
                                        priority: issue.priority,
                                        assignee: issue.assignee,
                                        status: issue.status,
                                        acceptanceCriteria: issue.acceptanceCriteria
                                      }
                                    } 
                                  })
                                }}
                                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1"
                              >
                                ✨ Create Test Cases
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-4 card-hover">
              <p className="text-gray-500">
                {searchTerm ? `No tickets found matching "${searchTerm}"` : 'No tickets available for this project'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Initial state - no project selected */}
      {!selectedProject && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-8 text-center">
          <p className="text-lg text-gray-700">
            👆 Select a JIRA project above to view its active board and tickets
          </p>
          <p className="text-sm text-gray-600 mt-2">
            For demo: Select <span className="font-medium">ESWCTV</span> or any project containing "WCTV"
          </p>
        </div>
      )}
    </div>
  );
}