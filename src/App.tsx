import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { MenuProvider } from './context/MenuContext';
import { LanguageProvider } from './context/LanguageContext';
import { TableProvider } from './context/TableContext';

// Keep the critical path for the initial customer load synchronous
import CustomerLayout from './pages/customer/CustomerLayout';
import HomePage from './pages/customer/HomePage';

// Lazy-load other customer pages
const ItemDetailsPage = React.lazy(() => import('./pages/customer/ItemDetailsPage'));
const CartPage = React.lazy(() => import('./pages/customer/CartPage'));
const OrderStatusPage = React.lazy(() => import('./pages/customer/OrderStatusPage'));

// Lazy-load all Admin pages (keeps admin code out of customer bundle)
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout'));
const AdminLogin = React.lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const MenuManager = React.lazy(() => import('./pages/admin/MenuManager'));
const OrderManager = React.lazy(() => import('./pages/admin/OrderManager'));
const TableManager = React.lazy(() => import('./pages/admin/TableManager'));

const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-bg-primary">
    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Let the application handle route scroll restoration deterministically
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TableProvider>
          <LanguageProvider>
            <MenuProvider>
              <OrderProvider>
                <CartProvider>
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      {/* Customer Routes */}
                      <Route path="/" element={<CustomerLayout />}>
                        <Route index element={<HomePage />} />
                        <Route path="menu" element={<HomePage />} />
                        <Route path="gallery" element={<Navigate to="/" replace />} />
                        <Route path="locations" element={<HomePage />} />
                        <Route path="item/:id" element={<ItemDetailsPage />} />
                        <Route path="cart" element={<CartPage />} />
                        <Route path="order/:id" element={<OrderStatusPage />} />
                      </Route>

                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route path="login" element={<AdminLogin />} />
                        <Route index element={<AdminDashboard />} />
                        <Route path="menu" element={<MenuManager />} />
                        <Route path="orders" element={<OrderManager />} />
                        <Route path="tables" element={<TableManager />} />
                      </Route>

                      {/* Catch-all fallback */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </CartProvider>
              </OrderProvider>
            </MenuProvider>
          </LanguageProvider>
        </TableProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
