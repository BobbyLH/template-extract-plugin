module.exports = function (id, content) {
  if (typeof window !== 'undefined') {
    if (!window.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) window.__TEMPLATE_EXTRACT_PLUGIN_STYLE__ = {};
    window.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[id] = content.default ? content.default.toString() : content.toString();
  } else {
    if (!global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__) global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__ = {};
    global.__TEMPLATE_EXTRACT_PLUGIN_STYLE__[id] = content.default ? content.default.toString() : content.toString();
  }
};