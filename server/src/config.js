import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'prisonguard_academic_jwt_secret_key_2026',
  dataStorePath: process.env.DATA_STORE_PATH || path.resolve(process.cwd(), 'data', 'prisonguard_store.json'),
  
  // Specific Origins
  adminOrigin: process.env.ADMIN_ORIGIN ? process.env.ADMIN_ORIGIN.replace(/\/$/, '') : 'http://localhost:5173',
  simulatorOrigin: process.env.SIMULATOR_ORIGIN ? process.env.SIMULATOR_ORIGIN.replace(/\/$/, '') : 'http://localhost:5174',

  // Computed Allowed Origins list for CORS and Socket.IO
  getAllowedOrigins() {
    const defaultDevOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174'
    ];

    const envOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ''))
      : [];

    const specificOrigins = [this.adminOrigin, this.simulatorOrigin].filter(Boolean);

    // Merge and deduplicate
    const combined = Array.from(new Set([
      ...(this.nodeEnv === 'development' ? defaultDevOrigins : []),
      ...envOrigins,
      ...specificOrigins
    ]));

    return combined;
  },

  validate() {
    const warnings = [];
    const errors = [];

    if (this.nodeEnv === 'production') {
      if (this.jwtSecret === 'prisonguard_academic_jwt_secret_key_2026') {
        warnings.push('CRITICAL SECURITY: Default JWT_SECRET is active in production mode! Set a strong random secret.');
      }
      if (!process.env.ALLOWED_ORIGINS && !process.env.ADMIN_ORIGIN) {
        warnings.push('CORS WARNING: No production ALLOWED_ORIGINS specified. Setting explicit frontend origins is required.');
      }
    }

    return { warnings, errors };
  }
};
