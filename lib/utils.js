'use-strict';

const debug = require('debug')('TemplateExtract');

const PLUGIN_NAME = 'TemplateExtractPlugin';

const error = (msg) => {
  const err = new Error(`${PLUGIN_NAME}: ${msg}`);
  err.name = PLUGIN_NAME + 'Error';
  debug(`${PLUGIN_NAME} error: ${msg}`);
  throw err;
};

let avoid_cache_counter = 0;

exports.debug = debug;
exports.error = error;
exports.PLUGIN_NAME = PLUGIN_NAME;
exports.avoid_cache_counter = avoid_cache_counter;