import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { environment } from '../../../environments/environment';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket | null = null;
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private messages = new BehaviorSubject<WebSocketMessage | null>(null);

  constructor() {}

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    try {
      this.socket = io(environment.websocketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.connectionStatus.next(false);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus.next(false);
    }
  }

  isConnected(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  getMessages(): Observable<WebSocketMessage | null> {
    return this.messages.asObservable();
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected. Cannot emit event:', event);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.connectionStatus.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.connectionStatus.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.connectionStatus.next(false);
    });

    // Transaction updates
    this.socket.on('transaction-update', (data) => {
      this.messages.next({
        type: 'transaction-update',
        data,
        timestamp: new Date()
      });
    });

    // System alerts
    this.socket.on('system-alert', (data) => {
      this.messages.next({
        type: 'system-alert',
        data,
        timestamp: new Date()
      });
    });

    // Metrics updates
    this.socket.on('metrics-update', (data) => {
      this.messages.next({
        type: 'metrics-update',
        data,
        timestamp: new Date()
      });
    });

    // PSP status updates
    this.socket.on('psp-status', (data) => {
      this.messages.next({
        type: 'psp-status',
        data,
        timestamp: new Date()
      });
    });

    // System health updates
    this.socket.on('health-update', (data) => {
      this.messages.next({
        type: 'health-update',
        data,
        timestamp: new Date()
      });
    });
  }
}

