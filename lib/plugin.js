'use-strict';

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
    const { scriptTag } = this.options;
    let extTpl = '';

    this.wire(
      events.before,
      compilation,
      (pluginArgs) => {
        const { html } = pluginArgs;
        extTpl = html.replace(/\${/g, '\\${');
        extTpl = extTpl.replace('<!--template-extract-dom-->', '\${dom}');
        extTpl = extTpl.replace('<!--template-extract-css-->', '<style>\${extStyle}</style>')
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
        extTpl = `<script>(function (g) { g._get_extract_template = function (dom) {var extStyle = '';if (!g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__ = {};for (k in g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {extStyle += g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[k]}return \`${extTpl}\`;}})(typeof window === 'undefined' ? {} : window)</script>`
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