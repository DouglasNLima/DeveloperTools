const DEFAULT_LIQUID_VARIABLE = 'powerPagesResults';

export function normaliseLiquidVariableName(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) {
    return DEFAULT_LIQUID_VARIABLE;
  }

  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `fetchxml_${cleaned}`;
}

export function analyseFetchXml(input) {
  const trimmed = String(input || '').trim();

  if (!trimmed) {
    throw new Error('Enter FetchXML before running this tool.');
  }

  const tokens = tokeniseXml(trimmed);
  const stack = [];
  const warnings = [];
  let rootName = null;
  let rootCount = 0;
  let tagCount = 0;

  tokens.forEach(token => {
    if (token.type !== 'tag') {
      return;
    }

    const tag = parseTag(token.value);

    if (tag.kind === 'meta') {
      return;
    }

    if (tag.kind === 'malformed') {
      throw new Error(`Malformed XML tag near "${token.value.slice(0, 40)}".`);
    }

    if (tag.kind === 'closing') {
      const current = stack.pop();

      if (!current || current !== tag.name) {
        throw new Error(`Unbalanced FetchXML tags near </${tag.name}>.`);
      }

      return;
    }

    tagCount += 1;

    if (!rootName) {
      rootName = tag.name;
    }

    if (stack.length === 0) {
      rootCount += 1;
    }

    if (tag.kind === 'self-closing') {
      warnings.push(`Self-closing <${tag.name} /> tag found. Power Pages Liquid FetchXML is safer with explicit closing tags.`);
      return;
    }

    stack.push(tag.name);
  });

  if (!rootName || rootName.toLowerCase() !== 'fetch') {
    throw new Error('FetchXML must use <fetch> as the root element.');
  }

  if (rootCount > 1) {
    throw new Error('FetchXML must contain one root <fetch> element.');
  }

  if (stack.length > 0) {
    throw new Error(`Unbalanced FetchXML tags. Missing closing tag for <${stack[stack.length - 1]}>.`);
  }

  return {
    rootName,
    tagCount,
    warnings
  };
}

export function formatFetchXml(input, options = {}) {
  const indentSize = options.indentSize || 2;
  const analysis = analyseFetchXml(input);
  const tokens = tokeniseXml(String(input || '').trim());
  const lines = [];
  let depth = 0;

  tokens.forEach(token => {
    if (token.type === 'text') {
      const text = token.value.trim();

      if (text) {
        lines.push(`${indent(depth, indentSize)}${text}`);
      }

      return;
    }

    const tag = parseTag(token.value);

    if (tag.kind === 'closing') {
      depth = Math.max(depth - 1, 0);
      lines.push(`${indent(depth, indentSize)}${normaliseTagSpacing(token.value)}`);
      return;
    }

    lines.push(`${indent(depth, indentSize)}${normaliseTagSpacing(token.value)}`);

    if (tag.kind === 'opening') {
      depth += 1;
    }
  });

  return {
    formatted: lines.join('\n'),
    analysis
  };
}

export function buildLiquidFetchXml(input, variableName) {
  const safeVariableName = normaliseLiquidVariableName(variableName);
  const result = formatFetchXml(input);

  return {
    liquid: `{% fetchxml ${safeVariableName} %}\n${result.formatted}\n{% endfetchxml %}`,
    variableName: safeVariableName,
    analysis: result.analysis
  };
}

function tokeniseXml(value) {
  const tokens = [];
  const tokenPattern = /<[^>]*>|[^<]+/g;
  let match;

  while ((match = tokenPattern.exec(value)) !== null) {
    const token = match[0];

    if (!token) {
      continue;
    }

    tokens.push({
      type: token.startsWith('<') ? 'tag' : 'text',
      value: token
    });
  }

  const combinedLength = tokens.reduce((total, token) => total + token.value.length, 0);

  if (combinedLength !== value.length) {
    throw new Error('FetchXML contains malformed angle brackets.');
  }

  return tokens;
}

function parseTag(rawTag) {
  const tag = rawTag.trim();

  if (/^<!--[\s\S]*-->$/.test(tag) || /^<!\[CDATA\[[\s\S]*\]\]>$/.test(tag) || /^<\?[\s\S]*\?>$/.test(tag) || /^<![A-Za-z][\s\S]*>$/.test(tag)) {
    return { kind: 'meta' };
  }

  const closingMatch = tag.match(/^<\/\s*([A-Za-z_][\w:.-]*)\s*>$/);

  if (closingMatch) {
    return {
      kind: 'closing',
      name: closingMatch[1]
    };
  }

  const selfClosingMatch = tag.match(/^<\s*([A-Za-z_][\w:.-]*)(?:\s[\s\S]*?)?\/\s*>$/);

  if (selfClosingMatch) {
    return {
      kind: 'self-closing',
      name: selfClosingMatch[1]
    };
  }

  const openingMatch = tag.match(/^<\s*([A-Za-z_][\w:.-]*)(?:\s[\s\S]*?)?>$/);

  if (openingMatch) {
    return {
      kind: 'opening',
      name: openingMatch[1]
    };
  }

  return { kind: 'malformed' };
}

function normaliseTagSpacing(tag) {
  return tag
    .trim()
    .replace(/^<\s+/, '<')
    .replace(/\s+>$/, '>')
    .replace(/\s+\/>$/, '/>');
}

function indent(depth, size) {
  return ' '.repeat(depth * size);
}
