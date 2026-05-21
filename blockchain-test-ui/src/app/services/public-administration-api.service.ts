import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PublicAdministrationApiResponse,
  PublicAdministrationPayload
} from '../models/public-administration.models';

@Injectable({
  providedIn: 'root'
})
export class PublicAdministrationApiService {
  private readonly baseUrl = '/api/v1/government-blockchain/public-administrations';

  constructor(private readonly http: HttpClient) {}

  createAdministration(
    payload: PublicAdministrationPayload
  ): Observable<PublicAdministrationApiResponse> {
    return this.http.post<PublicAdministrationApiResponse>(this.baseUrl, {
      administration: payload,
      persistence: {
        blockchain: true,
        postgresql: true
      }
    });
  }

  createAdministrationWallet(
    payload: PublicAdministrationPayload
  ): Observable<PublicAdministrationApiResponse> {
    return this.http.post<PublicAdministrationApiResponse>(
      `${this.baseUrl}/${payload.administrationId}/wallet`,
      {
        wallet: {
          administrationId: payload.administrationId,
          administrationCode: payload.administrationCode,
          administrationName: payload.administrationName,
          walletAddress: payload.walletAddress,
          walletCurrency: payload.walletCurrency,
          walletStatus: payload.walletStatus
        },
        persistence: {
          blockchain: true,
          postgresql: true
        }
      }
    );
  }

  bulkUploadAdministrations(
    rows: PublicAdministrationPayload[]
  ): Observable<PublicAdministrationApiResponse> {
    return this.http.post<PublicAdministrationApiResponse>(
      `${this.baseUrl}/bulk-upload`,
      {
        administrations: rows,
        persistence: {
          blockchain: true,
          postgresql: true
        }
      }
    );
  }

  saveDraft(payload: PublicAdministrationPayload): Observable<PublicAdministrationApiResponse> {
    return this.http.post<PublicAdministrationApiResponse>(
      `${this.baseUrl}/drafts`,
      {
        administration: payload
      }
    );
  }
}
