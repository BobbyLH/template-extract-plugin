const { PLUGIN_NAME, avoid_cache_counter } = require('./utils');
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
    try {
      const startInd = content.indexOf('module.id') + 12;
      const endInd = content.indexOf(', ""])') - 1;
      let cssData = content.substring(startInd, endInd);
      cssData = cssData.replace(/\\n/g, '');
      cssData = cssData.replace(/"/g, "'");
      css_dict[moduleId] = cssData;
    } catch (err) {
      this.emitWarning(err);
    }
  }

  if (!isListenEvent) {
    isListenEvent = true;
    this._compilation.hooks.finishModules.tap(`${PLUGIN_NAME} loader`, modules => {
      isListenEvent = false;
      try {
        let cssStr = '';
        for (const moduleId in css_dict) {
          cssStr += css_dict[moduleId];
        }
    
        this.emitFile(
          `template-extract-css-${avoid_cache_counter}.js`,
          `function getStyle () {
            return "${cssStr}";
          }`
        );
      } catch (err) {
        this.emitError(err); 
      }
    })
  }

  callback(null, content);
  return;
}

module.exports = loader;