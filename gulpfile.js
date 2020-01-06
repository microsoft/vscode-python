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
const argv = require('yargs').argv;
const os = require('os');

const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

const noop = function () { };
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
    '!**/*.d.ts'
];

gulp.task('compile', done => {
    let failed = false;
    const tsProject = ts.createProject('tsconfig.json');
    tsProject
        .src()
        .pipe(tsProject())
        .on('error', () => (failed = true))
        .js.pipe(gulp.dest('out'))
        .on('finish', () => (failed ? done(new Error('TypeScript compilation errors')) : done()));
});

gulp.task('precommit', done => run({ exitOnError: true, mode: 'staged' }, done));

gulp.task('hygiene-watch', () => gulp.watch(tsFilter, gulp.series('hygiene-modified')));

gulp.task('hygiene', done => run({ mode: 'compile', skipFormatCheck: true, skipIndentationCheck: true }, done));

gulp.task('hygiene-modified', gulp.series('compile', done => run({ mode: 'changes' }, done)));

gulp.task('watch', gulp.parallel('hygiene-modified', 'hygiene-watch'));

// Duplicate to allow duplicate task in tasks.json (one ith problem matching, and one without)
gulp.task('watchProblems', gulp.parallel('hygiene-modified', 'hygiene-watch'));

gulp.task('hygiene-watch-branch', () => gulp.watch(tsFilter, gulp.series('hygiene-branch')));

gulp.task('hygiene-all', done => run({ mode: 'all' }, done));

gulp.task('hygiene-branch', done => run({ mode: 'diffMaster' }, done));

gulp.task('output:clean', () => del(['coverage']));

gulp.task('clean:cleanExceptTests', () => del(['clean:vsix', 'out/client', 'out/datascience-ui', 'out/server']));
gulp.task('clean:vsix', () => del(['*.vsix']));
gulp.task('clean:out', () => del(['out']));

gulp.task('clean', gulp.parallel('output:clean', 'clean:vsix', 'clean:out'));

gulp.task('checkNativeDependencies', done => {
    if (hasNativeDependencies()) {
        done(new Error('Native dependencies detected'));
    }
    done();
});

gulp.task('check-datascience-dependencies', () => checkDatascienceDependencies());

gulp.task('compile-webviews', async () => {
    await spawnAsync('npm', ['run', 'webpack', '--', '--config', './build/webpack/webpack.config.js', '--mode', 'production'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '0' });
    await spawnAsync('npm', ['run', 'webpack', '--', '--config', './build/webpack/webpack.config.js', '--mode', 'production'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '1' });
    await spawnAsync('npm', ['run', 'webpack', '--', '--config', './build/webpack/webpack.config.js', '--mode', 'production'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '2' });
    await spawnAsync('npm', ['run', 'webpack', '--', '--config', './build/webpack/webpack.config.js', '--mode', 'production'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '3' });
});

