import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';

import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule, NgbModule],
  template: `
    <div class="alert-container">
      <div 
        *ngFor="let notification of notifications" 
        class="alert alert-{{ notification.type }} alert-dismissible fade show"
        role="alert">
        
        <!-- Alert Icon -->
        <i class="fas me-2" [ngClass]="{
          'fa-check-circle': notification.type === 'success',
          'fa-exclamation-triangle': notification.type === 'warning',
          'fa-times-circle': notification.type === 'error',
          'fa-info-circle': notification.type === 'info'
        }"></i>
        
        <!-- Alert Content -->
        <div class="alert-content">
          <strong *ngIf="notification.title">{{ notification.title }}</strong>
          <span [class.d-block]="notification.title">{{ notification.message }}</span>
        </div>
        
        <!-- Close Button -->
        <button 
          type="button" 
          class="btn-close" 
          aria-label="Close"
          (click)="removeNotification(notification.id)">
        </button>
      </div>
    </div>
  `,
  styles: [`
    .alert-container {
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 9999;
      max-width: 400px;
      width: 100%;
    }

    .alert {
      margin-bottom: 0.5rem;
      box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
      border: none;
      display: flex;
      align-items: flex-start;
    }

    .alert-content {
      flex: 1;
    }

    .alert-success {
      background-color: #d1e7dd;
      color: #0f5132;
    }

    .alert-warning {
      background-color: #fff3cd;
      color: #856404;
    }

    .alert-danger,
    .alert-error {
      background-color: #f8d7da;
      color: #721c24;
    }

    .alert-info {
      background-color: #cff4fc;
      color: #055160;
    }

    @media (max-width: 768px) {
      .alert-container {
        left: 20px;
        right: 20px;
        max-width: none;
      }
    }
  `]
})
export class AlertComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private destroy$ = new Subject<void>();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.notificationService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  removeNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }
}

