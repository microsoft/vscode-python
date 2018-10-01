/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/* jshint node: true */
/* jshint esversion: 6 */

'use strict';

const gulp = require('gulp');
const filter = require('gulp-filter');
const es = require('event-stream');
const tsfmt = require('typescript-formatter');
const tslint = require('tslint');
const relative = require('relative');
const ts = require('gulp-typescript');
const cp = require('child_process');
const spawn = require('cross-spawn');
const colors = require('colors/safe');
const gitmodified = require('gulp-gitmodified');
const path = require('path');
const debounce = require('debounce');
const jeditor = require("gulp-json-editor");
const del = require('del');
const sourcemaps = require('gulp-sourcemaps');
const fs = require('fs');
const remapIstanbul = require('remap-istanbul');
const istanbul = require('istanbul');
const glob = require('glob');
const os = require('os');
const _ = require('lodash');
const nativeDependencyChecker = require('node-has-native-dependencies');
const flat = require('flat');
const inlinesource = require('gulp-inline-source');
const nls = require('vscode-nls-dev');
const runSequence = require('run-sequence');
const typescript = require('typescript');
const gulpIf = require('gulp-if');

const languages = [
    { folderName: 'de', id: 'de' }, 
    { folderName: 'es', id: 'es' },
    { folderName: 'fr', id: 'fr' }, 
    { folderName: 'it', id: 'it' }, 
    { folderName: 'ja', id: 'ja' }, 
    { folderName: 'ko-kr', id: 'ko-kr' }, 
    { folderName: 'pt-br', id: 'pt-br' }, 
    { folderName: 'ru', id: 'ru' }, 
    { folderName: 'zh-cn', id: 'zh-cn' }, 
    { folderName: 'zh-tw', id: 'zh-tw' }, 
];

const tsProject = ts.createProject('./tsconfig.json', { typescript });

// Options for controlling compile step
const inlineMap = true;
const inlineSource = false;
const outDest = './out';

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

const tsFilter = [
    'src/**/*.ts',
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
    '!**/typings/**/*'
];

const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const copyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n')];

gulp.task('hygiene', () => run({ mode: 'all', skipFormatCheck: true, skipIndentationCheck: true }));

gulp.task('hygiene-compile', () => run({ mode: 'compile', skipFormatCheck: true, skipIndentationCheck: true, skipLinter: true }));

gulp.task('watch', ['hygiene-modified', 'hygiene-watch']);

// Duplicate to allow duplicate task in tasks.json (one ith problem matching, and one without)
gulp.task('watchProblems', ['hygiene-modified', 'hygiene-watch']);

gulp.task('debugger-coverage', () => buildDebugAdapterCoverage());

gulp.task('hygiene-watch', () => gulp.watch(tsFilter, debounce(() => run({ mode: 'changes', skipFormatCheck: true, skipIndentationCheck: true, skipCopyrightCheck: true }), 100)));

gulp.task('hygiene-all', () => run({ mode: 'all' }));

gulp.task('hygiene-modified', ['compile'], () => run({ mode: 'changes' }));

gulp.task('clean', ['output:clean', 'cover:clean'], () => { });

gulp.task('output:clean', () => del(['coverage', 'debug_coverage*']));

gulp.task('cover:clean', () => del(['coverage', 'debug_coverage*']));

gulp.task('clean:ptvsd', () => del(['coverage', 'pythonFiles/experimental/ptvsd/*']));

gulp.task('checkNativeDependencies', () => {
    if (hasNativeDependencies()) {
        throw new Error('Native dependencies deteced');
    }
});

gulp.task('cover:enable', () => {
    return gulp.src("./coverconfig.json")
        .pipe(jeditor((json) => {
            json.enabled = true;
            return json;
        }))
        .pipe(gulp.dest(outDest, { 'overwrite': true }));
});

gulp.task('cover:disable', () => {
    return gulp.src("./coverconfig.json")
        .pipe(jeditor((json) => {
            json.enabled = false;
            return json;
        }))
        .pipe(gulp.dest(outDest, { 'overwrite': true }));
});

/**
 * Inline CSS into the coverage report for better visualizations on
 * the VSTS report page for code coverage.
 */
gulp.task('inlinesource', () => {
    return gulp.src('./coverage/lcov-report/*.html')
                .pipe(inlinesource({attribute: false}))
                .pipe(gulp.dest('./coverage/lcov-report-inline'));
});

gulp.task('prepublish', function(callback) {
	runSequence('checkNativeDependencies', 'compile-nls', callback);
});

gulp.task('compile', function() {
	return compile(false, );
});

gulp.task('compile-nls', function() {
	return compile(true);
});

gulp.task('add-i18n', function() {
	return gulp.src(['package.nls.json'])
		.pipe(nls.createAdditionalLanguageFiles(languages, 'i18n'))
		.pipe(gulp.dest('.'));
});

//---- internal

function isLocalizable(file) {
    if (this) {
        var basename = path.basename(file.relative);

        // There's only one localizable output.
        return basename.match(/.*localize.*/)
    }
    return false;
}

