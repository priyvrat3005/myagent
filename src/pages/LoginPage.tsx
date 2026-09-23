import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { Boxes } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate('/workflows');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Boxes className="w-10 h-10 text-violet-400" />
            <h1 className="text-3xl font-bold text-white">SwarmBlocks</h1>
          </div>
          <p className="text-gray-400">AI Studio — Visual Agent Workflow Builder</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-8 space-y-4">
          <h2 className="text-xl font-semibold text-white">{isRegister ? 'Create Account' : 'Sign In'}</h2>
          
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
          
          <p className="text-center text-sm text-gray-500">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-violet-400 hover:text-violet-300"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        </form>
        
        <p className="text-center text-xs text-gray-600 mt-6">
          Demo mode — any email/password works
        </p>
      </div>
    </div>
  );
}
