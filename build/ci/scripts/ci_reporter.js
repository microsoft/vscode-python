'use strict';

const { reporters } = require('mocha');
const Spec = require('./spec_with_pid');

class CIReporter extends reporters.XUnit {
    constructor(runner, options = {}) {
        const reporterOptions = options.reporterOptions || {};
        super(runner, {
            ...options,
            reporterOptions: {
                ...reporterOptions,
                output: reporterOptions.output || process.env.MOCHA_FILE || 'test-results.xml',
            },
        });
        const ConsoleReporter = reporterOptions.consoleReporter ? require(reporterOptions.consoleReporter) : Spec;
        this.consoleReporter = new ConsoleReporter(runner, options);
    }

    done(failures, callback) {
        super.done(failures, () => {
            if (this.consoleReporter.done) {
                this.consoleReporter.done(failures, callback);
            } else {
                callback(failures);
            }
        });
    }
}

module.exports = CIReporter;
