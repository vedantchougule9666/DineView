import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock } from 'lucide-react';

export default function AdminLogin() {
  const { isAdmin, login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      login();
      navigate('/admin');
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 md:p-12 rounded-sm border border-border shadow-sm text-center">
        <div className="w-16 h-16 bg-border/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-6 h-6 text-text-primary" />
        </div>
        <h1 className="text-3xl font-serif text-text-primary mb-2">DineView Admin</h1>
        <p className="text-sm text-text-secondary mb-8">Please log in to access the restaurant dashboard.</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <input 
              type="password" 
              placeholder="Enter password (hint: 'admin')"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className={`w-full px-4 py-3 rounded-sm border outline-none transition-colors ${
                error ? 'border-red-500 bg-red-50/50' : 'border-border focus:border-text-secondary bg-transparent'
              }`}
            />
            {error && <p className="text-red-500 text-xs text-left mt-2 font-medium">Incorrect password.</p>}
          </div>
          <button 
            type="submit"
            className="w-full bg-text-primary text-white px-8 py-3.5 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors mt-2"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
