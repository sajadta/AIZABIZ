import test from 'node:test';
import assert from 'node:assert/strict';
import { isJwtTokenActuallyExpired } from '../lib/tokens';
import { resolveOptionChainSymbol } from '../routes/market/optionChain';
import { calculateOptionStopLoss, canEnterTradeAfterExit, makeMockJwt } from './helpers';

test('isJwtTokenActuallyExpired validates real exp and rejects empty/corrupted tokens', () => {
  assert.equal(isJwtTokenActuallyExpired(''), true);
  assert.equal(isJwtTokenActuallyExpired('not-a-jwt'), true);
  assert.equal(isJwtTokenActuallyExpired('eyJhbGciOiJIUzI1NiJ9.!!!corrupted!!!.sig'), true);

  const nowSec = Math.floor(Date.now() / 1000);
  assert.equal(isJwtTokenActuallyExpired(makeMockJwt(nowSec + 3600)), false);
  assert.equal(isJwtTokenActuallyExpired(makeMockJwt(nowSec - 60)), true);
  assert.equal(isJwtTokenActuallyExpired(makeMockJwt(nowSec + 10)), true);
});

test('resolveOptionChainSymbol accepts either symbol or instrumentKey query parameter', () => {
  assert.equal(resolveOptionChainSymbol({ symbol: 'BANKNIFTY' }), 'BANKNIFTY');
  assert.equal(resolveOptionChainSymbol({ instrumentKey: 'BSE_INDEX|SENSEX' }), 'BSE_INDEX|SENSEX');
  assert.equal(resolveOptionChainSymbol({}), 'NIFTY 50');
});
