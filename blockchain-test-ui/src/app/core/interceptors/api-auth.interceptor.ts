import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  /**
   * Keep reference APIs clean to avoid unnecessary browser preflight.
   */
  if (req.url.includes('/api/v1/reference/')) {
    return next(req);
  }

  const requestId = `REQ_UI_${Date.now()}`;

  const headers: Record<string, string> = {
    'x-request-id': requestId
  };

  /**
   * Fabric routes are protected by API key.
   */
  if (req.url.includes('/api/v1/fabric/')) {
    if (environment.fabricApiKey && environment.fabricApiKey !== 'PASTE_BACKEND_API_KEY_HERE') {
      headers['x-api-key'] = environment.fabricApiKey;
    }
  }

  const walletToken =
    localStorage.getItem('digital_kyc_wallet_token') ||
    '';

  if (walletToken && !req.headers.has('Authorization')) {
    headers['Authorization'] = `Bearer ${walletToken}`;
  }

  const clonedRequest = req.clone({
    setHeaders: headers
  });

  return next(clonedRequest);
};