// This script will run all of the functional tests for each functional test file in sequence
// This prevents mocha from running out of memory when running all of the tests
//
// This could potentially be improved to run tests in parallel (try that later)
//
// Additionally this was written in python at first but running python on an azure
// machine may pick up an invalid environment for the subprocess. Node doesn't have this problem
var path = require('path');
var glob = require('glob');
var child_process = require('child_process');

// Create a base for the output file
var originalMochaFile = process.env['MOCHA_FILE'];
var mochaFile = originalMochaFile || './test-results.xml';
var mochaBaseFile = path.join(path.dirname(mochaFile), path.basename(mochaFile, '.xml'));
var mochaFileExt = '.xml';

// Wrap async code in a function so can wait till done
async function main() {
    console.log('Globbing files for functional tests');

    // Glob all of the files that we usually send to mocha as a group (see mocha.functional.opts.xml)
    var files = await new Promise((resolve, reject) => {
        glob('./out/test/**/*.functional.test.js', (ex, res) => {
            if (ex) {
                reject(ex);
            } else {
                resolve(res);
            }
        });
    });

    // Iterate over them, running mocha on each
    var returnCode = 0;

    // Go through each one at a time
    try {
        for (var index = 0; index < files.length; index += 1) {
            // Each run with a file will expect a $MOCHA_FILE$ variable. Generate one for each
            // Note: this index is used as a pattern when setting mocha file in the test_phases.yml
            var subMochaFile = `${mochaBaseFile}_${index}_${path.basename(files[index])}${mochaFileExt}`;
            process.env['MOCHA_FILE'] = subMochaFile;
            var exitCode = await new Promise((resolve) => {
                // Spawn the sub node process
                var proc = child_process.fork('./node_modules/mocha/bin/_mocha', [
                    files[index],
                    '--require=out/test/unittests.js',
                    '--exclude=out/**/*.jsx',
                    '--reporter=mocha-multi-reporters',
                    '--reporter-option=configFile=build/.mocha-multi-reporters.config',
                    '--ui=tdd',
                    '--recursive',
                    '--colors',
                    '--exit',
                    '--timeout=180000'
                ]);
                proc.on('exit', resolve);
            });

            // If failed keep track
            if (exitCode !== 0) {
                console.log(`Functional tests for ${files[index]} failed.`);
                returnCode = exitCode;
            }
        }
    } catch (ex) {
        console.log(`Functional tests run failure: ${ex}.`);
        returnCode = -1;
    }

    // Reset the mocha file variable
    if (originalMochaFile) {
        process.env['MOCHA_FILE'] = originalMochaFile;
    }

    // Indicate error code
    console.log(`Functional test run result: ${returnCode}`);
    process.exit(returnCode);
}

// Call the main function. It will exit when promise is finished.
main();
