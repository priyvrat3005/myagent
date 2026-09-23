import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRunStore } from '../stores/run';
import * as api from '../api/mock';
import type { RunStep, StreamEvent } from '../types';
import { ArrowLeft, Square, CheckCircle, XCircle, AlertTriangle, Clock, Zap, DollarSign, Cpu } from 'lucide-react';

export default function RunInspector() {
  const { id: workflowId, runId } = useParams<{ id: string; runId: string }>();
  const navigate = useNavigate();
  const runStore = useRunStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) return;
    
    const loadRun = async () => {
      const run = await api.getRun(runId);
      const steps = await api.getRunSteps(runId);
      if (run) {
        runStore.setCurrentRun(run);
        runStore.setSteps(steps);
        runStore.updateSpend(run.total_cost_usd, run.total_tokens);
      }
      setLoading(false);
    };
    
    loadRun();
    
    // Subscribe to WebSocket stream
    const unsubscribe = api.subscribeToRun(runId, (event: StreamEvent) => {
      switch (event.type) {
        case 'step_start':
          // Visual indicator that step is starting
          break;
        case 'step_complete':
          runStore.addStep(event.data.step as RunStep);
          break;
        case 'spend_update':
          runStore.updateSpend(event.data.total_cost_usd, event.data.total_tokens);
          break;
        case 'run_complete':
          runStore.setCurrentRun({
            ...runStore.currentRun!,
            status: 'completed',
            total_tokens: event.data.total_tokens,
            total_cost_usd: event.data.total_cost_usd,
            completed_at: new Date().toISOString(),
          });
          runStore.setLive(false);
          break;
        case 'run_killed':
          runStore.setCurrentRun({
            ...runStore.currentRun!,
            status: 'killed',
            completed_at: new Date().toISOString(),
          });
          runStore.setLive(false);
          break;
        case 'approval_required':
          runStore.setCurrentRun({
            ...runStore.currentRun!,
            status: 'paused_for_approval',
          });
          break;
      }
    });
    
    runStore.setLive(true);
    
    return () => {
      unsubscribe();
      runStore.setLive(false);
    };
  }, [runId]);

  const handleKill = async () => {
    if (!runId) return;
    await api.killRun(runId);
  };

  const run = runStore.currentRun;
  const steps = runStore.steps;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading run...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Run not found</div>
      </div>
    );
  }

  const costPercentage = Math.min((runStore.totalCost / runStore.costCeiling) * 100, 100);
  const isRunning = run.status === 'running' || run.status === 'paused_for_approval';

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/workflows/${workflowId}/edit`)} className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Run Inspector</h1>
              <p className="text-sm text-gray-500 font-mono">{run.id}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <StatusBadge status={run.status} />
            {isRunning && (
              <button
                onClick={handleKill}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
                Kill Run
              </button>
            )}
          </div>
        </div>

        {/* Spend Meter */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Spend</span>
                <span className="text-lg font-bold text-white">${runStore.totalCost.toFixed(4)}</span>
                <span className="text-sm text-gray-500">/ ${runStore.costCeiling.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Tokens</span>
                <span className="text-lg font-bold text-white">{runStore.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Steps</span>
                <span className="text-lg font-bold text-white">{steps.length}</span>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                costPercentage > 80 ? 'bg-red-500' : costPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${costPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">{costPercentage.toFixed(1)}% of ceiling</span>
            <span className="text-xs text-gray-500">Auto-kill at $0.50</span>
          </div>
        </div>

        {/* Steps Timeline */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Execution Trace</h2>
          
          {steps.length === 0 && isRunning && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <div className="animate-pulse text-gray-500">Waiting for steps...</div>
            </div>
          )}
          
          {steps.map((step, idx) => (
            <StepCard key={step.id} step={step} isLatest={idx === steps.length - 1 && isRunning} />
          ))}
          
          {run.status === 'paused_for_approval' && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-yellow-200 font-medium">Paused for Approval</p>
                <p className="text-sm text-yellow-400/70">Waiting for human review in the Approval Inbox</p>
              </div>
            </div>
          )}
          
          {run.status === 'killed' && (
            <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-200 font-medium">Run Killed</p>
                <p className="text-sm text-red-400/70">
                  {run.status === 'killed' ? 'Manually killed or exceeded limits' : 'Unknown reason'}
                </p>
              </div>
            </div>
          )}
          
          {run.status === 'completed' && (
            <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-green-200 font-medium">Run Completed</p>
                <p className="text-sm text-green-400/70">
                  {steps.length} steps • {runStore.totalTokens.toLocaleString()} tokens • ${runStore.totalCost.toFixed(4)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, isLatest }: { step: RunStep; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  
  const statusIcon = step.status === 'ok' ? (
    <CheckCircle className="w-4 h-4 text-green-400" />
  ) : step.status === 'error' ? (
    <XCircle className="w-4 h-4 text-red-400" />
  ) : (
    <AlertTriangle className="w-4 h-4 text-yellow-400" />
  );

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${
      isLatest ? 'border-violet-700 ring-1 ring-violet-700/30' : 'border-gray-800'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        {statusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Step {step.step_index + 1}</span>
            <span className="text-xs text-gray-500 font-mono">{step.node_id.slice(0, 8)}</span>
            {step.status === 'escalated' && (
              <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded">escalated</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{step.tokens_used}</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${step.cost_usd.toFixed(5)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{step.latency_ms}ms</span>
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Input</p>
            <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-auto max-h-40">
              {JSON.stringify(step.input, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Output</p>
            <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-auto max-h-40">
              {JSON.stringify(step.output, null, 2)}
            </pre>
          </div>
          {step.error_message && (
            <div>
              <p className="text-xs text-red-400 mb-1">Error</p>
              <p className="text-sm text-red-300">{step.error_message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    running: { color: 'bg-blue-900/50 text-blue-300 border-blue-700', label: 'Running' },
    paused_for_approval: { color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700', label: 'Paused' },
    completed: { color: 'bg-green-900/50 text-green-300 border-green-700', label: 'Completed' },
    failed: { color: 'bg-red-900/50 text-red-300 border-red-700', label: 'Failed' },
    killed: { color: 'bg-red-900/50 text-red-300 border-red-700', label: 'Killed' },
  };
  
  const { color, label } = config[status] || config.running;
  
  return (
    <span className={`text-xs px-3 py-1 rounded-full border ${color}`}>
      {status === 'running' && <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5 animate-pulse" />}
      {label}
    </span>
  );
}
