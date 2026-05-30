import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatSqlQuery,
  lineariseSqlTokens,
  tokeniseSql
} from '../../src/tools/sql-formatter.js';

test('formats a basic SELECT query into readable clauses', () => {
  const result = formatSqlQuery({
    input: "select id,name from users where active=1 and role='admin,user' order by name desc"
  });

  assert.equal(result.outputType, 'Formatted SQL');
  assert.equal(result.output, [
    'select',
    '  id,',
    '  name',
    'from users',
    'where',
    '  active = 1',
    "  and role = 'admin,user'",
    'order by name desc'
  ].join('\n'));
  assert.equal(result.lineCount, 8);
});

test('indents nested SELECT queries without changing quoted identifiers', () => {
  const result = formatSqlQuery({
    input: 'SELECT [user id],(SELECT COUNT(*) FROM orders WHERE orders.[user id]=users.[user id]) AS order_count FROM users'
  });

  assert.equal(result.output, [
    'SELECT',
    '  [user id],',
    '  (',
    '    SELECT',
    '      COUNT(*)',
    '    FROM orders',
    '    WHERE',
    '      orders.[user id] = users.[user id]',
    '  ) AS order_count',
    'FROM users'
  ].join('\n'));
});

test('formats joins and grouped clauses on separate lines', () => {
  const result = formatSqlQuery({
    input: [
      'SELECT u.id,o.total',
      'FROM users u left join orders o ON o.user_id=u.id',
      'WHERE u.active=1 OR o.total>100',
      'GROUP BY u.id,o.total HAVING count(*)>1'
    ].join(' ')
  });

  assert.equal(result.output, [
    'SELECT',
    '  u.id,',
    '  o.total',
    'FROM users u',
    'left join orders o',
    '  ON o.user_id = u.id',
    'WHERE',
    '  u.active = 1',
    '  OR o.total > 100',
    'GROUP BY u.id,',
    '  o.total',
    'HAVING count(*) > 1'
  ].join('\n'));
});

test('formats INSERT, UPDATE and DELETE statements', () => {
  const insert = formatSqlQuery({
    input: "insert into users (id,name) values (1,'Ada'),(2,'Bob')"
  });
  const update = formatSqlQuery({
    input: "update users set name='Ada', active=1 where id=1"
  });
  const deleteSql = formatSqlQuery({
    input: 'delete from users where id in (select user_id from orders where total > 10)'
  });

  assert.equal(insert.output, [
    'insert into users(id, name)',
    'values',
    "  (1, 'Ada'),",
    "  (2, 'Bob')"
  ].join('\n'));
  assert.equal(update.output, [
    'update users',
    'set',
    "  name = 'Ada',",
    '  active = 1',
    'where',
    '  id = 1'
  ].join('\n'));
  assert.match(deleteSql.output, /where\n  id in \(\n    select/);
});

test('preserves strings and comments while formatting and linearising', () => {
  const input = [
    "select '-- not a comment' as marker, name -- keep this line comment",
    "from users where note='It''s fine' /* keep block comment */ and active=1"
  ].join('\n');
  const formatted = formatSqlQuery({ input });
  const linearised = formatSqlQuery({ input, mode: 'linearise' });

  assert.match(formatted.output, /'-- not a comment'/);
  assert.match(formatted.output, /-- keep this line comment/);
  assert.match(formatted.output, /\/\* keep block comment \*\//);
  assert.equal(linearised.output, [
    "select '-- not a comment' as marker, name",
    '-- keep this line comment',
    "from users where note = 'It''s fine' /* keep block comment */ and active = 1"
  ].join('\n'));
});

test('tokenises SQL safely enough for protected text and rejects empty input', () => {
  const tokens = tokeniseSql("SELECT 'Ada''s', [display name], `code` FROM users");

  assert.deepEqual(tokens.map(token => token.value), [
    'SELECT',
    "'Ada''s'",
    ',',
    '[display name]',
    ',',
    '`code`',
    'FROM',
    'users'
  ]);
  assert.equal(lineariseSqlTokens(tokens), "SELECT 'Ada''s', [display name], `code` FROM users");
  assert.throws(() => formatSqlQuery({ input: '' }), /Enter a SQL query/);
});
