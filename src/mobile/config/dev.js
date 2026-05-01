module.exports = {
  env: {
    NODE_ENV: '"development"',
    TARO_APP_API_URL: '"http://39.105.106.58"',
  },
  defineConstants: {},
  mini: {
    enableSourceMap: false,
    debugReact: false,
    hot: false,       // 关掉热更新，避免 WebSocket 连到错误 IP 导致 Disconnected
  },
  h5: {}
}
