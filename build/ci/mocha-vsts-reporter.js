'use-strict';

var mocha = require('mocha');
var MochaJUnitReporter = require('mocha-junit-reporter');
const colors = require('colors/safe');
module.exports = MochaVstsReporter;

function MochaVstsReporter(runner, options) {
    MochaJUnitReporter.call(this, runner, options);
    var INDENT_BASE = '  ';
    var indenter = '';
    var indentLevel = 0;
    var passes = 0;
    var failures = 0;
    var skipped = 0;

    runner.on('suite', function (suite) {
        if (suite.root === true) {
            console.log('Begin test run.............');
            indentLevel++;
            indenter = INDENT_BASE.repeat(indentLevel);
        } else {
            console.log('%sStart "%s"', indenter, suite.title);
            indentLevel++;
            indenter = INDENT_BASE.repeat(indentLevel);
        }
    });

    runner.on('suite end', function (suite) {
        if (suite.root === true) {
            indentLevel = 0;
            indenter = '';
            console.log('.............End test run.');
        } else {
            console.log('%sEnd "%s"', indenter, suite.title);
            indentLevel--;
            indenter = INDENT_BASE.repeat(indentLevel);
        }
    });

    runner.on('pass', function (test) {
        passes++;
        console.log(colors.green(`${indenter}✓ ${test.title} (${test.duration}ms)`));
    });

    runner.on('pending', function (test) {
        skipped++;
        console.log(colors.yellow(`${indenter}- ${test.title}`));
    });

    runner.on('fail', function (test, err) {
        failures++;
        console.log(colors.red(`${indenter}✖ ${test.title} -- error: ${err.message}`));
        console.log(colors.red(`Failed: ${test.parent.title} :: ${test.title} (${test.file})`));
    });

    runner.on('end', function () {
        console.log(colors.green(`SUMMARY: ${passes}/${passes + failures}, ${skipped} skipped`));
    });
}

mocha.utils.inherits(MochaVstsReporter, MochaJUnitReporter);
