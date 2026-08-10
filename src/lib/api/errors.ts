export class ApiError extends Error {
  readonly status?: number;
  readonly url: string;
  readonly details?: unknown;

  constructor(message: string, url: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.url = url;
    this.status = status;
    this.details = details;
  }
}
