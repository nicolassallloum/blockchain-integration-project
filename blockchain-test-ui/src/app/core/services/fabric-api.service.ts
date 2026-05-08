import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class FabricApiService {
  private readonly apiKey =
    '774101c2e4e6e8d46a8bb6c02571f0239ac7c8bd548c22db1162671e502278f7';

  constructor(
    private http: HttpClient,
    private config: ApiConfigService
  ) {}

  private getHeaders(): HttpHeaders {
    const requestId = `REQ_UI_FABRIC_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)
      .toUpperCase()}`;

    return new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('x-api-key', this.apiKey)
      .set('x-request-id', requestId)
      .set('x-correlation-id', requestId)
      .set('x-source-system', 'BLOCKCHAIN_TEST_UI')
      .set('x-request-source', 'ANGULAR_UI');
  }

  evaluate(payload: any): Observable<any> {
    return this.http.post(
      `${this.config.baseUrl}/fabric/evaluate`,
      payload,
      {
        headers: this.getHeaders()
      }
    );
  }

  submit(payload: any): Observable<any> {
    return this.http.post(
      `${this.config.baseUrl}/fabric/submit`,
      payload,
      {
        headers: this.getHeaders()
      }
    );
  }
}
