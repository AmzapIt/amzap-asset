import assert from 'node:assert/strict';
import test from 'node:test';
import { getItFollowUp, REPAIR_FOLLOW_UP_DAYS } from '../lib/it-follow-up.js';

test('IT follow-up loads open returns, offboarding, waiting repairs and overdue repairs', async () => {
  const data = {
    offboarding: [{ user_id: '1', pending_items: 2 }],
    unprocessed_returns: [{ asset_id: '2' }],
    waiting_repair: [{ asset_id: '3' }],
    long_repairs: [{ asset_id: '4', age_days: 8 }],
  };
  let sql;
  let values;
  const result = await getItFollowUp({
    query: async (statement, parameters) => {
      sql = statement;
      values = parameters;
      return { rows: [data] };
    },
  });

  assert.deepEqual(result, data);
  assert.equal(REPAIR_FOLLOW_UP_DAYS, 7);
  assert.deepEqual(values, [7]);
  assert.match(sql, /closed_at IS NULL/);
  assert.match(sql, /progress\.pending_quantity>0/);
  assert.match(sql, /asset\.status='Repair'/);
  assert.match(sql, /maintenance\.status IN \('Open','In Progress'\)/);
  assert.match(sql, /maintenance\.created_at>=receipt\.created_at/);
});
