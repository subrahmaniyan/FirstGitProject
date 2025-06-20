import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AlertComponent } from './shared/components/alert/alert.component';

import { WebSocketService } from './core/services/websocket.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    NgbModule,
    NavbarComponent,
    SidebarComponent,
    FooterComponent,
    AlertComponent
  ],
  template: `
    <div class="app-container">
      <!-- Navigation Bar -->
      <app-navbar></app-navbar>
      
      <!-- Main Content Area -->
      <div class="main-content">
        <!-- Sidebar Navigation -->
        <app-sidebar class="sidebar"></app-sidebar>
        
        <!-- Page Content -->
        <main class="content" role="main">
          <div class="container-fluid p-4">
            <!-- Alert Messages -->
            <app-alert></app-alert>
            
            <!-- Router Outlet for Page Components -->
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
      
      <!-- Footer -->
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .main-content {
      flex: 1;
      display: flex;
    }
    
    .sidebar {
      width: 250px;
      background-color: #f8f9fa;
      border-right: 1px solid #dee2e6;
      transition: all 0.3s ease;
    }
    
    .content {
      flex: 1;
      background-color: #f8f9fa;
      overflow-y: auto;
    }
    
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        left: -250px;
        top: 56px;
        height: calc(100vh - 56px);
        z-index: 1000;
      }
      
      .sidebar.show {
        left: 0;
      }
      
      .content {
        margin-left: 0;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Payment Switch Management Dashboard';

  constructor(
    private webSocketService: WebSocketService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Initialize WebSocket connection
    this.webSocketService.connect();
    
    // Show welcome notification
    this.notificationService.showSuccess('Payment Switch Dashboard loaded successfully');
    
    // Set up global error handling
    this.setupGlobalErrorHandling();
  }

  ngOnDestroy(): void {
    // Clean up WebSocket connection
    this.webSocketService.disconnect();
  }

  private setupGlobalErrorHandling(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.notificationService.showError('An unexpected error occurred');
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.notificationService.showError('An unexpected error occurred');
    });
  }
}

