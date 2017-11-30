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
const watch = require('gulp-debounced-watch');
const cp = require('child_process');
const colors = require('colors/safe');

/**
 * Hygiene works by creating cascading subsets of all our files and
 * passing them through a sequence of checks. Here are the current subsets,
 * named according to the checks performed on them. Each subset contains
 * the following one, as described in mathematical notation:
 *
 * all ⊃ eol ⊇ indentation ⊃ copyright ⊃ typescript
 */

const all = [
    'src/**/*',
    'src/client/**/*',
];

const eolFilter = [
    '**',
    '!.editorconfig',
    '!.eslintrc',
    '!.gitignore',
    '!.gitmodules',
    '!.jshintignore',
    '!.jshintrc',
    '!.npmrc',
    '!.vscodeignore',
    '!LICENSE',
    '!**/node_modules/**',
    '!**/*.{svg,exe,png,bmp,scpt,bat,cmd,cur,ttf,woff,eot,txt,md,json,yml,pyc}',
    '!out/**/*',
    '!images/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!**/typings/**/*',
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

function reportFailures(failures) {
    failures.forEach(failure => {
        const name = failure.name || failure.fileName;
        const position = failure.startPosition;
        const line = position.lineAndCharacter ? position.lineAndCharacter.line : position.line;
        const character = position.lineAndCharacter ? position.lineAndCharacter.character : position.character;

        // Output in format similar to tslint for the linter to pickup.
        console.error(`ERROR: (${failure.ruleName}) ${relative(__dirname, name)}[${line + 1}, ${character + 1}]: ${failure.failure}`);
    });
}


/**
 * @typedef {Object} hygieneOptions - creates a new type named 'SpecialType'
 * @property {boolean=} skipEOL - skipEOL check.
 * @property {boolean=} skipIndentationCheck - Skip indentation checks.
 * @property {boolean=} skipFormatCheck - Skip format checks.
 */

/**
  *
  * @param {string[]} some
  * @param {hygieneOptions} options
  * @returns {NodeJS.EventEmitter}
  */
const hygiene = (some, options) => {
    options = options || {};
    let errorCount = 0;
    const eol = es.through(function (file) {
        if (/\r\n?/g.test(file.contents.toString('utf8'))) {
            console.error(file.relative + ': Bad EOL found');
            errorCount++;
        }

        this.emit('data', file);
    });

    const indentation = es.through(function (file) {
        file.contents
            .toString('utf8')
            .split(/\r\n|\r|\n/)
            .forEach((line, i) => {
                if (/^\s*$/.test(line)) {
                    // Empty or whitespace lines are OK.
                } else if (/^(\s\s\s\s)+.*/.test(line)) {
                    // Good indent.
                } else if (/^[\t]+.*/.test(line)) {
                    console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation');
                    errorCount++;
                }
            });

        this.emit('data', file);
    });

    const formatting = es.map(function (file, cb) {
        tsfmt.processString(file.path, file.contents.toString('utf8'), {
            verify: true,
            tsconfig: true,
            tslint: true,
            editorconfig: true,
            tsfmt: true
        }).then(result => {
            if (result.error) {
                console.error(result.message);
                errorCount++;
            }
            cb(null, file);

        }, err => {
            cb(err);
        });
    });

    const tsl = es.through(function (file) {
        const configuration = tslint.Configuration.findConfiguration(null, '.');
        const options = {
            formatter: 'json'
        };
        const contents = file.contents.toString('utf8');
        const program = require('tslint').Linter.createProgram("./tsconfig.json");
        const linter = new tslint.Linter(options, program);
        linter.lint(file.relative, contents, configuration.results);
        const result = linter.getResult();
        if (result.failureCount > 0 || result.errorCount > 0) {
            reportFailures(result.failures);
            if (result.failureCount) {
                errorCount += result.failureCount;
            }
            if (result.errorCount) {
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
        const tsProject = ts.createProject('tsconfig.json', { strict: true, noImplicitAny: false, noImplicitThis: false });
        const reporter = customReporter();
        return tsProject(reporter);
    }

    // Misc file checks.
    let result = gulp.src(some || all, {
        base: '.'
    })
        .pipe(filter(f => !f.stat.isDirectory()))
        .pipe(filter(eolFilter))
        .pipe(options.skipEOL ? es.through() : eol)
        .pipe(filter(indentationFilter));

    if (!options.skipIndentationCheck) {
        result = result
            .pipe(indentation);
    }

    // Type script checks.
    let typescript = result
        .pipe(filter(tslintFilter));

    if (!options.skipFormatCheck) {
        typescript = typescript
            .pipe(formatting);
    }
    typescript = typescript.pipe(tsl)
        .pipe(tscFilesTracker)
        .pipe(tsc());

    return typescript
        .pipe(es.through(null, function () {
            if (errorCount > 0) {
                this.emit('error', 'Hygiene failed with ' + errorCount + ' errors 👎. Check \'gulpfile.js\'.');
            } else {
                this.emit('end');
            }
        }));
};

exports.hygiene = hygiene;

gulp.task('hygiene', () => run({ mode: 'all', skipFormatCheck: true, skipIndentationCheck: true }));

gulp.task('hygiene-staged', () => run({ mode: 'changes' }));

gulp.task('hygiene-watch', ['hygiene-staged', 'hygiene-watch-runner']);

gulp.task('hygiene-watch-runner', function () {
    return watch(all, { events: ['add', 'change'] }, function (event) {
        const start = new Date();
        console.log(`[${start.toLocaleTimeString()}] Starting '${colors.cyan('hygiene-watch-runner')}'...`);
        // Skip indentation and formatting checks to speed up linting.
        return run({ mode: 'watch', skipFormatCheck: true, skipIndentationCheck: true })
            .then(() => {
                const end = new Date();
                const time = (end.getTime() - start.getTime()) / 1000;
                console.log(`[${end.toLocaleTimeString()}] Finished '${colors.cyan('hygiene-watch-runner')}' after ${time} seconds`);
            });
    });
});

/**
 * @typedef {Object} runOptions
 * @property {boolean=} exitOnError - Exit on error.
 * @property {'watch'|'changes'|'staged'|'all'} [mode=] - Mode.
 * @property {string[]=} files - Optional list of files to be modified.
 * @property {boolean=} skipIndentationCheck - Skip indentation checks.
 * @property {boolean=} skipFormatCheck - Skip format checks.
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
        process.exit(1);
    }
    if (options.mode === 'watch') {
        console.log('Watching for changes...');
    }
}

/**
 * Run the linters.
 * @param {runOptions} options
 * @return {Promise<void>}
 */
function run(options) {
    options = options ? options : {};
    process.once('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        exitHandler(options);
    });

    return getGitSkipEOL()
        .then(skipEOL => {
            if (typeof options.mode !== 'string' && process.argv.length > 2) {
                return new Promise((resolve, reject) => {
                    return hygiene(process.argv.slice(2), {
                        skipEOL: skipEOL
                    })
                        .once('error', reject)
                        .once('end', resolve);
                });
            }

            return getFilesToProcess(options)
                .then(files => {
                    return new Promise((resolve, reject) => {
                        hygiene(files, {
                            skipEOL: skipEOL,
                            skipFormatCheck: options.skipFormatCheck,
                            skipIndentationCheck: options.skipIndentationCheck
                        })
                            .once('end', () => {
                                if (options.mode === 'watch') {
                                    console.log(colors.green('Hygiene passed with 0 errors 👍.'));
                                    console.log('Watching for changes...');
                                }
                                resolve();
                            })
                            .once('error', reject);
                    });
                });
        })
        .catch(exitHandler.bind(options));
}
function getGitSkipEOL() {
    return new Promise(resolve => {
        cp.exec('git config core.autocrlf', (err, out) => {
            const skipEOL = out.trim() === 'true';
            resolve(skipEOL);
        });
    });
}
/**
 * Gets a list of files to be processed.
 * @param {runOptions} options
 * @return {Promise<string[]>}
 */
function getFilesToProcess(options) {
    switch (options.mode) {
        case 'all': {
            return Promise.resolve(all);
        }
        case 'watch':
        case 'changes': {
            return Promise.all([getCachedFiles(), getModifiedFiles()])
                .then(filesList => mergeFiles(filesList[0], filesList[1]));
        }
        default: {
            return getCachedFiles();
        }
    }
}
/**
 * Merges a list of files.
 * @param {string[]} files1
 * @param {string[]} files2
 */
function mergeFiles(files1, files2) {
    const files = files2.slice();
    files.forEach(file => {
        if (files.indexOf(file) === -1) {
            files.push(file);
        }
    });
    return files;
}
function getCachedFiles() {
    return new Promise(resolve => {
        cp.exec('git diff --cached --name-only', {
            maxBuffer: 2000 * 1024
        }, (err, out) => {
            if (err) {
                return reject(err);
            }
            const some = out
                .split(/\r?\n/)
                .filter(l => !!l);
            resolve(some);
        });
    });
}
function getModifiedFiles() {
    return new Promise(resolve => {
        cp.exec('git diff --name-only', {
            maxBuffer: 2000 * 1024
        }, (err, out) => {
            if (err) {
                return reject(err);
            }
            const some = out
                .split(/\r?\n/)
                .filter(l => !!l);
            resolve(some);
        });
    });
}
// this allows us to run hygiene as a git pre-commit hook.
if (require.main === module) {
    run({ exitOnError: true, mode: 'staged' });
}
