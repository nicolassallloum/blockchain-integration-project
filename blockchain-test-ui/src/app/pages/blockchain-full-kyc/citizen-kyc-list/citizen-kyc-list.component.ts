import { Component } from '@angular/core';

@Component({
  selector: 'app-citizen-kyc-list',
  standalone: true,
  template: `
    <section class="page">
      <h1>Citizen KYC List</h1>
      <p>Search, filter, and manage citizen KYC profiles.</p>
    </section>
  `,
  styles: [`
    .page { padding: 24px; background: #fff; border-radius: 14px; box-shadow: 0 8px 24px rgba(15,23,42,.06); }
    h1 { margin: 0; color: #004b9b; font-size: 28px; font-weight: 900; }
    p { margin-top: 8px; color: #536174; font-size: 15px; }
  `]
})
export class CitizenKycListComponent {}
