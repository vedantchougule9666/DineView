import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, LayoutDashboard, UtensilsCrossed, ClipboardList, QrCode } from 'lucide-react';

export default function AdminLayout() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If not admin, and we are not on the login page (handled by routes), we'd redirect.
  // Actually, we should protect the nested routes, but let's do it simply here.
  const isLoginPage = location.pathname === '/admin/login';

  if (!isAdmin && !isLoginPage) {
    return <Navigate to="/admin/login" replace />;
  }

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-border flex flex-col fixed inset-y-0 z-10">
        <div className="h-20 flex items-center px-8 border-b border-border">
          <span className="text-xl font-serif tracking-tight font-bold">DineView Admin</span>
        </div>
        <nav className="flex-1 py-8 px-4 flex flex-col gap-2">
          <button 
            onClick={() => navigate('/admin')}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-colors ${
              location.pathname === '/admin' ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-border/30 hover:text-text-primary'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => navigate('/admin/orders')}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-colors ${
              location.pathname === '/admin/orders' ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-border/30 hover:text-text-primary'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Orders
          </button>
          <button 
            onClick={() => navigate('/admin/tables')}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-colors ${
              location.pathname === '/admin/tables' ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-border/30 hover:text-text-primary'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Tables & QRs
          </button>
          <button 
            onClick={() => navigate('/admin/menu')}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-colors ${
              location.pathname === '/admin/menu' ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-border/30 hover:text-text-primary'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Menu
          </button>
        </nav>
        <div className="p-4 border-t border-border">
          <button 
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-sm text-sm font-medium text-text-muted hover:bg-border/30 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}
