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

function gatherArgs(extraArgs, file) {
    return [
        file,
        '--require=out/test/unittests.js',
        '--exclude=out/**/*.jsx',
        '--reporter=mocha-multi-reporters',
        '--reporter-option=configFile=build/.mocha-multi-reporters.config',
        '--ui=tdd',
        '--recursive',
        '--colors',
        '--exit',
        '--timeout=180000',
        ...extraArgs
    ];
}

async function runIndividualTest(extraArgs, file, index) {
    var subMochaFile = `${mochaBaseFile}_${index}_${path.basename(file)}${mochaFileExt}`;
    process.env['MOCHA_FILE'] = subMochaFile;
    var args = gatherArgs(extraArgs, file);
    console.log(`Running functional test for file ${file} ...`);
    var exitCode = await new Promise((resolve) => {
        // Spawn the sub node process
        var proc = child_process.fork('./node_modules/mocha/bin/_mocha', args);
        proc.on('exit', resolve);
    });

    // If failed keep track
    if (exitCode !== 0) {
        console.log(`Functional tests for ${file} failed.`);
    } else {
        console.log(`Functional test for ${file} succeeded`);
    }

    return exitCode;
}

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

    // Figure out what group is running
    var groupArgIndex = process.argv.findIndex((a) => a === '--group');
    var groupArg =
        groupArgIndex >= 0 && groupArgIndex < process.argv.length - 1
            ? parseInt(process.argv[groupArgIndex + 1], 10) - 1
            : -1;

    // Split the files into groups if asked (4 equal parts as we support 4 groups)
    var groupSize = Math.floor(files.length / 4);
    var startIndex = groupArg >= 0 ? groupSize * groupArg : 0;
    var endIndex = groupArg >= 0 && groupArg < 3 ? startIndex + groupSize : files.length;
    console.log(`Running for group ${groupArg} from ${startIndex} to ${endIndex}`);
    files = files.slice(startIndex, endIndex);

    // Extract any extra args for the individual mocha processes
    var extraArgs =
        groupArg >= 0 && process.argv.length > 4
            ? process.argv.slice(4)
            : process.argv.length > 2
            ? process.argv.slice(2)
            : [];

    // Iterate over them, running mocha on each
    var returnCode = 0;

    // Start timing now (don't care about glob time)
    var startTime = Date.now();

    // Run all of the tests (in parallel or sync based on env)
    try {
        if (process.env.VSCODE_PYTHON_FORCE_TEST_SYNC) {
            for (var i = 0; i < files.length; i += 1) {
                // Synchronous, one at a time
                returnCode = returnCode | (await runIndividualTest(extraArgs, files[i], i));
            }
        } else {
            // Parallel, all at once
            const returnCodes = await Promise.all(files.map(runIndividualTest.bind(undefined, extraArgs)));

            // Or all of the codes together
            returnCode = returnCodes.reduce((p, c) => p | c);
        }
    } catch (ex) {
        console.log(`Functional tests run failure: ${ex}.`);
        returnCode = -1;
    }

    // Reset the mocha file variable
    if (originalMochaFile) {
        process.env['MOCHA_FILE'] = originalMochaFile;
    }

    var endTime = Date.now();

    // Indicate error code and total time of the run
    console.log(`Functional test run result: ${returnCode} after ${(endTime - startTime) / 1_000} seconds`);
    process.exit(returnCode);
}

// Call the main function. It will exit when promise is finished.
main();
