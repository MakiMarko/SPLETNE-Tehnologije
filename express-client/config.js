module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'kajdogaja-tajna-kljuc-2024',
  JWT_EXPIRES_IN: '24h',
  PORT: process.env.PORT || 3003,
  // OAuth 2.0
  OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID || 'kajdogaja-desktop',
  OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET || 'kajdogaja-oauth-secret-2024',
  ACCESS_TOKEN_EXPIRES: 3600,
  REFRESH_TOKEN_EXPIRES_DAYS: 30
};
