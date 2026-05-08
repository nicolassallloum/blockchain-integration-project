import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const requestId = `REQ_UI_${Date.now()}`;

  const normalizedUrl = req.url.startsWith('/')
    ? req.url
    : `/${req.url}`;

  const isReferenceApi = normalizedUrl.includes('/api/v1/reference/');
  const isFabricApi = normalizedUrl.includes('/api/v1/fabric/');
  const isProtectedTransactionApi =
    normalizedUrl.includes('/api/v1/transactions/organization-transfer');

  /**
   * Keep reference APIs simple.
   */
  if (isReferenceApi) {
    return next(req);
  }

  const headers: Record<string, string> = {
    'x-request-id': requestId
  };

  /**
   * Required for Fabric Test and protected service routes.
   */
  if (isFabricApi || isProtectedTransactionApi) {
    headers['x-api-key'] = environment.fabricApiKey;
  }

  /**
   * Optional wallet token after login.
   */
  const walletToken =
    localStorage.getItem('digital_kyc_wallet_token') ||
    '';

  if (walletToken && !req.headers.has('Authorization')) {
    headers['Authorization'] = `Bearer ${walletToken}`;
  }

  return next(
    req.clone({
      setHeaders: headers
    })
  );
};
