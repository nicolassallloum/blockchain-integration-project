import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class FabricApiService {
  private http = inject(HttpClient);
  private config = inject(ApiConfigService);

  evaluate(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/fabric/evaluate`, payload);
  }

  submit(payload: any): Observable<any> {
    return this.http.post(`${this.config.baseUrl}/fabric/submit`, payload);
  }
}
