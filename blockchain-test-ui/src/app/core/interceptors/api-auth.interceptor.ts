import { HttpInterceptorFn } from '@angular/common/http';

export const apiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  /**
   * IMPORTANT:
   * Reference APIs are simple dropdown GET APIs.
   * Do not add custom headers to them because x-request-id triggers
   * browser OPTIONS preflight.
   */
  if (req.url.includes('/api/v1/reference/')) {
    return next(req);
  }

  const requestId = `REQ_UI_${Date.now()}`;

  const clonedRequest = req.clone({
    setHeaders: {
      'x-request-id': requestId
    }
  });

  return next(clonedRequest);
};
