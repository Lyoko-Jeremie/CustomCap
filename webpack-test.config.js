const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
    entry: {
        'testTimeLock': './test/test.ts',
    },
    mode: 'development',
    devtool: 'inline-source-map',
    target: 'web',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "crypto": false,
            "stream": false,
            "buffer": false,
            "util": false,
            "path": false,
            "fs": false,
            "os": false,
        },
    },
    output: {
        filename: 'bundle-[name].js',
        path: path.resolve(__dirname, 'test/build/test'),
        clean: true,
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            typescript: {
                configFile: 'tsconfig.json',
                memoryLimit: 4096,
            },
        }),
        new HtmlWebpackPlugin({
            title: 'Test',
            template: './test/test.html',
            filename: 'test.html'
        }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'test/build'),
        },
        compress: true,
        port: 9000,
        open: true,
    },
    experiments: {
        topLevelAwait: true,
    },
};
