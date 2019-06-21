const coveralls = require('coveralls');
console.log(
    coveralls.getOptions(function(ex, options) {
        console.error(ex);
        console.log(JSON.stringify(options, undefined, 4));
    })
);
