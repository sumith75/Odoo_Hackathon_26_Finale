// Centralized API client for DealFlow360 frontend

// When an authenticated request comes back 401, the session token is no
// longer valid (expired/revoked) — clear it and bounce to login instead of
// letting every screen show its own generic "failed to connect" error.
function handleSessionExpired() {
  localStorage.removeItem('df360_token');
  localStorage.removeItem('df360_user');
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('df360_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Only treat this as an expired session when we actually sent a token —
    // a 401 on the login endpoint itself just means wrong credentials.
    if (response.status === 401 && token) {
      handleSessionExpired();
    }

    const errorMsg = data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
