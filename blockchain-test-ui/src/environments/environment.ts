export const environment = {
  production: false,

  /**
   * Use Angular proxy.
   * proxy.conf.json should forward /api/v1 to:
   * http://172.31.13.90:3001/api/v1
   */
  apiBaseUrl: '/api/v1',

  /**
   * IMPORTANT:
   * Replace this value with the active API key from backend .env.
   * Do not commit production API keys to Git.
   */
  fabricApiKey: '774101c2e4e6e8d46a8bb6c02571f0239ac7c8bd548c22db1162671e502278f7'
};