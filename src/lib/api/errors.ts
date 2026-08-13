export class ApiError extends Error {
  readonly status?: number;
  readonly url: string;
  readonly details?: unknown;
  readonly kind: 'http' | 'network' | 'timeout' | 'csrf';

  constructor(
    message: string,
    url: string,
    status?: number,
    details?: unknown,
    kind: 'http' | 'network' | 'timeout' | 'csrf' = status === undefined ? 'network' : 'http',
  ) {
    super(message);
    this.name = 'ApiError';
    this.url = url;
    this.status = status;
    this.details = details;
    this.kind = kind;
  }
}
