import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Bug, BookOpen, CheckSquare, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { cachedApi } from '../../services/cacheService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TicketSelector({ onSelect, selected }) {
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [boardSearchTerm, setBoardSearchTerm] = useState('');
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadBoards();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.board-search-container')) {
        setShowBoardDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadBoards = async () => {
    try {
      setIsLoading(true);
      const data = await cachedApi.getJiraBoards();
      setBoards(data || []);
      
      // Auto-select saved board
      const savedBoard = localStorage.getItem('selectedJiraBoard');
      if (savedBoard) {
        const board = JSON.parse(savedBoard);
        setSelectedBoard(board);
        loadSprint(board.id);
      }
    } catch (error) {
      console.error('Error loading boards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSprint = async (boardId) => {
    try {
      setIsLoading(true);
      const sprintData = await cachedApi.getJiraSprint(boardId);
      setSprint(sprintData);
      if (sprintData?.id) {
        loadTickets(sprintData.id);
      }
    } catch (error) {
      console.error('Error loading sprint:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTickets = async (sprintId) => {
    try {
      setIsLoading(true);
      const ticketData = await cachedApi.getJiraTickets(sprintId);
      setTickets(ticketData || []);
      setFilteredTickets(ticketData || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      // Use demo tickets if API fails
      const demoTickets = [
        {
          key: 'ESWCTV-5001',
          summary: 'Add Skip Intro button to video player',
          type: 'Story',
          priority: 'High',
          status: 'In Progress',
          description: 'As a user, I want to skip repetitive intro sequences in videos so I can get to the main content faster.',
          acceptanceCriteria: '- Button appears 5 seconds into intro\n- Button disappears after intro ends\n- Works on both Roku and CTV platforms'
        },
        {
          key: 'ESWCTV-5002',
          summary: 'Fix video playback issue on Roku',
          type: 'Bug',
          priority: 'Critical',
          status: 'Open',
          description: 'Video playback fails when switching between episodes on Roku devices.',
        },
        {
          key: 'ESWCTV-5003',
          summary: 'Update player controls UI',
          type: 'Task',
          priority: 'Medium',
          status: 'To Do',
          description: 'Modernize the video player control interface to match new design system.',
        }
      ];
      setTickets(demoTickets);
      setFilteredTickets(demoTickets);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Filter tickets based on search and type
    let filtered = tickets;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        ticket.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.summary.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Type filter
    if (filter !== 'all') {
      filtered = filtered.filter(ticket => ticket.type === filter);
    }
    
    setFilteredTickets(filtered);
  }, [searchTerm, filter, tickets]);

  const handleBoardChange = (e) => {
    const boardId = e.target.value;
    const board = boards.find(b => String(b.id) === boardId);
    if (board) {
      setSelectedBoard(board);
      localStorage.setItem('selectedJiraBoard', JSON.stringify(board));
      loadSprint(board.id);
    }
  };

  const handleTicketSelect = (ticket) => {
    onSelect(ticket);
    setExpandedTicket(null);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Bug':
        return <Bug className="h-4 w-4" />;
      case 'Story':
        return <BookOpen className="h-4 w-4" />;
      case 'Task':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Bug':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Story':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Task':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical':
      case 'Highest':
        return 'text-red-600 font-bold';
      case 'High':
        return 'text-orange-600 font-semibold';
      case 'Medium':
        return 'text-yellow-600';
      case 'Low':
      case 'Lowest':
        return 'text-gray-500';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Board and Sprint Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative board-search-container">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            JIRA Board
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
            <input
              type="text"
              placeholder="Search boards..."
              value={selectedBoard ? selectedBoard.name : boardSearchTerm}
              onChange={(e) => {
                setBoardSearchTerm(e.target.value);
                setSelectedBoard(null);
                setShowBoardDropdown(true);
              }}
              onFocus={() => setShowBoardDropdown(true)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            {showBoardDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {boards
                  .filter(b => 
                    boardSearchTerm === '' || 
                    b.name.toLowerCase().includes(boardSearchTerm.toLowerCase())
                  )
                  .map(board => (
                    <button
                      key={board.id}
                      onClick={() => {
                        setSelectedBoard(board);
                        setBoardSearchTerm('');
                        setShowBoardDropdown(false);
                        localStorage.setItem('selectedJiraBoard', JSON.stringify(board));
                        loadSprint(board.id);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <div className="font-medium text-sm">{board.name}</div>
                      {board.key && (
                        <span className="text-xs text-gray-500">{board.key}</span>
                      )}
                    </button>
                  ))}
                {boards.filter(b => 
                  boardSearchTerm === '' || 
                  b.name.toLowerCase().includes(boardSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No boards found</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sprint
          </label>
          <input
            type="text"
            value={sprint?.name || 'No active sprint'}
            disabled
            className="w-full rounded-md border-gray-300 bg-gray-50"
          />
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="Story">Stories</option>
          <option value="Bug">Bugs</option>
          <option value="Task">Tasks</option>
        </select>
      </div>

      {/* Tickets List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tickets found
          </div>
        ) : (
          filteredTickets.map(ticket => (
            <div
              key={ticket.key}
              className={`
                border rounded-lg p-4 cursor-pointer transition-all
                ${selected?.key === ticket.key 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}
              `}
              onClick={() => handleTicketSelect(ticket)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-indigo-600">
                      {ticket.key}
                    </span>
                    <span className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border
                      ${getTypeColor(ticket.type)}
                    `}>
                      {getTypeIcon(ticket.type)}
                      {ticket.type}
                    </span>
                    <span className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {ticket.summary}
                  </h3>
                  
                  {/* Expandable Description */}
                  {expandedTicket === ticket.key ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-gray-600">
                        {ticket.description}
                      </p>
                      {ticket.acceptanceCriteria && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">
                            Acceptance Criteria:
                          </p>
                          <p className="text-xs text-gray-600 whitespace-pre-line">
                            {ticket.acceptanceCriteria}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : ticket.description ? (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {ticket.description}
                    </p>
                  ) : null}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedTicket(
                      expandedTicket === ticket.key ? null : ticket.key
                    );
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  {expandedTicket === ticket.key ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {selected?.key === ticket.key && (
                <div className="mt-2 pt-2 border-t border-indigo-200">
                  <span className="text-xs text-indigo-600 font-medium">
                    ✓ Selected for test generation
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Selected Ticket Summary */}
      {selected && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-indigo-900 mb-2">
            Selected Ticket
          </h4>
          <div className="text-sm text-indigo-700">
            <strong>{selected.key}</strong>: {selected.summary}
          </div>
          <div className="mt-2 text-xs text-indigo-600">
            Type: {selected.type} | Priority: {selected.priority}
          </div>
        </div>
      )}
    </div>
  );
}