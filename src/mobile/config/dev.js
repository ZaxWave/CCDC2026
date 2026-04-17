module.exports = {
  env: { NODE_ENV: '"development"' },
  defineConstants: {},
  mini: {
    // 关闭 source-map 减小 bundle 体积，缓解 timeout
    enableSourceMap: false,
  },
  h5: {}
}
