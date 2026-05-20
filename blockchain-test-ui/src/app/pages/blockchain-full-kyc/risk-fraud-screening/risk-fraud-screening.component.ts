import { Component } from '@angular/core';

@Component({
  selector: 'app-risk-fraud-screening',
  standalone: true,
  template: `
    <section class="page">
      <h1>Risk / Fraud Screening</h1>
      <p>Screen citizen profiles for fraud risk, duplicate activity, and manual review flags.</p>
    </section>
  `,
  styles: [`
    .page { padding: 24px; background: #fff; border-radius: 14px; box-shadow: 0 8px 24px rgba(15,23,42,.06); }
    h1 { margin: 0; color: #004b9b; font-size: 28px; font-weight: 900; }
    p { margin-top: 8px; color: #536174; font-size: 15px; }
  `]
})
export class RiskFraudScreeningComponent {}
