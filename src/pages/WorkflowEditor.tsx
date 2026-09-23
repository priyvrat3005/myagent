import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '../stores/canvas';
import * as api from '../api/mock';
import type { NodeType, WorkflowNode } from '../types';
import { NODE_OUTPUT_TYPES } from '../types';
import NodePalette from '../components/NodePalette';
import NodeConfigPanel from '../components/NodeConfigPanel';
import { Save, Play, ArrowLeft, AlertCircle } from 'lucide-react';

const NODE_COLORS: Record<NodeType, string> = {
  trigger: '#8b5cf6',
  identity: '#3b82f6',
  skill: '#06b6d4',
  memory: '#10b981',
  tool: '#f59e0b',
  planner: '#ec4899',
  router: '#6366f1',
  approval: '#ef4444',
  output: '#84cc16',
};

const NODE_ICONS: Record<NodeType, string> = {
  trigger: '⚡',
  identity: '🤖',
  skill: '🎯',
  memory: '🧠',
  tool: '🔧',
  planner: '📋',
  router: '🔀',
  approval: '✅',
  output: '📤',
};

function CustomNode({ data }: { data: any }) {
  const color = NODE_COLORS[data.nodeType as NodeType] || '#6b7280';
  const icon = NODE_ICONS[data.nodeType as NodeType] || '⬜';
  
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[160px] shadow-lg transition-all ${
        data.selected ? 'ring-2 ring-white/50 scale-105' : ''
      }`}
      style={{ borderColor: color, backgroundColor: `${color}15` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-gray-900" />
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{data.nodeType}</p>
          <p className="text-sm text-white font-medium truncate max-w-[120px]">
            {data.label || data.nodeType}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-gray-900" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvas = useCanvasStore();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load workflow
  useEffect(() => {
    if (id) {
      api.getWorkflow(id).then(wf => {
        if (wf) {
          canvas.setWorkflowName(wf.name);
          canvas.loadGraph(wf.graph_definition);
        }
      });
    }
  }, [id]);

  // Sync store → React Flow nodes/edges
  useEffect(() => {
    const nodes: Node[] = canvas.nodes.map(n => ({
      id: n.id,
      type: 'custom',
      position: n.position,
      data: {
        nodeType: n.type,
        label: n.config.agent_name || n.config.skill_name || n.config.tool_name || n.type,
        selected: canvas.selectedNodeId === n.id,
      },
    }));
    setRfNodes(nodes);

    const edges: Edge[] = canvas.edges.map(e => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      style: { stroke: '#6b7280', strokeWidth: 2 },
      label: e.condition || undefined,
    }));
    setRfEdges(edges);
  }, [canvas.nodes, canvas.edges, canvas.selectedNodeId]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const result = canvas.addEdge(connection.source, connection.target);
    if (!result.valid) {
      setError(result.error || 'Invalid connection');
      setTimeout(() => setError(''), 3000);
    }
  }, [canvas]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    canvas.selectNode(node.id);
  }, [canvas]);

  const onPaneClick = useCallback(() => {
    canvas.selectNode(null);
  }, [canvas]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow-type') as NodeType;
    if (!type) return;
    
    const reactFlowBounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    if (!reactFlowBounds) return;
    
    const position = {
      x: event.clientX - reactFlowBounds.left - 80,
      y: event.clientY - reactFlowBounds.top - 30,
    };
    canvas.addNode(type, position);
  }, [canvas]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.updateWorkflow(id, {
        graph_definition: canvas.getGraphDefinition(),
        name: canvas.workflowName,
      });
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!id) return;
    await handleSave();
    try {
      await api.publishWorkflow(id);
      navigate('/workflows');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRun = async () => {
    if (!id) return;
    await handleSave();
    try {
      await api.publishWorkflow(id);
      const { run } = await api.startRun(id);
      navigate(`/workflows/${id}/runs/${run.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selectedNode = canvas.nodes.find(n => n.id === canvas.selectedNodeId);

  return (
    <div className="h-full flex">
      {/* Node Palette */}
      <NodePalette />
      
      {/* Canvas */}
      <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-700 text-red-200 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-950"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1f2937" gap={20} />
          <Controls className="!bg-gray-900 !border-gray-700 !rounded-lg" />
          <MiniMap
            className="!bg-gray-900 !border-gray-700 !rounded-lg"
            nodeColor={(node) => NODE_COLORS[node.data?.nodeType as NodeType] || '#6b7280'}
            maskColor="rgba(0,0,0,0.7)"
          />
        </ReactFlow>
        
        {/* Top bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/workflows')} className="p-2 bg-gray-900/90 border border-gray-700 rounded-lg text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={canvas.workflowName}
              onChange={e => canvas.setWorkflowName(e.target.value)}
              className="bg-gray-900/90 border border-gray-700 rounded-lg px-4 py-2 text-white font-medium focus:outline-none focus:border-violet-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handlePublish}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Publish
            </button>
            <button
              onClick={handleRun}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          </div>
        </div>
      </div>
      
      {/* Config Panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => canvas.selectNode(null)}
          onDelete={() => canvas.removeNode(selectedNode.id)}
        />
      )}
    </div>
  );
}
