const path = require('path');
const webpack = require('webpack');
const SentryWebpackPlugin = require('@sentry/webpack-plugin');

const gitCommit = require('child_process')
  .execSync('git rev-parse --short HEAD')
  .toString()
  .trim();
const gitBranch = require('child_process')
  .execSync('git rev-parse --abbrev-ref HEAD')
  .toString()
  .trim();

const releaseName = `fixtweet-${gitBranch}-${gitCommit}-${new Date()
  .toISOString()
  .substring(0, 19)}`;

require('dotenv').config();

let plugins = [
  new webpack.DefinePlugin({
    BRANDING_NAME: `'${process.env.BRANDING_NAME}'`
  }),
  new webpack.DefinePlugin({
    BRANDING_NAME_DISCORD: `'${process.env.BRANDING_NAME_DISCORD}'`
  }),
  new webpack.DefinePlugin({
    DIRECT_MEDIA_DOMAINS: `'${process.env.DIRECT_MEDIA_DOMAINS}'`
  }),
  new webpack.DefinePlugin({
    HOST_URL: `'${process.env.HOST_URL}'`
  }),
  new webpack.DefinePlugin({
    REDIRECT_URL: `'${process.env.REDIRECT_URL}'`
  }),
  new webpack.DefinePlugin({
    EMBED_URL: `'${process.env.EMBED_URL}'`
  }),
  new webpack.DefinePlugin({
    MOSAIC_DOMAIN_LIST: `'${process.env.MOSAIC_DOMAIN_LIST}'`
  }),
  new webpack.DefinePlugin({
    API_HOST_LIST: `'${process.env.API_HOST_LIST}'`
  }),
  new webpack.DefinePlugin({
    SENTRY_DSN: `'${process.env.SENTRY_DSN}'`
  }),
  new webpack.DefinePlugin({
    RELEASE_NAME: `'${releaseName}'`
  }),
  new webpack.DefinePlugin({
    DEPRECATED_DOMAIN_LIST: `'${process.env.DEPRECATED_DOMAIN_LIST}'`
  }),
  new webpack.DefinePlugin({
    DEPRECATED_DOMAIN_EPOCH: `'${process.env.DEPRECATED_DOMAIN_EPOCH}'`
  })
];

if (process.env.SENTRY_AUTH_TOKEN) {
  plugins.push(
    new SentryWebpackPlugin({
      release: releaseName,
      include: './dist',
      urlPrefix: '~/',
      ignore: ['node_modules', 'webpack.config.js'],
      authToken: process.env.SENTRY_AUTH_TOKEN
    })
  );
}

module.exports = {
  entry: {
    worker: './src/server.ts'
  },
  target: 'webworker',
  devtool: 'source-map',
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'dist')
  },
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: { util: false }
  },
  plugins: plugins,
  optimization: {
    mangleExports: 'size'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true
        }
      }
    ]
  }
};
