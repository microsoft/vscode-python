/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const filter = require('gulp-filter');
const es = require('event-stream');
const tsfmt = require('typescript-formatter');
const tslint = require('tslint');
const relative = require('relative');
const ts = require('gulp-typescript');
const cp = require('child_process');
const colors = require('colors/safe');
const gitmodified = require('gulp-gitmodified');
const path = require('path');
const debounce = require('debounce');

/**
* Hygiene works by creating cascading subsets of all our files and
* passing them through a sequence of checks. Here are the current subsets,
* named according to the checks performed on them. Each subset contains
* the following one, as described in mathematical notation:
*
* all ⊃ indentation ⊃ typescript
*/

const all = [
    'src/**/*',
    'src/client/**/*',
];

const indentationFilter = [
    'src/**/*.ts',
    '!**/typings/**/*',
];

const tslintFilter = [
    'src/**/*.ts',
    'test/**/*.ts',
    '!**/node_modules/**',
    '!out/**/*',
    '!images/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!**/typings/**/*',
];

gulp.task('hygiene', () => run({ mode: 'all', skipFormatCheck: true, skipIndentationCheck: true }));

gulp.task('compile', () => run({ mode: 'compile', skipFormatCheck: true, skipIndentationCheck: true, skipLinter: true }));

gulp.task('watch', ['hygiene-modified', 'hygiene-watch']);

gulp.task('hygiene-watch', () => gulp.watch(all, debounce(() => run({ mode: 'changes' }), 1000)));

gulp.task('hygiene-modified', ['compile'], () => run({ mode: 'changes' }));


/**
* @typedef {Object} hygieneOptions - creates a new type named 'SpecialType'
* @property {'changes'|'staged'|'all'|'compile'} [mode=] - Mode.
* @property {boolean=} skipIndentationCheck - Skip indentation checks.
* @property {boolean=} skipFormatCheck - Skip format checks.
* @property {boolean=} skipLinter - Skip linter.
*/

/**
 *
 * @param {hygieneOptions} options
 * @returns {NodeJS.ReadWriteStream}
 */
