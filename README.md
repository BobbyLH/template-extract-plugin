# template-extract-plugin(webpack模板抽取插件)

[![NPM downloads](http://img.shields.io/npm/dm/template-extract-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@omni-door/utils)
[![npm version](https://badge.fury.io/js/template-extract-plugin.svg)](https://badge.fury.io/js/template-extract-plugin)
[![install size](https://packagephobia.now.sh/badge?p=template-extract-plugin)](https://packagephobia.now.sh/result?p=template-extract-plugin)
[![license](http://img.shields.io/npm/l/template-extract-plugin.svg)](https://github.com/omni-door/utils/blob/master/LICENSE)

## 初衷
为了解决前端分享截图痛点，旨在项目 webpack 打包阶段，提取出分享DOM的信息。

从 `html-webpack-plugin` 中提取 `css` 和 `html`，并全局输出 `_get_extract_template` 方法，获取相应的模板。

## 使用

### 安装

```shell
npm i --save-dev template-extract-plugin

yarn add -D template-extract-plugin
```

### index.html 中的模板注释

- `<!--template-extract-css-->` `style` 标签插入的位置

- `<!--template-extract-dom-->` 动态DOM插入的位置

- `<!--template-extract-js-->` JS代码插入的位置

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <!--template-extract-css-->
    <title>test</title>
  </head>
  <body>
    <div id='root'><!--template-extract-dom--></div>
  </body>
  <!--template-extract-js-->
</html>
```

#### 通过配置Plugin的参数，指定js插入的位置

```js
const TemplateExtractPlugin = require('template-extract-plugin');

// ……
new TemplateExtractPlugin({
  disable: false,
  position: 'head-top' // 值可以是 head-top、head-bottom、body-top、body-bottom
})
```

### webpack.config.js 配置
```js
const TemplateExtractPlugin = require('template-extract-plugin');

module.exports = {
  // 省略若干……
  module: {
    rules: [
      {
        test: /.(css|less)$/,
        use: [
          'style-loader',
          TemplateExtractPlugin.loader,
          'css-loader',
          'less-loader'
        ]
      }
    ]
  },
  plugins: [
    // ……
    new TemplateExtractPlugin()
  ]
};
```

### 在代码中获取(以React项目为例)
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
    各种内容
    <button
      onClick={() => {
        const content = ReactDOMServer.renderToString(ShareContent({
          title: '神奇的'
        });

        if (window._get_extract_template) {
          const shareDOM = window._get_extract_template(content);

          // 接下去的逻辑可能是：发送你的分享DOM到某个node服务，而后用无头浏览器生成图片的相关信息返回给客户端
          // ajax.send(shareDOM);
        }
      }}
    >分享按钮</button>
  </div>
);
```