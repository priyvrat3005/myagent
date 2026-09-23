import type { NodeType } from '../types';

const NODE_TYPES: { type: NodeType; label: string; icon: string; description: string }[] = [
  { type: 'trigger', label: 'Trigger', icon: '⚡', description: 'Entry point & input validation' },
  { type: 'identity', label: 'Identity', icon: '🤖', description: 'LLM-powered agent node' },
  { type: 'skill', label: 'Skill', icon: '🎯', description: 'Templated prompt call' },
  { type: 'memory', label: 'Memory', icon: '🧠', description: 'Short/long-term memory access' },
  { type: 'tool', label: 'Tool', icon: '🔧', description: 'External tool execution' },
  { type: 'planner', label: 'Planner', icon: '📋', description: 'Task decomposition' },
  { type: 'router', label: 'Router', icon: '🔀', description: 'Conditional branching' },
  { type: 'approval', label: 'Approval', icon: '✅', description: 'Human-in-the-loop gate' },
  { type: 'output', label: 'Output', icon: '📤', description: 'Final response formatting' },
];

export default function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 overflow-y-auto">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Node Types</h3>
        <p className="text-[10px] text-gray-600 mt-1">Drag onto canvas</p>
      </div>
      
      <div className="p-2 space-y-1">
        {NODE_TYPES.map(({ type, label, icon, description }) => (
          <div
            key={type}
            draggable
            onDragStart={e => onDragStart(e, type)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-800 transition-colors group"
          >
            <span className="text-lg">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-medium">{label}</p>
              <p className="text-[10px] text-gray-500 truncate">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
