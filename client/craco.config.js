// Configuration for webpack to handle YAML files

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add YAML loader rule
      webpackConfig.module.rules.push({
        test: /\.ya?ml$/,
        use: 'yaml-loader',
      });
      
      return webpackConfig;
    },
  },
};