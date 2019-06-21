var baseKarmaConfig = require('./karma.base.conf.js');

var conf = baseKarmaConfig;
conf['browsers'] = ['Chrome'];

module.exports = function(config) {
  config.set(conf);
};
