import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-psps',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="psps-container">
      <div class="row mb-4">
        <div class="col-12">
          <h2><i class="fas fa-building me-2"></i>PSP Management</h2>
          <p class="text-muted">Manage Payment Service Provider integrations</p>
        </div>
      </div>
      <div class="alert alert-info">
        <i class="fas fa-info-circle me-2"></i>
        PSP management interface will be implemented in Phase 2.
      </div>
    </div>
  `
})
export class PspsComponent {}