function compile(buildNls) {
	var r = tsProject.src()
		.pipe(sourcemaps.init())
        .pipe(tsProject()).js
		.pipe(gulpIf(isLocalizable.bind(buildNls), nls.rewriteLocalizeCalls()))
		.pipe(gulpIf(isLocalizable.bind(buildNls), nls.createAdditionalLanguageFiles(languages, 'i18n', 'out')));

	if (inlineMap && inlineSource) {
		r = r.pipe(sourcemaps.write());
	} else {
		r = r.pipe(sourcemaps.write(outDest, {
			// no inlined source
			includeContent: inlineSource,
			// Return relative source map root directories per file.
			sourceRoot: "./src"
		}));
	}

	return r.pipe(gulp.dest(outDest));
}

function hasNativeDependencies() {
    let nativeDependencies = nativeDependencyChecker.check(path.join(__dirname, 'node_modules'));
    if (!Array.isArray(nativeDependencies) || nativeDependencies.length === 0) {
        return false;
    }
    const dependencies = JSON.parse(spawn.sync('npm', ['ls', '--json', '--prod']).stdout.toString());
    const jsonProperties = Object.keys(flat.flatten(dependencies));
    nativeDependencies = _.flatMap(nativeDependencies, item => path.dirname(item.substring(item.indexOf('node_modules') + 'node_modules'.length)).split(path.sep))
        .filter(item => item.length > 0)
        .filter(item => jsonProperties.findIndex(flattenedDependency => flattenedDependency.endsWith(`dependencies.${item}.version`)) >= 0);
    if (nativeDependencies.length > 0) {
        console.error('Native dependencies detected', nativeDependencies);
        return true;
    }
    return false;
}

function buildDebugAdapterCoverage() {
    const matches = glob.sync(path.join(__dirname, 'debug_coverage*/coverage.json'));
    matches.forEach(coverageFile => {
        const finalCoverageFile = path.join(path.dirname(coverageFile), 'coverage-final-upload.json');
        const remappedCollector = remapIstanbul.remap(JSON.parse(fs.readFileSync(coverageFile, 'utf8')), {
            warn: warning => {
                // We expect some warnings as any JS file without a typescript mapping will cause this.
                // By default, we'll skip printing these to the console as it clutters it up.
                console.warn(warning);
            }
        });

        const reporter = new istanbul.Reporter(undefined, path.dirname(coverageFile));
        reporter.add('lcov');
        reporter.write(remappedCollector, true, () => { });
    });
}

/**
* @typedef {Object} hygieneOptions - creates a new type named 'SpecialType'
* @property {'changes'|'staged'|'all'|'compile'} [mode=] - Mode.
* @property {boolean=} skipIndentationCheck - Skip indentation checks.
* @property {boolean=} skipFormatCheck - Skip format checks.
* @property {boolean=} skipCopyrightCheck - Skip copyright checks.
* @property {boolean=} skipLinter - Skip linter.
*/

const tsProjectMap = {};
/**
 *
 * @param {hygieneOptions} options
 */
function getTsProject(options) {
    const tsOptions = options.mode === 'compile' ? undefined : { strict: true, noImplicitAny: false, noImplicitThis: false };
    const mode = tsOptions && tsOptions.mode ? tsOptions.mode : '';
    return tsProjectMap[mode] ? tsProjectMap[mode] : tsProjectMap[mode] = ts.createProject('tsconfig.json', tsOptions);
}

let configuration;
/**
 *
 * @param {hygieneOptions} options
 */
function getLinter(options) {
    configuration = configuration ? configuration : tslint.Configuration.findConfiguration(null, '.');
    const program = tslint.Linter.createProgram('./tsconfig.json');
    const linter = new tslint.Linter({ formatter: 'json' }, program);
    return { linter, configuration };
}
let compilationInProgress = false;
let reRunCompilation = false;
/**
 *
 * @param {hygieneOptions} options
 * @returns {NodeJS.ReadWriteStream}
 */
