import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import ManagerLayout from './ManagerLayout';
import ManagerDashboard from './ManagerDashboard';
import ApprovalInbox from './ApprovalInbox';
import ApprovalDetails from './ApprovalDetails';
import TeamDealsView from './TeamDealsView';
import ApprovalHistoryView from './ApprovalHistoryView';
import ReportsView from '../reports/ReportsView';

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
export default function ManagerPortalWrapper() {
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
        <Route path="reports" element={<ReportsView />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </ManagerLayout>
  );
}
