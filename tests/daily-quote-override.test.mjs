import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { selectDailyQuote, validateQuotePool } from '../core/rooms/reading-content.mjs';
const root = new URL('../core/rooms/', import.meta.url);
const json = JSON.parse(await readFile(new URL('daily-quotes.public.json', root), 'utf8'));

test('dated selection changes only the explicitly requested date', () => {
  const original = structuredClone(json); delete original.dateOverrides;
  assert.equal(selectDailyQuote(json, '2026-11-11').id, 'agnes-martin-skowhegan-1987');
  for (const date of ['2026-10-28', '2026-11-04', '2026-11-10', '2026-11-12', '2026-11-18']) {
    assert.deepEqual(selectDailyQuote(json, date), selectDailyQuote(original, date));
  }
  const invalid = structuredClone(json); invalid.dateOverrides['2026-02-30'] = invalid.dateOverrides['2026-11-11'];
  assert.throws(() => validateQuotePool(invalid), /Invalid quotation override date/);
});

test('browser and static selections use the same sourced quote', async () => {
  const context = { window: {}, document: { querySelectorAll: () => [], documentElement: { dataset: {} }, addEventListener() {}, hidden: false }, Intl, Date, setTimeout: () => 1, clearTimeout() {} };
  context.window.addEventListener = () => {};
  vm.runInNewContext(await readFile(new URL('daily-quotes.js', root), 'utf8'), context);
  vm.runInNewContext(await readFile(new URL('daily-quote.js', root), 'utf8'), context);
  for (const date of ['2026-11-04', '2026-11-11', '2026-11-12', '2026-11-18']) {
    assert.equal(context.window.CTDailyQuote.quoteForDate(date).id, selectDailyQuote(json, date).id);
  }
});
