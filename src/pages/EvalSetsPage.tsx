import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api/mock';
import type { EvalSet, EvalCase } from '../types';
import { ArrowLeft, Plus, Play, CheckCircle, XCircle, FlaskConical } from 'lucide-react';

export default function EvalSetsPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const [evalSets, setEvalSets] = useState<EvalSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<EvalSet | null>(null);
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [showAddCase, setShowAddCase] = useState(false);
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newInput, setNewInput] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (workflowId) {
      api.getEvalSets(workflowId).then(sets => {
        setEvalSets(sets);
        if (sets.length > 0) {
          setSelectedSet(sets[0]);
          api.getEvalCases(sets[0].id).then(setCases);
        }
      });
    }
  }, [workflowId]);

  const handleCreateSet = async () => {
    if (!workflowId || !newSetName.trim()) return;
    const newSet = await api.createEvalSet(workflowId, newSetName);
    setEvalSets([...evalSets, newSet]);
    setSelectedSet(newSet);
    setCases([]);
    setShowCreateSet(false);
    setNewSetName('');
  };

  const handleAddCase = async () => {
    if (!selectedSet) return;
    try {
      const input = JSON.parse(newInput);
      const expected = JSON.parse(newExpected);
      const newCase = await api.addEvalCase(selectedSet.id, input, expected);
      setCases([...cases, newCase]);
      setShowAddCase(false);
      setNewInput('');
      setNewExpected('');
    } catch {
      alert('Invalid JSON. Please enter valid JSON objects.');
    }
  };

  const handleRunEval = async () => {
    if (!selectedSet) return;
    setRunning(true);
    const results = await api.runEvalSet(selectedSet.id);
    setCases(results);
    setRunning(false);
  };

  const passCount = cases.filter(c => c.result === 'pass').length;
  const failCount = cases.filter(c => c.result === 'fail').length;

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/workflows')} className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-violet-400" />
              <h1 className="text-xl font-bold text-white">Evaluation Sets</h1>
            </div>
            <p className="text-sm text-gray-500">Test your workflow against expected inputs and outputs</p>
          </div>
        </div>

        {/* Eval Set selector */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {evalSets.map(set => (
              <button
                key={set.id}
                onClick={() => {
                  setSelectedSet(set);
                  api.getEvalCases(set.id).then(setCases);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedSet?.id === set.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {set.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreateSet(true)}
            className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
          >
            <Plus className="w-3.5 h-3.5" />
            New Set
          </button>
        </div>

        {showCreateSet && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={newSetName}
                onChange={e => setNewSetName(e.target.value)}
                placeholder="Eval set name..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                autoFocus
              />
              <button onClick={handleCreateSet} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm">Create</button>
              <button onClick={() => setShowCreateSet(false)} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Actions bar */}
        {selectedSet && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">{cases.length} cases</span>
              {cases.some(c => c.result) && (
                <>
                  <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {passCount} pass</span>
                  <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {failCount} fail</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddCase(true)}
                className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Case
              </button>
              <button
                onClick={handleRunEval}
                disabled={running || cases.length === 0}
                className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
              >
                <Play className="w-3.5 h-3.5" />
                {running ? 'Running...' : 'Run Eval Set'}
              </button>
            </div>
          </div>
        )}

        {/* Add case form */}
        {showAddCase && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Input (JSON)</label>
              <textarea
                value={newInput}
                onChange={e => setNewInput(e.target.value)}
                placeholder='{"message": "Hello"}'
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono h-20 resize-none focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Expected Output (JSON)</label>
              <textarea
                value={newExpected}
                onChange={e => setNewExpected(e.target.value)}
                placeholder='{"result": "expected response"}'
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono h-20 resize-none focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddCase} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm">Add Case</button>
              <button onClick={() => setShowAddCase(false)} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Cases table */}
        {cases.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">#</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Input</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Expected</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, idx) => (
                  <tr key={c.id} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <pre className="text-xs text-gray-300 font-mono max-w-[200px] truncate">
                        {JSON.stringify(c.input)}
                      </pre>
                    </td>
                    <td className="px-4 py-3">
                      <pre className="text-xs text-gray-300 font-mono max-w-[200px] truncate">
                        {JSON.stringify(c.expected_output)}
                      </pre>
                    </td>
                    <td className="px-4 py-3">
                      {c.result === 'pass' && (
                        <span className="flex items-center gap-1 text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" /> Pass
                        </span>
                      )}
                      {c.result === 'fail' && (
                        <span className="flex items-center gap-1 text-red-400 text-sm">
                          <XCircle className="w-4 h-4" /> Fail
                        </span>
                      )}
                      {!c.result && (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!selectedSet && !showCreateSet && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🧪</div>
            <h3 className="text-gray-400 text-lg mb-2">No eval sets yet</h3>
            <p className="text-gray-600 text-sm">Create an eval set to test your workflow with different inputs</p>
          </div>
        )}
      </div>
    </div>
  );
}
