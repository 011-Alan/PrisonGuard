// Dynamic frontend configuration with environment fallbacks
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
export const WS_URL = (import.meta.env.VITE_WS_URL || API_BASE_URL).replace(/\/$/, '');
export const SIMULATOR_URL = (import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:5174').replace(/\/$/, '');
