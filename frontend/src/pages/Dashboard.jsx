import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { jiraApi } from '../services/jiraApi';

export default function Dashboard() {
  const [selectedBoard, setSelectedBoard] = useState(null);
  const navigate = useNavigate();

  const { data: boards, isLoading: boardsLoading, error: boardsError } = useQuery({
    queryKey: ['boards'],
    queryFn: jiraApi.getBoards,
    onError: (error) => {
      console.error('Error fetching boards:', error);
    }
  });

  const { data: sprint, isLoading: sprintLoading, error: sprintError } = useQuery({
    queryKey: ['currentSprint', selectedBoard],
    queryFn: () => jiraApi.getCurrentSprint(selectedBoard),
    enabled: !!selectedBoard,
  });

  const { data: issues, isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: ['sprintIssues', sprint?.id],
    queryFn: () => jiraApi.getSprintIssues(sprint.id),
    enabled: !!sprint?.id,
  });

  useEffect(() => {
    console.log('Boards data:', boards);
    if (boards && boards.length > 0 && !selectedBoard) {
      console.log('Setting default board:', boards[0].id);
      setSelectedBoard(boards[0].id);
    }
  }, [boards, selectedBoard]);

  useEffect(() => {
    console.log('Selected board:', selectedBoard);
    console.log('Sprint data:', sprint);
    console.log('Issues data:', issues);
  }, [selectedBoard, sprint, issues]);

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
      <div className="px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">Sprint Overview</h2>
        <p className="mt-1 text-sm text-gray-600">
          Current sprint status and test coverage
        </p>
        {boards && (
          <p className="mt-1 text-xs text-gray-500">
            {boards.length === 0 ? 'No boards available' : `Found ${boards.length} board(s)`}
          </p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700">
          Select Board
        </label>
        <select
          value={selectedBoard || ''}
          onChange={(e) => {
            console.log('Board selected:', e.target.value);
            setSelectedBoard(e.target.value);
          }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
        >
          <option value="">Select a board...</option>
          {boards?.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name} ({board.type})
            </option>
          ))}
        </select>
        
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-500">
            Debug: {boards ? `${boards.length} boards loaded` : 'No boards loaded'}
            {boards && boards.length > 0 && (
              <ul className="mt-1">
                {boards.map(b => (
                  <li key={b.id}>- {b.id}: {b.name}</li>
                ))}
              </ul>
            )}
          </div>
        )}
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
