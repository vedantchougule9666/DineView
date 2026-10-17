import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, QrCode, LogOut, UtensilsCrossed, Bell } from 'lucide-react';
import { useOrder } from '../../context/OrderContext';

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders } = useOrder();

  const isManagerAuth = typeof window !== 'undefined' && sessionStorage.getItem('dineview_manager_auth') === 'true';

  if (!isManagerAuth) {
    return <Navigate to="/manager/login" state={{ from: location }} replace />;
  }

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('dineview_manager_auth');
    } catch {}
    navigate('/manager/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-accent text-white rounded-md flex items-center justify-center font-serif font-bold text-lg shadow-xs">
                D
              </div>
              <div>
                <span className="font-serif font-bold text-text-primary text-base tracking-tight block leading-tight">
                  DineView
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-accent block leading-none">
                  Kitchen Manager Portal
                </span>
              </div>
            </div>

            <nav className="hidden sm:flex items-center gap-2 ms-4">
              <button
                onClick={() => navigate('/manager/orders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname.includes('/manager/orders') || location.pathname === '/manager'
                    ? 'bg-text-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-neutral-100'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Orders</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-mono font-bold animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/admin/tables')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-neutral-100 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Table QRs</span>
              </button>

              <button
                onClick={() => navigate('/admin/menu')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-neutral-100 transition-colors"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Menu Manager</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm text-xs font-bold">
                <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                <span>{pendingCount} Pending Confirmation</span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
