import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { LayoutDashboard, GitBranch, CheckSquare, FlaskConical, LogOut, Boxes } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-violet-400" />
            <h1 className="text-lg font-bold text-white">SwarmBlocks</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">AI Studio</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/workflows"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-violet-600/20 text-violet-300' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Workflows
          </NavLink>
          
          <NavLink
            to="/approvals"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-violet-600/20 text-violet-300' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <CheckSquare className="w-4 h-4" />
            Approval Inbox
          </NavLink>
          
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 cursor-not-allowed" title="Coming soon in swarm layer">
            <GitBranch className="w-4 h-4" />
            Swarm Canvas
            <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">soon</span>
          </div>
        </nav>
        
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="text-gray-300 truncate">{user?.email}</p>
              <p className="text-xs text-gray-500">editor</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
