'use strict';

const IS_CONSORTIUM_MODE = process.env.CONSORTIUM_MODE === 'true';

module.exports = {
  IS_CONSORTIUM_MODE,
};

exports.IS_CONSORTIUM_MODE = IS_CONSORTIUM_MODE;
