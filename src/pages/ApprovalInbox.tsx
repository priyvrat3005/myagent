import { useState, useEffect } from 'react';
import * as api from '../api/mock';
import type { Approval } from '../types';
import { CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';

export default function ApprovalInbox() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApprovals();
    // Poll for new approvals
    const interval = setInterval(loadApprovals, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadApprovals = async () => {
    const pending = await api.getPendingApprovals();
    setApprovals(pending);
    setLoading(false);
  };

  const handleResolve = async (approvalId: string, runId: string, decision: 'approve' | 'reject') => {
    await api.resolveApproval(runId, approvalId, decision);
    setApprovals(approvals.filter(a => a.id !== approvalId));
  };

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl font-bold text-white">Approval Inbox</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Review and approve/reject actions that require human confirmation
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-gray-400 text-lg mb-2">All clear</h3>
            <p className="text-gray-600 text-sm">No pending approvals. Actions requiring human review will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={() => handleResolve(approval.id, approval.run_id, 'approve')}
                onReject={() => handleResolve(approval.id, approval.run_id, 'reject')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({ approval, onApprove, onReject }: {
  approval: Approval;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-gray-900 border border-yellow-800/50 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400" />
        <div>
          <p className="text-white font-medium">Approval Required</p>
          <p className="text-xs text-gray-500 font-mono">Run: {approval.run_id.slice(0, 8)}... • Node: {approval.node_id.slice(0, 8)}...</p>
        </div>
      </div>
      
      <div className="p-4">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Confirm Intent</p>
        <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-auto">
          {JSON.stringify(approval.confirm_intent, null, 2)}
        </pre>
      </div>
      
      <div className="p-4 border-t border-gray-800 flex items-center gap-3 justify-end">
        <button
          onClick={onReject}
          className="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-300 px-4 py-2 rounded-lg transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Reject
        </button>
        <button
          onClick={onApprove}
          className="flex items-center gap-2 bg-green-900/30 hover:bg-green-900/50 border border-green-800 text-green-300 px-4 py-2 rounded-lg transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Approve
        </button>
      </div>
    </div>
  );
}
