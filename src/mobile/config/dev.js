module.exports = {
  env: {
    NODE_ENV: '"development"',
    TARO_APP_API_URL: '"http://192.168.1.103:8000"',
  },
  defineConstants: {},
  mini: {
    enableSourceMap: false,
    debugReact: false,
    hot: false,       // 关掉热更新，避免 WebSocket 连到错误 IP 导致 Disconnected
  },
  h5: {}
}
