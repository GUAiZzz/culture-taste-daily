import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diagnoseOnlineFailure } from '../scripts/lib/online-diagnostics.mjs';

test('online failure diagnostics distinguish transport, access and explicit HTTP authentication results', () => {
  const cases = [
    ['error connecting to api.github.com\ncheck your internet connection', 'GITHUB_TRANSPORT_UNAVAILABLE'],
    ['connect ETIMEDOUT 192.0.2.2', 'GITHUB_TRANSPORT_UNAVAILABLE'],
    ['operation not permitted accessing keychain', 'EXECUTION_ACCESS_UNAVAILABLE'],
    ['Bad credentials (HTTP 401)', 'GITHUB_AUTH_REJECTED'],
    ['Resource not accessible (HTTP 403)', 'GITHUB_ACCESS_FORBIDDEN'],
    ['The token in default is invalid.', 'GITHUB_AUTH_UNVERIFIED'],
    ['unrecognized failure', 'ONLINE_FAILURE_UNCLASSIFIED'],
  ];
  for (const [stderr, expected] of cases) assert.equal(diagnoseOnlineFailure({ stderr }).code, expected);
});

test('network and access signals take precedence over ambiguous authentication text', () => {
  const diagnostic = diagnoseOnlineFailure({ stderr: 'error connecting to api.github.com\nThe token in default is invalid.' });
  assert.equal(diagnostic.code, 'GITHUB_TRANSPORT_UNAVAILABLE');
  assert.match(diagnostic.action, /recheck/i);
});

test('diagnostics never reproduce command output or secrets', () => {
  const result = diagnoseOnlineFailure({ stderr: 'error connecting to api.github.com token=synthetic-secret' });
  assert.doesNotMatch(JSON.stringify(result), /synthetic-secret|token=/);
});
