import { useState, useEffect } from 'react';
import { Edit2, Check, X, ChevronDown, ChevronUp, Plus, Trash2, FileText } from 'lucide-react';

export default function TestReviewer({ tests, onReview, reviewed }) {
  const [editedTests, setEditedTests] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [expandedTests, setExpandedTests] = useState(new Set());
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' or 'simple'

  useEffect(() => {
    if (tests && tests.length > 0) {
      // Convert tests to TestRail format if they don't have steps already
      const formattedTests = tests.map(test => {
        if (!test.steps || test.steps.length === 0) {
          // Parse the description to extract steps if possible
          const steps = parseTestIntoSteps(test);
          return { ...test, steps };
        }
        return test;
      });
      setEditedTests(reviewed.length > 0 ? reviewed : formattedTests);
    }
  }, [tests]);

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
    onReview(editedTests);
    setEditingId(null);
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

  useEffect(() => {
    // Auto-save reviews
    if (editedTests.length > 0) {
      onReview(editedTests);
    }
  }, [editedTests]);

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
                    test.priority === 'High' ? 'bg-red-100 text-red-700' :
                    test.priority === 'Low' ? 'bg-gray-100 text-gray-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {test.priority || 'Medium'} Priority
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {test.type || 'Functional'}
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
    </div>
  );
}