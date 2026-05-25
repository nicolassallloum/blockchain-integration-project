import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  PublicAdministrationApiResponse,
  PublicAdministrationPayload
} from '../models/public-administration.models';

@Injectable({
  providedIn: 'root'
})
export class PublicAdministrationApiService {
  private readonly baseUrl =
    'http://172.31.13.90:3001/api/v1/government-blockchain/public-administrations';

  constructor(private readonly http: HttpClient) {}

  createAdministration(payload: PublicAdministrationPayload) {
    return this.http.post<PublicAdministrationApiResponse>(this.baseUrl, {
      administration: payload
    });
  }

  createAdministrationWallet(payload: PublicAdministrationPayload) {
    return this.http.post<PublicAdministrationApiResponse>(
      `${this.baseUrl}/${payload.administrationId}/wallet`,
      payload
    );
  }

  bulkUploadAdministrations(administrations: PublicAdministrationPayload[]) {
    return this.http.post<PublicAdministrationApiResponse>(
      `${this.baseUrl}/bulk-upload`,
      {
        administrations
      }
    );
  }

  saveDraft(payload: PublicAdministrationPayload) {
    return this.http.post<PublicAdministrationApiResponse>(
      `${this.baseUrl}/drafts`,
      {
        administration: payload
      }
    );
  }
}