import { Component } from '@angular/core';

@Component({
  selector: 'app-full-kyc-dashboard',
  standalone: true,
  template: `
    <section class="page">
      <h1>Blockchain Full KYC Dashboard</h1>
      <p>State institutions KYC overview, blockchain proof, risk, fraud, and audit summary.</p>
    </section>
  `,
  styles: [`
    .page {
      padding: 24px;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }

    h1 {
      margin: 0;
      color: #004b9b;
      font-size: 28px;
      font-weight: 900;
    }

    p {
      margin-top: 8px;
      color: #536174;
      font-size: 15px;
    }
  `]
})
export class FullKycDashboardComponent {}
