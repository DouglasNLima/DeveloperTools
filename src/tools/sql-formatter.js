import { formatBytes } from './base64.js';

export const SQL_FORMAT_MODES = [
  { value: 'format', label: 'Format SQL' },
  { value: 'linearise', label: 'Linearise SQL' }
];

const FORMAT_MODE = 'format';
const LINEARISE_MODE = 'linearise';

const CLAUSE_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'RETURNING',
  'VALUES',
  'SET',
  'INSERT',
  'UPDATE',
  'DELETE',
  'WITH',
  'UNION',
  'UNION ALL',
  'EXCEPT',
  'INTERSECT'
]);

const JOIN_STARTERS = new Set(['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS']);
const STATEMENT_STARTERS = new Set(['INSERT', 'UPDATE', 'DELETE', 'WITH']);
const BODY_ON_NEXT_LINE = new Set(['SELECT', 'WHERE', 'SET', 'VALUES']);
const LINE_WITH_BODY = new Set(['FROM', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'RETURNING']);
const UNION_CLAUSES = new Set(['UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT']);
const PAREN_REQUIRES_SPACE = new Set([
  'AS',
  'BY',
  'CASE',
  'CHECK',
  'CONSTRAINT',
  'DEFAULT',
  'EXISTS',
  'FROM',
  'IN',
  'INTO',
  'JOIN',
  'ON',
  'OVER',
  'REFERENCES',
  'SELECT',
  'TABLE',
  'VALUES',
  'WHERE',
  'WITH'
]);

export function formatSqlQuery(options = {}) {
  const input = normaliseSqlInput(options.input);
  const mode = normaliseMode(options.mode);
  const tokens = tokeniseSql(input);
  const output = mode === LINEARISE_MODE ? lineariseSqlTokens(tokens) : formatSqlTokens(tokens);
  const outputBytes = new TextEncoder().encode(output).length;
  const commentCount = tokens.filter(token => token.type === 'line-comment' || token.type === 'block-comment').length;

  return {
    mode,
    modeLabel: mode === LINEARISE_MODE ? 'Linearise' : 'Format',
    output,
    outputType: mode === LINEARISE_MODE ? 'Linearised SQL' : 'Formatted SQL',
    tokenCount: tokens.length,
    commentCount,
    lineCount: output ? output.split(/\r?\n/).length : 0,
    clauseCount: tokens.filter(token => token.type === 'word' && CLAUSE_KEYWORDS.has(token.upper)).length,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function tokeniseSql(input) {
  const source = String(input ?? '');
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === '-' && next === '-') {
      const start = index;
      index += 2;

      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') {
        index += 1;
      }

      tokens.push(createToken('line-comment', source.slice(start, index)));
      continue;
    }

    if (character === '/' && next === '*') {
      const start = index;
      index += 2;

      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }

      if (index < source.length) {
        index += 2;
      }

      tokens.push(createToken('block-comment', source.slice(start, index)));
      continue;
    }

    if (character === '\'') {
      const result = readQuotedToken(source, index, '\'', '\'');
      tokens.push(createToken('string', result.value));
      index = result.end;
      continue;
    }

    if (character === '"') {
      const result = readQuotedToken(source, index, '"', '"');
      tokens.push(createToken('quoted', result.value));
      index = result.end;
      continue;
    }

    if (character === '[') {
      const result = readQuotedToken(source, index, '[', ']');
      tokens.push(createToken('quoted', result.value));
      index = result.end;
      continue;
    }

    if (character === '`') {
      const result = readQuotedToken(source, index, '`', '`');
      tokens.push(createToken('quoted', result.value));
      index = result.end;
      continue;
    }

    if (/[A-Za-z_#@]/.test(character)) {
      const start = index;
      index += 1;

      while (index < source.length && /[A-Za-z0-9_$#@]/.test(source[index])) {
        index += 1;
      }

      tokens.push(createToken('word', source.slice(start, index)));
      continue;
    }

    if (/[0-9]/.test(character)) {
      const start = index;
      index += 1;

      while (index < source.length && /[0-9A-Fa-f_xX.]/.test(source[index])) {
        index += 1;
      }

      tokens.push(createToken('number', source.slice(start, index)));
      continue;
    }

    if ('(),;.'.includes(character)) {
      tokens.push(createToken('punctuation', character));
      index += 1;
      continue;
    }

    if (/[<>=!+\-*/%|&^~:?]/.test(character)) {
      const start = index;
      index += 1;

      while (index < source.length && /[<>=!+\-*/%|&^~:?]/.test(source[index])) {
        index += 1;
      }

      tokens.push(createToken('operator', source.slice(start, index)));
      continue;
    }

    tokens.push(createToken('symbol', character));
    index += 1;
  }

  return tokens;
}

