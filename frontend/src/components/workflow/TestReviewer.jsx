import { useState, useEffect } from 'react';
import { Edit2, Check, X, ChevronDown, ChevronUp, Plus, Trash2, FileText, Zap, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TestReviewer({ tests, onReview, reviewed, onSkipToAutomation }) {
  const [editedTests, setEditedTests] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [expandedTests, setExpandedTests] = useState(new Set());
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' or 'simple'
  const [skipTestRail, setSkipTestRail] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (tests && tests.length > 0 && editedTests.length === 0) {
      // Only initialize if editedTests is empty to prevent overwriting during edits
      const formattedTests = tests.map(test => {
        if (!test.steps || test.steps.length === 0) {
          const steps = parseTestIntoSteps(test);
          return { ...test, steps };
        }
        return test;
      });
      
      // Use reviewed if available, otherwise use formatted tests
      const initialTests = reviewed && reviewed.length > 0 ? reviewed : formattedTests;
      setEditedTests(initialTests);
      
      // Auto-approve tests after a short delay for better UX
      if (!reviewed || reviewed.length === 0) {
        setTimeout(() => onReview(formattedTests), 100);
      }
    }
  }, [tests, reviewed]); // Keep dependencies but add guard condition

  // Parse test description into structured steps
  const parseTestIntoSteps = (test) => {
    const defaultSteps = [
      {
        action: test.title || 'Execute test scenario',
        expectedResult: test.expectedResult || 'System behaves as expected'
      }
    ];

    // Try to parse numbered steps from description
    if (test.description) {
      const lines = test.description.split('\n');
      const steps = [];
      let currentStep = null;

      lines.forEach(line => {
        const stepMatch = line.match(/^\d+\.\s+(.+)/);
        const expectedMatch = line.match(/^Expected:\s+(.+)/i);
        
        if (stepMatch) {
          if (currentStep) {
            steps.push(currentStep);
          }
          currentStep = {
            action: stepMatch[1],
            expectedResult: ''
          };
        } else if (expectedMatch && currentStep) {
          currentStep.expectedResult = expectedMatch[1];
        }
      });

      if (currentStep) {
        steps.push(currentStep);
      }

      return steps.length > 0 ? steps : defaultSteps;
    }

    return defaultSteps;
  };

  const handleEdit = (testId, field, value) => {
    setEditedTests(editedTests.map(test => 
      test.id === testId ? { ...test, [field]: value } : test
    ));
  };

  const handleStepEdit = (testId, stepIndex, field, value) => {
    setEditedTests(editedTests.map(test => {
      if (test.id === testId) {
        const newSteps = [...(test.steps || [])];
        newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
        return { ...test, steps: newSteps };
      }
      return test;
    }));
  };

  const handleAddStep = (testId) => {
    setEditedTests(editedTests.map(test => {
      if (test.id === testId) {
        const newSteps = [...(test.steps || []), { action: '', expectedResult: '' }];
        return { ...test, steps: newSteps };
      }
      return test;
    }));
  };

  const handleRemoveStep = (testId, stepIndex) => {
    setEditedTests(editedTests.map(test => {
      if (test.id === testId) {
        const newSteps = test.steps.filter((_, index) => index !== stepIndex);
        return { ...test, steps: newSteps };
      }
      return test;
    }));
  };

  const handleSaveEdit = () => {
    setEditingId(null);
    // Only call onReview after editing is complete
    setTimeout(() => onReview(editedTests), 0);
  };

  const toggleExpanded = (testId) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testId)) {
      newExpanded.delete(testId);
    } else {
      newExpanded.add(testId);
    }
    setExpandedTests(newExpanded);
  };

  const handleRemoveTest = (testId) => {
    const updated = editedTests.filter(t => t.id !== testId);
    setEditedTests(updated);
    onReview(updated);
  };

  // Removed duplicate auto-save that was causing infinite loop

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-blue-800">
              Review and edit the generated test cases. Tests are displayed in TestRail format.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Click on any test to expand and edit steps individually.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('formatted')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'formatted' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-blue-600 border border-blue-600'
              }`}
            >
              <FileText className="h-3 w-3 inline mr-1" />
              TestRail Format
            </button>
            <button
              onClick={() => setViewMode('simple')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'simple' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-blue-600 border border-blue-600'
              }`}
            >
              Simple View
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {editedTests.map((test, index) => {
          const isExpanded = expandedTests.has(test.id);
          const isEditing = editingId === test.id;

          return (
            <div key={test.id} className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={test.title}
                        onChange={(e) => handleEdit(test.id, 'title', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <h4 className="font-medium text-gray-900">
                        Test Case #{index + 1}: {test.title}
                      </h4>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingId(test.id)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveTest(test.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleExpanded(test.id)}
                          className="text-gray-600 hover:text-gray-700"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Test Info */}
                <div className="mt-2 flex gap-4 text-xs">
                  <span className={`px-2 py-1 rounded ${
                    test.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                    test.priority === 'High' ? 'bg-amber-100 text-amber-700' :
                    test.priority === 'Low' ? 'bg-gray-100 text-gray-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {test.priority || 'Medium'} Priority
                  </span>
                  <span className={`px-2 py-1 rounded ${
                    test.testType === 'performance' ? 'bg-green-100 text-green-700' :
                    test.testType === 'security' ? 'bg-red-100 text-red-700' :
                    test.testType === 'accessibility' ? 'bg-purple-100 text-purple-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {test.testType ? test.testType.charAt(0).toUpperCase() + test.testType.slice(1) : test.type || 'Functional'}
                  </span>
                  {test.estimate && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      Est: {test.estimate}
                    </span>
                  )}
                </div>

                {/* Preconditions */}
                {(isExpanded || viewMode === 'formatted') && test.preconditions && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-700">Preconditions:</label>
                    {isEditing ? (
                      <textarea
                        value={test.preconditions}
                        onChange={(e) => handleEdit(test.id, 'preconditions', e.target.value)}
                        className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        rows="2"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">{test.preconditions}</p>
                    )}
                  </div>
                )}

                {/* Test Steps - TestRail Format */}
                {viewMode === 'formatted' && (
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-700">Test Steps:</label>
                      {isEditing && (
                        <button
                          onClick={() => handleAddStep(test.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add Step
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {(test.steps || []).map((step, stepIndex) => (
                        <div key={stepIndex} className="bg-gray-50 rounded p-2">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-gray-500 mt-1">
                              {stepIndex + 1}.
                            </span>
                            <div className="flex-1">
                              {isEditing ? (
                                <>
                                  <input
                                    type="text"
                                    value={step.action}
                                    onChange={(e) => handleStepEdit(test.id, stepIndex, 'action', e.target.value)}
                                    placeholder="Step action..."
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1"
                                  />
                                  <input
                                    type="text"
                                    value={step.expectedResult}
                                    onChange={(e) => handleStepEdit(test.id, stepIndex, 'expectedResult', e.target.value)}
                                    placeholder="Expected result..."
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </>
                              ) : (
                                <>
                                  <p className="text-sm text-gray-700">{step.action}</p>
                                  {step.expectedResult && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      <span className="font-medium">Expected:</span> {step.expectedResult}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            {isEditing && (
                              <button
                                onClick={() => handleRemoveStep(test.id, stepIndex)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {(!test.steps || test.steps.length === 0) && !isEditing && (
                        <p className="text-sm text-gray-500 italic">No steps defined</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Simple View - Just Description */}
                {viewMode === 'simple' && isExpanded && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-700">Description:</label>
                    {isEditing ? (
                      <textarea
                        value={test.description}
                        onChange={(e) => handleEdit(test.id, 'description', e.target.value)}
                        className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        rows="4"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                        {test.description || 'No description provided'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editedTests.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500">No test cases to review</p>
        </div>
      )}

      {/* Action Buttons */}
      {editedTests.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Skip TestRail Option */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipTestRail}
                onChange={(e) => setSkipTestRail(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-amber-900">
                Skip TestRail Save (Demo Mode)
              </span>
            </label>
            <p className="text-xs text-amber-700 mt-1 ml-6">
              Use this option for testing - tests won't be saved to TestRail but can still be automated
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                // Store reviewed tests in session for automation
                sessionStorage.setItem('reviewedTests', JSON.stringify(editedTests));
                sessionStorage.setItem('skipTestRail', skipTestRail.toString());
                
                // Navigate to automation page
                navigate('/automate-tests', {
                  state: {
                    fromReview: true,
                    tests: editedTests,
                    skipTestRail
                  }
                });
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Generate Java Selenium Tests
            </button>

            {!skipTestRail && (
              <button
                onClick={() => {
                  onReview(editedTests);
                  // This will trigger the parent to move to next step (Save to TestRail)
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save to TestRail & Continue
              </button>
            )}

            {skipTestRail && (
              <button
                onClick={() => {
                  onReview(editedTests);
                  // Skip directly to automation
                  if (onSkipToAutomation) {
                    onSkipToAutomation();
                  }
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                Skip to Next Step
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}