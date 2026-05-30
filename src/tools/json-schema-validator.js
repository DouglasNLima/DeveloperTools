import { parseJsonInput } from './json-formatter.js';

const MARKDOWN_OUTPUT = 'markdown';
const JSON_OUTPUT = 'json';

const JSON_SCHEMA_TYPES = new Set([
  'array',
  'boolean',
  'integer',
  'null',
  'number',
  'object',
  'string'
]);

const SCHEMA_KEYWORDS = new Set([
  '$comment',
  '$defs',
  '$id',
  '$ref',
  '$schema',
  'additionalProperties',
  'allOf',
  'anyOf',
  'const',
  'default',
  'definitions',
  'deprecated',
  'description',
  'else',
  'enum',
  'examples',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'if',
  'items',
  'maxItems',
  'maxLength',
  'maxProperties',
  'maximum',
  'minItems',
  'minLength',
  'minProperties',
  'minimum',
  'multipleOf',
  'not',
  'oneOf',
  'pattern',
  'patternProperties',
  'prefixItems',
  'properties',
  'readOnly',
  'required',
  'then',
  'title',
  'type',
  'uniqueItems',
  'writeOnly'
]);

export const JSON_SCHEMA_VALIDATOR_OUTPUT_FORMATS = [
  { value: MARKDOWN_OUTPUT, label: 'Markdown report' },
  { value: JSON_OUTPUT, label: 'JSON report' }
];

export function validateJsonAgainstSchema(jsonInput, schemaInput, options = {}) {
  const value = parseValidationInput(jsonInput, 'JSON input');
  const schema = parseValidationInput(schemaInput, 'JSON Schema input');
  assertSchemaRoot(schema, 'JSON Schema input');

  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const result = validateValueAgainstSchema(value, schema);
  const output = formatValidationReport(result, outputFormat);

  return {
    ...result,
    output,
    outputFormat,
    outputType: outputFormat === JSON_OUTPUT ? 'JSON validation report' : 'Markdown validation report'
  };
}

export function validateValueAgainstSchema(value, schema, options = {}) {
  assertSchemaRoot(schema, options.schemaLabel || 'JSON Schema');

  const warnings = [];
  collectSchemaWarnings(schema, [], warnings);

  const errors = validateSchema(value, schema, {
    rootSchema: schema,
    instancePath: [],
    schemaPath: [],
    refStack: []
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length
    },
    schemaDraft: getSchemaDraft(schema)
  };
}

export function formatValidationReport(result, outputFormat = MARKDOWN_OUTPUT) {
  const normalisedFormat = normaliseOutputFormat(outputFormat);

  if (normalisedFormat === JSON_OUTPUT) {
    return JSON.stringify({
      valid: result.valid,
      schemaDraft: result.schemaDraft,
      summary: result.summary,
      errors: result.errors,
      warnings: result.warnings
    }, null, 2);
  }

  return formatMarkdownReport(result);
}

export function formatJsonInstancePath(pathParts = []) {
  if (!Array.isArray(pathParts) || pathParts.length === 0) {
    return '$';
  }

  return pathParts.reduce((path, part) => {
    if (typeof part === 'number') {
      return `${path}[${part}]`;
    }

    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)) {
      return `${path}.${part}`;
    }

    return `${path}[${JSON.stringify(part)}]`;
  }, '$');
}

