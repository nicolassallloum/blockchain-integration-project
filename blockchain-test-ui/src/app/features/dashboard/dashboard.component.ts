import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="card">
      <h1>Dashboard</h1>
      <p>Blockchain Test UI is working successfully.</p>
      <p>This dashboard will be used to test Blockchain API Middleware endpoints.</p>
    </div>
  `,
  styles: [`
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 22px rgba(15,23,42,.05);
    }

    h1 {
      margin-top: 0;
    }

    p {
      color: #64748b;
    }
  `]
})
export class DashboardComponent {}
