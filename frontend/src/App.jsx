import React, { Suspense, lazy } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginView from './components/LoginView';

// Role Placeholder for Future Roles (Fallback)
import RolePortalPlaceholder from './components/portals/RolePortalPlaceholder';
import NotificationCenterView from './components/notifications/NotificationCenterView';

// Each role portal is its own lazy-loaded chunk — a user only ever downloads
// the JS for the one role they log in as, instead of all five bundled together.
const AdminPortalWrapper = lazy(() => import('./components/admin/AdminPortalWrapper'));
const SalesPortalWrapper = lazy(() => import('./components/sales/SalesPortalWrapper'));
const ManagerPortalWrapper = lazy(() => import('./components/manager/ManagerPortalWrapper'));
const CustomerPortalWrapper = lazy(() => import('./components/customer/CustomerPortalWrapper'));
const FinancePortalWrapper = lazy(() => import('./components/finance/FinancePortalWrapper'));

function PortalLoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading workspace...</p>
      </div>
    </div>
  );
}

/**
 * Route protection: requires authentication and matching role
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Connecting to DealFlow360...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'SALES_MANAGER') return <Navigate to="/manager/dashboard" replace />;
    if (user.role === 'SALES_REP') return <Navigate to="/sales/dashboard" replace />;
    if (user.role === 'CUSTOMER') return <Navigate to="/customer" replace />;
    if (user.role === 'FINANCE_OPERATIONS') return <Navigate to="/finance/dashboard" replace />;
    return <Navigate to="/finance/dashboard" replace />;
  }

  return children;
}

/**
 * Public authentication route: redirects if already logged in
 */
function PublicAuthRoute({ defaultView }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Connecting to DealFlow360...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'SALES_MANAGER') return <Navigate to="/manager/dashboard" replace />;
    if (user.role === 'SALES_REP') return <Navigate to="/sales/dashboard" replace />;
    if (user.role === 'CUSTOMER') return <Navigate to="/customer" replace />;
    if (user.role === 'FINANCE_OPERATIONS') return <Navigate to="/finance/dashboard" replace />;
    return <Navigate to="/finance/dashboard" replace />;
  }

  return <LoginView defaultView={defaultView} />;
}

/**
 * Root redirect based on role
 */
function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Connecting to DealFlow360...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'SALES_MANAGER') return <Navigate to="/manager/dashboard" replace />;
  if (user.role === 'SALES_REP') return <Navigate to="/sales/dashboard" replace />;
  if (user.role === 'CUSTOMER') return <Navigate to="/customer" replace />;
  if (user.role === 'FINANCE_OPERATIONS') return <Navigate to="/finance/dashboard" replace />;
  return <Navigate to="/finance/dashboard" replace />;
}

function DealFlowRoutes() {
  return (
    <Suspense fallback={<PortalLoadingFallback />}>
    <Routes>
      {/* Root redirect based on auth & role */}
      <Route path="/" element={<RootRedirect />} />

      {/* Authentication and Registration Routes */}
      <Route path="/login" element={<PublicAuthRoute defaultView="login" />} />
      <Route path="/signup" element={<PublicAuthRoute defaultView="register-customer" />} />
      <Route path="/register-customer" element={<PublicAuthRoute defaultView="register-customer" />} />
      <Route path="/register-organization" element={<PublicAuthRoute defaultView="register-org" />} />
      <Route path="/register-org" element={<PublicAuthRoute defaultView="register-org" />} />

      {/* Admin Portal (Admin Only) */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminPortalWrapper />
          </ProtectedRoute>
        }
      />

      {/* Sales Representative Portal (Sales Rep Only) */}
      <Route
        path="/sales/*"
        element={
          <ProtectedRoute allowedRoles={['SALES_REP']}>
            <SalesPortalWrapper />
          </ProtectedRoute>
        }
      />

      {/* Sales Manager / Approver Portal (Sales Manager & Admin) */}
      <Route
        path="/manager/*"
        element={
          <ProtectedRoute allowedRoles={['SALES_MANAGER', 'ADMIN']}>
            <ManagerPortalWrapper />
          </ProtectedRoute>
        }
      />

      {/* Customer Deal Room & Negotiation Portal */}
      <Route
        path="/customer/*"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CustomerPortalWrapper />
          </ProtectedRoute>
        }
      />

      {/* Finance & Operations Portal */}
      <Route
        path="/finance/*"
        element={
          <ProtectedRoute allowedRoles={['FINANCE_OPERATIONS', 'ADMIN']}>
            <FinancePortalWrapper />
          </ProtectedRoute>
        }
      />

      {/* Notifications Center */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationCenterView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/notifications"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <NotificationCenterView />
          </ProtectedRoute>
        }
      />

      {/* Fallback Legacy Portal Route */}
      <Route
        path="/portal/*"
        element={
          <ProtectedRoute>
            <RolePortalPlaceholder />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DealFlowRoutes />
    </AuthProvider>
  );
}
