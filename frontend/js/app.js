/**
 * Payment Switch Application - Main JavaScript
 * 
 * This file contains the core application logic for the frontend
 * management interface.
 */

class PaymentSwitchApp {
    constructor() {
        this.apiBaseUrl = '/api';
        this.socket = null;
        this.currentSection = 'dashboard';
        this.isConnected = false;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        console.log('🚀 Payment Switch Application initializing...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
    }

    /**
     * Called when DOM is ready
     */
    onDOMReady() {
        console.log('📄 DOM ready, setting up application...');
        
        this.setupEventListeners();
        this.setupNavigation();
        this.initializeSocket();
        this.loadInitialData();
        
        console.log('✅ Application initialized successfully');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation clicks
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('[data-section]').dataset.section;
                this.navigateToSection(section);
            });
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Before unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Setup navigation system
     */
    setupNavigation() {
        // Get current section from URL hash or default to dashboard
        const hash = window.location.hash.substring(1);
        this.currentSection = hash || 'dashboard';
        
        // Show initial section
        this.showSection(this.currentSection);
        this.updateActiveNavigation(this.currentSection);
    }

    /**
     * Navigate to a specific section
     */
    navigateToSection(section) {
        if (section === this.currentSection) return;
        
        console.log(`🧭 Navigating to section: ${section}`);
        
        this.currentSection = section;
        this.showSection(section);
        this.updateActiveNavigation(section);
        
        // Update URL hash
        window.location.hash = section;
        
        // Load section-specific data
        this.loadSectionData(section);
    }

    /**
     * Show specific section and hide others
     */
    showSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(el => {
            el.classList.add('d-none');
        });
        
        // Show target section
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.remove('d-none');
            targetSection.classList.add('fade-in');
        }
    }

    /**
     * Update active navigation item
     */
    updateActiveNavigation(section) {
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to current section
        const activeLink = document.querySelector(`[data-section="${section}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Initialize WebSocket connection
     */
    initializeSocket() {
        try {
            console.log('🔌 Initializing WebSocket connection...');
            
            this.socket = io({
                transports: ['websocket', 'polling'],
                timeout: 5000,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('❌ WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
            });

            this.socket.on('transaction-update', (data) => {
                this.handleTransactionUpdate(data);
            });

            this.socket.on('system-alert', (alert) => {
                this.handleSystemAlert(alert);
            });

            this.socket.on('metrics-update', (metrics) => {
                this.handleMetricsUpdate(metrics);
            });

        } catch (error) {
            console.error('❌ Failed to initialize WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(connected) {
        const indicators = document.querySelectorAll('.status-indicator');
        indicators.forEach(indicator => {
            if (connected) {
                indicator.classList.remove('status-offline');
                indicator.classList.add('status-online');
            } else {
                indicator.classList.remove('status-online');
                indicator.classList.add('status-offline');
            }
        });
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        console.log('📊 Loading initial data...');
        
        try {
            // Load dashboard data by default
            await this.loadSectionData('dashboard');
            
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.showError('Failed to load application data');
        }
    }

    /**
     * Load data for specific section
     */
    async loadSectionData(section) {
        console.log(`📊 Loading data for section: ${section}`);
        
        try {
            switch (section) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'transactions':
                    await this.loadTransactionsData();
                    break;
                case 'routing':
                    await this.loadRoutingData();
                    break;
                case 'psps':
                    await this.loadPSPData();
                    break;
                case 'monitoring':
                    await this.loadMonitoringData();
                    break;
                case 'settings':
                    await this.loadSettingsData();
                    break;
                default:
                    console.warn(`Unknown section: ${section}`);
            }
        } catch (error) {
            console.error(`❌ Failed to load data for section ${section}:`, error);
            this.showError(`Failed to load ${section} data`);
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        // This will be implemented with actual API calls
        console.log('📊 Loading dashboard data...');
        
        // For now, initialize charts with sample data
        if (typeof window.dashboardManager !== 'undefined') {
            window.dashboardManager.initializeCharts();
        }
    }

    /**
     * Load transactions data
     */
    async loadTransactionsData() {
        console.log('💳 Loading transactions data...');
        
        // This will be implemented with actual API calls
        if (typeof window.transactionMonitor !== 'undefined') {
            window.transactionMonitor.loadTransactions();
        }
    }

    /**
     * Load routing data
     */
    async loadRoutingData() {
        console.log('🛣️ Loading routing data...');
        // To be implemented in Phase 2
    }

    /**
     * Load PSP data
     */
    async loadPSPData() {
        console.log('🏢 Loading PSP data...');
        // To be implemented in Phase 2
    }

    /**
     * Load monitoring data
     */
    async loadMonitoringData() {
        console.log('📈 Loading monitoring data...');
        // To be implemented in Phase 2
    }

    /**
     * Load settings data
     */
    async loadSettingsData() {
        console.log('⚙️ Loading settings data...');
        // To be implemented in Phase 2
    }

    /**
     * Handle transaction updates from WebSocket
     */
    handleTransactionUpdate(data) {
        console.log('💳 Transaction update received:', data);
        
        // Update dashboard metrics
        if (this.currentSection === 'dashboard' && window.dashboardManager) {
            window.dashboardManager.updateMetrics(data);
        }
        
        // Update transaction list
        if (this.currentSection === 'transactions' && window.transactionMonitor) {
            window.transactionMonitor.updateTransaction(data);
        }
    }

    /**
     * Handle system alerts
     */
    handleSystemAlert(alert) {
        console.log('🚨 System alert received:', alert);
        
        this.showAlert(alert.message, alert.type || 'info');
    }

    /**
     * Handle metrics updates
     */
    handleMetricsUpdate(metrics) {
        console.log('📊 Metrics update received:', metrics);
        
        if (this.currentSection === 'dashboard' && window.dashboardManager) {
            window.dashboardManager.updateCharts(metrics);
        }
    }

    /**
     * Show alert message
     */
    showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class="fas fa-info-circle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Find or create alert container
        let alertContainer = document.getElementById('alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alert-container';
            alertContainer.className = 'position-fixed top-0 end-0 p-3';
            alertContainer.style.zIndex = '9999';
            document.body.appendChild(alertContainer);
        }
        
        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const alerts = alertContainer.querySelectorAll('.alert');
            if (alerts.length > 0) {
                alerts[0].remove();
            }
        }, 5000);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showAlert(message, 'danger');
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Resize charts if they exist
        if (window.dashboardManager && window.dashboardManager.charts) {
            Object.values(window.dashboardManager.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    /**
     * Make API request
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${url}`, error);
            throw error;
        }
    }

    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Format date
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    /**
     * Get status badge HTML
     */
    getStatusBadge(status) {
        const statusClasses = {
            'PENDING': 'status-pending',
            'PROCESSING': 'status-processing',
            'APPROVED': 'status-approved',
            'DECLINED': 'status-declined',
            'FAILED': 'status-failed'
        };
        
        const className = statusClasses[status] || 'status-pending';
        return `<span class="status-badge ${className}">${status}</span>`;
    }
}

// Initialize the application when the script loads
window.paymentSwitchApp = new PaymentSwitchApp();

// Global utility functions
window.filterTransactions = function() {
    if (window.transactionMonitor) {
        window.transactionMonitor.applyFilters();
    }
};

window.exportTransactions = function() {
    if (window.transactionMonitor) {
        window.transactionMonitor.exportData();
    }
};

console.log('✅ Payment Switch Application script loaded');

