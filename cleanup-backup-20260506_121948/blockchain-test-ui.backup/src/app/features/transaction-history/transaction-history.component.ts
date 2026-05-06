import { Component } from '@angular/core';

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  template: `<div class="card"><h1>Transaction History</h1><p>This page will test GET /api/v1/transactions with filters.</p></div>`,
  styles: [`.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px;}`]
})
export class TransactionHistoryComponent {}
