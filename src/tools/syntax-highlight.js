const SUPPORTED_LANGUAGES = new Set(['auto', 'plain', 'json', 'xml', 'expression', 'markdown', 'sql']);
const SQL_KEYWORDS = new Set([
  'ADD',
  'ALL',
  'ALTER',
  'AND',
  'AS',
  'ASC',
  'BETWEEN',
  'BY',
  'CASE',
  'CREATE',
  'CROSS',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'ELSE',
  'END',
  'EXCEPT',
  'EXISTS',
  'FROM',
  'FULL',
  'GROUP',
  'HAVING',
  'IN',
  'INNER',
  'INSERT',
  'INTERSECT',
  'INTO',
  'IS',
  'JOIN',
  'LEFT',
  'LIKE',
  'LIMIT',
  'NOT',
  'NULL',
  'OFFSET',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'RETURNING',
  'RIGHT',
  'SELECT',
  'SET',
  'THEN',
  'UNION',
  'UPDATE',
  'VALUES',
  'WHEN',
  'WHERE',
  'WITH'
]);

export function detectSyntaxLanguage(value) {
  const trimmed = String(value ?? '').trimStart();

  if (!trimmed) {
    return 'plain';
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  if (trimmed.startsWith('<')) {
    return 'xml';
  }

  if (/^(select|with|insert|update|delete)\b/i.test(trimmed)) {
    return 'sql';
  }

  return 'plain';
}

export function highlightSyntax(value, language = 'plain') {
  const source = String(value ?? '');
  const resolvedLanguage = resolveLanguage(language, source);

  if (!source) {
    return '';
  }

  if (resolvedLanguage === 'json') {
    return highlightJson(source);
  }

  if (resolvedLanguage === 'xml') {
    return highlightXml(source);
  }

  if (resolvedLanguage === 'expression') {
    return highlightExpression(source);
  }

  if (resolvedLanguage === 'markdown') {
    return highlightMarkdown(source);
  }

  if (resolvedLanguage === 'sql') {
    return highlightSql(source);
  }

  return escapeHtml(source);
}

export function bindSyntaxHighlight(textarea, options = {}) {
  if (!textarea || textarea.dataset.syntaxHighlighted === 'true') {
    return createNoopBinding();
  }

  let language = normaliseLanguage(options.language || 'plain');
  const wrapper = document.createElement('div');
  wrapper.className = `syntax-editor syntax-editor--${language}`;
  wrapper.dataset.syntaxEditorFor = textarea.id || '';

  const layer = document.createElement('pre');
  layer.className = 'syntax-highlight-layer';
  layer.setAttribute('aria-hidden', 'true');

  const code = document.createElement('code');
  layer.append(code);

  textarea.parentNode.insertBefore(wrapper, textarea);
  wrapper.append(layer, textarea);
  textarea.classList.add('syntax-editor-input');
  textarea.dataset.syntaxHighlighted = 'true';

  function update() {
    wrapper.classList.remove('syntax-editor--auto', 'syntax-editor--plain', 'syntax-editor--json', 'syntax-editor--xml', 'syntax-editor--expression', 'syntax-editor--markdown', 'syntax-editor--sql');
    wrapper.classList.add(`syntax-editor--${resolveLanguage(language, textarea.value)}`);
    code.innerHTML = `${highlightSyntax(textarea.value, language)}\n`;
    syncScroll();
  }

  function syncScroll() {
    code.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }

  function setLanguage(nextLanguage) {
    language = normaliseLanguage(nextLanguage);
    update();
  }

  const restoreValue = patchTextareaValue(textarea, update);
  textarea.addEventListener('input', update);
  textarea.addEventListener('scroll', syncScroll);
  update();

  return {
    update,
    setLanguage,
    destroy() {
      textarea.removeEventListener('input', update);
      textarea.removeEventListener('scroll', syncScroll);
      restoreValue();
    }
  };
}

function highlightJson(source) {
  const tokenPattern = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}\[\]:,]/g;
  let html = '';
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(source)) !== null) {
    const token = match[0];
    html += escapeHtml(source.slice(cursor, match.index));

    if (token.startsWith('"')) {
      const nextCharacter = source.slice(tokenPattern.lastIndex).match(/^\s*:/);
      html += tokenSpan(nextCharacter ? 'key' : 'string', token);
    } else if (/^-?\d/.test(token)) {
      html += tokenSpan('number', token);
    } else if (token === 'true' || token === 'false' || token === 'null') {
      html += tokenSpan('literal', token);
    } else {
      html += tokenSpan('punctuation', token);
    }

    cursor = tokenPattern.lastIndex;
  }

  html += escapeHtml(source.slice(cursor));
  return html;
}

function highlightXml(source) {
  const tokenPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![A-Z][\s\S]*?>|<\/?[A-Za-z_:][^>]*?>/g;
  let html = '';
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(source)) !== null) {
    html += escapeHtml(source.slice(cursor, match.index));
    html += highlightXmlToken(match[0]);
    cursor = tokenPattern.lastIndex;
  }

  html += escapeHtml(source.slice(cursor));
  return html;
}