export function formatSqlTokens(tokens) {
  const lines = [];
  const parenStack = [];
  let indent = 0;
  let currentIndent = 0;
  let currentLine = '';
  let currentLastToken = null;

  function pushLine() {
    const trimmed = currentLine.trim();

    if (trimmed) {
      lines.push(`${'  '.repeat(Math.max(currentIndent, 0))}${trimmed}`);
    }

    currentLine = '';
    currentLastToken = null;
  }

  function appendToken(token) {
    const separator = needsSpace(currentLastToken, token) ? ' ' : '';
    currentLine += `${separator}${token.value}`;
    currentLastToken = token;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === 'line-comment') {
      if (currentLine.trim()) {
        appendToken(token);
      } else {
        currentLine = token.value;
        currentLastToken = token;
      }

      pushLine();
      continue;
    }

    if (token.type === 'block-comment' && /\r|\n/.test(token.value)) {
      pushLine();
      currentIndent = indent;
      token.value.split(/\r?\n/).forEach(line => {
        lines.push(`${'  '.repeat(Math.max(currentIndent, 0))}${line.trimEnd()}`);
      });
      continue;
    }

    const clause = getClause(tokens, index);

    if (clause) {
      handleClause(clause);
      index += clause.length - 1;
      continue;
    }

    if (token.value === '(') {
      const multiline = nextSignificantToken(tokens, index + 1)?.upper === 'SELECT';
      appendToken(token);
      parenStack.push({ multiline, closeIndent: currentIndent, previousIndent: indent });

      if (multiline) {
        pushLine();
        indent = currentIndent + 1;
        currentIndent = indent;
      }

      continue;
    }

    if (token.value === ')') {
      const context = parenStack.pop();

      if (context?.multiline) {
        pushLine();
        indent = Math.max(context.previousIndent, 0);
        currentIndent = Math.max(context.closeIndent, 0);
        currentLine = token.value;
        currentLastToken = token;
      } else {
        appendToken(token);
      }

      continue;
    }

    if (token.value === ',') {
      appendToken(token);

      if (!hasOpenInlineParen(parenStack)) {
        pushLine();
        currentIndent = Math.max(indent + 1, 0);
      }

      continue;
    }

    if (token.value === ';') {
      appendToken(token);
      pushLine();
      currentIndent = indent;
      continue;
    }

    appendToken(token);
  }

  pushLine();
  return lines.join('\n');

  function handleClause(clause) {
    if (clause.kind === 'condition') {
      pushLine();
      currentIndent = Math.max(indent + 1, 0);
      currentLine = clause.phrase;
      currentLastToken = clause.lastToken;
      return;
    }

    if (clause.kind === 'join') {
      pushLine();
      currentIndent = indent;
      currentLine = clause.phrase;
      currentLastToken = clause.lastToken;
      return;
    }

    if (clause.kind === 'union') {
      pushLine();
      currentIndent = indent;
      currentLine = clause.phrase;
      currentLastToken = clause.lastToken;
      pushLine();
      currentIndent = indent;
      return;
    }

    if (clause.kind === 'body-next-line') {
      pushLine();
      currentIndent = indent;
      currentLine = clause.phrase;
      currentLastToken = clause.lastToken;
      pushLine();
      currentIndent = Math.max(indent + 1, 0);
      return;
    }

    if (clause.kind === 'line-with-body' || clause.kind === 'statement-start') {
      pushLine();
      currentIndent = indent;
      currentLine = clause.phrase;
      currentLastToken = clause.lastToken;
      return;
    }

    appendToken(clause.lastToken);
  }
}

export function lineariseSqlTokens(tokens) {
  const lines = [];
  let currentLine = '';
  let currentLastToken = null;

  function pushLine() {
    const trimmed = currentLine.trim();

    if (trimmed) {
      lines.push(trimmed);
    }

    currentLine = '';
    currentLastToken = null;
  }

  function appendToken(token) {
    const separator = needsSpace(currentLastToken, token) ? ' ' : '';
    currentLine += `${separator}${token.value}`;
    currentLastToken = token;
  }

  tokens.forEach(token => {
    if (token.type === 'line-comment') {
      pushLine();
      currentLine = token.value;
      currentLastToken = token;
      pushLine();
      return;
    }

    appendToken(token);
  });

  pushLine();
  return lines.join('\n');
}

