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
const path = require('path');
const del = require('del');
const sourcemaps = require('gulp-sourcemaps');
const fs = require('fs-extra');
const fsExtra = require('fs-extra');
const glob = require('glob');
const _ = require('lodash');
const nativeDependencyChecker = require('node-has-native-dependencies');
const flat = require('flat');
const { argv } = require('yargs');
const os = require('os');
const rmrf = require('rimraf');

const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

const noop = function () {};
/**
 * Hygiene works by creating cascading subsets of all our files and
 * passing them through a sequence of checks. Here are the current subsets,
 * named according to the checks performed on them. Each subset contains
 * the following one, as described in mathematical notation:
 *
 * all ⊃ indentation ⊃ typescript
 */

const all = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.d.ts', 'src/**/*.js', 'src/**/*.jsx'];

const tsFilter = ['src/**/*.ts*', '!out/**/*'];

const indentationFilter = ['src/**/*.ts*', '!**/typings/**/*'];

const tslintFilter = [
    'src/**/*.ts*',
    'test/**/*.ts*',
    '!**/node_modules/**',
    '!out/**/*',
    '!images/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!**/typings/**/*',
    '!**/*.d.ts',
];

gulp.task('compile', (done) => {
    let failed = false;
    const tsProject = ts.createProject('tsconfig.json');
    tsProject
        .src()
        .pipe(tsProject())
        .on('error', () => (failed = true))
        .js.pipe(gulp.dest('out'))
        .on('finish', () => (failed ? done(new Error('TypeScript compilation errors')) : done()));
});

gulp.task('precommit', (done) => run({ exitOnError: true, mode: 'staged' }, done));

gulp.task('hygiene-watch', () => gulp.watch(tsFilter, gulp.series('hygiene-modified')));

gulp.task('hygiene', (done) => run({ mode: 'compile', skipFormatCheck: true, skipIndentationCheck: true }, done));

gulp.task(
    'hygiene-modified',
    gulp.series('compile', (done) => run({ mode: 'changes' }, done)),
);

gulp.task('watch', gulp.parallel('hygiene-modified', 'hygiene-watch'));

// Duplicate to allow duplicate task in tasks.json (one ith problem matching, and one without)
gulp.task('watchProblems', gulp.parallel('hygiene-modified', 'hygiene-watch'));

gulp.task('hygiene-watch-branch', () => gulp.watch(tsFilter, gulp.series('hygiene-branch')));

gulp.task('hygiene-all', (done) => run({ mode: 'all' }, done));

gulp.task('hygiene-branch', (done) => run({ mode: 'diffMain' }, done));

gulp.task('output:clean', () => del(['coverage']));

gulp.task('clean:cleanExceptTests', () => del(['clean:vsix', 'out/client', 'out/startpage-ui', 'out/server']));
gulp.task('clean:vsix', () => del(['*.vsix']));
gulp.task('clean:out', () => del(['out']));
gulp.task('clean:ipywidgets', () => spawnAsync('npm', ['run', 'build-ipywidgets-clean'], webpackEnv));

gulp.task('clean', gulp.parallel('output:clean', 'clean:vsix', 'clean:out'));

gulp.task('checkNativeDependencies', (done) => {
    if (hasNativeDependencies()) {
        done(new Error('Native dependencies detected'));
    }
    done();
});

gulp.task('compile-ipywidgets', () => buildIPyWidgets());

const webpackEnv = { NODE_OPTIONS: '--max_old_space_size=9096' };

async function buildIPyWidgets() {
    // if the output ipywidgest file exists, then no need to re-build.
    // Barely changes. If making changes, then re-build manually.
    if (!isCI && fs.existsSync(path.join(__dirname, 'out/ipywidgets/dist/ipywidgets.js'))) {
        return;
    }
    await spawnAsync('npm', ['run', 'build-ipywidgets'], webpackEnv);
}

gulp.task('compile-viewers', async () => {
    await buildWebPackForDevOrProduction('./build/webpack/webpack.startpage-ui-viewers.config.js');
});

gulp.task('compile-webviews', gulp.series('compile-viewers'));

