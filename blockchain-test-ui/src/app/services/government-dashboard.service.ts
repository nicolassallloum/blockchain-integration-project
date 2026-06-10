import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GovernmentDashboardService {
  private readonly baseUrl = '/api/v1/government-blockchain/dashboard';

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/summary`);
  }

  getCharts(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/charts`);
  }

  getHealth(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/health`);
  }

  getRecentTransactions(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/recent-transactions`);
  }
}
