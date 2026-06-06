const path = require('path');

module.exports = {
  mode: 'none',
  target: 'node',
  entry: {
    extension: './src/extension.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs',
  },
  resolve: {
    mainFields: ['module', 'main'],
    extensions: ['.ts', '.js'],
    fallback: {
      "path": false,
      "fs": false,
      "os": false,
      "child_process": false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'ES2022'
              }
            }
          }
        ]
      }
    ]
  },
  externals: {
    vscode: 'commonjs vscode',
    playwright: 'commonjs playwright'
  },
  devtool: 'nosources-source-map',
};
