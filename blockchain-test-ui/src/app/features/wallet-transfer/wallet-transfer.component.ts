import { Component } from '@angular/core';

@Component({
  selector: 'app-wallet-transfer',
  standalone: true,
  template: `<div class="card"><h1>Wallet Transfer</h1><p>This page will test POST /api/v1/transactions/wallet-transfer.</p></div>`,
  styles: [`.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px;}`]
})
export class WalletTransferComponent {}
