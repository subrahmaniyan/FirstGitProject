import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  private notificationId = 0;

  constructor() {}

  getNotifications(): Observable<Notification[]> {
    return this.notifications.asObservable();
  }

  showSuccess(message: string, title?: string, autoClose: boolean = true): void {
    this.addNotification({
      type: 'success',
      title,
      message,
      autoClose,
      duration: 5000
    });
  }

  showError(message: string, title?: string, autoClose: boolean = false): void {
    this.addNotification({
      type: 'error',
      title,
      message,
      autoClose,
      duration: 0
    });
  }

  showWarning(message: string, title?: string, autoClose: boolean = true): void {
    this.addNotification({
      type: 'warning',
      title,
      message,
      autoClose,
      duration: 7000
    });
  }

  showInfo(message: string, title?: string, autoClose: boolean = true): void {
    this.addNotification({
      type: 'info',
      title,
      message,
      autoClose,
      duration: 5000
    });
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notifications.value;
    const updatedNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications.next(updatedNotifications);
  }

  clearAll(): void {
    this.notifications.next([]);
  }

  private addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${++this.notificationId}`,
      timestamp: new Date()
    };

    const currentNotifications = this.notifications.value;
    this.notifications.next([...currentNotifications, newNotification]);

    // Auto-remove notification if autoClose is enabled
    if (notification.autoClose && notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, notification.duration);
    }
  }
}

