'use-strict';

const CleanCss = require('clean-css');
const minifyHtml = require('html-minifier-terser');
const ConcatSource = require('webpack-sources').ConcatSource;
const { PLUGIN_NAME } = require('./utils');

// webpack 3.x and earlier
const events = {
  before: 'html-webpack-plugin-before-html-processing',
  alter: 'html-webpack-plugin-alter-asset-tags',
  after: 'html-webpack-plugin-after-html-processing'
};

// webpack 4.x and later
const hookEvents = {
  before: 'htmlWebpackPluginBeforeHtmlProcessing',
  alter: 'htmlWebpackPluginAlterAssetTags',
  after: 'htmlWebpackPluginAfterHtmlProcessing'
};

const fnName = '_get_extract_template_';

class TemplateExtractPlugin {
  constructor (options) {
    this.options = options || {};
    this.compilation = this.compilation.bind(this);
    this.wire = this.wire.bind(this);
  }

  apply (compiler) {
    const { disable } = this.options;
    if (disable) {
      const emit = (compilation, callback) => {
        if (global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {
          delete global['__TEMPLATE_EXTRACT_PLUGIN_STYLE__'];
        }
        typeof callback === 'function' && callback();
      }
      if (compiler.hooks) {
        compiler.hooks.emit.tapAsync(PLUGIN_NAME, emit);
      } else {
        compiler.plugin('emit', emit);
      }
      return;
    };

    if (compiler.hooks) {
      compiler.hooks.compilation.tap('HtmlWebpackPlugin', this.compilation.bind(this, hookEvents));
    } else {
      compiler.plugin('compilation', this.compilation.bind(this, events));
    }
  }

  compilation (events, compilation) {
    const { scriptTag, injectInJs } = this.options;
    let extTpl = '';

    this.wire(
      events.before,
      compilation,
      (pluginArgs) => {
        let extStyle = '';
        if (global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {
          for (const k in global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {
            extStyle += global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[k]
          }
          extStyle = new CleanCss().minify(extStyle).styles;
        }
        const { html } = pluginArgs;
        extTpl = html.replace(/\${/g, '\\${');
        extTpl = extTpl.replace('<!--template-extract-dom-->', '\${dom}');
        extTpl = extTpl.replace('<!--template-extract-css-->', `<style>${extStyle ? '\${style?style:raw`' + extStyle + '`}' : '\${style ? style : extStyle}'}</style>`);
        extTpl = minifyHtml.minify(extTpl, {
          collapseWhitespace: true,
          keepClosingSlash: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true
        });
        if (!scriptTag) {
          extTpl = extTpl.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        } else {
          extTpl = extTpl.replace(/`/g, '\\`');
          extTpl = extTpl.replace(/<\/script>/gi, '<\\/script>');
        }
        if (extStyle) {
          extTpl = `(function (g) { g.${fnName} = function (dom, style) {function raw(callSite = {}, ...substitutions) {var template;try {template = Array.from(callSite.raw);} catch (e) {throw new TypeError('Cannot convert undefined or null to object');}return template.map((chunk, i) => {if (callSite.raw.length <= i) {return chunk;}return substitutions[i - 1] ? substitutions[i - 1] + chunk : chunk;}).join('');};return \`${extTpl}\`;} })(typeof window === 'undefined' ? {} : window)`
        } else {
          extTpl = `(function (g) { g.${fnName} = function (dom, style) {var extStyle = '';if (!g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__ = {};for (var k in g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {extStyle += g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[k]}return \`${extTpl}\`;}})(typeof window === 'undefined' ? {} : window)`
        }
      }
    );
    
    this.wire(
      events.after,
      compilation,
      (pluginArgs) => {
        let toReplace;
        let replaceWith;
        if (!!~pluginArgs.html.indexOf('<!--template-extract-js-->')) {
          toReplace = '<!--template-extract-js-->';
          replaceWith = '<script>' + extTpl + '</script>';
        } else {
          const { position } = this.options;
          switch (position) {
            case 'head-top':
              toReplace = '<head>';
              replaceWith = toReplace + extTpl;
              break;
            case 'head-bottom':
              toReplace = '</head>';
              replaceWith = extTpl + toReplace;
              break;
            case 'body-top':
              toReplace = '<body>';
              replaceWith = toReplace + extTpl;
              break;
            case 'body-bottom':
            default:
              toReplace = '</body>';
              replaceWith = extTpl + toReplace;
              break;
          }
        }

        function injectInHtml () {
          pluginArgs.html = pluginArgs.html.replace(toReplace, replaceWith);
        }

        if (injectInJs) {
          const jsFiles = pluginArgs.assets.js;
          if (!jsFiles || jsFiles.length === 0) {
            compilation.warnings.push(`[${PLUGIN_NAME}]: There is not any js file, template will be injected in html file!`);
            injectInHtml();
          } else {
            let fileIndex = 0;
            jsFiles.forEach((fileName, ind) => {
              if (typeof injectInJs === 'string' ? ~fileName.indexOf(injectInJs) : ~fileName.indexOf('chunk')) {
                fileIndex = ind;
              } else if (~fileName.indexOf('vendor')) {
                fileIndex = ind;
              } else if (~fileName.indexOf('main')) {
                fileIndex = ind;
              } else if (~fileName.indexOf('index')) {
                fileIndex = ind;
              }
            });
            let injectFileName = jsFiles[fileIndex].split('?')[0];
            const publicPath = pluginArgs.assets.publicPath;
            if (publicPath) {
              injectFileName = injectFileName.split(publicPath)[1];
            }
            const injectJs = compilation.assets[injectFileName];
            if (injectJs) {
              compilation.assets[injectFileName] = new ConcatSource(
                injectJs,
                extTpl
              );
            } else {
              compilation.warnings.push(`[${PLUGIN_NAME}]: The ${injectFileName} not existence, template will be injected in html file!`);
              injectInHtml();
            }
          }
        } else {
          injectInHtml();
        }
      }
    );
  }

  wire (event, compilation, fn) {
    const eventCallback = (pluginArgs, callback) => {
      try {
        fn(pluginArgs);
        if (callback) {
          callback(null, pluginArgs);
        }
      } catch (err) {
        if (callback) {
          callback(err);
        } else {
          compilation.errors.push(err);
        }
      }
    };

    if (compilation.hooks) {
      if (compilation.hooks[event]) {
        compilation.hooks[event].tapAsync(PLUGIN_NAME, eventCallback);
      }
    } else {
      compilation.plugin(event, eventCallback);
    }
  }
}

TemplateExtractPlugin.loader = require.resolve('./loader');
exports.TemplateExtractPlugin = TemplateExtractPlugin;
module.exports = TemplateExtractPlugin;