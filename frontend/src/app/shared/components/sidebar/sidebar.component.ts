import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="sidebar-content">
      <div class="sidebar-header p-3">
        <h6 class="text-muted mb-0">NAVIGATION</h6>
      </div>
      
      <nav class="sidebar-nav">
        <ul class="nav flex-column">
          <li class="nav-item">
            <a class="nav-link" routerLink="/dashboard" routerLinkActive="active">
              <i class="fas fa-tachometer-alt me-2"></i>
              Dashboard
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" routerLink="/transactions" routerLinkActive="active">
              <i class="fas fa-exchange-alt me-2"></i>
              Transactions
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" routerLink="/routing" routerLinkActive="active">
              <i class="fas fa-route me-2"></i>
              Routing Rules
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" routerLink="/psps" routerLinkActive="active">
              <i class="fas fa-building me-2"></i>
              PSP Management
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" routerLink="/monitoring" routerLinkActive="active">
              <i class="fas fa-chart-line me-2"></i>
              Monitoring
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" routerLink="/settings" routerLinkActive="active">
              <i class="fas fa-cog me-2"></i>
              Settings
            </a>
          </li>
        </ul>
      </nav>
    </div>
  `,
  styles: [`
    .sidebar-content {
      height: 100%;
      background-color: #f8f9fa;
    }

    .sidebar-header {
      border-bottom: 1px solid #dee2e6;
    }

    .nav-link {
      color: #495057;
      padding: 0.75rem 1rem;
      border-radius: 0;
      transition: all 0.15s ease-in-out;
    }

    .nav-link:hover {
      background-color: #e9ecef;
      color: #0d6efd;
    }

    .nav-link.active {
      background-color: #0d6efd;
      color: white;
    }

    .nav-link i {
      width: 20px;
      text-align: center;
    }
  `]
})
export class SidebarComponent {}

