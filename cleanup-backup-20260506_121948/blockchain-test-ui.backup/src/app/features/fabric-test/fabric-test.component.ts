import { Component } from '@angular/core';

@Component({
  selector: 'app-fabric-test',
  standalone: true,
  template: `<div class="card"><h1>Fabric Test</h1><p>This page will test POST /api/v1/fabric/evaluate and POST /api/v1/fabric/submit.</p></div>`,
  styles: [`.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px;}`]
})
export class FabricTestComponent {}