gulp.task('webpack', async () => {
    // Build node_modules and DS stuff.
    // Unwrap the array used to build each webpack.
    await buildWebPack('production', ['--config', './build/webpack/webpack.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '0' });
    await buildWebPack('production', ['--config', './build/webpack/webpack.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '1' });
    await buildWebPack('production', ['--config', './build/webpack/webpack.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '2' });
    await buildWebPack('production', ['--config', './build/webpack/webpack.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '3' });
    await buildWebPack('production', ['--config', './build/webpack/webpack.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096', 'BUNDLE_INDEX': '4' });
    // Run both in parallel, for faster process on CI.
    // Yes, console would print output from both, that's ok, we have a faster CI.
    // If things fail, we can run locally separately.
    if (isCI) {
        const buildExtension = buildWebPack('extension', ['--config', './build/webpack/webpack.extension.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096' });
        const buildDebugAdapter = buildWebPack('debugAdapter', ['--config', './build/webpack/webpack.debugadapter.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096' });
        await Promise.all([buildExtension, buildDebugAdapter]);
    } else {
        await buildWebPack('extension', ['--config', './build/webpack/webpack.extension.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096' });
        await buildWebPack('debugAdapter', ['--config', './build/webpack/webpack.debugadapter.config.js'], { 'NODE_OPTIONS': '--max_old_space_size=9096' });
    }
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
        const versionParts = packageJson['version'].split('.');
        const buildNumberPortion = versionParts.length > 2 ? versionParts[2].replace(/(\d+)/, args.buildNumber) : args.buildNumber;
        const newVersion = versionParts.length > 1 ? `${versionParts[0]}.${versionParts[1]}.${buildNumberPortion}` : packageJson['version'];
        packageJson['version'] = newVersion;

        // Write back to the package json
        await fsExtra.writeFile('package.json', JSON.stringify(packageJson, null, 4), 'utf-8');

        // Update the changelog.md if we are told to (this should happen on the release branch)
        if (args.updateChangelog) {
            const changeLogContents = await fsExtra.readFile('CHANGELOG.md', 'utf-8');
            const fixedContents = changeLogContents.replace(/##\s*(\d+)\.(\d+)\.(\d+)\s*\(/, `## $1.$2.${buildNumberPortion} (`);

            // Write back to changelog.md
            await fsExtra.writeFile('CHANGELOG.md', fixedContents, 'utf-8');
        }
    } else {
        throw Error('buildNumber argument required for updateBuildNumber task');
    }
}

async function buildWebPack(webpackConfigName, args, env) {
    // Remember to perform a case insensitive search.
    const allowedWarnings = getAllowedWarningsForWebPack(webpackConfigName).map(item => item.toLowerCase());
    const stdOut = await spawnAsync('npm', ['run', 'webpack', '--', ...args, ...['--mode', 'production']], env);
    const stdOutLines = stdOut
        .split(os.EOL)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    // Remember to perform a case insensitive search.
    const warnings = stdOutLines
        .filter(item => item.startsWith('WARNING in '))
        .filter(item => allowedWarnings.findIndex(allowedWarning => item.toLowerCase().startsWith(allowedWarning.toLowerCase())) == -1);
    const errors = stdOutLines.some(item => item.startsWith('ERROR in'));
    if (errors) {
        throw new Error(`Errors in ${webpackConfigName}, \n${warnings.join(', ')}\n\n${stdOut}`);
    }
    if (warnings.length > 0) {
        throw new Error(`Warnings in ${webpackConfigName}, Check gulpfile.js to see if the warning should be allowed., \n\n${stdOut}`);
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
                'WARNING in ./node_modules/any-promise/register.js'
            ];
        case 'extension':
            return [
                'WARNING in ./node_modules/encoding/lib/iconv-loader.js',
                'WARNING in ./node_modules/ws/lib/BufferUtil.js',
                'WARNING in ./node_modules/ws/lib/buffer-util.js',
                'WARNING in ./node_modules/ws/lib/Validation.js',
                'WARNING in ./node_modules/ws/lib/validation.js',
                'WARNING in ./node_modules/any-promise/register.js'
            ];
        case 'debugAdapter':
            return ['WARNING in ./node_modules/vscode-uri/lib/index.js'];
        default:
            throw new Error('Unknown WebPack Configuration');
    }
}
gulp.task('renameSourceMaps', async () => {
    // By default source maps will be disabled in the extension.
    // Users will need to use the command `python.enableSourceMapSupport` to enable source maps.
    const extensionSourceMap = path.join(__dirname, 'out', 'client', 'extension.js.map');
    const debuggerSourceMap = path.join(__dirname, 'out', 'client', 'debugger', 'debugAdapter', 'main.js.map');
    await fs.rename(extensionSourceMap, `${extensionSourceMap}.disabled`);
    await fs.rename(debuggerSourceMap, `${debuggerSourceMap}.disabled`);
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
gulp.task('checkDependencies', gulp.series('checkNativeDependencies', 'check-datascience-dependencies'));
gulp.task('prePublishNonBundle', gulp.series('compile', 'compile-webviews'));

gulp.task('installPythonRequirements', async () => {
    const requirements = fs
        .readFileSync(path.join(__dirname, 'requirements.txt'), 'utf8')
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    const args = ['-m', 'pip', '--disable-pip-version-check', 'install', '-t', './pythonFiles/lib/python', '--no-cache-dir', '--implementation', 'py', '--no-deps', '--upgrade'];
    await Promise.all(
        requirements.map(async requirement => {
            const success = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', args.concat(requirement))
                .then(() => true)
                .catch(ex => {
                    console.error("Failed to install Python Libs using 'python3'", ex);
                    return false;
                });
            if (!success) {
                console.info("Failed to install Python Libs using 'python3', attempting to install using 'python'");
                await spawnAsync('python', args.concat(requirement)).catch(ex => console.error("Failed to install Python Libs using 'python'", ex));
            }
        })
    );
});


// See https://github.com/microsoft/vscode-python/issues/7136
gulp.task('installNewPtvsd', async () => {
    // Install new PTVSD with wheels for python 3.7
    const successWithWheels = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', ['./pythonFiles/install_ptvsd.py'])
        .then(() => true)
        .catch(ex => {
            console.error("Failed to install new PTVSD wheels using 'python3'", ex);
            return false;
        });
    if (!successWithWheels) {
        console.info("Failed to install new PTVSD wheels using 'python3', attempting to install using 'python'");
        await spawnAsync('python', args).catch(ex => console.error("Failed to install PTVSD 5.0 wheels using 'python'", ex));
    }

    // Install source only version of new PTVSD for use with all other python versions.
    const args = ['-m', 'pip', '--disable-pip-version-check', 'install', '-t', './pythonFiles/lib/python/new_ptvsd/no_wheels', '--no-cache-dir', '--implementation', 'py', '--no-deps', '--upgrade', 'ptvsd==5.0.0a10']
    const successWithoutWheels = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', args)
        .then(() => true)
        .catch(ex => {
            console.error("Failed to install PTVSD using 'python3'", ex);
            return false;
        });
    if (!successWithoutWheels) {
        console.info("Failed to install source only version of new PTVSD using 'python3', attempting to install using 'python'");
        await spawnAsync('python', args).catch(ex => console.error("Failed to install source only PTVSD 5.0 using 'python'", ex));
    }
});

// Install the last stable version of old PTVSD (which includes a middle layer adapter and requires ptvsd_launcher.py)
// until all users have migrated to the new debug adapter + new PTVSD (specified in requirements.txt)
// See https://github.com/microsoft/vscode-python/issues/7136
gulp.task('installOldPtvsd', async () => {
    const args = ['-m', 'pip', '--disable-pip-version-check', 'install', '-t', './pythonFiles/lib/python/old_ptvsd', '--no-cache-dir', '--implementation', 'py', '--no-deps', '--upgrade', 'ptvsd==4.3.2']
    const success = await spawnAsync(process.env.CI_PYTHON_PATH || 'python3', args)
        .then(() => true)
        .catch(ex => {
            console.error("Failed to install PTVSD using 'python3'", ex);
            return false;
        });
    if (!success) {
        console.info("Failed to install PTVSD using 'python3', attempting to install using 'python'");
        await spawnAsync('python', args).catch(ex => console.error("Failed to install PTVSD using 'python'", ex));
    }
});

gulp.task('installPythonLibs', gulp.series('installPythonRequirements', 'installOldPtvsd', 'installNewPtvsd'));

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
                container: process.env.AZURE_STORAGE_CONTAINER
            })
        );
}

gulp.task('uploadDeveloperExtension', () => uploadExtension('ms-python-insiders.vsix'));
gulp.task('uploadReleaseExtension', () => uploadExtension(`ms-python-${process.env.TRAVIS_BRANCH || process.env.BUILD_SOURCEBRANCHNAME}.vsix`));

function spawnAsync(command, args, env) {
    env = env || {};
    env = { ...process.env, ...env };
    return new Promise((resolve, reject) => {
        let stdOut = '';
        const proc = spawn(command, args, { cwd: __dirname, env });
        proc.stdout.on('data', data => {
            // Log output on CI (else travis times out when there's not output).
            stdOut += data.toString();
            if (isCI) {
                console.log(data.toString());
            }
        });
        proc.stderr.on('data', data => console.error(data.toString()));
        proc.on('close', () => resolve(stdOut));
        proc.on('error', error => reject(error));
    });
}
function buildDatascienceDependencies() {
    fsExtra.ensureDirSync(path.join(__dirname, 'tmp'));
    spawn.sync('npm', ['run', 'dump-datascience-webpack-stats']);
}

async function checkDatascienceDependencies() {
    buildDatascienceDependencies();

    const existingModulesFileName = 'package.datascience-ui.dependencies.json';
    const existingModulesFile = path.join(__dirname, existingModulesFileName);
    const existingModulesList = JSON.parse(await fsExtra.readFile(existingModulesFile).then(data => data.toString()));
    const existingModules = new Set(existingModulesList);
    const existingModulesCopy = new Set(existingModulesList);

    const statsOutput = path.join(__dirname, 'tmp', 'ds-stats.json');
    const contents = await fsExtra.readFile(statsOutput).then(data => data.toString());
    const startIndex = contents.toString().indexOf('{') - 1;

    const json = JSON.parse(contents.substring(startIndex));
    const newModules = new Set();
    const packageLock = JSON.parse(await fsExtra.readFile('package-lock.json').then(data => data.toString()));
    const modulesInPackageLock = Object.keys(packageLock.dependencies);

    // Right now the script only handles two parts in the dependency name (with one '/').
    // If we have dependencies with more than one '/', then update this code.
    if (modulesInPackageLock.some(dependency => dependency.indexOf('/') !== dependency.lastIndexOf('/'))) {
        throwAndLogError("Dependencies detected with more than one '/', please update this script.");
    }
    json.children.forEach(c => {
        c.chunks[0].modules.forEach(m => {
            const name = m.name;
            if (!name.startsWith('./node_modules')) {
                return;
            }

            let nameWithoutNodeModules = name.substring('./node_modules'.length);
            // Special case expose-loader.
            if (nameWithoutNodeModules.startsWith('/expose-loader')) {
                nameWithoutNodeModules = nameWithoutNodeModules.substring(nameWithoutNodeModules.indexOf('./node_modules') + './node_modules'.length);
            }

            let moduleName1 = nameWithoutNodeModules.split('/')[1];
            moduleName1 = moduleName1.endsWith('!.') ? moduleName1.substring(0, moduleName1.length - 2) : moduleName1;
            const moduleName2 = `${nameWithoutNodeModules.split('/')[1]}/${nameWithoutNodeModules.split('/')[2]}`;

            const matchedModules = modulesInPackageLock.filter(dependency => dependency === moduleName2 || dependency === moduleName1);
            switch (matchedModules.length) {
                case 0:
                    throwAndLogError(`Dependency not found in package-lock.json, Dependency = '${name}, ${moduleName1}, ${moduleName2}'`);
                    break;
                case 1:
                    break;
                default: {
                    throwAndLogError(`Exact Dependency not found in package-lock.json, Dependency = '${name}'`);
                }
            }

            const moduleName = matchedModules[0];
            if (existingModulesCopy.has(moduleName)) {
                existingModulesCopy.delete(moduleName);
            }
            if (existingModules.has(moduleName) || newModules.has(moduleName)) {
                return;
            }
            newModules.add(moduleName);
        });
    });

    const errorMessages = [];
    if (newModules.size > 0) {
        errorMessages.push(`Add the untracked dependencies '${Array.from(newModules.values()).join(', ')}' to ${existingModulesFileName}`);
    }
    if (existingModulesCopy.size > 0) {
        errorMessages.push(`Remove the unused '${Array.from(existingModulesCopy.values()).join(', ')}' dependencies from ${existingModulesFileName}`);
    }
    if (errorMessages.length > 0) {
        throwAndLogError(errorMessages.join('\n'));
    }
}
function throwAndLogError(message) {
    if (message.length > 0) {
        console.error(colors.red(message));
        throw new Error(message);
    }
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

/**
 * @typedef {Object} hygieneOptions - creates a new type named 'SpecialType'
 * @property {'changes'|'staged'|'all'|'compile'|'diffMaster'} [mode=] - Mode.
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
const hygiene = (options, done) => {
    done = done || noop;
    if (compilationInProgress) {
        reRunCompilation = true;
        return done();
    }
    const fileListToProcess = options.mode === 'compile' ? undefined : getFileListToProcess(options);
    if (Array.isArray(fileListToProcess) && fileListToProcess !== all && fileListToProcess.filter(item => item.endsWith('.ts')).length === 0) {
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
                    console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation (use 4 spaces instead of tabs or other)');
                    errorCount++;
                }
            });

        this.emit('data', file);
    });

    const formatOptions = { verify: true, tsconfig: true, tslint: true, editorconfig: true, tsfmt: true };
    const formatting = es.map(function (file, cb) {
        tsfmt
            .processString(file.path, file.contents.toString('utf8'), formatOptions)
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
        return (
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
                .filter(reported => reported === true).length > 0
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
                error: function (error, typescript) {
                    const fullFilename = error.fullFilename || '';
                    const relativeFilename = error.relativeFilename || '';
                    if (tsFiles.findIndex(file => fullFilename === file || relativeFilename === file) === -1) {
                        return;
                    }
                    console.error(`Error: ${error.message}`);
                    errorCount += 1;
                },
                finish: function () {
                    // forget the summary.
                    console.log('Finished compilation');
                }
            };
        }
        const reporter = customReporter();
        return tsProject(reporter);
    };

    const files = options.mode === 'compile' ? tsProject.src() : getFilesToProcess(fileListToProcess);
    const dest = options.mode === 'compile' ? './out' : '.';
    let result = files.pipe(filter(f => f && f.stat && !f.stat.isDirectory()));

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
    let totalTime = 0;
    result = result
        .pipe(tscFilesTracker)
        .pipe(sourcemaps.init())
        .pipe(tsc())
        .pipe(
            sourcemaps.mapSources(function (sourcePath, file) {
                let tsFileName = path.basename(file.path).replace(/js$/, 'ts');
                const qualifiedSourcePath = path
                    .dirname(file.path)
                    .replace('out/', 'src/')
                    .replace('out\\', 'src\\');
                if (!fs.existsSync(path.join(qualifiedSourcePath, tsFileName))) {
                    const tsxFileName = path.basename(file.path).replace(/js$/, 'tsx');
                    if (!fs.existsSync(path.join(qualifiedSourcePath, tsxFileName))) {
                        console.error(`ERROR: (source-maps) ${file.path}[1,1]: Source file not found`);
                    } else {
                        tsFileName = tsxFileName;
                    }
                }
                return path.join(path.relative(path.dirname(file.path), qualifiedSourcePath), tsFileName);
            })
        )
        .pipe(sourcemaps.write('.', { includeContent: false }))
        .pipe(gulp.dest(dest))
        .pipe(
            es.through(null, function () {
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
                        hygiene(options, done);
                    }, 10);
                }
                done();
                this.emit('end');
            })
        )
        .on('error', ex => {
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
    options = options ? options : {};
    options.exitOnError = typeof options.exitOnError === 'undefined' ? isCI : options.exitOnError;
    process.once('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        exitHandler(options);
    });

    // Clear screen each time
    console.log('\x1Bc');
    const startMessage = `Hygiene starting`;
    console.log(colors.blue(startMessage));

    hygiene(options, done);
}

function git(args) {
    let result = cp.spawnSync('git', args, { encoding: 'utf-8' });
    return result.output.join('\n');
}

function getStagedFilesSync() {
    const out = git(['diff', '--cached', '--name-only']);
    return out.split(/\r?\n/).filter(l => !!l);
}
function getAddedFilesSync() {
    const out = git(['status', '-u', '-s']);
    return out
        .split(/\r?\n/)
        .filter(l => !!l)
        .filter(
            l =>
                _.intersection(
                    ['A', '?', 'U'],
                    l
                        .substring(0, 2)
                        .trim()
                        .split('')
                ).length > 0
        )
        .map(l => path.join(__dirname, l.substring(2).trim()));
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
        if (targetBranch !== 'master') {
            return [];
        }

        const repo = process.env.TRAVIS_REPO_SLUG || getAzureDevOpsVarValue('Build.Repository.Name');
        const originOrUpstream = repo.toUpperCase() === 'MICROSOFT/VSCODE-PYTHON' || repo.toUpperCase() === 'VSCODE-PYTHON-DATASCIENCE/VSCODE-PYTHON' ? 'origin' : 'upstream';

        // If on CI, get a list of modified files comparing against
        // PR branch and master of current (assumed 'origin') repo.
        try {
            cp.execSync(`git remote set-branches --add ${originOrUpstream} master`, { encoding: 'utf8', cwd: __dirname });
            cp.execSync('git fetch', { encoding: 'utf8', cwd: __dirname });
        } catch (ex) {
            return [];
        }
        const cmd = `git diff --name-only HEAD ${originOrUpstream}/master`;
        console.info(cmd);
        const out = cp.execSync(cmd, { encoding: 'utf8', cwd: __dirname });
        return out
            .split(/\r?\n/)
            .filter(l => !!l)
            .filter(l => l.length > 0)
            .map(l => l.trim().replace(/\//g, path.sep))
            .map(l => path.join(__dirname, l));
    } else {
        const out = cp.execSync('git status -u -s', { encoding: 'utf8' });
        return out
            .split(/\r?\n/)
            .filter(l => !!l)
            .filter(
                l =>
                    _.intersection(
                        ['M', 'A', 'R', 'C', 'U', '?'],
                        l
                            .substring(0, 2)
                            .trim()
                            .split('')
                    ).length > 0
            )
            .map(l =>
                path.join(
                    __dirname,
                    l
                        .substring(2)
                        .trim()
                        .replace(/\//g, path.sep)
                )
            );
    }
}

function getDifferentFromMasterFilesSync() {
    const out = git(['diff', '--name-status', 'master']);
    return out
        .split(/\r?\n/)
        .filter(l => !!l)
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
        return getModifiedFilesSync().filter(f => fs.existsSync(f));
    }

    if (options && options.mode === 'staged') {
        return getStagedFilesSync().filter(f => fs.existsSync(f));
    }

    if (options && options.mode === 'diffMaster') {
        return getDifferentFromMasterFilesSync().filter(f => fs.existsSync(f));
    }

    return all;
}

exports.hygiene = hygiene;

// this allows us to run hygiene via CLI (e.g. `node gulfile.js`).
if (require.main === module) {
    run({ exitOnError: true, mode: 'staged' }, () => { });
}
