import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHighlightSegments,
  collectRegexMatches,
  compileRegex,
  formatRegexReportAsMarkdown,
  normaliseFlags,
  processRegexTest
} from '../../src/tools/regex-tester.js';

test('normalises duplicate flags and rejects unsupported flags', () => {
  assert.deepEqual(normaliseFlags('gimig'), {
    value: 'gim',
    warnings: ['Duplicate flags removed: i, g.']
  });
  assert.throws(() => normaliseFlags('gz'), /Unsupported regex flags: z/);
});

test('collects matches, numbered groups and named groups', () => {
  const result = processRegexTest({
    pattern: '(?<name>[A-Z][a-z]+)\\s+(?<email>[^\\s]+@[^\\s]+)',
    flags: 'g',
    text: 'Ada ada@example.test\nGrace grace@example.test',
    outputFormat: 'json'
  });

  assert.equal(result.matchCount, 2);
  assert.equal(result.groupsCount, 4);
  assert.equal(result.namedGroupsCount, 4);
  assert.equal(result.matches[0].value, 'Ada ada@example.test');
  assert.equal(result.matches[0].line, 1);
  assert.equal(result.matches[1].line, 2);
  assert.deepEqual(result.matches[0].groups.map(group => group.value), ['Ada', 'ada@example.test']);
  assert.deepEqual(result.matches[0].namedGroups.map(group => [group.name, group.value]), [
    ['name', 'Ada'],
    ['email', 'ada@example.test']
  ]);
  assert.match(result.output, /"matchCount": 2/);
});

test('adds global scanning when g is omitted', () => {
  const regex = compileRegex('\\d+', '');
  const matches = collectRegexMatches(regex, '10 20 30');

  assert.equal(regex.flags, 'g');
  assert.deepEqual(matches.map(match => match.value), ['10', '20', '30']);
});

test('builds highlight segments around non-overlapping matches', () => {
  const result = processRegexTest({
    pattern: '\\d+',
    text: 'A10 B20'
  });
  const segments = buildHighlightSegments('A10 B20', result.matches);

  assert.deepEqual(segments, [
    { type: 'text', value: 'A' },
    { type: 'match', index: 1, value: '10' },
    { type: 'text', value: ' B' },
    { type: 'match', index: 2, value: '20' }
  ]);
});

test('reports no matches and formats Markdown output', () => {
  const result = processRegexTest({
    pattern: 'z+',
    text: 'abc',
    outputFormat: 'markdown'
  });

  assert.equal(result.matchCount, 0);
  assert.match(result.warnings.join('\n'), /No matches found/);
  assert.match(result.output, /No matches found/);
  assert.match(formatRegexReportAsMarkdown(result), /Warnings:/);
});

test('handles zero-length matches without looping forever', () => {
  const result = processRegexTest({
    pattern: '\\b',
    text: 'Hi',
    maxMatches: 10
  });

  assert.equal(result.zeroLengthCount, 2);
  assert.match(result.warnings.join('\n'), /zero-length match/);
  assert.equal(result.segments[0].value, 'Hi');
});

test('limits very broad match sets', () => {
  const result = processRegexTest({
    pattern: '.',
    text: 'abcdef',
    maxMatches: 3
  });

  assert.equal(result.matchCount, 3);
  assert.match(result.warnings.join('\n'), /Only the first 3 matches/);
});

test('reports empty and invalid patterns', () => {
  assert.throws(() => processRegexTest({ pattern: '', text: 'abc' }), /Enter a regular expression pattern/);
  assert.throws(() => processRegexTest({ pattern: '(', text: 'abc' }), /Invalid regular expression/);
});
