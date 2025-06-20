export const environment = {
  production: false,
  apiUrl: 'http://localhost:3004/api',
  websocketUrl: 'http://localhost:3005',
  services: {
    transactionProcessor: 'http://localhost:3001',
    routingEngine: 'http://localhost:3002',
    pspGateway: 'http://localhost:3003',
    managementApi: 'http://localhost:3004',
    monitoring: 'http://localhost:3005'
  },
  features: {
    enableRealTimeUpdates: true,
    enableNotifications: true,
    enableAnalytics: true,
    enableDebugMode: true
  },
  security: {
    enableCSRF: true,
    tokenRefreshInterval: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 60 * 60 * 1000 // 1 hour
  }
};

