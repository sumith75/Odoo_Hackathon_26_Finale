import React, { useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import CustomerLayout from './CustomerLayout';
import CustomerDashboard from './CustomerDashboard';
import CustomerQuotesList from './CustomerQuotesList';
import CustomerDealRoom from './CustomerDealRoom';

function DealRoomWrapper({ initialNegotiate = false, initialConfirm = false }) {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CustomerDealRoom
      quoteId={id}
      onBack={() => navigate('/customer/quotes')}
      initialNegotiate={initialNegotiate}
      initialConfirm={initialConfirm}
    />
  );
}

function QuotesListWrapper() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const statusParam = searchParams.get('status') || 'ALL';

  return (
    <CustomerQuotesList
      initialStatus={statusParam}
      onOpenQuote={(id) => navigate(`/customer/quotes/${id}`)}
    />
  );
}

function DashboardWrapper() {
  const navigate = useNavigate();

  return (
    <CustomerDashboard
      onOpenQuote={(id) => navigate(`/customer/quotes/${id}`)}
      onViewAllQuotes={() => navigate('/customer/quotes')}
    />
  );
}

export default function CustomerPortalWrapper() {
  const navigate = useNavigate();

  // Resolve active tab from current pathname
  const pathname = window.location.pathname;
  let activeTab = 'dashboard';
  if (pathname.includes('/quotes')) activeTab = 'quotes';
  if (window.location.search.includes('status=UNDER_NEGOTIATION')) activeTab = 'negotiations';
  if (window.location.search.includes('status=CONFIRMED')) activeTab = 'confirmed';

  const handleSelectTab = (tabId) => {
    if (tabId === 'dashboard') navigate('/customer/dashboard');
    else if (tabId === 'quotes') navigate('/customer/quotes');
    else if (tabId === 'negotiations') navigate('/customer/quotes?status=UNDER_NEGOTIATION');
    else if (tabId === 'confirmed') navigate('/customer/quotes?status=CONFIRMED');
  };

  return (
    <CustomerLayout activeTab={activeTab} onSelectTab={handleSelectTab}>
      <Routes>
        <Route path="dashboard" element={<DashboardWrapper />} />
        <Route path="quotes" element={<QuotesListWrapper />} />
        <Route path="quotes/:id" element={<DealRoomWrapper />} />
        <Route path="quotes/:id/negotiate" element={<DealRoomWrapper initialNegotiate={true} />} />
        <Route path="quotes/:id/confirm" element={<DealRoomWrapper initialConfirm={true} />} />
        <Route path="*" element={<Navigate to="/customer/dashboard" replace />} />
      </Routes>
    </CustomerLayout>
  );
}
