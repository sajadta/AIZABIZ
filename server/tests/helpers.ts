// Shared fixtures for the server rule tests.

export { computeOptionStopLossPlan as calculateOptionStopLoss } from '../services/bot/positionMonitor/stopLoss';

export function canEnterTradeAfterExit(
  lastExitTimeMs: number,
  currentTimeMs: number,
  cooldownMs: number = 180000,
): boolean {
  return currentTimeMs - lastExitTimeMs >= cooldownMs;
}

export function makeMockJwt(expUnixSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: '5VCABX', exp: expUnixSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.signature`;
}
