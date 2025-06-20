import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';

import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, NgbModule],
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container-fluid">
        <!-- Brand -->
        <a class="navbar-brand" routerLink="/dashboard">
          <i class="fas fa-credit-card me-2"></i>
          Payment Switch
        </a>

        <!-- Mobile Toggle -->
        <button 
          class="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
          aria-controls="navbarNav" 
          aria-expanded="false" 
          aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Navigation Links -->
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" routerLink="/dashboard" routerLinkActive="active">
                <i class="fas fa-tachometer-alt me-1"></i>Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/transactions" routerLinkActive="active">
                <i class="fas fa-exchange-alt me-1"></i>Transactions
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/routing" routerLinkActive="active">
                <i class="fas fa-route me-1"></i>Routing
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/psps" routerLinkActive="active">
                <i class="fas fa-building me-1"></i>PSPs
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/monitoring" routerLinkActive="active">
                <i class="fas fa-chart-line me-1"></i>Monitoring
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/settings" routerLinkActive="active">
                <i class="fas fa-cog me-1"></i>Settings
              </a>
            </li>
          </ul>

          <!-- Right Side Items -->
          <ul class="navbar-nav">
            <!-- Connection Status -->
            <li class="nav-item me-3">
              <span class="navbar-text">
                <span 
                  class="status-indicator me-2"
                  [class.status-online]="isConnected"
                  [class.status-offline]="!isConnected"
                  [title]="isConnected ? 'Connected' : 'Disconnected'">
                </span>
                <small>{{ isConnected ? 'Connected' : 'Disconnected' }}</small>
              </span>
            </li>

            <!-- User Dropdown -->
            <li class="nav-item dropdown">
              <a 
                class="nav-link dropdown-toggle" 
                href="#" 
                id="userDropdown" 
                role="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false">
                <i class="fas fa-user me-1"></i>Admin
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <a class="dropdown-item" href="#profile">
                    <i class="fas fa-user-edit me-2"></i>Profile
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#audit">
                    <i class="fas fa-history me-2"></i>Audit Log
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item" href="#logout">
                    <i class="fas fa-sign-out-alt me-2"></i>Logout
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar-brand {
      font-weight: 600;
      font-size: 1.5rem;
    }

    .nav-link {
      font-weight: 500;
      transition: all 0.15s ease-in-out;
    }

    .nav-link:hover {
      color: rgba(255, 255, 255, 0.8) !important;
    }

    .nav-link.active {
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 0.375rem;
    }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }

    .dropdown-menu {
      border: none;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }

    @media (max-width: 768px) {
      .navbar-brand {
        font-size: 1.25rem;
      }
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  isConnected = false;
  private destroy$ = new Subject<void>();

  constructor(private webSocketService: WebSocketService) {}

  ngOnInit(): void {
    // Subscribe to connection status
    this.webSocketService.isConnected()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

