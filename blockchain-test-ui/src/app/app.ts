import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  appName = 'Blockchain Test UI';

  menuItems = [
    { label: 'Dashboard', route: '/dashboard', icon: '📊' },
    { label: 'Wallet Create', route: '/wallet-create', icon: '👤' },
    { label: 'Wallet Login', route: '/wallet-login', icon: '🔐' },
    { label: 'Wallet Query', route: '/wallet-query', icon: '🔎' },
    { label: 'Wallet Transfer', route: '/wallet-transfer', icon: '💸' },
    { label: 'Organization Transfer', route: '/organization-transfer', icon: '🏦' },
    { label: 'Transaction History', route: '/transaction-history', icon: '📜' },
    { label: 'Fabric Test', route: '/fabric-test', icon: '⛓️' }
  ];
}
