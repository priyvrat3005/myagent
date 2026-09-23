import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import WorkflowsPage from './pages/WorkflowsPage';
import WorkflowEditor from './pages/WorkflowEditor';
import RunInspector from './pages/RunInspector';
import ApprovalInbox from './pages/ApprovalInbox';
import EvalSetsPage from './pages/EvalSetsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/workflows" replace />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/:id/edit" element={<WorkflowEditor />} />
          <Route path="workflows/:id/runs/:runId" element={<RunInspector />} />
          <Route path="approvals" element={<ApprovalInbox />} />
          <Route path="eval-sets/:workflowId" element={<EvalSetsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
