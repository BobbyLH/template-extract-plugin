'use-strict';

const debug = require('debug')('TemplateExtract');

const PLUGIN_NAME = 'TemplateExtractPlugin';

const error = (msg) => {
  const err = new Error(`${PLUGIN_NAME}: ${msg}`);
  err.name = PLUGIN_NAME + 'Error';
  debug(`${PLUGIN_NAME} error: ${msg}`);
  throw err;
};

exports.debug = debug;
exports.error = error;
exports.PLUGIN_NAME = PLUGIN_NAME;