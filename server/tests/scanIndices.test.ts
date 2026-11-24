import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SCAN_INDICES, resolveScanIndices } from '../services/bot/entryScan/scanIndices';

test('resolveScanIndices scans every index for the multi-index default', () => {
  assert.deepEqual(resolveScanIndices({}), ALL_SCAN_INDICES);
  assert.deepEqual(
    resolveScanIndices({ selectedIndexPriority: 'FULL_AUTO_MULTI_INDEX' }),
    ALL_SCAN_INDICES,
  );
});

test('resolveScanIndices narrows to a single index for a _ONLY priority', () => {
  const res = resolveScanIndices({ selectedIndexPriority: 'BANKNIFTY_ONLY' });
  assert.deepEqual(res, [{ key: 'NSE_INDEX|Nifty Bank', symbol: 'NIFTY BANK' }]);
});

test('resolveScanIndices honours an explicit instrument key outside multi-index modes', () => {
  const res = resolveScanIndices({
    selectedIndexPriority: 'CUSTOM',
    selectedInstrumentKey: 'BSE_INDEX|SENSEX',
  });
  assert.deepEqual(res, [{ key: 'BSE_INDEX|SENSEX', symbol: 'SENSEX' }]);
});

test('resolveScanIndices ignores the instrument key in multi-index modes', () => {
  const res = resolveScanIndices({
    selectedIndexPriority: 'ALL_EQUAL',
    selectedInstrumentKey: 'BSE_INDEX|SENSEX',
  });
  assert.equal(res.length, ALL_SCAN_INDICES.length);
});

test('resolveScanIndices falls back to all indices for an unknown instrument key', () => {
  const res = resolveScanIndices({
    selectedIndexPriority: 'CUSTOM',
    selectedInstrumentKey: 'NOPE',
  });
  assert.equal(res.length, ALL_SCAN_INDICES.length);
});
