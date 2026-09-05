import React, { useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
  useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginView from './components/LoginView';

// Admin Portal Components
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import OrganizationView from './components/admin/OrganizationView';
import TeamManagement from './components/admin/TeamManagement';
import ProductCatalog from './components/admin/ProductCatalog';
import DiscountRulesView from './components/admin/DiscountRulesView';
import ApprovalRulesView from './components/admin/ApprovalRulesView';
import AuditActivityView from './components/admin/AuditActivityView';
import AdminActivityCenter from './components/admin/AdminActivityCenter';
import NotificationCenterView from './components/notifications/NotificationCenterView';
import AdminCustomersView from './components/admin/AdminCustomersView';
import WarehouseAdminView from './components/admin/WarehouseAdminView';

// Sales Representative Portal Components
import SalesLayout from './components/sales/SalesLayout';
import SalesDashboard from './components/sales/SalesDashboard';
import MyDealsView from './components/sales/MyDealsView';
import CPQStudio from './components/sales/CPQStudio';
import CustomersView from './components/sales/CustomersView';
import QuoteDetailsModal from './components/sales/QuoteDetailsModal';

// Sales Manager & Approver Portal Components
import ManagerLayout from './components/manager/ManagerLayout';
import ManagerDashboard from './components/manager/ManagerDashboard';
import ApprovalInbox from './components/manager/ApprovalInbox';
import ApprovalDetails from './components/manager/ApprovalDetails';
import TeamDealsView from './components/manager/TeamDealsView';
import ApprovalHistoryView from './components/manager/ApprovalHistoryView';

// Customer Deal Room & Negotiation Portal
import CustomerPortalWrapper from './components/customer/CustomerPortalWrapper';

// Finance & Operations Module
import FinancePortalWrapper from './components/finance/FinancePortalWrapper';

// Role Placeholder for Future Roles (Fallback)
import RolePortalPlaceholder from './components/portals/RolePortalPlaceholder';

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

/**
 * Multi-Tenant Admin Portal Router
 */
function AdminPortalWrapper() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[1] || 'dashboard';

  const handleSelectTab = (tab) => {
    navigate(`/admin/${tab}`);
  };

  return (
    <AdminLayout activeTab={activeTab} onSelectTab={handleSelectTab}>
      <Routes>
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard onNavigate={handleSelectTab} />} />
        <Route path="organization" element={<OrganizationView />} />
        <Route path="team" element={<TeamManagement />} />
        <Route path="customers" element={<AdminCustomersView />} />
        <Route path="products" element={<ProductCatalog />} />
        <Route path="discount-rules" element={<DiscountRulesView />} />
        <Route path="approval-rules" element={<ApprovalRulesView />} />
        <Route path="warehouses" element={<WarehouseAdminView />} />
        <Route path="activity" element={<AdminActivityCenter />} />
        <Route path="audit" element={<AdminActivityCenter />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
}

/**
 * Sales Representative Portal & CPQ Studio Router
 */
function SalesPortalWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [viewingQuoteId, setViewingQuoteId] = useState(null);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[1] || 'dashboard';

  const handleSelectTab = (tab) => {
    navigate(`/sales/${tab}`);
  };

  const handleNewQuote = () => {
    navigate('/sales/cpq');
  };

  const handleEditQuote = (id) => {
    navigate(`/sales/cpq?edit=${id}`);
  };

  return (
    <>
      <SalesLayout
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onNewQuote={handleNewQuote}
      >
        <Routes>
          <Route path="" element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <SalesDashboard
                onNavigateToCPQ={handleNewQuote}
                onNavigateToDeals={() => navigate('/sales/deals')}
                onViewQuote={(id) => setViewingQuoteId(id)}
              />
            }
          />
          <Route
            path="deals"
            element={
              <MyDealsView
                onOpenCPQForEdit={handleEditQuote}
                onNavigateToNewQuote={handleNewQuote}
                onViewQuote={(id) => setViewingQuoteId(id)}
              />
            }
          />
          <Route
            path="cpq"
            element={
              <CPQStudio
                key={searchParams.get('edit') || 'new'}
                editingQuoteId={searchParams.get('edit')}
                onSaved={() => {}}
                onSubmitted={() => navigate('/sales/deals')}
                onCancel={() => navigate('/sales/deals')}
              />
            }
          />
          <Route
            path="customers"
            element={
              <CustomersView
                onSelectCustomerForQuote={(custId) => navigate(`/sales/cpq?customer=${custId}`)}
              />
            }
          />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </SalesLayout>

      {viewingQuoteId && (
        <QuoteDetailsModal
          quoteId={viewingQuoteId}
          onClose={() => setViewingQuoteId(null)}
          onEditDraft={(id) => {
            setViewingQuoteId(null);
            handleEditQuote(id);
          }}
        />
      )}
    </>
  );
}

/**
 * ApprovalDetailsWrapper to extract :id param from URL
 */
function ApprovalDetailsWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <ApprovalDetails
      quoteId={id}
      onBack={() => navigate('/manager/approvals')}
      onActionCompleted={() => {
        navigate('/manager/approvals');
      }}
    />
  );
}

/**
 * Sales Manager & Approver Portal Router
 */
function ManagerPortalWrapper() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[1] || 'dashboard';

  const handleSelectTab = (tab) => {
    navigate(`/manager/${tab}`);
  };

  return (
    <ManagerLayout activeTab={activeTab} onSelectTab={handleSelectTab}>
      <Routes>
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <ManagerDashboard
              onNavigateToApprovals={() => navigate('/manager/approvals')}
              onNavigateToQuote={(id) => navigate(`/manager/approvals/${id}`)}
              onNavigateToDeals={() => navigate('/manager/deals')}
            />
          }
        />
        <Route
          path="approvals"
          element={
            <ApprovalInbox
              onSelectQuote={(id) => navigate(`/manager/approvals/${id}`)}
            />
          }
        />
        <Route path="approvals/:id" element={<ApprovalDetailsWrapper />} />
        <Route
          path="deals"
          element={
            <TeamDealsView
              onSelectQuote={(id) => navigate(`/manager/approvals/${id}`)}
            />
          }
        />
        <Route
          path="history"
          element={
            <ApprovalHistoryView
              onSelectQuote={(id) => navigate(`/manager/approvals/${id}`)}
            />
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </ManagerLayout>
  );
}

function DealFlowRoutes() {
  return (
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DealFlowRoutes />
    </AuthProvider>
  );
}
