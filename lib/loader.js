const { PLUGIN_NAME } = require('./utils');
let isListenEvent = false;
const css_dict = {};

function loader (content) {
  const callback = this.async();
  const mode = this.mode;
  const moduleId = this.resourcePath;

  if (mode !== 'production') {
    this.addDependency(moduleId);
  }

  if (content) {
    const startInd = content.indexOf('module.id') + 12;
    const endInd = content.indexOf(', ""])') - 1;
    let cssData = content.substring(startInd, endInd);
    cssData = cssData.replace(/\\n/g, '');
    cssData = cssData.replace(/"/g, "'");
    css_dict[moduleId] = cssData;
  }

  if (!isListenEvent) {
    isListenEvent = true;
    this._compilation.hooks.finishModules.tap(`${PLUGIN_NAME} loader`, modules => {
      let cssStr = '';
      for (const moduleId in css_dict) {
        cssStr += css_dict[moduleId];
      }
  
      this.emitFile(
        'template-extract-css.js',
        `function getStyle () {
          return "${cssStr}";
        }`
      );
    })
  }

  callback(null, content);
  return;
}

module.exports = loader;