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
const watch = require('gulp-watch');
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
    '!**/*.{svg,exe,png,bmp,scpt,bat,cmd,cur,ttf,woff,eot,txt,md,json,yml}',
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

const hygiene = exports.hygiene = (some, options) => {
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

    const result = gulp.src(some || all, {
        base: '.'
    })
        .pipe(filter(f => !f.stat.isDirectory()))
        .pipe(filter(eolFilter))
        .pipe(options.skipEOL ? es.through() : eol)
        .pipe(filter(indentationFilter))
        .pipe(indentation);

    const typescript = result
        .pipe(filter(tslintFilter))
        .pipe(formatting)
        .pipe(tsl)
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

gulp.task('hygiene', () => hygiene());

gulp.task('hygiene-watch', function () {
    return watch(all, function () {
        console.clear();
        console.log('Checking hygiene...');
        run(true, true);
    });
});

function run(lintOnlyModifiedFiles, doNotExit) {
    function exitProcessOnError(ex) {
        console.error();
        console.error(colors.red(ex));
        if (!doNotExit) {
            process.exit(1);
        }
        if (lintOnlyModifiedFiles && doNotExit) {
            console.log('Watching for changes...');
        }
    }
    process.on('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        exitProcessOnError();
    });

    cp.exec('git config core.autocrlf', (err, out) => {
        const skipEOL = out.trim() === 'true';
        if (!lintOnlyModifiedFiles && process.argv.length > 2) {
            return hygiene(process.argv.slice(2), {
                skipEOL: skipEOL
            }).on('error', exitProcessOnError);
        }

        let filesPromise;
        if (lintOnlyModifiedFiles) {
            filesPromise = Promise.all([getCachedFiles(), getModifiedFiles()]).then(filesList => {
                const files1 = filesList[0];
                const files2 = filesList[1];
                files2.forEach(file => {
                    if (files1.indexOf(file) === -1) {
                        files1.push(file);
                    }
                });
                return files1;
            });
        } else {
            filesPromise = getCachedFiles();
        }
        filesPromise.then(files => {
            hygiene(files, {
                skipEOL: skipEOL
            })
                .on('end', () => {
                    if (lintOnlyModifiedFiles && doNotExit) {
                        console.log(colors.green('Hygiene passed with 0 errors 👍.'));
                        console.log('Watching for changes...');
                    }
                })
                .on('error', exitProcessOnError);
        }).catch(exitProcessOnError);
    });
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
    run();
}
