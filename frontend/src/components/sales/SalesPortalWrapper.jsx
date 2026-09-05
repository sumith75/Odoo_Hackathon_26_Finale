import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import SalesLayout from './SalesLayout';
import SalesDashboard from './SalesDashboard';
import MyDealsView from './MyDealsView';
import CPQStudio from './CPQStudio';
import CustomersView from './CustomersView';
import QuoteDetailsModal from './QuoteDetailsModal';
import ReportsView from '../reports/ReportsView';

/**
 * Sales Representative Portal & CPQ Studio Router
 */
export default function SalesPortalWrapper() {
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
          <Route path="reports" element={<ReportsView />} />
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