async function buildWebPackForDevOrProduction(configFile, configNameForProductionBuilds) {
    if (configNameForProductionBuilds) {
        await buildWebPack(configNameForProductionBuilds, ['--config', configFile], webpackEnv);
    } else {
        await spawnAsync('npm', ['run', 'webpack', '--', '--config', configFile, '--mode', 'production'], webpackEnv);
    }
}
gulp.task('webpack', async () => {
    // Build node_modules.
    await buildWebPackForDevOrProduction('./build/webpack/webpack.extension.dependencies.config.js', 'production');
    // Build DS stuff (separately as it uses far too much memory and slows down CI).
    // Individually is faster on CI.
    await buildIPyWidgets();
    await buildWebPackForDevOrProduction('./build/webpack/webpack.startpage-ui-viewers.config.js', 'production');
    await buildWebPackForDevOrProduction('./build/webpack/webpack.extension.config.js', 'extension');
});

gulp.task('updateBuildNumber', async () => {
    await updateBuildNumber(argv);
});

async function updateBuildNumber(args) {
    if (args && args.buildNumber) {
        // Edit the version number from the package.json
        const packageJsonContents = await fsExtra.readFile('package.json', 'utf-8');
        const packageJson = JSON.parse(packageJsonContents);

        // Change version number
        const versionParts = packageJson.version.split('.');
        const buildNumberPortion = versionParts.length > 2 ? versionParts[2]
            .replace(/(\d+)/, args.buildNumber) : args.buildNumber;
        const newVersion = versionParts.length > 1
            ? `${versionParts[0]}.${versionParts[1]}.${buildNumberPortion}`
            : packageJson.version;
        packageJson.version = newVersion;

        // Write back to the package json
        await fsExtra.writeFile('package.json', JSON.stringify(packageJson, null, 4), 'utf-8');

        // Update the changelog.md if we are told to (this should happen on the release branch)
        if (args.updateChangelog) {
            const changeLogContents = await fsExtra.readFile('CHANGELOG.md', 'utf-8');
            const fixedContents = changeLogContents.replace(
                /##\s*(\d+)\.(\d+)\.(\d+)\s*\(/,
                `## $1.$2.${buildNumberPortion} (`,
            );

            // Write back to changelog.md
            await fsExtra.writeFile('CHANGELOG.md', fixedContents, 'utf-8');
        }
    } else {
        throw Error('buildNumber argument required for updateBuildNumber task');
    }
}

async function buildWebPack(webpackConfigName, args, env) {
    // Remember to perform a case insensitive search.
    const allowedWarnings = getAllowedWarningsForWebPack(webpackConfigName).map((item) => item.toLowerCase());
    const stdOut = await spawnAsync(
        'npm',
        ['run', 'webpack', '--', ...args, ...['--mode', 'production', '--devtool', 'source-map']],
        env,
    );
    const stdOutLines = stdOut
        .split(os.EOL)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    // Remember to perform a case insensitive search.
    const warnings = stdOutLines
        .filter((item) => item.startsWith('WARNING in '))
        .filter(
            (item) => allowedWarnings.findIndex((allowedWarning) => item.toLowerCase().startsWith(allowedWarning.toLowerCase())) == -1,
        );
    const errors = stdOutLines.some((item) => item.startsWith('ERROR in'));
    if (errors) {
        throw new Error(`Errors in ${webpackConfigName}, \n${warnings.join(', ')}\n\n${stdOut}`);
    }
    if (warnings.length > 0) {
        throw new Error(
            `Warnings in ${webpackConfigName}, Check gulpfile.js to see if the warning should be allowed., \n\n${stdOut}`,
        );
    }
}
function getAllowedWarningsForWebPack(buildConfig) {
    switch (buildConfig) {
        case 'production':
            return [
                'WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).',
                'WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.',
                'WARNING in webpack performance recommendations:',
                'WARNING in ./node_modules/vsls/vscode.js',
                'WARNING in ./node_modules/encoding/lib/iconv-loader.js',
                'WARNING in ./node_modules/ws/lib/BufferUtil.js',
                'WARNING in ./node_modules/ws/lib/buffer-util.js',
                'WARNING in ./node_modules/ws/lib/Validation.js',
                'WARNING in ./node_modules/ws/lib/validation.js',
                'WARNING in ./node_modules/@jupyterlab/services/node_modules/ws/lib/buffer-util.js',
                'WARNING in ./node_modules/@jupyterlab/services/node_modules/ws/lib/validation.js',
                'WARNING in ./node_modules/any-promise/register.js',
                'WARNING in ./node_modules/log4js/lib/appenders/index.js',
                'WARNING in ./node_modules/log4js/lib/clustering.js',
                'WARNING in ./node_modules/diagnostic-channel-publishers/dist/src/azure-coretracing.pub.js',
                'WARNING in ./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js',
            ];
        case 'extension':
            return [
                'WARNING in ./node_modules/encoding/lib/iconv-loader.js',
                'WARNING in ./node_modules/ws/lib/BufferUtil.js',
                'WARNING in ./node_modules/ws/lib/buffer-util.js',
                'WARNING in ./node_modules/ws/lib/Validation.js',
                'WARNING in ./node_modules/ws/lib/validation.js',
                'WARNING in ./node_modules/any-promise/register.js',
                'remove-files-plugin@1.4.0:',
                'WARNING in ./node_modules/@jupyterlab/services/node_modules/ws/lib/buffer-util.js',
                'WARNING in ./node_modules/@jupyterlab/services/node_modules/ws/lib/validation.js',
                'WARNING in ./node_modules/@jupyterlab/services/node_modules/ws/lib/Validation.js',
                'WARNING in ./node_modules/diagnostic-channel-publishers/dist/src/azure-coretracing.pub.js',
                'WARNING in ./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js',
            ];
        case 'debugAdapter':
            return [
                'WARNING in ./node_modules/vscode-uri/lib/index.js',
                'WARNING in ./node_modules/diagnostic-channel-publishers/dist/src/azure-coretracing.pub.js',
                'WARNING in ./node_modules/applicationinsights/out/AutoCollection/NativePerformance.js',
            ];
        default:
            throw new Error('Unknown WebPack Configuration');
    }
}
gulp.task('renameSourceMaps', async () => {
    // By default source maps will be disabled in the extension.
    // Users will need to use the command `python.enableSourceMapSupport` to enable source maps.
    const extensionSourceMap = path.join(__dirname, 'out', 'client', 'extension.js.map');
    await fs.rename(extensionSourceMap, `${extensionSourceMap}.disabled`);
});

