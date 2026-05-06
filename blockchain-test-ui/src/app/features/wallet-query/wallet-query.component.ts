import { Component } from '@angular/core';

@Component({
  selector: 'app-wallet-query',
  standalone: true,
  template: `<div class="card"><h1>Wallet Query</h1><p>This page will test wallet search by customer ID and wallet address.</p></div>`,
  styles: [`.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px;}`]
})
export class WalletQueryComponent {}
