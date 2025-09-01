import { useState, useEffect } from 'react';
import { Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function TestReviewer({ tests, onReview, reviewed }) {
  const [editedTests, setEditedTests] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [expandedTests, setExpandedTests] = useState(new Set());

  useEffect(() => {
    if (tests && tests.length > 0) {
      setEditedTests(reviewed.length > 0 ? reviewed : tests);
    }
  }, [tests]);

  const handleEdit = (testId, field, value) => {
    setEditedTests(editedTests.map(test => 
      test.id === testId ? { ...test, [field]: value } : test
    ));
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
        <p className="text-sm text-blue-800">
          Review and edit the generated test cases. Click on any test to expand and edit details.
        </p>
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
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        autoFocus
                      />
                    ) : (
                      <h4 className="font-medium text-gray-900">
                        {index + 1}. {test.title}
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
                          className="text-indigo-600 hover:text-indigo-700"
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
                          {isExpanded ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                          }
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Objective */}
                <p className="text-sm text-gray-600 mt-2">{test.objective}</p>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    {/* Preconditions */}
                    <div>
                      <label className="text-xs font-medium text-gray-700">Preconditions:</label>
                      {isEditing ? (
                        <textarea
                          value={test.preconditions}
                          onChange={(e) => handleEdit(test.id, 'preconditions', e.target.value)}
                          className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          rows="2"
                        />
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">{test.preconditions}</p>
                      )}
                    </div>

                    {/* Steps */}
                    <div>
                      <label className="text-xs font-medium text-gray-700">Test Steps:</label>
                      <ol className="mt-1 space-y-1">
                        {test.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="text-sm text-gray-600">
                            <span className="font-medium">{stepIndex + 1}.</span> {step.action}
                            <span className="text-gray-500 ml-2">→ {step.expected}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Expected Result */}
                    <div>
                      <label className="text-xs font-medium text-gray-700">Expected Result:</label>
                      {isEditing ? (
                        <textarea
                          value={test.expectedResult}
                          onChange={(e) => handleEdit(test.id, 'expectedResult', e.target.value)}
                          className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          rows="2"
                        />
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">{test.expectedResult}</p>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Priority: {test.priority}</span>
                      {test.platforms && (
                        <span>Platforms: {test.platforms.join(', ')}</span>
                      )}
                      {test.tags && (
                        <span>Tags: {test.tags.join(', ')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editedTests.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No tests to review. Please generate tests first.
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>{editedTests.length}</strong> test cases ready for saving to TestRail
        </p>
      </div>
    </div>
  );
}