gulp.task('verifyBundle', async () => {
    const matches = await glob.sync(path.join(__dirname, '*.vsix'));
    if (!matches || matches.length == 0) {
        throw new Error('Bundle does not exist');
    } else {
        console.log(`Bundle ${matches[0]} exists.`);
    }
});

gulp.task('prePublishBundle', gulp.series('webpack', 'renameSourceMaps'));
gulp.task('checkDependencies', gulp.series('checkNativeDependencies'));
gulp.task('prePublishNonBundle', gulp.series('compile', 'compile-webviews'));

gulp.task('installPythonRequirements', async () => {
    const args = [
        '-m',
        'pip',
        '--disable-pip-version-check',
        'install',
        '-t',
        './pythonFiles/lib/python',
        '--no-cache-dir',
        '--implementation',
        'py',
        '--no-deps',
        '--upgrade',
        '-r',
        './requirements.txt',
    ];
    const success = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', args, undefined, true)
        .then(() => true)
        .catch((ex) => {
            console.error("Failed to install Python Libs using 'python3'", ex);
            return false;
        });
    if (!success) {
        console.info("Failed to install Python Libs using 'python3', attempting to install using 'python'");
        await spawnAsync('python', args).catch((ex) => console.error("Failed to install Python Libs using 'python'", ex));
    }
});

// See https://github.com/microsoft/vscode-python/issues/7136
gulp.task('installDebugpy', async () => {
    // Install dependencies needed for 'install_debugpy.py'
    const depsArgs = [
        '-m',
        'pip',
        '--disable-pip-version-check',
        'install',
        '-t',
        './pythonFiles/lib/temp',
        '-r',
        './build/debugger-install-requirements.txt',
    ];
    const successWithWheelsDeps = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', depsArgs, undefined, true)
        .then(() => true)
        .catch((ex) => {
            console.error("Failed to install new DEBUGPY wheels using 'python3'", ex);
            return false;
        });
    if (!successWithWheelsDeps) {
        console.info(
            "Failed to install dependencies need by 'install_debugpy.py' using 'python3', attempting to install using 'python'",
        );
        await spawnAsync('python', depsArgs).catch((ex) => console.error("Failed to install dependencies need by 'install_debugpy.py' using 'python'", ex));
    }

    // Install new DEBUGPY with wheels for python 3.7
    const wheelsArgs = ['./pythonFiles/install_debugpy.py'];
    const wheelsEnv = { PYTHONPATH: './pythonFiles/lib/temp' };
    const successWithWheels = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', wheelsArgs, wheelsEnv, true)
        .then(() => true)
        .catch((ex) => {
            console.error("Failed to install new DEBUGPY wheels using 'python3'", ex);
            return false;
        });
    if (!successWithWheels) {
        console.info("Failed to install new DEBUGPY wheels using 'python3', attempting to install using 'python'");
        await spawnAsync('python', wheelsArgs, wheelsEnv).catch((ex) => console.error("Failed to install DEBUGPY wheels using 'python'", ex));
    }

    rmrf.sync('./pythonFiles/lib/temp');
});

