import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-routing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="routing-container">
      <div class="row mb-4">
        <div class="col-12">
          <h2><i class="fas fa-route me-2"></i>Routing Rules</h2>
          <p class="text-muted">Configure intelligent transaction routing</p>
        </div>
      </div>
      <div class="alert alert-info">
        <i class="fas fa-info-circle me-2"></i>
        Routing rules management will be implemented in Phase 2.
      </div>
    </div>
  `
})
export class RoutingComponent {}

