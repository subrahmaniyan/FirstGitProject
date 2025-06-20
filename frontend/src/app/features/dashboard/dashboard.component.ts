import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';

import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgbModule],
  template: `
    <div class="dashboard-container">
      <!-- Page Header -->
      <div class="row mb-4">
        <div class="col-12">
          <h2><i class="fas fa-tachometer-alt me-2"></i>Dashboard</h2>
          <p class="text-muted">Real-time overview of payment switch operations</p>
        </div>
      </div>

      <!-- Key Metrics Cards -->
      <div class="row mb-4">
        <div class="col-md-3 mb-3">
          <div class="card metric-card bg-primary text-white">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="metric-value">{{ metrics.totalVolume | currency }}</div>
                  <div class="metric-label">Total Volume Today</div>
                </div>
                <div class="metric-icon">
                  <i class="fas fa-dollar-sign"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-3 mb-3">
          <div class="card metric-card bg-success text-white">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="metric-value">{{ metrics.successfulTransactions }}</div>
                  <div class="metric-label">Successful Transactions</div>
                </div>
                <div class="metric-icon">
                  <i class="fas fa-check-circle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-3 mb-3">
          <div class="card metric-card bg-warning text-white">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="metric-value">{{ metrics.failedTransactions }}</div>
                  <div class="metric-label">Failed Transactions</div>
                </div>
                <div class="metric-icon">
                  <i class="fas fa-exclamation-triangle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-3 mb-3">
          <div class="card metric-card bg-info text-white">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="metric-value">{{ metrics.systemUptime }}%</div>
                  <div class="metric-label">System Uptime</div>
                </div>
                <div class="metric-icon">
                  <i class="fas fa-server"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="row mb-4">
        <div class="col-md-8 mb-3">
          <div class="card">
            <div class="card-header">
              <h5><i class="fas fa-chart-line me-2"></i>Transaction Volume (24h)</h5>
            </div>
            <div class="card-body">
              <div class="chart-container">
                <canvas id="volumeChart"></canvas>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4 mb-3">
          <div class="card">
            <div class="card-header">
              <h5><i class="fas fa-chart-pie me-2"></i>PSP Distribution</h5>
            </div>
            <div class="card-body">
              <div class="chart-container">
                <canvas id="pspChart"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Status -->
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h5><i class="fas fa-heartbeat me-2"></i>System Status</h5>
            </div>
            <div class="card-body">
              <div class="row text-center">
                <div class="col-md-2 mb-3" *ngFor="let service of systemServices">
                  <div class="service-status">
                    <div 
                      class="status-indicator mx-auto mb-2"
                      [class.status-online]="service.status === 'online'"
                      [class.status-offline]="service.status === 'offline'"
                      [class.status-warning]="service.status === 'warning'">
                    </div>
                    <small class="text-muted">{{ service.name }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      animation: fadeIn 0.5s ease-in;
    }

    .metric-card .card-body {
      padding: 1.5rem;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .metric-label {
      font-size: 0.875rem;
      font-weight: 500;
      opacity: 0.9;
    }

    .metric-icon {
      font-size: 2.5rem;
      opacity: 0.7;
    }

    .chart-container {
      position: relative;
      height: 300px;
      width: 100%;
    }

    .service-status {
      padding: 1rem;
    }

    .status-indicator {
      width: 20px;
      height: 20px;
      border-radius: 50%;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .metric-value {
        font-size: 1.5rem;
      }

      .metric-icon {
        font-size: 2rem;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  metrics = {
    totalVolume: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    systemUptime: 99.9
  };

  systemServices = [
    { name: 'Transaction Processor', status: 'online' },
    { name: 'Routing Engine', status: 'online' },
    { name: 'PSP Gateway', status: 'online' },
    { name: 'Database', status: 'online' },
    { name: 'Redis Cache', status: 'online' },
    { name: 'Node-RED', status: 'online' }
  ];

  private destroy$ = new Subject<void>();

  constructor(private webSocketService: WebSocketService) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.subscribeToUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    // Load initial dashboard data
    // This will be replaced with actual API calls in Phase 2
    console.log('Loading dashboard data...');
  }

  private subscribeToUpdates(): void {
    this.webSocketService.getMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        if (message) {
          switch (message.type) {
            case 'metrics-update':
              this.updateMetrics(message.data);
              break;
            case 'health-update':
              this.updateSystemStatus(message.data);
              break;
          }
        }
      });
  }

  private updateMetrics(data: any): void {
    if (data.metrics) {
      this.metrics = { ...this.metrics, ...data.metrics };
    }
  }

  private updateSystemStatus(data: any): void {
    if (data.services) {
      this.systemServices = data.services;
    }
  }
}

