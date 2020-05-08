const path = require('path');
const loaderUtils = require('loader-utils');

function loader (content) {
  const callback = this.async();
  const mode = this.mode;
  const moduleId = this.resourcePath;

  if (mode !== 'production') {
    this.addDependency(moduleId);
  }

  const result = [
    'var content=require(' + loaderUtils.stringifyRequest(this, '!!' + this.request) + ')',
    'require(' + loaderUtils.stringifyRequest(this, '!' + path.join(__dirname, 'extStyle.js')) + ')("' + moduleId + '",content)'
  ];

  callback(null, content + result.join(';'));
  return;
}

module.exports = loader;