const hygiene = (options) => {
    options = options || {};
    let errorCount = 0;

    const indentation = es.through(function (file) {
        file.contents
            .toString('utf8')
            .split(/\r\n|\r|\n/)
            .forEach((line, i) => {
                if (/^\s*$/.test(line) || /^\S+.*$/.test(line)) {
                    // Empty or whitespace lines are OK.
                } else if (/^(\s\s\s\s)+.*/.test(line)) {
                    // Good indent.
                } else if (/^[\t]+.*/.test(line)) {
                    console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation (use 4 spaces instead of tabs or other)');
                    errorCount++;
                }
            });

        this.emit('data', file);
    });

    const formatOptions = { verify: true, tsconfig: true, tslint: true, editorconfig: true, tsfmt: true };
    const formatting = es.map(function (file, cb) {
        tsfmt.processString(file.path, file.contents.toString('utf8'), formatOptions)
            .then(result => {
                if (result.error) {
                    let message = result.message.trim();
                    let formattedMessage = '';
                    if (message.startsWith(__dirname)) {
                        message = message.substr(__dirname.length);
                        message = message.startsWith(path.sep) ? message.substr(1) : message;
                        const index = message.indexOf('.ts ');
                        if (index === -1) {
                            formattedMessage = colors.red(message);
                        } else {
                            const file = message.substr(0, index + 3);
                            const errorMessage = message.substr(index + 4).trim();
                            formattedMessage = `${colors.red(file)} ${errorMessage}`;
                        }
                    } else {
                        formattedMessage = colors.red(message);
                    }
                    console.error(formattedMessage);
                    errorCount++;
                }
                cb(null, file);
            })
            .catch(cb);
    });

    let reportedLinterFailures = [];
    /**
     * Report the linter failures
     * @param {any[]} failures
     */
    function reportLinterFailures(failures) {
        failures
            .map(failure => {
                const name = failure.name || failure.fileName;
                const position = failure.startPosition;
                const line = position.lineAndCharacter ? position.lineAndCharacter.line : position.line;
                const character = position.lineAndCharacter ? position.lineAndCharacter.character : position.character;

                // Output in format similar to tslint for the linter to pickup.
                const message = `ERROR: (${failure.ruleName}) ${relative(__dirname, name)}[${line + 1}, ${character + 1}]: ${failure.failure}`;
                if (reportedLinterFailures.indexOf(message) === -1) {
                    console.error(message);
                    reportedLinterFailures.push(message);
                    return true;
                } else {
                    return false;
                }
            })
            .filter(reported => reported === true)
            .length > 0;
    }
    const configuration = tslint.Configuration.findConfiguration(null, '.');
    const program = tslint.Linter.createProgram('./tsconfig.json');
    const linter = new tslint.Linter({ formatter: 'json' }, program);
    const tsl = es.through(function (file) {
        const contents = file.contents.toString('utf8');
        // Don't print anything to the console, we'll do that.
        // Yes this is a hack, but tslinter doesn't provide an option to prevent this.
        const oldWarn = console.warn;
        console.warn = () => { };
        linter.lint(file.relative, contents, configuration.results);
        console.warn = oldWarn;
        const result = linter.getResult();
        if (result.failureCount > 0 || result.errorCount > 0) {
            const reported = reportLinterFailures(result.failures);
            if (result.failureCount && reported) {
                errorCount += result.failureCount;
            }
            if (result.errorCount && reported) {
                errorCount += result.errorCount;
            }
        }
        this.emit('data', file);
    });

    const tsFiles = [];
    const tscFilesTracker = es.through(function (file) {
        tsFiles.push(file.path.replace(/\\/g, '/'));
        tsFiles.push(file.path);
        this.emit('data', file);
    });

    const tsOptions = options.mode === 'compile' ? undefined : { strict: true, noImplicitAny: false, noImplicitThis: false };
    const tsProject = ts.createProject('tsconfig.json', tsOptions);

    const tsc = function () {
        function customReporter() {
            return {
                error: function (error) {
                    const fullFilename = error.fullFilename || '';
                    const relativeFilename = error.relativeFilename || '';
                    if (tsFiles.findIndex(file => fullFilename === file || relativeFilename === file) === -1) {
                        return;
                    }
                    errorCount += 1;
                    console.error(error.message);
                },
                finish: function () {
                    // forget the summary.
                }
            };
        }
        const reporter = customReporter();
        return tsProject(reporter);
    }

    const files = options.mode === 'compile' ? tsProject.src() : getFilesToProcess(options);
    const dest = options.mode === 'compile' ? './out' : '.';
    let result = files
        .pipe(filter(f => !f.stat.isDirectory()));

    if (!options.skipIndentationCheck) {
        result = result.pipe(filter(indentationFilter))
            .pipe(indentation);
    }

    result = result
        .pipe(filter(tslintFilter));

    if (!options.skipFormatCheck) {
        // result = result
        //     .pipe(formatting);
    }

    if (!options.skipLinter) {
        result = result
            .pipe(tsl);
    }

    result = result
        .pipe(tscFilesTracker)
        .pipe(tsc())
        .js.pipe(gulp.dest(dest))
        .pipe(es.through(null, function () {
            if (errorCount > 0) {
                const errorMessage = `Hygiene failed with ${colors.yellow(errorCount)} errors 👎 . Check 'gulpfile.js'.`;
                console.error(colors.red(errorMessage));
                exitHandler(options);
            } else {
                console.log(colors.green('Hygiene passed with 0 errors 👍.'));
            }
            // Reset error counter.
            errorCount = 0;
            reportedLinterFailures = [];
            this.emit('end');
        }))
        .on('error', exitHandler.bind(this, options));
};

/**
* @typedef {Object} runOptions
* @property {boolean=} exitOnError - Exit on error.
* @property {'changes'|'staged'|'all'} [mode=] - Mode.
* @property {string[]=} files - Optional list of files to be modified.
* @property {boolean=} skipIndentationCheck - Skip indentation checks.
* @property {boolean=} skipFormatCheck - Skip format checks.
* @property {boolean=} skipLinter - Skip linter.
 * @property {boolean=} watch - Watch mode.
*/

/**
* Run the linters.
* @param {runOptions} options
* @param {Error} ex
*/
function exitHandler(options, ex) {
    console.error();
    if (ex) {
        console.error(ex);
        console.error(colors.red(ex));
    }
    if (options.exitOnError) {
        console.log('exit');
        process.exit(1);
    }
}

/**
* Run the linters.
* @param {runOptions} options
*/
function run(options) {
    options = options ? options : {};
    process.once('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        exitHandler(options);
    });

    return hygiene(options);
}
function getStagedFilesSync() {
    const out = cp.execSync('git diff --cached --name-only', { encoding: 'utf8' });
    const some = out
        .split(/\r?\n/)
        .filter(l => !!l);
    return some;
}

/**
* @param {hygieneOptions} options
*/
function getFilesToProcess(options) {
    const mode = options ? options.mode : 'all';
    const gulpSrcOptions = { base: '.' };

    // If we need only modified files, then filter the glob.
    if (options && options.mode === 'changes') {
        return gulp.src(all, gulpSrcOptions)
            .pipe(gitmodified(['M', 'A', 'D', 'R', 'C', 'U', '??']));
    }

    if (options && options.mode === 'staged') {
        return gulp.src(getStagedFilesSync(), gulpSrcOptions);
    }

    return gulp.src(all, gulpSrcOptions);
}

exports.hygiene = hygiene;

// this allows us to run hygiene as a git pre-commit hook.
if (require.main === module) {
    run({ exitOnError: true, mode: 'staged' });
}
