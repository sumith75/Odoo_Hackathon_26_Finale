import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import OrganizationView from './OrganizationView';
import TeamManagement from './TeamManagement';
import ProductCatalog from './ProductCatalog';
import DiscountRulesView from './DiscountRulesView';
import ApprovalRulesView from './ApprovalRulesView';
import AdminActivityCenter from './AdminActivityCenter';
import AdminCustomersView from './AdminCustomersView';
import WarehouseAdminView from './WarehouseAdminView';
import ReportsView from '../reports/ReportsView';

/**
 * Multi-Tenant Admin Portal Router
 */
export default function AdminPortalWrapper() {
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
        <Route path="reports" element={<ReportsView />} />
        <Route path="activity" element={<AdminActivityCenter />} />
        <Route path="audit" element={<AdminActivityCenter />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
}
