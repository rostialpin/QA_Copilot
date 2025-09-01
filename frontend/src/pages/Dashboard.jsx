import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { jiraApi } from '../services/jiraApi';
import { cachedApi } from '../services/cacheService';
import DemoMode from '../components/DemoMode';
import CacheStats from '../components/CacheStats';

export default function Dashboard() {
  // Load saved board from localStorage
  const savedBoard = localStorage.getItem('selectedJiraBoard');
  const savedBoardData = savedBoard ? JSON.parse(savedBoard) : null;
  
  console.log('Loading Dashboard - Saved board data:', savedBoardData);
  
  // Ensure IDs are strings for consistency
  const [selectedBoard, setSelectedBoard] = useState(savedBoardData?.id ? String(savedBoardData.id) : null);
  const [selectedBoardInfo, setSelectedBoardInfo] = useState(savedBoardData || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const navigate = useNavigate();

  // Separate queries for all boards and search results - now with caching
  const { data: allBoards, isLoading: allBoardsLoading } = useQuery({
    queryKey: ['allBoards'],
    queryFn: () => cachedApi.getJiraBoards(), // Using cached version
    enabled: !debouncedSearchTerm, // Only fetch when not searching
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['searchProjects', debouncedSearchTerm],
    queryFn: () => jiraApi.searchProjects(debouncedSearchTerm), // Keep search uncached for real-time results
    enabled: !!debouncedSearchTerm && debouncedSearchTerm.length >= 2,
  });

  // Combine results based on search state
  const boards = debouncedSearchTerm ? searchResults : allBoards;
  const boardsLoading = debouncedSearchTerm ? searchLoading : allBoardsLoading;
  const boardsError = null;

  const { data: sprint, isLoading: sprintLoading, error: sprintError } = useQuery({
    queryKey: ['currentSprint', selectedBoard],
    queryFn: () => cachedApi.getJiraSprint(selectedBoard), // Using cached version
    enabled: !!selectedBoard,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const { data: issues, isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: ['sprintIssues', sprint?.id],
    queryFn: () => cachedApi.getJiraTickets(sprint.id), // Using cached version
    enabled: !!sprint?.id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Save selected board to localStorage whenever it changes
  const handleBoardSelect = (boardId) => {
    // Convert to string for consistent comparison
    const boardIdStr = String(boardId);
    const board = boards?.find(b => String(b.id) === boardIdStr);
    if (board) {
      // Save board info to localStorage
      const boardInfo = {
        id: String(board.id),
        name: board.name,
        projectKey: board.location?.projectKey || board.projectKey,
        projectName: board.location?.projectName || board.projectName
      };
      localStorage.setItem('selectedJiraBoard', JSON.stringify(boardInfo));
      setSelectedBoardInfo(boardInfo);
    }
    setSelectedBoard(boardIdStr);
  };

  // Clear saved board
  const clearSavedBoard = () => {
    localStorage.removeItem('selectedJiraBoard');
    setSelectedBoard(null);
    setSelectedBoardInfo(null);
  };

  useEffect(() => {
    console.log('Projects data:', boards, 'Search term:', debouncedSearchTerm);
    // Only auto-select first board if there's no saved board and no current selection
    if (boards && boards.length > 0 && !selectedBoard && !savedBoardData) {
      console.log('Setting default board:', boards[0].id);
      handleBoardSelect(boards[0].id);
    }
    // If we have a saved board but haven't selected it yet, restore it
    else if (boards && savedBoardData && !selectedBoard) {
      // Check if the saved board still exists in the list
      const savedBoardExists = boards.find(b => String(b.id) === String(savedBoardData.id));
      if (savedBoardExists) {
        console.log('Restoring saved board:', savedBoardData.id);
        setSelectedBoard(String(savedBoardData.id));
      } else {
        console.log('Saved board no longer exists, clearing');
        clearSavedBoard();
      }
    }
  }, [boards]);

  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    console.log('Selected board:', selectedBoard);
    console.log('Sprint data:', sprint);
    console.log('Issues data:', issues);
  }, [selectedBoard, sprint, issues]);

  // Filter boards based on debounced search term
  const filteredBoards = boards?.filter(board => 
    debouncedSearchTerm === '' || 
    board.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
    board.key?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  ) || [];

  if (boardsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (boardsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error loading boards</h3>
        <p className="text-red-600 text-sm mt-1">{boardsError.message}</p>
        <p className="text-red-600 text-xs mt-2">Check the console for more details</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode for Hackathon */}
      <DemoMode />
      
      {/* Cache Performance Stats */}
      <CacheStats />
      
      <div className="px-4 sm:px-0">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sprint Overview</h2>
            <p className="mt-1 text-sm text-gray-600">
              Current sprint status and test coverage
            </p>
            {selectedBoardInfo && (
              <p className="mt-1 text-sm text-indigo-600">
                📌 Last used: <span className="font-medium">{selectedBoardInfo.name}</span>
              </p>
            )}
            {boards && (
              <p className="mt-1 text-xs text-gray-500">
                {boards.length === 0 ? 'No boards available' : 
                 debouncedSearchTerm ? 
                   `Showing ${filteredBoards.length} of ${boards.length} board(s)` :
                   `Found ${boards.length} board(s)`
                }
              </p>
            )}
          </div>
          {selectedBoardInfo && (
            <button
              onClick={clearSavedBoard}
              className="text-sm text-gray-500 hover:text-gray-700 bg-white px-2 py-1 rounded border border-gray-300 hover:border-gray-400"
              title="Clear saved project"
            >
              Clear saved project
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 space-y-4">
        {/* Search Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Projects
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by project name or key (e.g., 'WCTV')..."
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
          />
        </div>

        {/* Board Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Select Board
          </label>
          <select
            value={selectedBoard || ''}
            onChange={(e) => {
              console.log('Board selected:', e.target.value);
              handleBoardSelect(e.target.value);
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
          >
            <option value="">Select a board...</option>
            {filteredBoards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name} ({board.key || board.type})
              </option>
            ))}
          </select>
          
          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs text-gray-500">
              Debug: {boards ? `${boards.length} total boards, ${filteredBoards.length} filtered` : 'No boards loaded'}
              {debouncedSearchTerm && (
                <div className="mt-1">
                  <strong>Search results for "{debouncedSearchTerm}":</strong>
                  <ul className="mt-1 max-h-40 overflow-y-auto">
                    {filteredBoards.map(b => (
                      <li key={b.id}>- {b.id}: {b.name} ({b.key || b.type})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {sprintLoading && selectedBoard && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3 mt-2"></div>
          </div>
        </div>
      )}

      {sprint && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900">{sprint.name}</h3>
          <p className="text-sm text-gray-600">Status: {sprint.state}</p>
          {sprint.startDate && sprint.endDate && (
            <p className="text-xs text-gray-500 mt-1">
              {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {!sprint && selectedBoard && !sprintLoading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No active sprint found for this board</p>
        </div>
      )}

      {issuesLoading && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="animate-pulse space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="border p-3 rounded">
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                <div className="h-2 bg-gray-200 rounded w-3/4 mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {issues && issues.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Sprint Issues ({issues.length})</h3>
            <div className="space-y-2">
              {issues.map((issue) => (
                <div key={issue.key} className="border p-3 rounded hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-indigo-600">{issue.key}</span>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        issue.type === 'Bug' ? 'bg-red-100 text-red-700' :
                        issue.type === 'Story' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {issue.type}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        issue.status === 'Done' ? 'bg-green-100 text-green-700' :
                        issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
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
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => navigate('/workflow', { 
                        state: { 
                          ticket: {
                            key: issue.key,
                            summary: issue.summary,
                            description: issue.description || '',
                            type: issue.type,
                            priority: issue.priority,
                            assignee: issue.assignee,
                            status: issue.status
                          }
                        } 
                      })}
                      className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 transition-colors"
                    >
                      Complete Workflow
                    </button>
                    <button
                      onClick={() => navigate('/test-generator', { 
                        state: { 
                          ticketKey: issue.key,
                          ticketSummary: issue.summary,
                          ticketDescription: issue.description || '',
                          ticketType: issue.type
                        } 
                      })}
                      className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                    >
                      Generate Tests
                    </button>
                    <button
                      onClick={() => navigate('/cypress-generator', {
                        state: {
                          ticketKey: issue.key,
                          ticketSummary: issue.summary
                        }
                      })}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                    >
                      Generate Cypress
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {issues && issues.length === 0 && (
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-gray-500">No issues in this sprint</p>
        </div>
      )}
    </div>
  );
}