gulp.task('installPythonLibs', gulp.series('installPythonRequirements', 'installDebugpy'));

function uploadExtension(uploadBlobName) {
    const azure = require('gulp-azure-storage');
    const rename = require('gulp-rename');
    return gulp
        .src('*python*.vsix')
        .pipe(rename(uploadBlobName))
        .pipe(
            azure.upload({
                account: process.env.AZURE_STORAGE_ACCOUNT,
                key: process.env.AZURE_STORAGE_ACCESS_KEY,
                container: process.env.AZURE_STORAGE_CONTAINER,
            }),
        );
}

gulp.task('uploadDeveloperExtension', () => uploadExtension('ms-python-insiders.vsix'));
gulp.task('uploadReleaseExtension', () => uploadExtension(`ms-python-${process.env.TRAVIS_BRANCH || process.env.BUILD_SOURCEBRANCHNAME}.vsix`));

function spawnAsync(command, args, env, rejectOnStdErr = false) {
    env = env || {};
    env = { ...process.env, ...env };
    return new Promise((resolve, reject) => {
        let stdOut = '';
        console.info(`> ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { cwd: __dirname, env });
        proc.stdout.on('data', (data) => {
            // Log output on CI (else travis times out when there's not output).
            stdOut += data.toString();
            if (isCI) {
                console.log(data.toString());
            }
        });
        proc.stderr.on('data', (data) => {
            console.error(data.toString());
            if (rejectOnStdErr) {
                reject(data.toString());
            }
        });
        proc.on('close', () => resolve(stdOut));
        proc.on('error', (error) => reject(error));
    });
}

function hasNativeDependencies() {
    let nativeDependencies = nativeDependencyChecker.check(path.join(__dirname, 'node_modules'));
    if (!Array.isArray(nativeDependencies) || nativeDependencies.length === 0) {
        return false;
    }
    const dependencies = JSON.parse(spawn.sync('npm', ['ls', '--json', '--prod']).stdout.toString());
    const jsonProperties = Object.keys(flat.flatten(dependencies));
    nativeDependencies = _.flatMap(nativeDependencies, (item) => path.dirname(item.substring(item.indexOf('node_modules') + 'node_modules'.length)).split(path.sep))
        .filter((item) => item.length > 0)
        .filter((item) => !item.includes('zeromq')) // This is a known native. Allow this one for now
        .filter(
            (item) => jsonProperties.findIndex((flattenedDependency) => flattenedDependency.endsWith(`dependencies.${item}.version`)) >= 0,
        );
    if (nativeDependencies.length > 0) {
        console.error('Native dependencies detected', nativeDependencies);
        return true;
    }
    return false;
}

/**
 * @typedef {Object} hygieneOptions - creates a new type named 'SpecialType'
 * @property {'changes'|'staged'|'all'|'compile'|'diffMain'} [mode=] - Mode.
 * @property {boolean=} skipIndentationCheck - Skip indentation checks.
 * @property {boolean=} skipFormatCheck - Skip format checks.
 * @property {boolean=} skipLinter - Skip linter.
 */

/**
 *
 * @param {hygieneOptions} options
 */
function getTsProject(options) {
    return ts.createProject('tsconfig.json');
}

let configuration;
/**
 *
 * @param {hygieneOptions} options
 */
function getLinter(options) {
    configuration = configuration || tslint.Configuration.findConfiguration(null, '.');
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
const hygiene = (options, done) => {
    done = done || noop;
    if (compilationInProgress) {
        reRunCompilation = true;
        return done();
    }
    const fileListToProcess = options.mode === 'compile' ? undefined : getFileListToProcess(options);
    if (
        Array.isArray(fileListToProcess)
        && fileListToProcess !== all
        && fileListToProcess.filter((item) => item.endsWith('.ts')).length === 0
    ) {
        return done();
    }

    const started = new Date().getTime();
    compilationInProgress = true;
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
                    console.error(
                        `${file.relative
                        }(${
                            i + 1
                        },1): Bad whitespace indentation (use 4 spaces instead of tabs or other)`,
                    );
                    errorCount++;
                }
            });

        this.emit('data', file);
    });

    const formatOptions = {
        verify: true, tsconfig: true, tslint: true, editorconfig: true, tsfmt: true,
    };
    const formatting = es.map((file, cb) => {
        tsfmt
            .processString(file.path, file.contents.toString('utf8'), formatOptions)
            .then((result) => {
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
        return (
            failures
                .map((failure) => {
                    const name = failure.name || failure.fileName;
                    const position = failure.startPosition;
                    const line = position.lineAndCharacter ? position.lineAndCharacter.line : position.line;
                    const character = position.lineAndCharacter
                        ? position.lineAndCharacter.character
                        : position.character;

                    // Output in format similar to tslint for the linter to pickup.
                    const message = `ERROR: (${failure.ruleName}) ${relative(__dirname, name)}[${line + 1}, ${
                        character + 1
                    }]: ${failure.failure}`;
                    if (reportedLinterFailures.indexOf(message) === -1) {
                        console.error(message);
                        reportedLinterFailures.push(message);
                        return true;
                    }
                    return false;
                })
                .filter((reported) => reported === true).length > 0
        );
    }

    const { linter, configuration } = getLinter(options);
    const tsl = es.through(function (file) {
        const contents = file.contents.toString('utf8');
        if (isCI) {
            // Don't print anything to the console, we'll do that.
            console.log('.');
        }
        // Yes this is a hack, but tslinter doesn't provide an option to prevent this.
        const oldWarn = console.warn;
        console.warn = () => {};
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
                error(error, typescript) {
                    const fullFilename = error.fullFilename || '';
                    const relativeFilename = error.relativeFilename || '';
                    if (tsFiles.findIndex((file) => fullFilename === file || relativeFilename === file) === -1) {
                        return;
                    }
                    console.error(`Error: ${error.message}`);
                    errorCount += 1;
                },
                finish() {
                    // forget the summary.
                    console.log('Finished compilation');
                },
            };
        }
        const reporter = customReporter();
        return tsProject(reporter);
    };

    const files = options.mode === 'compile' ? tsProject.src() : getFilesToProcess(fileListToProcess);
    const dest = options.mode === 'compile' ? './out' : '.';
    let result = files.pipe(filter((f) => f && f.stat && !f.stat.isDirectory()));

    if (!options.skipIndentationCheck) {
        result = result.pipe(filter(indentationFilter)).pipe(indentation);
    }

    result = result.pipe(filter(tslintFilter));

    if (!options.skipFormatCheck) {
        // result = result
        //     .pipe(formatting);
    }

    if (!options.skipLinter) {
        result = result.pipe(tsl);
    }
    const totalTime = 0;
    result = result
        .pipe(tscFilesTracker)
        .pipe(sourcemaps.init())
        .pipe(tsc())
        .pipe(
            sourcemaps.mapSources((sourcePath, file) => {
                let tsFileName = path.basename(file.path).replace(/js$/, 'ts');
                const qualifiedSourcePath = path.dirname(file.path).replace('out/', 'src/').replace('out\\', 'src\\');
                if (!fs.existsSync(path.join(qualifiedSourcePath, tsFileName))) {
                    const tsxFileName = path.basename(file.path).replace(/js$/, 'tsx');
                    if (!fs.existsSync(path.join(qualifiedSourcePath, tsxFileName))) {
                        console.error(`ERROR: (source-maps) ${file.path}[1,1]: Source file not found`);
                    } else {
                        tsFileName = tsxFileName;
                    }
                }
                return path.join(path.relative(path.dirname(file.path), qualifiedSourcePath), tsFileName);
            }),
        )
        .pipe(sourcemaps.write('.', { includeContent: false }))
        .pipe(gulp.dest(dest))
        .pipe(
            es.through(null, function () {
                if (errorCount > 0) {
                    const errorMessage = `Hygiene failed with errors 👎 . Check 'gulpfile.js' (completed in ${
                        new Date().getTime() - started
                    }ms).`;
                    console.error(colors.red(errorMessage));
                    exitHandler(options);
                } else {
                    console.log(
                        colors.green(
                            `Hygiene passed with 0 errors 👍 (completed in ${new Date().getTime() - started}ms).`,
                        ),
                    );
                }
                // Reset error counter.
                errorCount = 0;
                reportedLinterFailures = [];
                compilationInProgress = false;
                if (reRunCompilation) {
                    reRunCompilation = false;
                    setTimeout(() => {
                        hygiene(options, done);
                    }, 10);
                }
                done();
                this.emit('end');
            }),
        )
        .on('error', (ex) => {
            exitHandler(options, ex);
            done();
        });

    return result;
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
function run(options, done) {
    done = done || noop;
    options = options || {};
    options.exitOnError = typeof options.exitOnError === 'undefined' ? isCI : options.exitOnError;
    process.once('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        exitHandler(options);
    });

    // Clear screen each time
    console.log('\x1Bc');
    const startMessage = 'Hygiene starting';
    console.log(colors.blue(startMessage));

    hygiene(options, done);
}

function git(args) {
    const result = cp.spawnSync('git', args, { encoding: 'utf-8' });
    return result.output.join('\n');
}

function getStagedFilesSync() {
    const out = git(['diff', '--cached', '--name-only']);
    return out.split(/\r?\n/).filter((l) => !!l);
}
function getAddedFilesSync() {
    const out = git(['status', '-u', '-s']);
    return out
        .split(/\r?\n/)
        .filter((l) => !!l)
        .filter((l) => _.intersection(['A', '?', 'U'], l.substring(0, 2).trim().split('')).length > 0)
        .map((l) => path.join(__dirname, l.substring(2).trim()));
}
function getAzureDevOpsVarValue(varName) {
    return process.env[varName.replace(/\./g, '_').toUpperCase()];
}
function getModifiedFilesSync() {
    if (isCI) {
        const isAzurePR = getAzureDevOpsVarValue('System.PullRequest.SourceBranch') !== undefined;
        const isTravisPR = process.env.TRAVIS_PULL_REQUEST !== undefined && process.env.TRAVIS_PULL_REQUEST !== 'true';
        if (!isAzurePR && !isTravisPR) {
            return [];
        }
        const targetBranch = process.env.TRAVIS_BRANCH || getAzureDevOpsVarValue('System.PullRequest.TargetBranch');
        if (targetBranch !== 'main') {
            return [];
        }

        const repo = process.env.TRAVIS_REPO_SLUG || getAzureDevOpsVarValue('Build.Repository.Name');
        const originOrUpstream = repo.toUpperCase() === 'MICROSOFT/VSCODE-PYTHON'
            ? 'origin'
            : 'upstream';

        // If on CI, get a list of modified files comparing against
        // PR branch and main of current (assumed 'origin') repo.
        try {
            cp.execSync(`git remote set-branches --add ${originOrUpstream} main`, {
                encoding: 'utf8',
                cwd: __dirname,
            });
            cp.execSync('git fetch', { encoding: 'utf8', cwd: __dirname });
        } catch (ex) {
            return [];
        }
        const cmd = `git diff --name-only HEAD ${originOrUpstream}/main`;
        console.info(cmd);
        const out = cp.execSync(cmd, { encoding: 'utf8', cwd: __dirname });
        return out
            .split(/\r?\n/)
            .filter((l) => !!l)
            .filter((l) => l.length > 0)
            .map((l) => l.trim().replace(/\//g, path.sep))
            .map((l) => path.join(__dirname, l));
    }
    const out = cp.execSync('git status -u -s', { encoding: 'utf8' });
    return out
        .split(/\r?\n/)
        .filter((l) => !!l)
        .filter(
            (l) => _.intersection(['M', 'A', 'R', 'C', 'U', '?'], l.substring(0, 2).trim().split('')).length > 0,
        )
        .map((l) => path.join(__dirname, l.substring(2).trim().replace(/\//g, path.sep)));
}

function getDifferentFromMainFilesSync() {
    const out = git(['diff', '--name-status', 'main']);
    return out
        .split(/\r?\n/)
        .filter((l) => !!l)
        .map((l) => path.join(__dirname, l.substring(2).trim()));
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
        return getModifiedFilesSync().filter((f) => fs.existsSync(f));
    }

    if (options && options.mode === 'staged') {
        return getStagedFilesSync().filter((f) => fs.existsSync(f));
    }

    if (options && options.mode === 'diffMain') {
        return getDifferentFromMainFilesSync().filter((f) => fs.existsSync(f));
    }

    return all;
}

exports.hygiene = hygiene;

// this allows us to run hygiene via CLI (e.g. `node gulfile.js`).
if (require.main === module) {
    run({ exitOnError: true, mode: 'staged' }, () => {});
}
