export const PORTAL_AUTH_FAILURE_EVENT = 'sunbird:portal-auth-failure';

export function notifyPortalAuthFailure(): void {
  window.dispatchEvent(new Event(PORTAL_AUTH_FAILURE_EVENT));
}
