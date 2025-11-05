let Joi;
try {
  Joi = require('joi');
} catch (error) {
  ({ Joi } = require('../utils/joiStub'));
}

module.exports = Joi;
