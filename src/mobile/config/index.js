const config = {
  projectName: 'lightscan-mobile',
  date: '2026-04-17',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist', 
  plugins: [],
  defineConstants: {
    TARO_APP_API_URL: JSON.stringify('http://192.168.1.103:8000'),
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
  },
  mini: {
    compile: {
      exclude: []
    },
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: {
        enable: true,
        config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' }
      }
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: true,
        config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' }
      }
    }
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}