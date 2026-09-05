import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import FinanceLayout from './FinanceLayout';
import FinanceDashboard from './FinanceDashboard';
import FulfillmentView from './FulfillmentView';
import FulfillmentDetail from './FulfillmentDetail';
import InvoicesView from './InvoicesView';
import InvoiceDetail from './InvoiceDetail';
import PaymentsView from './PaymentsView';
import SubscriptionsView from './SubscriptionsView';
import WarehousesView from './WarehousesView';
import ApprovalInbox from '../manager/ApprovalInbox';
import ApprovalDetails from '../manager/ApprovalDetails';

function FulfillmentDetailRoute({ onNavigate, onBack }) {
  const { id } = useParams();
  return <FulfillmentDetail quotationId={id} onNavigate={onNavigate} onBack={onBack} />;
}

function InvoiceDetailRoute({ onBack }) {
  const { id } = useParams();
  return <InvoiceDetail invoiceId={id} onBack={onBack} />;
}

function FinanceApprovalDetailsRoute({ onBack }) {
  const { id } = useParams();
  return (
    <ApprovalDetails
      quoteId={id}
      apiBase="/api/finance"
      onBack={onBack}
      onActionCompleted={onBack}
    />
  );
}

export default function FinancePortalWrapper() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[1] || 'dashboard';

  const handleSelectTab = (tab) => {
    navigate(`/finance/${tab}`);
  };

  const handleNavigate = (tab, id) => {
    if (id) {
      if (tab === 'fulfillment-detail' || tab === 'fulfillment') {
        navigate(`/finance/fulfillment/${id}`);
      } else if (tab === 'invoice-detail' || tab === 'invoices') {
        navigate(`/finance/invoices/${id}`);
      } else {
        navigate(`/finance/${tab}/${id}`);
      }
    } else {
      navigate(`/finance/${tab}`);
    }
  };

  return (
    <FinanceLayout activeTab={activeTab} onSelectTab={handleSelectTab}>
      <Routes>
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<FinanceDashboard onNavigate={handleNavigate} />} />
        <Route
          path="approvals"
          element={
            <ApprovalInbox
              apiBase="/api/finance"
              title="Finance Approval Inbox"
              onSelectQuote={(id) => navigate(`/finance/approvals/${id}`)}
            />
          }
        />
        <Route
          path="approvals/:id"
          element={<FinanceApprovalDetailsRoute onBack={() => navigate('/finance/approvals')} />}
        />
        <Route path="fulfillment" element={<FulfillmentView onNavigate={handleNavigate} />} />
        <Route
          path="fulfillment/:id"
          element={<FulfillmentDetailRoute onNavigate={handleNavigate} onBack={() => navigate('/finance/fulfillment')} />}
        />
        <Route
          path="fulfillment-detail/:id"
          element={<FulfillmentDetailRoute onNavigate={handleNavigate} onBack={() => navigate('/finance/fulfillment')} />}
        />
        <Route path="invoices" element={<InvoicesView onNavigate={handleNavigate} />} />
        <Route
          path="invoices/:id"
          element={<InvoiceDetailRoute onBack={() => navigate('/finance/invoices')} />}
        />
        <Route
          path="invoice-detail/:id"
          element={<InvoiceDetailRoute onBack={() => navigate('/finance/invoices')} />}
        />
        <Route path="payments" element={<PaymentsView onNavigate={handleNavigate} />} />
        <Route path="subscriptions" element={<SubscriptionsView onNavigate={handleNavigate} />} />
        <Route path="warehouses" element={<WarehousesView />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </FinanceLayout>
  );
}
