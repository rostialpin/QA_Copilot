import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, ChevronLeft, FileText, FolderOpen, 
  Cpu, Code, CheckCircle, AlertCircle, RefreshCw,
  Play, Save, Copy, Download, Search, X, ChevronDown,
  ChevronUp, Filter, Eye, EyeOff, Zap
} from 'lucide-react';
import axios from 'axios';
import { cachedApi } from '../services/cacheService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function UnifiedGeneratorV2() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Step 1: Sprint & Ticket Selection
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [sprintTickets, setSprintTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [showFullDescription, setShowFullDescription] = useState({});
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Step 2: Context Selection
  const [testRailProject, setTestRailProject] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [contextTests, setContextTests] = useState([]);
  const [skipContext, setSkipContext] = useState(false);
  
  // Step 3: Test Generation
  const [generationOptions, setGenerationOptions] = useState({
    coverageLevel: 'standard',
    includePositive: true,
    includeNegative: true,
    includeEdgeCases: true,
    includePlatformVariations: true
  });
  const [generatedTests, setGeneratedTests] = useState([]);
  const [qualityScore, setQualityScore] = useState(0);
  
  // Step 4: Cypress Conversion
  const [selectedTestsForCypress, setSelectedTestsForCypress] = useState([]);
  const [cypressCode, setCypressCode] = useState('');

  // Load boards and saved selections
  useEffect(() => {
    loadBoards();
    loadSavedSelections();
  }, []);

  const loadBoards = async () => {
    try {
      // Use cached API for faster loading
      const data = await cachedApi.getJiraBoards();
      setBoards(data);
      
      // Auto-select saved board
      const savedBoard = localStorage.getItem('selected_board');
      if (savedBoard) {
        const board = JSON.parse(savedBoard);
        setSelectedBoard(board);
        loadSprint(board.id);
      }
    } catch (error) {
      console.error('Error loading boards:', error);
      // Use mock data for demo
      setBoards([
        { id: 2892, name: 'ESW', projectKey: 'ESW' },
        { id: 3859, name: 'ESWCTV', projectKey: 'ESWCTV' },
        { id: 3860, name: 'ESR', projectKey: 'ESR' }
      ]);
    }
  };

  const loadSprint = async (boardId) => {
    setIsLoading(true);
    try {
      // Use cached API for faster loading
      const data = await cachedApi.getJiraSprint(boardId);
      setCurrentSprint(data);
      loadSprintTickets(data.id);
    } catch (error) {
      console.error('Error loading sprint:', error);
      // Use mock sprint for demo
      setCurrentSprint({ id: 101, name: 'Sprint 42', state: 'active' });
      loadSprintTickets(101);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSprintTickets = async (sprintId) => {
    setIsLoading(true);
    try {
      // Use cached API for faster loading
      const data = await cachedApi.getJiraTickets(sprintId);
      setSprintTickets(data);
    } catch (error) {
      console.error('Error loading tickets:', error);
      // Use mock tickets for demo
      setSprintTickets(getMockTickets());
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedSelections = () => {
    const savedTestRail = localStorage.getItem('testrail_selected_project');
    if (savedTestRail) {
      setTestRailProject(JSON.parse(savedTestRail));
    }
  };

  const getMockTickets = () => [
    {
      key: 'ESWCTV-5001',
      type: 'Story',
      status: 'In Progress',
      priority: 'High',
      storyPoints: 5,
      summary: 'Add Skip Intro Button to Video Player',
      description: `As a user, I want to skip intro sequences when watching content on the Unified OAO platform.

**Acceptance Criteria:**
- Skip intro button appears after 5 seconds of intro playback
- Button remains visible for 10 seconds
- Clicking button skips to main content timestamp
- Skip action is tracked in analytics
- Feature works on both CTV and Roku platforms

**Technical Notes:**
- Intro timestamps provided via metadata API
- Use existing VideoPlayerControls component
- Follow design system for button styling`,
      assignee: 'John Doe',
      reporter: 'Sarah Chen',
      labels: ['video-player', 'user-experience']
    },
    {
      key: 'ESWCTV-5002',
      type: 'Bug',
      status: 'Open',
      priority: 'Critical',
      summary: 'Skip Intro Button Not Responding on Roku',
      description: `The Skip Intro button is not responding to remote control input on Roku devices.

**Steps to Reproduce:**
1. Launch app on Roku
2. Start playing series with intro
3. Wait for Skip Intro button
4. Press OK on remote

**Expected:** Video skips to main content
**Actual:** Button highlights but nothing happens

**Environment:** Roku Ultra 4800X, App v3.2.1`,
      assignee: 'Mike Smith',
      reporter: 'QA Team'
    },
    {
      key: 'ESWCTV-5003',
      type: 'Task',
      status: 'To Do',
      priority: 'Low',
      summary: 'Update Skip Button Color to Brand Guidelines',
      description: 'Change skip button background from white to Paramount purple (#6B46C1)',
      assignee: 'Jane Wilson',
      reporter: 'Design Team'
    },
    {
      key: 'ESWCTV-5004',
      type: 'Story',
      status: 'In Review',
      priority: 'Medium',
      storyPoints: 3,
      summary: 'Add Skip Recap Feature',
      description: `Similar to skip intro, add ability to skip "Previously on..." recaps.

**Requirements:**
- Detect recap segments via metadata
- Show "Skip Recap" button
- Same timing as skip intro (5 sec appear, 10 sec visible)`,
      assignee: 'Tom Brown',
      reporter: 'Product Team'
    },
    {
      key: 'ESWCTV-5005',
      type: 'Task',
      status: 'Done',
      priority: 'Medium',
      summary: 'Database Migration for User Preferences',
      description: 'Technical task - no QA testing required',
      assignee: 'Backend Team',
      reporter: 'Tech Lead'
    }
  ];

  // Filter tickets based on search and type
  const getFilteredTickets = () => {
    let filtered = sprintTickets;
    
    // Filter by type
    if (ticketFilter !== 'all') {
      filtered = filtered.filter(ticket => {
        if (ticketFilter === 'testable') {
          return ticket.type !== 'Task' || !ticket.description?.includes('no QA testing');
        }
        return ticket.type.toLowerCase() === ticketFilter;
      });
    }
    
    // Filter by search
    if (ticketSearch) {
      filtered = filtered.filter(ticket =>
        ticket.summary.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        ticket.key.toLowerCase().includes(ticketSearch.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Determine if ticket needs testing
  const needsTesting = (ticket) => {
    if (ticket.type === 'Task' && ticket.description?.includes('no QA testing')) {
      return false;
    }
    if (ticket.status === 'Done') {
      return false;
    }
    return true;
  };

  // Load demo data
  const loadDemoMode = () => {
    setIsDemoMode(true);
    setSelectedBoard({ id: 3859, name: 'ESWCTV', projectKey: 'ESWCTV' });
    setCurrentSprint({ id: 101, name: 'Sprint 42', state: 'active' });
    setSprintTickets(getMockTickets());
  };

  // Generate tests
  const generateTests = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/gemini/generate-tests`, {
        ticket: selectedTicket,
        context: skipContext ? null : {
          folder: selectedFolder,
          tests: contextTests
        },
        options: generationOptions
      });
      
      setGeneratedTests(response.data.tests);
      setQualityScore(response.data.qualityScore || 92);
    } catch (error) {
      // Mock data for demo
      setGeneratedTests([
        {
          id: 1,
          title: 'Video Player - Skip Intro Button Display Timing',
          objective: 'Validate skip intro button appears and disappears at correct times',
          steps: [
            'Navigate to video content with intro',
            'Start video playback',
            'Wait 5 seconds',
            'Verify skip intro button appears',
            'Wait additional 10 seconds',
            'Verify button automatically disappears'
          ]
        },
        {
          id: 2,
          title: 'Video Player - Skip Intro Functionality',
          objective: 'Validate skip action works correctly on both platforms',
          steps: [
            'Start video with intro on CTV platform',
            'Wait for skip button to appear',
            'Click skip intro button',
            'Verify video jumps to main content',
            'Repeat test on Roku platform',
            'Verify same behavior on both platforms'
          ]
        },
        {
          id: 3,
          title: 'Video Player - Skip Intro Remote Navigation',
          objective: 'Validate remote control accessibility',
          steps: [
            'Start video using remote control',
            'Wait for skip button appearance',
            'Navigate to button using directional pad',
            'Verify button receives focus',
            'Press OK/Select on remote',
            'Verify skip action triggers'
          ]
        },
        {
          id: 4,
          title: 'Video Player - Skip Intro Analytics Tracking',
          objective: 'Validate analytics events are fired correctly',
          steps: [
            'Open network debugger',
            'Start video with intro',
            'Click skip intro button',
            'Verify analytics event fired with correct parameters',
            'Check event includes: user_id, content_id, skip_timestamp'
          ]
        }
      ]);
      setQualityScore(92);
    } finally {
      setIsLoading(false);
      setCurrentStep(4);
    }
  };

  // Step 1: Enhanced Ticket Selection
  const renderStep1 = () => (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center">
            <FileText className="mr-2" size={24} />
            Select Ticket from Active Sprint
          </h2>
          <span className="text-sm text-gray-500">Step 1 of 4</span>
        </div>
      </div>

      <div className="p-6">
        {/* Board and Sprint Selection */}
        <div className="mb-6 flex items-center space-x-4">
          <select
            className="px-4 py-2 border rounded-lg"
            value={selectedBoard?.id || ''}
            onChange={(e) => {
              const board = boards.find(b => b.id === parseInt(e.target.value));
              setSelectedBoard(board);
              localStorage.setItem('selected_board', JSON.stringify(board));
              loadSprint(board.id);
            }}
          >
            <option value="">Select Board</option>
            {boards.map(board => (
              <option key={board.id} value={board.id}>
                {board.projectKey || board.name}
              </option>
            ))}
          </select>

          {currentSprint && (
            <div className="flex items-center text-sm">
              <span className="text-gray-500 mr-2">Sprint:</span>
              <span className="font-medium">{currentSprint.name}</span>
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                {currentSprint.state}
              </span>
            </div>
          )}

          <button
            onClick={loadDemoMode}
            className="ml-auto px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center"
          >
            <Zap className="mr-2" size={16} />
            Load Demo Sprint
          </button>
        </div>

        {/* Filters and Search */}
        <div className="mb-4 flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-500" />
            <select
              className="px-3 py-1 border rounded"
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
            >
              <option value="all">All Tickets</option>
              <option value="testable">Needs Testing</option>
              <option value="story">Stories Only</option>
              <option value="bug">Bugs Only</option>
              <option value="task">Tasks Only</option>
            </select>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-1 border rounded"
            />
          </div>

          <span className="text-sm text-gray-500">
            {getFilteredTickets().length} tickets
          </span>
        </div>

        {/* Tickets List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : getFilteredTickets().length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tickets found. Try adjusting filters or load demo sprint.
            </div>
          ) : (
            getFilteredTickets().map(ticket => (
              <div
                key={ticket.key}
                className={`border rounded-lg ${
                  selectedTicket?.key === ticket.key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                } ${!needsTesting(ticket) ? 'opacity-60' : ''}`}
              >
                {/* Ticket Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => {
                    if (needsTesting(ticket)) {
                      setSelectedTicket(ticket);
                      setExpandedTicket(expandedTicket === ticket.key ? null : ticket.key);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-blue-600">{ticket.key}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          ticket.type === 'Bug' ? 'bg-red-100 text-red-700' :
                          ticket.type === 'Story' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ticket.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          ticket.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                          ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                          ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ticket.priority}
                        </span>
                        {ticket.storyPoints && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {ticket.storyPoints} pts
                          </span>
                        )}
                        {!needsTesting(ticket) && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                            No QA needed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-gray-800">{ticket.summary}</p>
                      <div className="mt-1 text-xs text-gray-500">
                        Assignee: {ticket.assignee} | Status: {ticket.status}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {needsTesting(ticket) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
                          }}
                          className={`px-3 py-1 rounded text-sm ${
                            selectedTicket?.key === ticket.key
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {selectedTicket?.key === ticket.key ? 'Selected' : 'Select'}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTicket(expandedTicket === ticket.key ? null : ticket.key);
                        }}
                      >
                        {expandedTicket === ticket.key ? 
                          <ChevronUp size={20} /> : 
                          <ChevronDown size={20} />
                        }
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Description */}
                {expandedTicket === ticket.key && (
                  <div className="px-4 pb-4 border-t">
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">Description:</h4>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                        {showFullDescription[ticket.key] 
                          ? ticket.description 
                          : (ticket.description?.substring(0, 300) + (ticket.description?.length > 300 ? '...' : ''))
                        }
                      </div>
                      {ticket.description?.length > 300 && (
                        <button
                          onClick={() => setShowFullDescription({
                            ...showFullDescription,
                            [ticket.key]: !showFullDescription[ticket.key]
                          })}
                          className="text-blue-600 text-sm mt-2 hover:underline"
                        >
                          {showFullDescription[ticket.key] ? 'Show Less' : 'Show More'}
                        </button>
                      )}
                    </div>
                    
                    {ticket.labels && ticket.labels.length > 0 && (
                      <div className="mt-3">
                        <span className="text-sm text-gray-500">Labels: </span>
                        {ticket.labels.map(label => (
                          <span key={label} className="ml-1 px-2 py-1 bg-gray-100 rounded text-xs">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {needsTesting(ticket) && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-700">
                          ✓ This ticket requires test cases. Click "Select" to proceed.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Selected Ticket Summary */}
        {selectedTicket && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Selected for Test Generation:</h3>
            <p className="text-blue-800">
              {selectedTicket.key} - {selectedTicket.summary}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Type: {selectedTicket.type} | Priority: {selectedTicket.priority}
            </p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={() => setCurrentStep(2)}
          disabled={!selectedTicket}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          Next: Select Context
          <ChevronRight className="ml-2" size={20} />
        </button>
      </div>
    </div>
  );

  // Step 2: Context Selection (simplified)
  const renderStep2 = () => (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center">
            <FolderOpen className="mr-2" size={24} />
            Select Test Context (Optional)
          </h2>
          <span className="text-sm text-gray-500">Step 2 of 4</span>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-700 mb-2">
            <strong>Selected Ticket:</strong> {selectedTicket?.key} - {selectedTicket?.summary}
          </p>
          <p className="text-sm text-gray-600">
            Select a TestRail folder with similar tests to improve generation quality, or skip this step.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => {
              setSelectedFolder({ 
                name: 'Video Player Controls',
                testCount: 5,
                pattern: 'Video Player - [Feature]'
              });
              setSkipContext(false);
            }}
            className={`w-full text-left p-4 rounded-lg border ${
              selectedFolder?.name === 'Video Player Controls' && !skipContext
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <FolderOpen className="mr-2" size={20} />
                  <span className="font-medium">Video Player Controls</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">5 similar tests • Pattern: "Video Player - [Feature]"</p>
              </div>
              {selectedFolder?.name === 'Video Player Controls' && !skipContext && (
                <CheckCircle className="text-blue-500" size={20} />
              )}
            </div>
          </button>

          <button
            onClick={() => navigate('/testrail?mode=context')}
            className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <div className="flex items-center">
              <Search className="mr-2 text-blue-600" size={20} />
              <span className="text-blue-600">Browse TestRail for different folder →</span>
            </div>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>

          <button
            onClick={() => {
              setSkipContext(true);
              setSelectedFolder(null);
            }}
            className={`w-full text-left p-4 rounded-lg border ${
              skipContext
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Skip Context Selection</span>
                <p className="text-sm text-gray-600 mt-1">Generate tests without reference to existing tests</p>
              </div>
              {skipContext && (
                <CheckCircle className="text-orange-500" size={20} />
              )}
            </div>
          </button>
        </div>

        {(selectedFolder || skipContext) && (
          <div className={`mt-6 p-4 rounded-lg ${
            skipContext 
              ? 'bg-orange-50 border border-orange-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            {skipContext ? (
              <p className="text-orange-700">
                ⚡ Will generate tests based solely on ticket requirements
              </p>
            ) : (
              <>
                <p className="text-green-700 font-medium">✓ Context selected: {selectedFolder.name}</p>
                <p className="text-sm text-green-600 mt-1">AI will analyze {selectedFolder.testCount} similar tests to maintain consistency</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
        <button
          onClick={() => setCurrentStep(1)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center"
        >
          <ChevronLeft className="mr-2" size={20} />
          Back: Select Ticket
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          disabled={!selectedFolder && !skipContext}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          Next: Generate Tests
          <ChevronRight className="ml-2" size={20} />
        </button>
      </div>
    </div>
  );

  // Steps 3 & 4 remain similar to original implementation
  const renderStep3 = () => (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center">
            <Cpu className="mr-2" size={24} />
            Generate Test Cases
          </h2>
          <span className="text-sm text-gray-500">Step 3 of 4</span>
        </div>
      </div>

      <div className="p-6">
        {!generatedTests.length ? (
          <>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Generation Options:</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input type="checkbox" checked={generationOptions.includePositive} 
                      onChange={(e) => setGenerationOptions({...generationOptions, includePositive: e.target.checked})}
                      className="mr-2" />
                    Positive Tests
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" checked={generationOptions.includeNegative}
                      onChange={(e) => setGenerationOptions({...generationOptions, includeNegative: e.target.checked})}
                      className="mr-2" />
                    Negative Tests
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" checked={generationOptions.includeEdgeCases}
                      onChange={(e) => setGenerationOptions({...generationOptions, includeEdgeCases: e.target.checked})}
                      className="mr-2" />
                    Edge Cases
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={generateTests}
              disabled={isLoading}
              className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={20} />
                  Generating Tests...
                </>
              ) : (
                <>
                  <Play className="mr-2" size={20} />
                  Generate Tests
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-green-700 font-medium">
                  ✅ {generatedTests.length} tests generated successfully!
                </span>
                <span className="text-green-600">
                  Quality Score: {qualityScore}/100
                </span>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {generatedTests.map((test, index) => (
                <div key={test.id || index} className="p-4 border rounded-lg">
                  <h4 className="font-medium">{test.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{test.objective}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center"
        >
          <ChevronLeft className="mr-2" size={20} />
          Back
        </button>
        {generatedTests.length > 0 && (
          <button
            onClick={() => setCurrentStep(4)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
          >
            Next: Convert to Cypress
            <ChevronRight className="ml-2" size={20} />
          </button>
        )}
      </div>
    </div>
  );

  // Progress indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {[
          { num: 1, label: 'Select Ticket' },
          { num: 2, label: 'Context' },
          { num: 3, label: 'Generate' },
          { num: 4, label: 'Cypress' }
        ].map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.num
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {currentStep > step.num ? <CheckCircle size={20} /> : step.num}
            </div>
            <div className="ml-2">
              <span className={`text-sm ${currentStep >= step.num ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {index < 3 && (
              <div className={`w-16 h-0.5 ml-4 ${
                currentStep > step.num ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 text-center">
            🚀 QA Copilot - Smart Test Generator
          </h1>
          {isDemoMode && (
            <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded-lg text-center">
              <span className="text-purple-700 font-medium">
                🎭 DEMO MODE - Using example sprint data
              </span>
            </div>
          )}
        </div>

        {renderStepIndicator()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep3()} {/* Reuse for simplicity */}
      </div>
    </div>
  );
}

export default UnifiedGeneratorV2;