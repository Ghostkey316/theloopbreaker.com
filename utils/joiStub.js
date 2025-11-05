class ValidationError extends Error {
  constructor(details) {
    super('validation error');
    this.details = details;
  }
}

class BaseSchema {
  constructor() {
    this._required = false;
  }

  required() {
    this._required = true;
    return this;
  }

  optional() {
    this._required = false;
    return this;
  }

  _maybeMissing(value, path) {
    if (value === undefined || value === null) {
      if (this._required) {
        throw new ValidationError([
          { message: 'value is required', path },
        ]);
      }
      return { value: undefined };
    }
    return null;
  }
}

class StringSchema extends BaseSchema {
  constructor() {
    super();
    this._trim = false;
    this._min = null;
  }

  trim() {
    this._trim = true;
    return this;
  }

  min(length) {
    this._min = length;
    return this;
  }

  validate(value) {
    const missing = this._maybeMissing(value, []);
    if (missing) {
      return missing;
    }
    if (typeof value !== 'string') {
      throw new ValidationError([{ message: 'must be a string', path: [] }]);
    }
    let result = value;
    if (this._trim) {
      result = result.trim();
    }
    if (this._min !== null && result.length < this._min) {
      throw new ValidationError([{ message: `length must be >= ${this._min}`, path: [] }]);
    }
    return { value: result };
  }
}

class NumberSchema extends BaseSchema {
  constructor() {
    super();
    this._min = null;
    this._max = null;
  }

  min(minValue) {
    this._min = minValue;
    return this;
  }

  max(maxValue) {
    this._max = maxValue;
    return this;
  }

  validate(value) {
    const missing = this._maybeMissing(value, []);
    if (missing) {
      return missing;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new ValidationError([{ message: 'must be a number', path: [] }]);
    }
    if (this._min !== null && value < this._min) {
      throw new ValidationError([{ message: `must be >= ${this._min}`, path: [] }]);
    }
    if (this._max !== null && value > this._max) {
      throw new ValidationError([{ message: `must be <= ${this._max}`, path: [] }]);
    }
    return { value };
  }
}

class DateSchema extends BaseSchema {
  constructor() {
    super();
    this._mode = null;
  }

  timestamp(mode) {
    this._mode = mode;
    return this;
  }

  validate(value) {
    const missing = this._maybeMissing(value, []);
    if (missing) {
      return missing;
    }
    if (this._mode === 'unix') {
      if (typeof value !== 'number') {
        throw new ValidationError([{ message: 'must be unix timestamp', path: [] }]);
      }
      return { value };
    }
    if (!(value instanceof Date)) {
      throw new ValidationError([{ message: 'must be a Date', path: [] }]);
    }
    return { value };
  }
}

class ObjectSchema extends BaseSchema {
  constructor(shape) {
    super();
    this._shape = shape || {};
  }

  validate(value, options = {}) {
    const missing = this._maybeMissing(value, []);
    if (missing) {
      return missing;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError([{ message: 'must be an object', path: [] }]);
    }
    const errors = [];
    const result = {};
    if (Object.keys(this._shape).length === 0) {
      return { value: { ...value } };
    }
    for (const [key, schema] of Object.entries(this._shape)) {
      try {
        const child = schema.validate(value[key], options);
        if (child.value !== undefined) {
          result[key] = child.value;
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          error.details.forEach((detail) => {
            errors.push({ message: detail.message, path: [key, ...detail.path] });
          });
        } else {
          throw error;
        }
      }
    }
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
    if (!options.stripUnknown) {
      Object.keys(value).forEach((key) => {
        if (!(key in result)) {
          result[key] = value[key];
        }
      });
    }
    return { value: result };
  }
}

function object(shape) {
  return new ObjectSchema(shape);
}

function string() {
  return new StringSchema();
}

function number() {
  return new NumberSchema();
}

function date() {
  return new DateSchema();
}

function buildJoiStub() {
  return {
    object,
    string,
    number,
    date,
    ValidationError,
  };
}

module.exports = { Joi: buildJoiStub() };
