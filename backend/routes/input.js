const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readString(body, field, errors, { required = false, allowEmpty = true } = {}) {
  if (body[field] === undefined) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  if (body[field] === null) {
    if (required) errors.push(`${field} is required`);
    return allowEmpty ? '' : undefined;
  }
  const value = String(body[field]).trim();
  if (required && !value) errors.push(`${field} is required`);
  if (!allowEmpty && !value) return undefined;
  return value;
}

function readDate(body, field, errors, { required = false } = {}) {
  if (body[field] === undefined || body[field] === null) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = String(body[field]).trim();
  if (!value) {
    if (required) errors.push(`${field} is required`);
    return required ? undefined : '';
  }
  if (!isValidDateString(value)) errors.push(`${field} must be a valid YYYY-MM-DD date`);
  return value;
}

function readNonNegativeNumber(body, field, errors, { required = false, integer = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = Number(body[field]);
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    errors.push(`${field} must be a non-negative ${integer ? 'integer' : 'number'}`);
  }
  return value;
}

function readBoolean(body, field) {
  if (body[field] === undefined) return undefined;
  return Boolean(body[field]);
}

function readEnum(body, field, allowed, errors, { required = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = String(body[field]).trim();
  if (!allowed.includes(value)) errors.push(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

function sendValidationError(res, errors) {
  return res.status(400).json({ error: errors.join('; ') });
}

function parsePagination(query, { defaultLimit = 500, maxLimit = 1000 } = {}) {
  const rawLimit = Number(query.limit);
  const rawSkip = Number(query.skip);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const skip = Number.isInteger(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
  return { limit, skip };
}

module.exports = {
  isValidDateString,
  readString,
  readDate,
  readNonNegativeNumber,
  readBoolean,
  readEnum,
  sendValidationError,
  parsePagination,
};
