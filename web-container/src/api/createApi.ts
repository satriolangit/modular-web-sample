import axios, { type AxiosInstance } from 'axios';

import type { AppConfig } from '../config/types';
import type { Logger } from '../logger/logger';

function createCorrelationId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function createServiceClient(baseURL: string, timeout = 8000): AxiosInstance {
  return axios.create({ baseURL, timeout });
}

export function createApi(config: AppConfig, logger: Logger): AxiosInstance {
  const correlationId = createCorrelationId();
  const api = axios.create({
    baseURL: config.apiBase,
    timeout: 10000,
  });

  api.interceptors.request.use((request) => {
    request.headers.set('X-Request-Id', createCorrelationId());
    request.headers.set('X-Correlation-Id', correlationId);
    return request;
  });

  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('api request failed', { message });
      return Promise.reject(error);
    },
  );

  return api;
}
