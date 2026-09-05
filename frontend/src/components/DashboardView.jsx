import React from 'react';
import AdminDashboard from './admin/AdminDashboard';

/**
 * DashboardView — Database-backed Analytics Dashboard
 * Replaces legacy static mock metrics with live PostgreSQL telemetry from /api/admin/dashboard
 */
export default function DashboardView() {
  return (
    <div className="space-y-6">
      <AdminDashboard onNavigate={() => {}} />
    </div>
  );
}
