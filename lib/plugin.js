'use-strict';

const CleanCss = require('clean-css');
const minifyHtml = require('html-minifier-terser');
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
        Object.keys(compilation.assets).forEach(moduleId => {
          if (moduleId === 'template-extract-css.js') {
            delete compilation.assets[moduleId];
          }
        });
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
    let extTpl = '';

    this.wire(
      events.before,
      compilation,
      (pluginArgs) => {
        let extStyle = '';
        Object.keys(compilation.assets).forEach(moduleId => {
          if (moduleId === 'template-extract-css.js') {
            const content = compilation.assets[moduleId].source();
            extStyle = new Function(`return ${content}`)()();
            extStyle = new CleanCss().minify(extStyle).styles;
            delete compilation.assets[moduleId];
          }
        });
        const { html } = pluginArgs;
        extTpl = html.replace('<!--template-extract-dom-->', '\${dom}');
        if (extStyle) {
          extTpl = extTpl.replace('<!--template-extract-css-->', `<style>${extStyle}</style>`)
        }
        extTpl = minifyHtml.minify(extTpl, {
          collapseWhitespace: true,
          keepClosingSlash: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true
        });
        extTpl = `<script>function _get_extract_template (dom) {return \`${extTpl}\`}window._get_extract_template = _get_extract_template;</script>"`
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
          replaceWith = extTpl;
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
        pluginArgs.html = pluginArgs.html.replace(toReplace, replaceWith);
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