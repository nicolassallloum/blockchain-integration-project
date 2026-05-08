import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FabricService {
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly apiKey =
    '774101c2e4e6e8d46a8bb6c02571f0239ac7c8bd548c22db1162671e502278f7';

  constructor(private http: HttpClient) {}

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

  evaluate(functionName: string, args: string[]): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/fabric/evaluate`,
      {
        functionName,
        args
      },
      {
        headers: this.getHeaders()
      }
    );
  }

  submit(functionName: string, args: string[]): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/fabric/submit`,
      {
        functionName,
        args
      },
      {
        headers: this.getHeaders()
      }
    );
  }

  test(payload: any): Observable<any> {
    const mode = String(payload?.mode || 'evaluate').toLowerCase();

    const body = {
      functionName: payload?.functionName,
      args: payload?.args || []
    };

    if (mode === 'submit') {
      return this.http.post(
        `${this.baseUrl}/fabric/submit`,
        body,
        {
          headers: this.getHeaders()
        }
      );
    }

    return this.http.post(
      `${this.baseUrl}/fabric/evaluate`,
      body,
      {
        headers: this.getHeaders()
      }
    );
  }
}
