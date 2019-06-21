var baseKarmaConfig = require('./karma.base.conf.js');

var conf = baseKarmaConfig;
conf['browsers'] = ['ChromeHeadless'];

module.exports = function(config) {
  config.set(conf);
};
