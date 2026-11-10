import { registerAs } from '@nestjs/config';

/**
 * Centralized, typed configuration loaded from environment variables.
 */
export default registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    isProd: nodeEnv === 'production',
    port: parseInt(process.env.PORT || '4000', 10),
    apiPrefix: process.env.API_PREFIX || 'api',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:4000/api',
    webUrl: process.env.WEB_URL || 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),

    databaseUrl: process.env.DATABASE_URL,

    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    },

    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },

    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

    mail: {
      driver: process.env.MAIL_DRIVER || 'log',
      host: process.env.MAIL_HOST || '',
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      user: process.env.MAIL_USER || '',
      password: process.env.MAIL_PASSWORD || '',
      from: process.env.MAIL_FROM || 'Mehfil <no-reply@joinmehfil.co>',
    },

    upload: {
      driver: process.env.UPLOAD_DRIVER || 'local',
      dir: process.env.UPLOAD_DIR || 'uploads',
      maxMb: parseInt(process.env.MAX_UPLOAD_MB || '200', 10),
    },

    payments: {
      provider: process.env.PAYMENT_PROVIDER || 'mock',
      platformFeePercent: parseInt(process.env.PLATFORM_FEE_PERCENT || '5', 10),
      defaultCurrency: process.env.DEFAULT_CURRENCY || 'PKR',
    },

    features: {
      enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
      enableAgeGate: process.env.ENABLE_AGE_GATE !== 'false',
      minAge: parseInt(process.env.MIN_AGE || '13', 10),
    },
  };
});
