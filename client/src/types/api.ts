export interface HealthResponse {
  status: 'ok' | 'error';
  message: string;
  timestamp: string;
  uptime: number;
  environment: string;
}
