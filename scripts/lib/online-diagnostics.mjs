// Only return fixed, non-secret diagnostics. A CLI's generic authentication
// status can be misleading when its network or credential store is inaccessible.
export function diagnoseOnlineFailure(error) {
  const stderr = String(error?.stderr ?? '');
  const message = String(error?.message ?? '');
  const details = `${error?.code ?? ''} ${error?.signal ?? ''} ${stderr} ${message}`;
  if (/error connecting to api\.github\.com|failed to connect|could not resolve|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|timed?\s*out|SIGTERM/i.test(details)) {
    return { code: 'GITHUB_TRANSPORT_UNAVAILABLE', action: 'Retry in the approved execution context with network and credential-store access; recheck before deciding authentication failed.' };
  }
  if (/EPERM|EACCES|operation not permitted|permission denied|keychain.*(?:denied|unavailable)/i.test(details)) {
    return { code: 'EXECUTION_ACCESS_UNAVAILABLE', action: 'Retry in the approved execution context with access to the network and credential store.' };
  }
  if (/HTTP\s*401\b|401\s+Unauthorized/i.test(details)) {
    return { code: 'GITHUB_AUTH_REJECTED', action: 'Confirm the active account and credential in an execution context with network and credential-store access.' };
  }
  if (/HTTP\s*403\b|403\s+Forbidden/i.test(details)) {
    return { code: 'GITHUB_ACCESS_FORBIDDEN', action: 'Inspect repository permissions or service restrictions; do not assume the credential is invalid.' };
  }
  if (/invalid token|token[^\n]{0,80}\binvalid\b|failed to log in|bad credentials/i.test(details)) {
    return { code: 'GITHUB_AUTH_UNVERIFIED', action: 'Confirm connectivity and credential-store access, then recheck authentication before changing credentials.' };
  }
  return { code: 'ONLINE_FAILURE_UNCLASSIFIED', action: 'Inspect the scoped command failure in the approved execution context; preserve the current release state.' };
}