function highlightXmlToken(token) {
  if (token.startsWith('<!--') || token.startsWith('<![CDATA[')) {
    return tokenSpan('comment', token);
  }

  const tagMatch = token.match(/^(<\/?|<\?|<!)([^\s/>?]+)?([\s\S]*?)(\/?>|\?>)$/);

  if (!tagMatch) {
    return escapeHtml(token);
  }

  const [, opener, tagName = '', attributes = '', closer] = tagMatch;
  return [
    tokenSpan('punctuation', opener),
    tagName ? tokenSpan('tag', tagName) : '',
    highlightXmlAttributes(attributes),
    tokenSpan('punctuation', closer)
  ].join('');
}

function highlightXmlAttributes(source) {
  const attributePattern = /([^\s=/>]+)(\s*=\s*)("(?:[^"]*)"|'(?:[^']*)'|[^\s/>]+)?/g;
  let html = '';
  let cursor = 0;
  let match;

  while ((match = attributePattern.exec(source)) !== null) {
    html += escapeHtml(source.slice(cursor, match.index));
    html += tokenSpan('attribute', match[1]);

    if (match[2]) {
      html += tokenSpan('operator', match[2]);
    }

    if (match[3]) {
      html += tokenSpan('string', match[3]);
    }

    cursor = attributePattern.lastIndex;
  }

  html += escapeHtml(source.slice(cursor));
  return html;
}

function highlightExpression(source) {
  const tokenPattern = /'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w.]*\b|[()[\]{}.,?:+\-*\/=<>!&|@;]/g;
  let html = '';
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(source)) !== null) {
    const token = match[0];
    html += escapeHtml(source.slice(cursor, match.index));

    if (token.startsWith("'") || token.startsWith('"')) {
      html += tokenSpan('string', token);
    } else if (/^\d/.test(token)) {
      html += tokenSpan('number', token);
    } else if (/^[A-Za-z_]/.test(token)) {
      const nextCharacter = source.slice(tokenPattern.lastIndex).match(/^\s*\(/);
      html += tokenSpan(nextCharacter ? 'function' : expressionIdentifierClass(token), token);
    } else if (/^[+\-*\/=<>!&|?:]$/.test(token)) {
      html += tokenSpan('operator', token);
    } else {
      html += tokenSpan('punctuation', token);
    }

    cursor = tokenPattern.lastIndex;
  }

  html += escapeHtml(source.slice(cursor));
  return html;
}

function highlightSql(source) {
  const tokenPattern = /--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"|\[(?:\]\]|[^\]])*\]|`(?:``|[^`])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_$#@]*\b|[()[\]{}.,;:+\-*\/=<>!%|&?]/g;
  let html = '';
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(source)) !== null) {
    const token = match[0];
    html += escapeHtml(source.slice(cursor, match.index));

    if (token.startsWith('--') || token.startsWith('/*')) {
      html += tokenSpan('comment', token);
    } else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('[') || token.startsWith('`')) {
      html += tokenSpan('string', token);
    } else if (/^\d/.test(token)) {
      html += tokenSpan('number', token);
    } else if (/^[A-Za-z_]/.test(token)) {
      const upperToken = token.toLocaleUpperCase('en-GB');
      const nextCharacter = source.slice(tokenPattern.lastIndex).match(/^\s*\(/);

      if (upperToken === 'NULL' || upperToken === 'TRUE' || upperToken === 'FALSE') {
        html += tokenSpan('literal', token);
      } else if (SQL_KEYWORDS.has(upperToken)) {
        html += tokenSpan('key', token);
      } else {
        html += tokenSpan(nextCharacter ? 'function' : 'variable', token);
      }
    } else if (/^[+\-*\/=<>!%|&?:]$/.test(token)) {
      html += tokenSpan('operator', token);
    } else {
      html += tokenSpan('punctuation', token);
    }

    cursor = tokenPattern.lastIndex;
  }

  html += escapeHtml(source.slice(cursor));
  return html;
}

function highlightMarkdown(source) {
  return source
    .split(/(\r\n|\r|\n)/)
    .map(part => {
      if (/^\r?\n$|^\r$/.test(part)) {
        return part;
      }

      if (/^#{1,6}\s/.test(part)) {
        return tokenSpan('tag', part);
      }

      return escapeHtml(part).replace(/(`+)([^`]+)(`+)/g, (_, opener, value, closer) => (
        `${tokenSpan('punctuation', opener)}${tokenSpan('string', value)}${tokenSpan('punctuation', closer)}`
      ));
    })
    .join('');
}

function expressionIdentifierClass(token) {
  return /^(true|false|null|blank)$/i.test(token) ? 'literal' : 'variable';
}

function resolveLanguage(language, source) {
  const normalisedLanguage = normaliseLanguage(language);
  return normalisedLanguage === 'auto' ? detectSyntaxLanguage(source) : normalisedLanguage;
}

function normaliseLanguage(language) {
  return SUPPORTED_LANGUAGES.has(language) ? language : 'plain';
}

function tokenSpan(type, value) {
  return `<span class="syntax-token syntax-token--${type}">${escapeHtml(value)}</span>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function patchTextareaValue(textarea, update) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), 'value');

  if (!descriptor?.get || !descriptor?.set) {
    return () => {};
  }

  Object.defineProperty(textarea, 'value', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      return descriptor.get.call(textarea);
    },
    set(nextValue) {
      descriptor.set.call(textarea, nextValue);
      update();
    }
  });

  return () => {
    delete textarea.value;
  };
}

function createNoopBinding() {
  return {
    update() {},
    setLanguage() {},
    destroy() {}
  };
}
