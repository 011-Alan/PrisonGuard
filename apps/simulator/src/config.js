// Dynamic frontend configuration with environment fallbacks
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
export const WS_URL = (import.meta.env.VITE_WS_URL || API_BASE_URL).replace(/\/$/, '');
export const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');
