import type { WorkflowNode, NodeType } from '../types';
import { useCanvasStore } from '../stores/canvas';
import { X, Trash2 } from 'lucide-react';

interface Props {
  node: WorkflowNode;
  onClose: () => void;
  onDelete: () => void;
}

const NODE_ICONS: Record<NodeType, string> = {
  trigger: '⚡', identity: '🤖', skill: '🎯', memory: '🧠',
  tool: '🔧', planner: '📋', router: '🔀', approval: '✅', output: '📤',
};

export default function NodeConfigPanel({ node, onClose, onDelete }: Props) {
  const updateConfig = useCanvasStore(s => s.updateNodeConfig);

  const renderConfigFields = () => {
    switch (node.type) {
      case 'trigger':
        return (
          <>
            <Field label="Input Schema (JSON)">
              <textarea
                value={JSON.stringify(node.config.input_schema || {}, null, 2)}
                onChange={e => {
                  try { updateConfig(node.id, { input_schema: JSON.parse(e.target.value) }); }
                  catch {}
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono h-32 resize-none focus:outline-none focus:border-violet-500"
              />
            </Field>
          </>
        );
      
      case 'identity':
        return (
          <>
            <Field label="Agent Name">
              <input
                type="text"
                value={node.config.agent_name || ''}
                onChange={e => updateConfig(node.id, { agent_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="System Instructions">
              <textarea
                value={node.config.system_instructions || ''}
                onChange={e => updateConfig(node.id, { system_instructions: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white h-32 resize-none focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Model">
              <select
                value={node.config.model || 'claude-3-sonnet'}
                onChange={e => updateConfig(node.id, { model: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
                <option value="gpt-4">GPT-4</option>
              </select>
            </Field>
            <Field label="Max Context Tokens">
              <input
                type="number"
                value={node.config.max_context_tokens || 4096}
                onChange={e => updateConfig(node.id, { max_context_tokens: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
          </>
        );
      
      case 'skill':
        return (
          <>
            <Field label="Skill Name">
              <input
                type="text"
                value={node.config.skill_name || ''}
                onChange={e => updateConfig(node.id, { skill_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Prompt Template">
              <textarea
                value={node.config.prompt_template || ''}
                onChange={e => updateConfig(node.id, { prompt_template: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white h-24 resize-none focus:outline-none focus:border-violet-500"
                placeholder="Use {{variable}} for inputs..."
              />
            </Field>
            <Field label="Input Schema (JSON)">
              <textarea
                value={JSON.stringify(node.config.input_schema || {}, null, 2)}
                onChange={e => { try { updateConfig(node.id, { input_schema: JSON.parse(e.target.value) }); } catch {} }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono h-20 resize-none focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Output Schema (JSON)">
              <textarea
                value={JSON.stringify(node.config.output_schema || {}, null, 2)}
                onChange={e => { try { updateConfig(node.id, { output_schema: JSON.parse(e.target.value) }); } catch {} }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono h-20 resize-none focus:outline-none focus:border-violet-500"
              />
            </Field>
          </>
        );
      
      case 'memory':
        return (
          <>
            <Field label="Mode">
              <select
                value={node.config.mode || 'short_term'}
                onChange={e => updateConfig(node.id, { mode: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="short_term">Short-term (windowed buffer)</option>
                <option value="long_term">Long-term (pgvector store)</option>
              </select>
            </Field>
            <Field label="Window Size">
              <input
                type="number"
                value={node.config.window_size || 5}
                onChange={e => updateConfig(node.id, { window_size: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Namespace">
              <input
                type="text"
                value={node.config.namespace || ''}
                onChange={e => updateConfig(node.id, { namespace: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
          </>
        );
      
      case 'tool':
        return (
          <>
            <Field label="Tool Name">
              <input
                type="text"
                value={node.config.tool_name || ''}
                onChange={e => updateConfig(node.id, { tool_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Tool Type">
              <select
                value={node.config.tool_type || 'code_interpreter'}
                onChange={e => updateConfig(node.id, { tool_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="code_interpreter">Code Interpreter (Docker sandbox)</option>
                <option value="api_call">API/Webhook Call</option>
                <option value="db_query">Database Query</option>
                <option value="web_search">Web Search</option>
                <option value="file_parser">File Parser</option>
              </select>
            </Field>
            <Field label="Timeout (ms)">
              <input
                type="number"
                value={node.config.timeout_ms || 30000}
                onChange={e => updateConfig(node.id, { timeout_ms: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Max Retries">
              <input
                type="number"
                value={node.config.max_retries || 3}
                onChange={e => updateConfig(node.id, { max_retries: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Irreversible Action">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={node.config.is_irreversible || false}
                  onChange={e => updateConfig(node.id, { is_irreversible: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-sm text-gray-300">Requires approval before execution</span>
              </label>
            </Field>
          </>
        );
      
      case 'router':
        return (
          <>
            <Field label="Routing Pattern">
              <select
                value={node.config.pattern || 'routing'}
                onChange={e => updateConfig(node.id, { pattern: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="routing">Routing (conditional)</option>
                <option value="prompt_chaining">Prompt Chaining</option>
                <option value="parallelization">Parallelization (TODO)</option>
                <option value="orchestrator_workers">Orchestrator-Workers (TODO)</option>
                <option value="evaluator_optimizer">Evaluator-Optimizer (TODO)</option>
                <option value="handoff">Handoff (TODO)</option>
              </select>
            </Field>
            <Field label="Max Iterations (for cycles)">
              <input
                type="number"
                value={node.config.max_iterations || 5}
                onChange={e => updateConfig(node.id, { max_iterations: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
          </>
        );
      
      case 'approval':
        return (
          <>
            <Field label="Action Description">
              <input
                type="text"
                value={node.config.description || ''}
                onChange={e => updateConfig(node.id, { description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
            <Field label="Action Type">
              <input
                type="text"
                value={node.config.action || ''}
                onChange={e => updateConfig(node.id, { action: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                placeholder="e.g., destructive_api_call"
              />
            </Field>
            <Field label="Target">
              <input
                type="text"
                value={node.config.target || ''}
                onChange={e => updateConfig(node.id, { target: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                placeholder="e.g., production_database"
              />
            </Field>
          </>
        );
      
      case 'output':
        return (
          <>
            <Field label="Response Format">
              <select
                value={node.config.response_format || 'text'}
                onChange={e => updateConfig(node.id, { response_format: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="text">Plain Text</option>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
            </Field>
            <Field label="Response Template">
              <textarea
                value={node.config.template || ''}
                onChange={e => updateConfig(node.id, { template: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white h-24 resize-none focus:outline-none focus:border-violet-500"
                placeholder="Use {{variable}} for dynamic content..."
              />
            </Field>
          </>
        );
      
      case 'planner':
        return (
          <>
            <Field label="Strategy">
              <select
                value={node.config.strategy || 'decomposition'}
                onChange={e => updateConfig(node.id, { strategy: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="decomposition">Task Decomposition</option>
                <option value="plan_and_execute">Plan & Execute</option>
              </select>
            </Field>
            <Field label="Max Steps">
              <input
                type="number"
                value={node.config.max_steps || 5}
                onChange={e => updateConfig(node.id, { max_steps: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </Field>
          </>
        );
      
      default:
        return <p className="text-gray-500 text-sm">No configuration available for this node type.</p>;
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{NODE_ICONS[node.type]}</span>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">{node.type}</p>
            <p className="text-sm text-white font-medium">Configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        <Field label="Node ID">
          <input
            type="text"
            value={node.id}
            disabled
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono"
          />
        </Field>
        
        {renderConfigFields()}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}
