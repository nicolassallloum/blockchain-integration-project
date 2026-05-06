import { HttpInterceptorFn } from '@angular/common/http';

export const apiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const apiKey = localStorage.getItem('BLOCKCHAIN_API_KEY') || '';
  const token = localStorage.getItem('BLOCKCHAIN_JWT_TOKEN') || '';
  const requestId = `REQ_ANGULAR_UI_${Date.now()}`;

  let headers = req.headers
    .set('Content-Type', 'application/json')
    .set('x-request-id', requestId);

  if (apiKey) {
    headers = headers.set('x-api-key', apiKey);
  }

  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  return next(req.clone({ headers }));
};
