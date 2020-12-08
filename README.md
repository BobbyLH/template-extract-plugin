# template-extract-plugin(webpack模板抽取插件)

[![NPM downloads](http://img.shields.io/npm/dm/template-extract-plugin.svg?style=flat-square)](https://www.npmjs.com/package/template-extract-plugin)
[![npm version](https://badge.fury.io/js/template-extract-plugin.svg)](https://badge.fury.io/js/template-extract-plugin)
[![install size](https://packagephobia.now.sh/badge?p=template-extract-plugin)](https://packagephobia.now.sh/result?p=template-extract-plugin)
[![license](http://img.shields.io/npm/l/template-extract-plugin.svg)](https://github.com/BobbyLH/template-extract-plugin/blob/master/LICENSE)

## 初衷
为了解决前端分享截图痛点，旨在项目 webpack 打包阶段，提取出分享DOM的信息。

从 `html-webpack-plugin` 中提取 `css` 和 `html`，并全局输出 `_get_extract_template_` 方法，获取相应的模板。

## 使用

### 安装

```shell
npm i --save-dev template-extract-plugin

yarn add -D template-extract-plugin
```

### 项目配置
#### 步骤 1：在 index.html/ejs 中添加模板注释

- `<!--template-extract-css-->` `style` 标签插入的位置

- `<!--template-extract-dom-->` 动态DOM插入的位置

- `<!--template-extract-js-->` JS代码插入的位置

- `<!--template-extract-del-start-->` 需要移除的代码块起始标志

- `<!--template-extract-del-end-->` 需要移除的代码结束标志

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <!--template-extract-css-->
    <title>test</title>
    <!--template-extract-del-start-->
    <style>
      .loading{}
    </style>
    <!--template-extract-del-end-->
  </head>
  <body>
    <div id='root'>
      <!--template-extract-del-start-->
      <div class='loading'></div>
      <!--template-extract-del-end-->
      <!--template-extract-dom-->
    </div>
  </body>
  <!--template-extract-js-->
</html>
```

##### 也可通过配置Plugin的参数，指定js插入的位置

```js
const TemplateExtractPlugin = require('template-extract-plugin');

// ……
new TemplateExtractPlugin({
  injectInJs: true, // 将模板注入到 js文件，而非 html文件，模板文件名为 template.extract.js
  fileName: 'js/snapshot.template.[hash:8].js', // 暂只支持 hash
  disable: false, // 禁用插件，默认 false 
  scriptTag: false, // 模板是否保留script标签，默认全部移除
  position: 'head-top' // 值可以是 head-top、head-bottom、body-top、body-bottom，默认 body-bottom
})
```

#### 步骤 2： 配置你的 `webpack.config.js`
**Note**：插件强依赖 `css-loader` 和 `html-webpack-plugin`，请优先注册 `html-webpack-plugin` 保证顺序，注意 `TemplateExtractPlugin.loader` 和 `css-loader` 的顺序。

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TemplateExtractPlugin = require('template-extract-plugin');

module.exports = {
  // 省略若干……
  module: {
    rules: [
      {
        test: /.(css|less)$/,
        use: [
          'style-loader',
          TemplateExtractPlugin.loader, // 置于 css-loader 前
          'css-loader',
          'less-loader'
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'project',
      // ……
    }),
    // ……
    new TemplateExtractPlugin({
      injectInJs: true
    }) // 置于 HtmlWebpackPlugin 后
  ]
};
```

### 应用
#### 在代码中获取(以React项目为例)
```jsx
// src/ShareContent.jsx
export default props => <div>分享的{props.title}内容</div>;
```

```jsx
// src/index.jsx
import ReactDOMServer from 'react-dom/server';
import ShareContent from './ShareContent';

const App = () => (
  <div>
    内容若干……
    <button
      onClick={() => {
        const content = ReactDOMServer.renderToString(ShareContent({
          title: '神奇的'
        }));

        if (window._get_extract_template_) {
          let shareDOM;
          if (customStyle) {
            // 自定义了 style 样式
            shareDOM = window._get_extract_template_(content, customStyle);
          } else {
            shareDOM = window._get_extract_template_(content);
          }

          // 接下去的逻辑可能是：发送你的分享DOM到某个node服务，而后用无头浏览器生成图片的相关信息返回给客户端
          // ajax.send(shareDOM);
        }
      }}
    >
      分享按钮
    </button>
  </div>
);
```

**Note**：如果你的静态资源 `src` 地址是自动获取 protocol 的方式(`//cdn.xxx.com/image.jpg`)，可能你需要手动为其添加 protocol，以便它能在无头浏览器中正常执行。