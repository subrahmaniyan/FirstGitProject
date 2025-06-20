export const environment = {
  production: true,
  apiUrl: '/api',
  websocketUrl: window.location.origin,
  services: {
    transactionProcessor: '/api/transaction-processor',
    routingEngine: '/api/routing-engine',
    pspGateway: '/api/psp-gateway',
    managementApi: '/api/management',
    monitoring: '/api/monitoring'
  },
  features: {
    enableRealTimeUpdates: true,
    enableNotifications: true,
    enableAnalytics: true,
    enableDebugMode: false
  },
  security: {
    enableCSRF: true,
    tokenRefreshInterval: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 60 * 60 * 1000 // 1 hour
  }
};

