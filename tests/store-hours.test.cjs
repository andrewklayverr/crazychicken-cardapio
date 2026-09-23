/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const { emptyWeeklySchedule, getStoreAvailability, normalizeWeeklySchedule } = require('../lib/store-hours.ts');

test('manual modes always override the weekly schedule', () => {
  const schedule = emptyWeeklySchedule();
  assert.deepEqual(getStoreAvailability({ orderingMode: 'open', weeklySchedule: schedule }).isOpen, true);
  assert.deepEqual(getStoreAvailability({ orderingMode: 'closed', weeklySchedule: schedule }).isOpen, false);
});

test('automatic mode opens and closes in America/Sao_Paulo', () => {
  const schedule = emptyWeeklySchedule();
  schedule.monday = [{ open: '18:00', close: '23:00' }];
  assert.equal(getStoreAvailability({ orderingMode: 'automatic', weeklySchedule: schedule }, new Date('2026-09-21T21:30:00Z')).isOpen, true);
  assert.equal(getStoreAvailability({ orderingMode: 'automatic', weeklySchedule: schedule }, new Date('2026-09-22T03:00:00Z')).isOpen, false);
});

test('interval crossing midnight remains open on the following day', () => {
  const schedule = emptyWeeklySchedule();
  schedule.monday = [{ open: '22:00', close: '02:00' }];
  assert.equal(getStoreAvailability({ orderingMode: 'automatic', weeklySchedule: schedule }, new Date('2026-09-22T01:30:00Z')).isOpen, true);
  assert.equal(getStoreAvailability({ orderingMode: 'automatic', weeklySchedule: schedule }, new Date('2026-09-22T04:00:00Z')).isOpen, true);
  assert.equal(getStoreAvailability({ orderingMode: 'automatic', weeklySchedule: schedule }, new Date('2026-09-22T06:00:00Z')).isOpen, false);
});

test('closed message identifies the next opening', () => {
  const schedule = emptyWeeklySchedule();
  schedule.tuesday = [{ open: '18:00', close: '23:00' }];
  const result = getStoreAvailability({ orderingMode: 'automatic', weeklySchedule: schedule }, new Date('2026-09-21T21:30:00Z'));
  assert.equal(result.isOpen, false);
  assert.match(result.message, /amanhã às 18:00/);
});

test('schedule rejects invalid and overlapping intervals but accepts separate overnight hours', () => {
  assert.throws(() => normalizeWeeklySchedule({ monday: [{ open: '25:00', close: '02:00' }] }));
  assert.throws(() => normalizeWeeklySchedule({ monday: [{ open: '18:00', close: '22:00' }, { open: '21:00', close: '23:00' }] }), /sobrepostos/);
  const value = normalizeWeeklySchedule({ monday: [{ open: '00:00', close: '01:00' }, { open: '22:00', close: '02:00' }] });
  assert.equal(value.monday.length, 2);
});

test('schedule rejects overlap between an overnight interval and the next day', () => {
  assert.throws(() => normalizeWeeklySchedule({ monday: [{ open: '22:00', close: '02:00' }], tuesday: [{ open: '01:00', close: '04:00' }] }), /dias consecutivos/);
});
