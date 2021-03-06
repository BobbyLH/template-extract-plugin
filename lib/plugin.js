'use-strict';
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const CleanCss = require('clean-css');
const minifyHtml = require('html-minifier-terser');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ConcatSource = require('webpack-sources').ConcatSource;
const { util: { createHash } } = require('webpack');
const { PLUGIN_NAME, error } = require('./utils');

// webpack 3.x and earlier
const events = {
  before: 'html-webpack-plugin-before-html-processing',
  after: 'html-webpack-plugin-after-html-processing'
};

// webpack 4.x and later
const hook4Events = {
  before: 'htmlWebpackPluginBeforeHtmlProcessing',
  after: 'htmlWebpackPluginAfterHtmlProcessing'
};

// webpack 5.x and later
const hook5Events = {
  before: 'afterTemplateExecution',
  after: 'beforeEmit'
};

const fnName = '_get_extract_template_';
const REGEXP_HASH = /\[hash(?::(\d+))?\]/i;

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
      compiler.hooks.compilation.tap('HtmlWebpackPlugin', this.compilation.bind(this, HtmlWebpackPlugin.getHooks ? hook5Events : hook4Events));
    } else {
      compiler.plugin('compilation', this.compilation.bind(this, events));
    }
  }

  compilation (events, compilation) {
    const { scriptTag, injectInJs, fileName, sync } = this.options;
    let extTpl = '';
    this.wire(
      events.before,
      compilation,
      (pluginArgs) => {
        let extStyle = '';
        if (global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {
          for (const k in global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {
            extStyle += global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[k];
          }
          extStyle = new CleanCss().minify(extStyle).styles;
        }
        const { html } = pluginArgs;
        extTpl = html.replace(/\${/g, '\\${');
        extTpl = extTpl.replace(/<!--template-extract-del-start-->([\s\S]*?)<!--template-extract-del-end-->/g, '');
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
          extTpl = `(function (g) {try {g.${fnName} = function (dom, style) {function raw() {var callSite = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};for (var _len = arguments.length, substitutions = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {substitutions[_key - 1] = arguments[_key];}var template;try {template = Array.from(callSite.raw);} catch (e) {throw new TypeError('Your browser not support Array.form API!');}return template.map(function (chunk, i){if (callSite.raw.length <= i) {return chunk;}return substitutions[i - 1] ? substitutions[i - 1] + chunk : chunk;}).join('');};return \`${extTpl}\`;}} catch (e) {console.error('[Template-Extract-Plugin]: ', e);}})(typeof window === 'undefined' ? {} : window)`
        } else {
          extTpl = `(function (g) {try {g.${fnName} = function (dom, style) {var extStyle = '';if (!g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__ = {};for (var k in g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) {extStyle += g.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[k]}return \`${extTpl}\`;}} catch (e) {console.error('[Template-Extract-Plugin]: ', e);}})(typeof window === 'undefined' ? {} : window)`
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
          const extTplWithScript = '<script>' + extTpl + '</script>';
          const { position } = this.options;
          switch (position) {
            case 'head-top':
              toReplace = '<head>';
              replaceWith = toReplace + extTplWithScript;
              break;
            case 'head-bottom':
              toReplace = '</head>';
              replaceWith = extTplWithScript + toReplace;
              break;
            case 'body-top':
              toReplace = '<body>';
              replaceWith = toReplace + extTplWithScript;
              break;
            case 'body-bottom':
            default:
              toReplace = '</body>';
              replaceWith = toReplace + extTplWithScript;
              break;
          }
        }

        function injectInHtml () {
          pluginArgs.html = pluginArgs.html.replace(toReplace, replaceWith);
        }

        if (injectInJs) {
          const jsFiles = HtmlWebpackPlugin.getHooks ? JSON.parse(pluginArgs.plugin.assetJson) : pluginArgs.assets.js;
          if (!jsFiles || jsFiles.length === 0) {
            compilation.warnings.push(`[${PLUGIN_NAME}]: There is not any js file, template will be injected in html file!`);
            injectInHtml();
          } else {
            let fileIndex = 0;
            jsFiles.forEach((fileName, ind) => {
              if (~fileName.indexOf('vendor')) {
                fileIndex = ind;
              } else if (~fileName.indexOf('chunk')) {
                fileIndex = ind;
              } else if (~fileName.indexOf('main')) {
                fileIndex = ind;
              } else if (~fileName.indexOf('index')) {
                fileIndex = ind;
              }
            });
            let injectFileName = jsFiles[fileIndex].split('?')[0];
            const publicPath = HtmlWebpackPlugin.getHooks ? compilation.outputOptions.publicPath : pluginArgs.assets.publicPath;
            if (publicPath && publicPath !== 'auto') {
              injectFileName = injectFileName.split(publicPath)[1];
            }
            const injectJs = compilation.assets[injectFileName];
            if (injectJs) {
              let file_name = fileName || 'template.extract.js';
              if (REGEXP_HASH.test(file_name)) {
                const matchs = file_name.match(REGEXP_HASH);
                const { outputOptions } = compilation;
                const { hashFunction, hashDigest, hashDigestLength } = outputOptions;
                const hash = createHash(hashFunction).digest(hashDigest)
                .substring(0, matchs[1] || hashDigestLength);
                file_name = file_name.replace(matchs[0], hash);
              }

              const executeJs = `if(!g.${fnName}_init_ && !g.${fnName}){g.${fnName}_init_=true;var s=document.createElement("script");s.charset="utf-8",s.type="text/javascript",s.src="${publicPath && publicPath !== 'auto' ? publicPath + file_name : file_name}";s.defer=true;s.async=false;g.document.body.appendChild(s);}`
              const appendJs = `(function (g) {${sync ? executeJs : `g.setTimeout(function(){${executeJs}},0);`}})(window);`
              if (!~injectJs.source().indexOf(appendJs)) {
                compilation.assets[injectFileName] = new ConcatSource(
                  injectJs,
                  appendJs
                );
              }

              const cacheFilePath = path.resolve(__dirname, '.cache.js');
              fs.writeFileSync(cacheFilePath, extTpl, {
                encoding: 'utf-8'
              });
              const { code } = babel.transformSync(extTpl, {
                filename: cacheFilePath,
                presets: ['@babel/preset-env', ['babel-preset-minify', {
                  keepFnName: true
                }]],
                babelrc: false
              });
              fs.unlinkSync(cacheFilePath);

              const content = '/** https://github.com/BobbyLH/template-extract-plugin **/\n' + code + '\n/** Copyright (c) 2020 Bobby Li, Release under the MIT License **/';
              compilation.assets[file_name] = {
                source: () => content,
                size: () => Buffer.byteLength(content, 'utf8')
              }

              let pureHtml = pluginArgs.html.replace(/<!--template-extract-dom-->/g, '');
              pureHtml = pureHtml.replace(/<!--template-extract-css-->/g, '');
              pureHtml = pureHtml.replace(/<!--template-extract-js-->/g, '');
              pureHtml = pureHtml.replace(/<!--template-extract-del-start-->/g, '');
              pureHtml = pureHtml.replace(/<!--template-extract-del-end-->/g, '');
              pluginArgs.html = pureHtml;
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
          error(err);
        }
      }
    };

    if (compilation.hooks) {
      if (HtmlWebpackPlugin.getHooks) {
        HtmlWebpackPlugin.getHooks(compilation)[event].tapAsync(PLUGIN_NAME, eventCallback);
      } else if (compilation.hooks[event]) {
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