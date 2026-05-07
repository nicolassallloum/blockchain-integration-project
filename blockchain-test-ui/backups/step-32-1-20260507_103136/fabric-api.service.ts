import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class FabricApiService {
  constructor(
    private http: HttpClient,
    private config: ApiConfigService
  ) {}

  evaluate(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/fabric/evaluate`, payload);
  }

  submit(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/fabric/submit`, payload);
  }
}