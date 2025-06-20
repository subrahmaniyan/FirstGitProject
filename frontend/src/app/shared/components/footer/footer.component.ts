import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer bg-light border-top">
      <div class="container-fluid">
        <div class="row align-items-center py-3">
          <div class="col-md-6">
            <span class="text-muted">
              © {{ currentYear }} Payment Switch Application. All rights reserved.
            </span>
          </div>
          <div class="col-md-6 text-md-end">
            <span class="text-muted">
              Version 1.0.0 | 
              <a href="#" class="text-decoration-none">Documentation</a> | 
              <a href="#" class="text-decoration-none">Support</a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      margin-top: auto;
      font-size: 0.875rem;
    }

    .footer a {
      color: #6c757d;
    }

    .footer a:hover {
      color: #0d6efd;
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}

