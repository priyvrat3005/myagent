import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Eye, Trash2, FlaskConical } from 'lucide-react';
import * as api from '../api/mock';
import type { Workflow, Run } from '../types';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    const wfs = await api.listWorkflows();
    setWorkflows(wfs);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const wf = await api.createWorkflow(newName, { nodes: [], edges: [] });
    setWorkflows([...workflows, wf]);
    setShowCreate(false);
    setNewName('');
    navigate(`/workflows/${wf.id}/edit`);
  };

  const handlePublish = async (id: string) => {
    try {
      await api.publishWorkflow(id);
      await loadWorkflows();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRun = async (id: string) => {
    try {
      const { run } = await api.startRun(id);
      navigate(`/workflows/${id}/runs/${run.id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Workflows</h1>
            <p className="text-gray-400 text-sm mt-1">Build and manage your AI agent workflows</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        {showCreate && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-white font-medium mb-3">Create New Workflow</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Workflow name..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg">
                Create
              </button>
              <button onClick={() => setShowCreate(false)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}

        {workflows.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-600 text-6xl mb-4">🤖</div>
            <h3 className="text-gray-400 text-lg mb-2">No workflows yet</h3>
            <p className="text-gray-600 text-sm">Create your first AI agent workflow to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map(wf => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onEdit={() => navigate(`/workflows/${wf.id}/edit`)}
                onPublish={() => handlePublish(wf.id)}
                onRun={() => handleRun(wf.id)}
                onEval={() => navigate(`/eval-sets/${wf.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowCard({ workflow, onEdit, onPublish, onRun, onEval }: {
  workflow: Workflow;
  onEdit: () => void;
  onPublish: () => void;
  onRun: () => void;
  onEval: () => void;
}) {
  const nodeCount = workflow.graph_definition.nodes.length;
  const edgeCount = workflow.graph_definition.edges.length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-medium">{workflow.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              workflow.status === 'published'
                ? 'bg-green-900/50 text-green-300 border border-green-800'
                : 'bg-yellow-900/50 text-yellow-300 border border-yellow-800'
            }`}>
              {workflow.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{nodeCount} nodes</span>
            <span>{edgeCount} edges</span>
            <span>{workflow.graph_definition.nodes.map(n => n.type).join(' → ') || 'empty'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Edit
          </button>
          
          {workflow.status === 'draft' && (
            <button
              onClick={onPublish}
              className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Publish
            </button>
          )}
          
          {workflow.status === 'published' && (
            <button
              onClick={onRun}
              className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
          )}
          
          <button
            onClick={onEval}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Eval
          </button>
        </div>
      </div>
    </div>
  );
}
