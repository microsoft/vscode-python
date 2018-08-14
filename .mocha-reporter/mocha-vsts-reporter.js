'use-strict';

var mocha = require('mocha');
var MochaJUnitReporter = require('mocha-junit-reporter');
module.exports = MochaVstsReporter;

function MochaVstsReporter(runner, options) {
  MochaJUnitReporter.call(this, runner, options);
  var INDENT_BASE = '  ';
  var indenter = '';
  var indentLevel = 0;
  var passes = 0;
  var failures = 0;
  var skipped = 0;

  runner.on('suite', function(suite){
    if (suite.root === true){
      console.log('Begin test run.............');
      indentLevel++;
      indenter = INDENT_BASE.repeat(indentLevel);
    } else {
      console.log('%sStart "%s"', indenter, suite.title);
      indentLevel++;
      indenter = INDENT_BASE.repeat(indentLevel);
    }
  });

  runner.on('suite end', function(suite){
    if (suite.root === true) {
      indentLevel=0;
      indenter = '';
      console.log('.............End test run.');
    } else {
      console.log('%sEnd "%s"', indenter, suite.title);
      indentLevel--;
      indenter = INDENT_BASE.repeat(indentLevel);
      // ##vso[task.setprogress]current operation
    }
  });

  runner.on('pass', function(test){
    passes++;
    console.log('%s✓ %s (%dms)', indenter, test.title, test.duration);
  });

  runner.on('pending', function(test){
    skipped++;
    console.log('%s- %s', indenter, test.title);
    console.log('##vso[task.logissue type=warning;sourcepath=%s;]SKIPPED TEST %s :: %s', test.file, test.parent.title, test.title);
  });

  runner.on('fail', function(test, err){
    failures++;
    console.log('%s✖ %s -- error: %s', indenter, test.title, err.message);
    console.log('##vso[task.logissue type=error;sourcepath=%s;]FAILED %s :: %s', test.file, test.parent.title, test.title);
  });

  runner.on('end', function(){
    console.log('SUMMARY: %d/%d passed, %d skipped', passes, passes + failures, skipped);
  });
}

mocha.utils.inherits(MochaVstsReporter, MochaJUnitReporter);