export function normaliseSqlInput(input) {
  const value = String(input ?? '').trim();

  if (!value) {
    throw new Error('Enter a SQL query to format.');
  }

  return value;
}

function getClause(tokens, index) {
  const token = tokens[index];

  if (token.type !== 'word') {
    return null;
  }

  const upper = token.upper;
  const next = nextWordToken(tokens, index + 1);
  const nextUpper = next?.token.upper;

  if (upper === 'GROUP' && nextUpper === 'BY') {
    return createClause(tokens, index, 2, 'line-with-body');
  }

  if (upper === 'ORDER' && nextUpper === 'BY') {
    return createClause(tokens, index, 2, 'line-with-body');
  }

  if (upper === 'UNION' && nextUpper === 'ALL') {
    return createClause(tokens, index, 2, 'union');
  }

  if ((upper === 'LEFT' || upper === 'RIGHT' || upper === 'FULL') && nextUpper === 'OUTER') {
    const third = nextWordToken(tokens, next.index + 1);

    if (third?.token.upper === 'JOIN') {
      return createClause(tokens, index, 3, 'join');
    }
  }

  if (JOIN_STARTERS.has(upper) && nextUpper === 'JOIN') {
    return createClause(tokens, index, 2, 'join');
  }

  if (upper === 'JOIN') {
    return createClause(tokens, index, 1, 'join');
  }

  if (upper === 'ON' || upper === 'AND' || upper === 'OR') {
    return createClause(tokens, index, 1, 'condition');
  }

  if (UNION_CLAUSES.has(upper)) {
    return createClause(tokens, index, 1, 'union');
  }

  if (BODY_ON_NEXT_LINE.has(upper)) {
    return createClause(tokens, index, 1, 'body-next-line');
  }

  if (LINE_WITH_BODY.has(upper)) {
    return createClause(tokens, index, 1, 'line-with-body');
  }

  if (STATEMENT_STARTERS.has(upper)) {
    return createClause(tokens, index, 1, 'statement-start');
  }

  return null;
}

function createClause(tokens, index, length, kind) {
  const clauseTokens = tokens.slice(index, index + length);

  return {
    kind,
    length,
    phrase: clauseTokens.map(token => token.value).join(' '),
    lastToken: clauseTokens.at(-1)
  };
}

function nextSignificantToken(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (tokens[index].type !== 'line-comment' && tokens[index].type !== 'block-comment') {
      return tokens[index];
    }
  }

  return null;
}

function nextWordToken(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === 'line-comment' || token.type === 'block-comment') {
      continue;
    }

    return token.type === 'word' ? { token, index } : null;
  }

  return null;
}

function hasOpenInlineParen(parenStack) {
  return parenStack.some(context => !context.multiline);
}

function needsSpace(previous, token) {
  if (!previous) {
    return false;
  }

  if (token.value === '.' || previous.value === '.') {
    return false;
  }

  if (token.value === ',' || token.value === ';' || token.value === ')') {
    return false;
  }

  if (previous.value === '(') {
    return false;
  }

  if (token.value === '(') {
    return shouldSpaceBeforeOpenParen(previous);
  }

  if (token.type === 'operator' || previous.type === 'operator') {
    return true;
  }

  return true;
}

function shouldSpaceBeforeOpenParen(previous) {
  if (previous.type !== 'word') {
    return false;
  }

  return PAREN_REQUIRES_SPACE.has(previous.upper);
}

function normaliseMode(mode) {
  return mode === LINEARISE_MODE ? LINEARISE_MODE : FORMAT_MODE;
}

function createToken(type, value) {
  return {
    type,
    value,
    upper: type === 'word' ? value.toLocaleUpperCase('en-GB') : value
  };
}

function readQuotedToken(source, start, opener, closer) {
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '\\' && opener === '\'' && index + 1 < source.length) {
      index += 2;
      continue;
    }

    if (character === closer) {
      if (next === closer) {
        index += 2;
        continue;
      }

      index += 1;
      break;
    }

    index += 1;
  }

  return {
    value: source.slice(start, index),
    end: index
  };
}