const hygiene = (options) => {
    if (compilationInProgress) {
        reRunCompilation = true;
        return;
    }
    const fileListToProcess = options.mode === 'compile' ? undefined : getFileListToProcess(options);
    if (Array.isArray(fileListToProcess) && fileListToProcess !== all
        && fileListToProcess.filter(item => item.endsWith('.ts')).length === 0) {
        return;
    }

    const started = new Date().getTime();
    compilationInProgress = true;
    options = options || {};
    let errorCount = 0;
    const addedFiles = options.skipCopyrightCheck ? [] : getAddedFilesSync();
    console.log(colors.blue('Hygiene started.'));
    const copyrights = es.through(function (file) {
        if (addedFiles.indexOf(file.path) !== -1) {
            const contents = file.contents.toString('utf8');
            if (!copyrightHeaders.some(header => contents.indexOf(header) === 0)) {
                // Use tslint format.
                console.error(`ERROR: (copyright) ${file.relative}[1,1]: Missing or bad copyright statement`);
                errorCount++;
            }
        }

        this.emit('data', file);
    });

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
        return failures
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

    const { linter, configuration } = getLinter(options);
    const tsl = es.through(function (file) {
        const contents = file.contents.toString('utf8');
        // Don't print anything to the console, we'll do that.
        // Yes this is a hack, but tslinter doesn't provide an option to prevent this.
        const oldWarn = console.warn;
        console.warn = () => { };
        linter.failures = [];
        linter.fixes = [];
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

    const tsProject = getTsProject(options);

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

    const files = options.mode === 'compile' ? tsProject.src() : getFilesToProcess(fileListToProcess);
    const dest = options.mode === 'compile' ? outDest : '.';
    let result = files
        .pipe(filter(f => f && f.stat && !f.stat.isDirectory()));

    if (!options.skipIndentationCheck) {
        result = result.pipe(filter(indentationFilter))
            .pipe(indentation);
    }

    result = result
        .pipe(filter(tslintFilter));

    if (!options.skipCopyrightCheck) {
        result = result.pipe(copyrights);
    }

    if (!options.skipFormatCheck) {
        // result = result
        //     .pipe(formatting);
    }

    if (!options.skipLinter) {
        result = result
            .pipe(tsl);
    }
    let totalTime = 0;
    result = result
        .pipe(tscFilesTracker)
        .pipe(sourcemaps.init())
        .pipe(tsc())
        .pipe(sourcemaps.mapSources(function (sourcePath, file) {
            const tsFileName = path.basename(file.path).replace(/js$/, 'ts');
            const qualifiedSourcePath = path.dirname(file.path).replace('out/', 'src/').replace('out\\', 'src\\');
            if (!fs.existsSync(path.join(qualifiedSourcePath, tsFileName))) {
                console.error(`ERROR: (source-maps) ${file.path}[1,1]: Source file not found`);
            }
            return path.join(path.relative(path.dirname(file.path), qualifiedSourcePath), tsFileName);
        }))
        .pipe(sourcemaps.write('.', { includeContent: false }))
        .pipe(gulp.dest(dest))
        .pipe(es.through(null, function () {
            if (errorCount > 0) {
                const errorMessage = `Hygiene failed with errors 👎 . Check 'gulpfile.js' (completed in ${new Date().getTime() - started}ms).`;
                console.error(colors.red(errorMessage));
                exitHandler(options);
            } else {
                console.log(colors.green(`Hygiene passed with 0 errors 👍 (completed in ${new Date().getTime() - started}ms).`));
            }
            // Reset error counter.
            errorCount = 0;
            reportedLinterFailures = [];
            compilationInProgress = false;
            if (reRunCompilation) {
                reRunCompilation = false;
                setTimeout(() => {
                    hygiene(options);
                }, 10);
            }
            this.emit('end');
        }))
        .on('error', exitHandler.bind(this, options));

    return result;
};

/**
* @typedef {Object} runOptions
* @property {boolean=} exitOnError - Exit on error.
* @property {'changes'|'staged'|'all'} [mode=] - Mode.
* @property {string[]=} files - Optional list of files to be modified.
* @property {boolean=} skipIndentationCheck - Skip indentation checks.
* @property {boolean=} skipFormatCheck - Skip format checks.
* @property {boolean=} skipCopyrightCheck - Skip copyright checks.
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
    return out
        .split(/\r?\n/)
        .filter(l => !!l);
}
function getAddedFilesSync() {
    const out = cp.execSync('git status -u -s', { encoding: 'utf8' });
    return out
        .split(/\r?\n/)
        .filter(l => !!l)
        .filter(l => _.intersection(['A', '?', 'U'], l.substring(0, 2).trim().split('')).length > 0)
        .map(l => path.join(__dirname, l.substring(2).trim()));
}
function getModifiedFilesSync() {
    const out = cp.execSync('git status -u -s', { encoding: 'utf8' });
    return out
        .split(/\r?\n/)
        .filter(l => !!l)
        .filter(l => _.intersection(['M', 'A', 'R', 'C', 'U', '?'], l.substring(0, 2).trim().split('')).length > 0)
        .map(l => path.join(__dirname, l.substring(2).trim()));
}

/**
* @param {hygieneOptions} options
*/
function getFilesToProcess(fileList) {
    const gulpSrcOptions = { base: '.' };
    return gulp.src(fileList, gulpSrcOptions);
}

/**
* @param {hygieneOptions} options
*/
function getFileListToProcess(options) {
    const mode = options ? options.mode : 'all';
    const gulpSrcOptions = { base: '.' };

    // If we need only modified files, then filter the glob.
    if (options && options.mode === 'changes') {
        return getModifiedFilesSync();
    }

    if (options && options.mode === 'staged') {
        return getStagedFilesSync();
    }

    return all;
}
exports.hygiene = hygiene;

// this allows us to run hygiene as a git pre-commit hook.
if (require.main === module) {
    run({ exitOnError: true, mode: 'staged' });
}
