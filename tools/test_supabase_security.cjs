const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '0001_kono_private_plans.sql'),
  'utf8',
).toLowerCase();
const client = fs.readFileSync(
  path.join(root, 'src', 'store', 'supabaseRemote.ts'),
  'utf8',
).toLowerCase();

for (const table of ['kono_plans', 'kono_plan_history']) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
}

assert.match(sql, /owner\s*=\s*\(select auth\.uid\(\)\)|owner\s*=\s*auth\.uid\(\)/);
assert.match(sql, /revoke all on public\.kono_plans from anon/);
assert.match(sql, /revoke all on public\.kono_plan_history from anon/);
assert.match(sql, /security invoker/);
assert.match(sql, /revoke all on function public\.kono_save_plan/);
assert.match(sql, /revoke all on function public\.kono_delete_plan/);
assert.match(client, /session\.user\.id\s*!==\s*accountid/);
assert.match(client, /x-kono-data-version/);
assert.doesNotMatch(client, /service[_-]?role/);

console.log('Supabase security invariants passed.');