export function formatJsonSchemaPath(pathParts = []) {
  if (!Array.isArray(pathParts) || pathParts.length === 0) {
    return '#';
  }

  return `#/${pathParts.map(part => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
}

function parseValidationInput(input, label) {
  try {
    return parseJsonInput(input);
  } catch (error) {
    const validationError = new Error(`${label}: ${error.message}`);
    validationError.details = {
      side: label,
      parseError: error.details || null
    };
    throw validationError;
  }
}

function assertSchemaRoot(schema, label) {
  if (!isSchemaNode(schema)) {
    const error = new Error(`${label} must be a JSON object or boolean schema.`);
    error.details = {
      side: label
    };
    throw error;
  }
}

function validateSchema(value, schema, state) {
  if (schema === true) {
    return [];
  }

  if (schema === false) {
    return [createError(state, 'false', 'Boolean schema false rejects every value.', 'allowed value', formatActualValue(value))];
  }

  if (!isPlainObject(schema)) {
    return [createError(state, 'schema', 'Schema node must be an object or boolean.', 'schema object or boolean', getJsonType(value))];
  }

  const errors = [];

  if (Object.hasOwn(schema, '$ref')) {
    errors.push(...validateRef(value, schema.$ref, {
      ...state,
      schemaPath: [...state.schemaPath, '$ref']
    }));
  }

  errors.push(...validateType(value, schema, state));
  errors.push(...validateConst(value, schema, state));
  errors.push(...validateEnum(value, schema, state));
  errors.push(...validateNumericKeywords(value, schema, state));
  errors.push(...validateStringKeywords(value, schema, state));
  errors.push(...validateArrayKeywords(value, schema, state));
  errors.push(...validateObjectKeywords(value, schema, state));
  errors.push(...validateCompositionKeywords(value, schema, state));
  errors.push(...validateConditionalKeywords(value, schema, state));

  return errors;
}

function validateRef(value, ref, state) {
  if (typeof ref !== 'string') {
    return [createError(state, '$ref', '$ref must be a string.', 'local JSON Pointer reference', getJsonType(ref))];
  }

  if (!ref.startsWith('#')) {
    return [createError(
      state,
      '$ref',
      'Remote $ref values are not supported by this local validator.',
      'local $ref starting with #',
      ref
    )];
  }

  if (state.refStack.includes(ref)) {
    return [createError(state, '$ref', `Circular local $ref detected for ${ref}.`, 'non-circular local $ref', ref)];
  }

  const resolved = resolveLocalRef(state.rootSchema, ref);

  if (!resolved.found) {
    return [createError(state, '$ref', `Local $ref target ${ref} was not found.`, 'existing local $ref target', ref)];
  }

  return validateSchema(value, resolved.value, {
    ...state,
    schemaPath: resolved.path,
    refStack: [...state.refStack, ref]
  });
}

function validateType(value, schema, state) {
  if (!Object.hasOwn(schema, 'type')) {
    return [];
  }

  const expectedTypes = normaliseTypeDeclaration(schema.type);

  if (expectedTypes.length === 0) {
    return [];
  }

  const actualType = getJsonType(value);

  if (expectedTypes.some(type => matchesJsonType(actualType, type))) {
    return [];
  }

  return [createError(
    { ...state, schemaPath: [...state.schemaPath, 'type'] },
    'type',
    `Expected type ${formatExpectedList(expectedTypes)} but found ${actualType}.`,
    formatExpectedList(expectedTypes),
    actualType
  )];
}

function validateConst(value, schema, state) {
  if (!Object.hasOwn(schema, 'const') || deepEqual(value, schema.const)) {
    return [];
  }

  return [createError(
    { ...state, schemaPath: [...state.schemaPath, 'const'] },
    'const',
    'Value does not match the required constant.',
    formatValuePreview(schema.const),
    formatActualValue(value)
  )];
}

function validateEnum(value, schema, state) {
  if (!Array.isArray(schema.enum) || schema.enum.some(item => deepEqual(value, item))) {
    return [];
  }

  return [createError(
    { ...state, schemaPath: [...state.schemaPath, 'enum'] },
    'enum',
    'Value is not one of the allowed enum values.',
    `${schema.enum.length.toLocaleString('en-GB')} allowed values`,
    formatActualValue(value)
  )];
}

function validateNumericKeywords(value, schema, state) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return [];
  }

  const errors = [];

  if (isNumber(schema.minimum) && value < schema.minimum) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'minimum'] },
      'minimum',
      `Number must be greater than or equal to ${schema.minimum}.`,
      `>= ${schema.minimum}`,
      value
    ));
  }

  if (isNumber(schema.maximum) && value > schema.maximum) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'maximum'] },
      'maximum',
      `Number must be less than or equal to ${schema.maximum}.`,
      `<= ${schema.maximum}`,
      value
    ));
  }

  if (isNumber(schema.exclusiveMinimum) && value <= schema.exclusiveMinimum) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'exclusiveMinimum'] },
      'exclusiveMinimum',
      `Number must be greater than ${schema.exclusiveMinimum}.`,
      `> ${schema.exclusiveMinimum}`,
      value
    ));
  }

  if (isNumber(schema.exclusiveMaximum) && value >= schema.exclusiveMaximum) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'exclusiveMaximum'] },
      'exclusiveMaximum',
      `Number must be less than ${schema.exclusiveMaximum}.`,
      `< ${schema.exclusiveMaximum}`,
      value
    ));
  }

  if (isPositiveNumber(schema.multipleOf) && !isMultipleOf(value, schema.multipleOf)) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'multipleOf'] },
      'multipleOf',
      `Number must be a multiple of ${schema.multipleOf}.`,
      `multiple of ${schema.multipleOf}`,
      value
    ));
  }

  return errors;
}

function validateStringKeywords(value, schema, state) {
  if (typeof value !== 'string') {
    return [];
  }

  const errors = [];
  const length = [...value].length;

  if (isNonNegativeInteger(schema.minLength) && length < schema.minLength) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'minLength'] },
      'minLength',
      `String must contain at least ${schema.minLength.toLocaleString('en-GB')} characters.`,
      `minimum length ${schema.minLength}`,
      `length ${length}`
    ));
  }

  if (isNonNegativeInteger(schema.maxLength) && length > schema.maxLength) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'maxLength'] },
      'maxLength',
      `String must contain no more than ${schema.maxLength.toLocaleString('en-GB')} characters.`,
      `maximum length ${schema.maxLength}`,
      `length ${length}`
    ));
  }

  if (typeof schema.pattern === 'string') {
    const pattern = compilePattern(schema.pattern);

    if (pattern && !pattern.test(value)) {
      errors.push(createError(
        { ...state, schemaPath: [...state.schemaPath, 'pattern'] },
        'pattern',
        `String must match pattern ${JSON.stringify(schema.pattern)}.`,
        schema.pattern,
        value
      ));
    }
  }

  return errors;
}

function validateArrayKeywords(value, schema, state) {
  if (!Array.isArray(value)) {
    return [];
  }

  const errors = [];

  if (isNonNegativeInteger(schema.minItems) && value.length < schema.minItems) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'minItems'] },
      'minItems',
      `Array must contain at least ${schema.minItems.toLocaleString('en-GB')} items.`,
      `minimum ${schema.minItems}`,
      `length ${value.length}`
    ));
  }

  if (isNonNegativeInteger(schema.maxItems) && value.length > schema.maxItems) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'maxItems'] },
      'maxItems',
      `Array must contain no more than ${schema.maxItems.toLocaleString('en-GB')} items.`,
      `maximum ${schema.maxItems}`,
      `length ${value.length}`
    ));
  }

  if (schema.uniqueItems === true) {
    errors.push(...validateUniqueItems(value, state));
  }

  errors.push(...validateArrayItems(value, schema, state));

  return errors;
}

function validateArrayItems(value, schema, state) {
  const errors = [];
  const prefixItems = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
  const hasPrefixItems = prefixItems.length > 0;
  const hasItems = Object.hasOwn(schema, 'items') && isSchemaNode(schema.items);

  prefixItems.forEach((itemSchema, index) => {
    if (index < value.length && isSchemaNode(itemSchema)) {
      errors.push(...validateSchema(value[index], itemSchema, {
        ...state,
        instancePath: [...state.instancePath, index],
        schemaPath: [...state.schemaPath, 'prefixItems', index]
      }));
    }
  });

  if (!hasItems) {
    return errors;
  }

  const startIndex = hasPrefixItems ? prefixItems.length : 0;

  for (let index = startIndex; index < value.length; index += 1) {
    if (schema.items === false) {
      errors.push(createError(
        {
          ...state,
          instancePath: [...state.instancePath, index],
          schemaPath: [...state.schemaPath, 'items']
        },
        'items',
        'Additional array item is not allowed.',
        'no additional items',
        formatActualValue(value[index])
      ));
    } else {
      errors.push(...validateSchema(value[index], schema.items, {
        ...state,
        instancePath: [...state.instancePath, index],
        schemaPath: [...state.schemaPath, 'items']
      }));
    }
  }

  return errors;
}

function validateUniqueItems(value, state) {
  const seen = new Map();
  const errors = [];

  value.forEach((item, index) => {
    const key = stableStringify(item);

    if (seen.has(key)) {
      const firstIndex = seen.get(key);
      errors.push(createError(
        {
          ...state,
          instancePath: [...state.instancePath, index],
          schemaPath: [...state.schemaPath, 'uniqueItems']
        },
        'uniqueItems',
        `Array item duplicates an earlier item at ${formatJsonInstancePath([...state.instancePath, firstIndex])}.`,
        'unique items',
        formatValuePreview(item)
      ));
      return;
    }

    seen.set(key, index);
  });

  return errors;
}

function validateObjectKeywords(value, schema, state) {
  if (!isJsonObject(value)) {
    return [];
  }

  const errors = [];
  const keys = Object.keys(value);

  if (isNonNegativeInteger(schema.minProperties) && keys.length < schema.minProperties) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'minProperties'] },
      'minProperties',
      `Object must contain at least ${schema.minProperties.toLocaleString('en-GB')} properties.`,
      `minimum ${schema.minProperties}`,
      `property count ${keys.length}`
    ));
  }

  if (isNonNegativeInteger(schema.maxProperties) && keys.length > schema.maxProperties) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'maxProperties'] },
      'maxProperties',
      `Object must contain no more than ${schema.maxProperties.toLocaleString('en-GB')} properties.`,
      `maximum ${schema.maxProperties}`,
      `property count ${keys.length}`
    ));
  }

  errors.push(...validateRequiredProperties(value, schema, state));
  errors.push(...validateNamedProperties(value, schema, state));
  errors.push(...validatePatternProperties(value, schema, state));
  errors.push(...validateAdditionalProperties(value, schema, state));

  return errors;
}

function validateRequiredProperties(value, schema, state) {
  if (!Array.isArray(schema.required)) {
    return [];
  }

  return schema.required.flatMap((key, index) => {
    if (typeof key !== 'string' || Object.hasOwn(value, key)) {
      return [];
    }

    return [createError(
      {
        ...state,
        instancePath: [...state.instancePath, key],
        schemaPath: [...state.schemaPath, 'required', index]
      },
      'required',
      `Missing required property ${JSON.stringify(key)}.`,
      'present property',
      'missing'
    )];
  });
}

function validateNamedProperties(value, schema, state) {
  if (!isPlainObject(schema.properties)) {
    return [];
  }

  return Object.entries(schema.properties).flatMap(([key, propertySchema]) => {
    if (!Object.hasOwn(value, key) || !isSchemaNode(propertySchema)) {
      return [];
    }

    return validateSchema(value[key], propertySchema, {
      ...state,
      instancePath: [...state.instancePath, key],
      schemaPath: [...state.schemaPath, 'properties', key]
    });
  });
}

function validatePatternProperties(value, schema, state) {
  if (!isPlainObject(schema.patternProperties)) {
    return [];
  }

  const errors = [];

  Object.entries(schema.patternProperties).forEach(([patternText, propertySchema]) => {
    const pattern = compilePattern(patternText);

    if (!pattern || !isSchemaNode(propertySchema)) {
      return;
    }

    Object.keys(value).forEach(key => {
      if (pattern.test(key)) {
        errors.push(...validateSchema(value[key], propertySchema, {
          ...state,
          instancePath: [...state.instancePath, key],
          schemaPath: [...state.schemaPath, 'patternProperties', patternText]
        }));
      }
    });
  });

  return errors;
}

function validateAdditionalProperties(value, schema, state) {
  if (!Object.hasOwn(schema, 'additionalProperties') || schema.additionalProperties === true) {
    return [];
  }

  if (!isSchemaNode(schema.additionalProperties)) {
    return [];
  }

  const propertySchemas = isPlainObject(schema.properties) ? schema.properties : {};
  const errors = [];

  Object.keys(value).forEach(key => {
    if (Object.hasOwn(propertySchemas, key) || matchesAnyPatternProperty(key, schema.patternProperties)) {
      return;
    }

    if (schema.additionalProperties === false) {
      errors.push(createError(
        {
          ...state,
          instancePath: [...state.instancePath, key],
          schemaPath: [...state.schemaPath, 'additionalProperties']
        },
        'additionalProperties',
        `Additional property ${JSON.stringify(key)} is not allowed.`,
        'no additional properties',
        formatActualValue(value[key])
      ));
      return;
    }

    errors.push(...validateSchema(value[key], schema.additionalProperties, {
      ...state,
      instancePath: [...state.instancePath, key],
      schemaPath: [...state.schemaPath, 'additionalProperties']
    }));
  });

  return errors;
}

function validateCompositionKeywords(value, schema, state) {
  const errors = [];

  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((childSchema, index) => {
      if (isSchemaNode(childSchema)) {
        errors.push(...validateSchema(value, childSchema, {
          ...state,
          schemaPath: [...state.schemaPath, 'allOf', index]
        }));
      }
    });
  }

  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.filter((childSchema, index) => isSchemaNode(childSchema) && validateSchema(value, childSchema, {
      ...state,
      schemaPath: [...state.schemaPath, 'anyOf', index]
    }).length === 0).length;

    if (matches === 0) {
      errors.push(createError(
        { ...state, schemaPath: [...state.schemaPath, 'anyOf'] },
        'anyOf',
        'Value must match at least one schema in anyOf.',
        'at least one matching schema',
        '0 matching schemas'
      ));
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((childSchema, index) => isSchemaNode(childSchema) && validateSchema(value, childSchema, {
      ...state,
      schemaPath: [...state.schemaPath, 'oneOf', index]
    }).length === 0).length;

    if (matches !== 1) {
      errors.push(createError(
        { ...state, schemaPath: [...state.schemaPath, 'oneOf'] },
        'oneOf',
        `Value must match exactly one schema in oneOf, but matched ${matches.toLocaleString('en-GB')}.`,
        'exactly one matching schema',
        `${matches} matching schemas`
      ));
    }
  }

  if (isSchemaNode(schema.not) && validateSchema(value, schema.not, {
    ...state,
    schemaPath: [...state.schemaPath, 'not']
  }).length === 0) {
    errors.push(createError(
      { ...state, schemaPath: [...state.schemaPath, 'not'] },
      'not',
      'Value must not match the schema in not.',
      'schema mismatch',
      'schema matched'
    ));
  }

  return errors;
}

function validateConditionalKeywords(value, schema, state) {
  if (!isSchemaNode(schema.if)) {
    return [];
  }

  const conditionErrors = validateSchema(value, schema.if, {
    ...state,
    schemaPath: [...state.schemaPath, 'if']
  });
  const branchKeyword = conditionErrors.length === 0 ? 'then' : 'else';
  const branchSchema = schema[branchKeyword];

  if (!isSchemaNode(branchSchema)) {
    return [];
  }

  return validateSchema(value, branchSchema, {
    ...state,
    schemaPath: [...state.schemaPath, branchKeyword]
  });
}

function createError(state, keyword, message, expected, actual) {
  return {
    instancePath: formatJsonInstancePath(state.instancePath),
    schemaPath: formatJsonSchemaPath(state.schemaPath),
    keyword,
    message,
    expected: String(expected),
    actual: String(actual)
  };
}

function collectSchemaWarnings(schema, path, warnings) {
  if (schema === true || schema === false) {
    return;
  }

  if (!isPlainObject(schema)) {
    addWarning(warnings, path, 'schema', 'Schema node must be an object or boolean.');
    return;
  }

  Object.keys(schema).forEach(keyword => {
    if (!SCHEMA_KEYWORDS.has(keyword)) {
      addWarning(warnings, [...path, keyword], keyword, `Keyword ${JSON.stringify(keyword)} is not supported by this validator and was not enforced.`);
      return;
    }

    if (keyword === 'format') {
      addWarning(warnings, [...path, keyword], keyword, 'Keyword "format" is recognised but not enforced by this validator.');
    }
  });

  collectKeywordShapeWarnings(schema, path, warnings);
  collectSubschemaWarnings(schema, path, warnings);
}

function collectKeywordShapeWarnings(schema, path, warnings) {
  if (Object.hasOwn(schema, 'type') && normaliseTypeDeclaration(schema.type).length === 0) {
    addWarning(warnings, [...path, 'type'], 'type', 'Keyword "type" must be a recognised type name or an array of type names.');
  }

  if (Object.hasOwn(schema, 'required') && !isStringArray(schema.required)) {
    addWarning(warnings, [...path, 'required'], 'required', 'Keyword "required" must be an array of property names.');
  }

  ['properties', 'patternProperties', '$defs', 'definitions'].forEach(keyword => {
    if (Object.hasOwn(schema, keyword) && !isPlainObject(schema[keyword])) {
      addWarning(warnings, [...path, keyword], keyword, `Keyword "${keyword}" must be an object.`);
    }
  });

  if (Object.hasOwn(schema, 'additionalProperties') && !isSchemaNode(schema.additionalProperties)) {
    addWarning(warnings, [...path, 'additionalProperties'], 'additionalProperties', 'Keyword "additionalProperties" must be a boolean or schema object.');
  }

  if (Array.isArray(schema.items)) {
    addWarning(warnings, [...path, 'items'], 'items', 'Tuple arrays in "items" are not enforced; use "prefixItems" for tuple validation.');
  } else if (Object.hasOwn(schema, 'items') && !isSchemaNode(schema.items)) {
    addWarning(warnings, [...path, 'items'], 'items', 'Keyword "items" must be a boolean or schema object.');
  }

  if (Object.hasOwn(schema, 'prefixItems') && !Array.isArray(schema.prefixItems)) {
    addWarning(warnings, [...path, 'prefixItems'], 'prefixItems', 'Keyword "prefixItems" must be an array of schemas.');
  }

  ['allOf', 'anyOf', 'oneOf'].forEach(keyword => {
    if (Object.hasOwn(schema, keyword) && !Array.isArray(schema[keyword])) {
      addWarning(warnings, [...path, keyword], keyword, `Keyword "${keyword}" must be an array of schemas.`);
    }
  });

  ['not', 'if', 'then', 'else'].forEach(keyword => {
    if (Object.hasOwn(schema, keyword) && !isSchemaNode(schema[keyword])) {
      addWarning(warnings, [...path, keyword], keyword, `Keyword "${keyword}" must be a boolean or schema object.`);
    }
  });

  ['minItems', 'maxItems', 'minLength', 'maxLength', 'minProperties', 'maxProperties'].forEach(keyword => {
    if (Object.hasOwn(schema, keyword) && !isNonNegativeInteger(schema[keyword])) {
      addWarning(warnings, [...path, keyword], keyword, `Keyword "${keyword}" must be a non-negative integer.`);
    }
  });

  ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'].forEach(keyword => {
    if (Object.hasOwn(schema, keyword) && !isNumber(schema[keyword])) {
      addWarning(warnings, [...path, keyword], keyword, `Keyword "${keyword}" must be a number.`);
    }
  });

  if (Object.hasOwn(schema, 'multipleOf') && !isPositiveNumber(schema.multipleOf)) {
    addWarning(warnings, [...path, 'multipleOf'], 'multipleOf', 'Keyword "multipleOf" must be a positive number.');
  }

  if (Object.hasOwn(schema, 'uniqueItems') && typeof schema.uniqueItems !== 'boolean') {
    addWarning(warnings, [...path, 'uniqueItems'], 'uniqueItems', 'Keyword "uniqueItems" must be a boolean.');
  }

  if (Object.hasOwn(schema, 'enum') && !Array.isArray(schema.enum)) {
    addWarning(warnings, [...path, 'enum'], 'enum', 'Keyword "enum" must be an array.');
  }

  if (Object.hasOwn(schema, 'pattern') && typeof schema.pattern !== 'string') {
    addWarning(warnings, [...path, 'pattern'], 'pattern', 'Keyword "pattern" must be a string.');
  } else if (typeof schema.pattern === 'string' && !compilePattern(schema.pattern)) {
    addWarning(warnings, [...path, 'pattern'], 'pattern', `Pattern ${JSON.stringify(schema.pattern)} is not a valid JavaScript regular expression.`);
  }

  if (Object.hasOwn(schema, '$ref')) {
    if (typeof schema.$ref !== 'string') {
      addWarning(warnings, [...path, '$ref'], '$ref', 'Keyword "$ref" must be a string.');
    } else if (!schema.$ref.startsWith('#')) {
      addWarning(warnings, [...path, '$ref'], '$ref', 'Remote $ref values cannot be resolved by this local validator.');
    }
  }
}

function collectSubschemaWarnings(schema, path, warnings) {
  collectMapSubschemas(schema.properties, [...path, 'properties'], warnings);
  collectMapSubschemas(schema.patternProperties, [...path, 'patternProperties'], warnings, true);
  collectMapSubschemas(schema.$defs, [...path, '$defs'], warnings);
  collectMapSubschemas(schema.definitions, [...path, 'definitions'], warnings);

  if (isSchemaNode(schema.additionalProperties) && typeof schema.additionalProperties !== 'boolean') {
    collectSchemaWarnings(schema.additionalProperties, [...path, 'additionalProperties'], warnings);
  }

  if (isSchemaNode(schema.items) && typeof schema.items !== 'boolean') {
    collectSchemaWarnings(schema.items, [...path, 'items'], warnings);
  }

  if (Array.isArray(schema.prefixItems)) {
    collectArraySubschemas(schema.prefixItems, [...path, 'prefixItems'], warnings);
  }

  ['allOf', 'anyOf', 'oneOf'].forEach(keyword => {
    if (Array.isArray(schema[keyword])) {
      collectArraySubschemas(schema[keyword], [...path, keyword], warnings);
    }
  });

  ['not', 'if', 'then', 'else'].forEach(keyword => {
    if (isSchemaNode(schema[keyword]) && typeof schema[keyword] !== 'boolean') {
      collectSchemaWarnings(schema[keyword], [...path, keyword], warnings);
    }
  });
}

function collectMapSubschemas(schemaMap, path, warnings, validatePatterns = false) {
  if (!isPlainObject(schemaMap)) {
    return;
  }

  Object.entries(schemaMap).forEach(([key, childSchema]) => {
    if (validatePatterns && !compilePattern(key)) {
      addWarning(warnings, [...path, key], 'patternProperties', `Pattern property ${JSON.stringify(key)} is not a valid JavaScript regular expression.`);
    }

    if (!isSchemaNode(childSchema)) {
      addWarning(warnings, [...path, key], 'schema', 'Subschema must be an object or boolean.');
      return;
    }

    if (typeof childSchema !== 'boolean') {
      collectSchemaWarnings(childSchema, [...path, key], warnings);
    }
  });
}

function collectArraySubschemas(items, path, warnings) {
  items.forEach((childSchema, index) => {
    if (!isSchemaNode(childSchema)) {
      addWarning(warnings, [...path, index], 'schema', 'Subschema must be an object or boolean.');
      return;
    }

    if (typeof childSchema !== 'boolean') {
      collectSchemaWarnings(childSchema, [...path, index], warnings);
    }
  });
}

function addWarning(warnings, schemaPath, keyword, message) {
  const warning = {
    schemaPath: formatJsonSchemaPath(schemaPath),
    keyword,
    message
  };

  if (!warnings.some(item => item.schemaPath === warning.schemaPath && item.message === warning.message)) {
    warnings.push(warning);
  }
}

function resolveLocalRef(rootSchema, ref) {
  const path = parseJsonPointer(ref);

  if (!path) {
    return {
      found: false,
      path: []
    };
  }

  let current = rootSchema;

  for (const part of path) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false, path };
      }

      current = current[index];
      continue;
    }

    if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) {
      return { found: false, path };
    }

    current = current[part];
  }

  return {
    found: true,
    path,
    value: current
  };
}

function parseJsonPointer(ref) {
  if (ref === '#') {
    return [];
  }

  if (!ref.startsWith('#/')) {
    return null;
  }

  try {
    return ref
      .slice(2)
      .split('/')
      .map(part => decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~'));
  } catch {
    return null;
  }
}

function matchesAnyPatternProperty(key, patternProperties) {
  if (!isPlainObject(patternProperties)) {
    return false;
  }

  return Object.keys(patternProperties).some(patternText => {
    const pattern = compilePattern(patternText);
    return pattern ? pattern.test(key) : false;
  });
}

function compilePattern(patternText) {
  try {
    return new RegExp(patternText);
  } catch {
    return null;
  }
}

function normaliseTypeDeclaration(typeDeclaration) {
  const types = Array.isArray(typeDeclaration) ? typeDeclaration : [typeDeclaration];
  const uniqueTypes = [...new Set(types)];

  if (uniqueTypes.length === 0 || !uniqueTypes.every(type => JSON_SCHEMA_TYPES.has(type))) {
    return [];
  }

  return uniqueTypes;
}

function matchesJsonType(actualType, expectedType) {
  if (expectedType === 'number') {
    return actualType === 'number' || actualType === 'integer';
  }

  return actualType === expectedType;
}

function getJsonType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return 'integer';
  }

  return typeof value;
}

function getSchemaDraft(schema) {
  if (!isPlainObject(schema) || typeof schema.$schema !== 'string') {
    return 'Unspecified';
  }

  if (schema.$schema.includes('2020-12')) {
    return 'Draft 2020-12';
  }

  if (schema.$schema.includes('2019-09')) {
    return 'Draft 2019-09';
  }

  const draftMatch = schema.$schema.match(/draft-?(\d+)/i);

  if (draftMatch) {
    return `Draft ${draftMatch[1]}`;
  }

  return schema.$schema;
}

function formatMarkdownReport(result) {
  const lines = [
    '# JSON Schema validation report',
    '',
    `Status: ${result.valid ? 'Valid' : 'Invalid'}`,
    `Schema: ${result.schemaDraft}`,
    `Errors: ${result.summary.errorCount.toLocaleString('en-GB')}`,
    `Warnings: ${result.summary.warningCount.toLocaleString('en-GB')}`,
    '',
    '## Errors'
  ];

  if (result.errors.length === 0) {
    lines.push('- No validation errors found.');
  } else {
    result.errors.forEach(error => {
      lines.push(
        '',
        `### ${error.instancePath}`,
        error.message,
        '',
        `- Keyword: ${error.keyword}`,
        `- Schema path: ${error.schemaPath}`,
        `- Expected: ${error.expected}`,
        `- Actual: ${error.actual}`
      );
    });
  }

  lines.push('', '## Warnings');

  if (result.warnings.length === 0) {
    lines.push('- No schema warnings found.');
  } else {
    result.warnings.forEach(warning => {
      lines.push(`- ${warning.schemaPath}: ${warning.message}`);
    });
  }

  return lines.join('\n');
}

function formatExpectedList(values) {
  if (values.length === 1) {
    return values[0];
  }

  return values.slice(0, -1).join(', ') + ` or ${values.at(-1)}`;
}

function formatActualValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  return formatValuePreview(value);
}

function formatValuePreview(value) {
  const preview = JSON.stringify(value);

  if (preview === undefined) {
    return String(value);
  }

  return preview.length <= 160 ? preview : `${preview.slice(0, 157)}...`;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }

  if (isJsonObject(value)) {
    return `{${Object.keys(value).sort((left, right) => left.localeCompare(right, 'en-GB')).map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function deepEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function isSchemaNode(value) {
  return typeof value === 'boolean' || isPlainObject(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value) {
  return isNumber(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isMultipleOf(value, divisor) {
  const quotient = value / divisor;
  const rounded = Math.round(quotient);

  return Math.abs(quotient - rounded) <= 1e-12;
}

function normaliseOutputFormat(value) {
  return value === JSON_OUTPUT ? JSON_OUTPUT : MARKDOWN_OUTPUT;
}
