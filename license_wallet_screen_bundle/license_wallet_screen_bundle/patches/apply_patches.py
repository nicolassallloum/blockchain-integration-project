#!/usr/bin/env python3

from pathlib import Path
import sys

root = Path(sys.argv[1]).expanduser().resolve()
backend = root / 'blockchain-api'
frontend = root / 'blockchain-test-ui'

server_path = backend / 'src/server.js'
routes_path = frontend / 'src/app/app.routes.ts'
menu_path = frontend / 'src/app/app.ts'
recovery_service_path = frontend / 'src/app/services/license-recovery.service.ts'
recovery_html_path = frontend / 'src/app/pages/license-recovery/license-recovery.component.html'

for path in [
    server_path,
    routes_path,
    menu_path,
    recovery_service_path,
    recovery_html_path,
]:
    if not path.exists():
        raise SystemExit(f'[FAIL] Missing file: {path}')

server = server_path.read_text(encoding='utf-8')
recovery_import = """const licenseRecoveryRoutes =
  require('../routes/licenseRecoveryRoutes');"""
wallet_import = """const licenseWalletRoutes =
  require('../routes/licenseWalletRoutes');"""

if wallet_import not in server:
    if recovery_import not in server:
        raise SystemExit('[FAIL] Recovery route import marker was not found.')
    server = server.replace(
        recovery_import,
        recovery_import + '\n' + wallet_import,
        1,
    )

wallet_mount = """try {
  app.use(
    '/api/license-wallets',
    licenseWalletRoutes(licensePool)
  );

  console.log(
    '[ROUTE MOUNTED] /api/license-wallets'
  );
} catch (error) {
  console.error(
    '[ROUTE ERROR] License Wallet route failed to mount:',
    error.message
  );
}

"""

recovery_mount_marker = """try {
  app.use(
    '/api/license-recovery',
    licenseRecoveryRoutes(licensePool)
  );"""

if "'/api/license-wallets'" not in server:
    if recovery_mount_marker not in server:
        raise SystemExit('[FAIL] Recovery route mount marker was not found.')
    server = server.replace(
        recovery_mount_marker,
        wallet_mount + recovery_mount_marker,
        1,
    )

server_path.write_text(server, encoding='utf-8')

routes = routes_path.read_text(encoding='utf-8')
create_route = """  {
    path: 'government-blockchain/license-wallet-create',
    loadComponent: () =>
      import(
        './pages/license-wallet-create/license-wallet-create.component'
      ).then(
        (component) =>
          component.LicenseWalletCreateComponent
      ),
    title: 'Create License Recovery Wallet'
  },
"""
recovery_route_marker = """  {
    path: 'government-blockchain/license-recovery',
"""

if 'license-wallet-create' not in routes:
    if recovery_route_marker not in routes:
        raise SystemExit('[FAIL] Recovery Angular route marker was not found.')
    routes = routes.replace(
        recovery_route_marker,
        create_route + recovery_route_marker,
        1,
    )

routes_path.write_text(routes, encoding='utf-8')

menu = menu_path.read_text(encoding='utf-8')
create_menu = """    {
      label: 'Create License Wallet',
      route: '/government-blockchain/license-wallet-create',
      icon: '🔐',
      group: 'Government Blockchain'
    },
"""
recover_menu_marker = """    {
      label: 'Recover License',
      route: '/government-blockchain/license-recovery',
"""

if 'Create License Wallet' not in menu:
    if recover_menu_marker not in menu:
        raise SystemExit('[FAIL] Recover License menu marker was not found.')
    menu = menu.replace(
        recover_menu_marker,
        create_menu + recover_menu_marker,
        1,
    )

menu_path.write_text(menu, encoding='utf-8')

recovery_service = recovery_service_path.read_text(encoding='utf-8')
recovery_service = recovery_service.replace(
    'sourceLicenseId: string;',
    'licenseId: string;',
)
recovery_service_path.write_text(recovery_service, encoding='utf-8')

recovery_html = recovery_html_path.read_text(encoding='utf-8')
recovery_html = recovery_html.replace(
    '<span>Source License ID</span>',
    '<span>License ID</span>',
)
recovery_html = recovery_html.replace(
    'recoveryResult.wallet.sourceLicenseId',
    'recoveryResult.wallet.licenseId',
)
recovery_html_path.write_text(recovery_html, encoding='utf-8')

print('[PASS] Backend license-wallet route imported and mounted')
print('[PASS] Angular wallet-creation route added')
print('[PASS] Sidebar menu item added')
print('[PASS] Recovery DTO updated for production licenseId')
