'use strict';
// TODO: Cleanup this place
// Add options for execPythonFile
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { CancellationToken, Range, TextDocument, Uri } from 'vscode';
import * as settings from './configSettings';
import { mergeEnvVariables, parseEnvFile } from './envFileParser';
import { isNotInstalledError } from './helpers';
import { InterpreterInfoCache } from './interpreterInfoCache';

export const IS_WINDOWS = /^win/.test(process.platform);
export const Is_64Bit = os.arch() === 'x64';
export const PATH_VARIABLE_NAME = IS_WINDOWS ? 'Path' : 'PATH';

const PathValidity: Map<string, boolean> = new Map<string, boolean>();
export function validatePath(filePath: string): Promise<string> {
    if (filePath.length === 0) {
        return Promise.resolve('');
    }
    if (PathValidity.has(filePath)) {
        return Promise.resolve(PathValidity.get(filePath) ? filePath : '');
    }
    return new Promise<string>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists ? filePath : '');
        });
    });
}
export function fsExistsAsync(filePath: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists);
        });
    });
}
export function fsReaddirAsync(root: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(root, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            resolve(subDirs.map(subDir => path.join(root, subDir)));
        });
    });
}

async function getPythonInterpreterDirectory(resource?: Uri): Promise<string> {
    const cache = InterpreterInfoCache.get(resource);
    const pythonFileName = settings.PythonSettings.getInstance(resource).pythonPath;

    // If we already have it and the python path hasn't changed, yay
    if (cache.pythonInterpreterDirectory && cache.pythonInterpreterDirectory.length > 0
        && cache.pythonSettingsPath === pythonFileName) {
        return cache.pythonInterpreterDirectory;
    }


    // Check if we have the path
    if (path.basename(pythonFileName) === pythonFileName) {
        try {
            const pythonInterpreterPath = await getPathFromPythonCommand(pythonFileName);
            const pythonInterpreterDirectory = path.dirname(pythonInterpreterPath);
            InterpreterInfoCache.setPaths(resource, pythonFileName, pythonInterpreterPath, pythonInterpreterDirectory);
            return pythonInterpreterDirectory;
            // tslint:disable-next-line:variable-name
        } catch (_ex) {
            InterpreterInfoCache.setPaths(resource, pythonFileName, pythonFileName, '');
            return '';
        }
    }

    return new Promise<string>(resolve => {
        // If we can execute the python, then get the path from the fully qualified name
        child_process.execFile(pythonFileName, ['-c', 'print(1234)'], (error, stdout, stderr) => {
            // Yes this is a valid python path
            if (stdout.startsWith('1234')) {
                const pythonInterpreterDirectory = path.dirname(pythonFileName);
                InterpreterInfoCache.setPaths(resource, pythonFileName, pythonFileName, pythonInterpreterDirectory);
                resolve(pythonInterpreterDirectory);
            } else {
                // No idea, didn't work, hence don't reject, but return empty path
                InterpreterInfoCache.setPaths(resource, pythonFileName, pythonFileName, '');
                resolve('');
            }
        });
    });
}
export async function getFullyQualifiedPythonInterpreterPath(resource?: Uri): Promise<string> {
    const pyDir = await getPythonInterpreterDirectory(resource);
    const cache = InterpreterInfoCache.get(resource);
    return cache.pythonInterpreterPath;
}
export async function getPathFromPythonCommand(pythonPath: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
            if (stdout) {
                const lines = stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
                resolve(lines.length > 0 ? lines[0] : '');
            } else {
                reject();
            }
        });
    });
}
async function getEnvVariables(resource?: Uri): Promise<{}> {
    const cache = InterpreterInfoCache.get(resource);
    if (cache.customEnvVariables) {
        return cache.customEnvVariables;
    }

    const pyPath = await getPythonInterpreterDirectory(resource);
    let customEnvVariables = await getCustomEnvVars(resource) || {};

    if (pyPath.length > 0) {
        // Ensure to include the path of the current python.
        let newPath = '';
        const currentPath = typeof customEnvVariables[PATH_VARIABLE_NAME] === 'string' ? customEnvVariables[PATH_VARIABLE_NAME] : process.env[PATH_VARIABLE_NAME];
        if (IS_WINDOWS) {
            newPath = `${pyPath}\\${path.delimiter}${path.join(pyPath, 'Scripts\\')}${path.delimiter}${currentPath}`;
            // This needs to be done for windows.
            process.env[PATH_VARIABLE_NAME] = newPath;
        } else {
            newPath = `${pyPath}${path.delimiter}${currentPath}`;
        }
        customEnvVariables = mergeEnvVariables(customEnvVariables, process.env);
        customEnvVariables[PATH_VARIABLE_NAME] = newPath;
    }

    InterpreterInfoCache.setCustomEnvVariables(resource, customEnvVariables);
    return customEnvVariables;
}
export async function execPythonFile(resource: string | Uri | undefined, file: string, args: string[], cwd: string, includeErrorAsResponse: boolean = false, stdOut: (line: string) => void = null, token?: CancellationToken): Promise<string> {
    const resourceUri = typeof resource === 'string' ? Uri.file(resource) : resource;
    const env = await getEnvVariables(resourceUri);
    const options = { cwd, env };

    if (stdOut) {
        return spawnFileInternal(file, args, options, includeErrorAsResponse, stdOut, token);
    }

    const fileIsPythonInterpreter = (file.toUpperCase() === 'PYTHON' || file === settings.PythonSettings.getInstance(resourceUri).pythonPath);
    const execAsModule = fileIsPythonInterpreter && args.length > 0 && args[0] === '-m';

    if (execAsModule) {
        return getFullyQualifiedPythonInterpreterPath(resourceUri)
            .then(p => execPythonModule(p, args, options, includeErrorAsResponse, token));
    }
    return execFileInternal(file, args, options, includeErrorAsResponse, token);
}

function handleResponse(file: string, includeErrorAsResponse: boolean, error: Error, stdout: string, stderr: string, token?: CancellationToken): Promise<string> {
    if (token && token.isCancellationRequested) {
        return Promise.resolve(undefined);
    }
    if (isNotInstalledError(error)) {
        return Promise.reject(error);
    }

    // pylint:
    //      In the case of pylint we have some messages (such as config file not found and using default etc...) being returned in stderr
    //      These error messages are useless when using pylint
    if (includeErrorAsResponse && (stdout.length > 0 || stderr.length > 0)) {
        return Promise.resolve(stdout + '\n' + stderr);
    }

    let hasErrors = (error && error.message.length > 0) || (stderr && stderr.length > 0);
    if (hasErrors && (typeof stdout !== 'string' || stdout.length === 0)) {
        let errorMsg = (error && error.message) ? error.message : (stderr && stderr.length > 0 ? stderr + '' : '');
        return Promise.reject(errorMsg);
    }
    else {
        return Promise.resolve(stdout + '');
    }
}
function handlePythonModuleResponse(includeErrorAsResponse: boolean, error: Error, stdout: string, stderr: string, token?: CancellationToken): Promise<string> {
    if (token && token.isCancellationRequested) {
        return Promise.resolve(undefined);
    }
    if (isNotInstalledError(error)) {
        return Promise.reject(error);
    }

    // pylint:
    //      In the case of pylint we have some messages (such as config file not found and using default etc...) being returned in stderr
    //      These error messages are useless when using pylint
    if (includeErrorAsResponse && (stdout.length > 0 || stderr.length > 0)) {
        return Promise.resolve(stdout + '\n' + stderr);
    }
    if (!includeErrorAsResponse && stderr.length > 0) {
        return Promise.reject(stderr);
    }

    return Promise.resolve(stdout + '');
}
function execPythonModule(file: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean, token?: CancellationToken): Promise<string> {
    options.maxBuffer = options.maxBuffer ? options.maxBuffer : 1024 * 102400;
    return new Promise<string>((resolve, reject) => {
        let proc = child_process.execFile(file, args, options, (error, stdout, stderr) => {
            handlePythonModuleResponse(includeErrorAsResponse, error, stdout, stderr, token)
                .then(resolve)
                .catch(reject);
        });
        if (token && token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                if (proc) {
                    proc.kill();
                    proc = null;
                }
            });
        }
    });
}

function execFileInternal(file: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean, token?: CancellationToken): Promise<string> {
    options.maxBuffer = options.maxBuffer ? options.maxBuffer : 1024 * 102400;
    return new Promise<string>((resolve, reject) => {
        let proc = child_process.execFile(file, args, options, (error, stdout, stderr) => {
            handleResponse(file, includeErrorAsResponse, error, stdout, stderr, token)
                .then(data => resolve(data))
                .catch(err => reject(err));
        });
        if (token && token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                if (proc) {
                    proc.kill();
                    proc = null;
                }
            });
        }
    });
}
function spawnFileInternal(file: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean, stdOut: (line: string) => void, token?: CancellationToken): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        options.env = options.env || {};
        options.env['PYTHONIOENCODING'] = 'UTF-8';
        let proc = child_process.spawn(file, args, options);
        let error = '';
        let exited = false;
        if (token && token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                if (!exited && proc) {
                    proc.kill();
                    proc = null;
                }
            });
        }
        proc.on('error', error => {
            reject(error);
        });
        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');
        proc.stdout.on('data', function (data: string) {
            if (token && token.isCancellationRequested) {
                return;
            }
            stdOut(data);
        });

        proc.stderr.on('data', function (data: string) {
            if (token && token.isCancellationRequested) {
                return;
            }
            if (includeErrorAsResponse) {
                stdOut(data);
            }
            else {
                error += data;
            }
        });

        proc.on('exit', function (code) {
            exited = true;

            if (token && token.isCancellationRequested) {
                return reject();
            }
            if (error.length > 0) {
                return reject(error);
            }

            resolve();
        });

    });
}
function execInternal(command: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        child_process.exec([command].concat(args).join(' '), options, (error, stdout, stderr) => {
            handleResponse(command, includeErrorAsResponse, error, stdout, stderr)
                .then(data => resolve(data))
                .catch(err => reject(err));
        });
    });
}

export function formatErrorForLogging(error: Error | string): string {
    let message: string = '';
    if (typeof error === 'string') {
        message = error;
    }
    else {
        if (error.message) {
            message = `Error Message: ${error.message}`;
        }
        if (error.name && error.message.indexOf(error.name) === -1) {
            message += `, (${error.name})`;
        }
        const innerException = (error as any).innerException;
        if (innerException && (innerException.message || innerException.name)) {
            if (innerException.message) {
                message += `, Inner Error Message: ${innerException.message}`;
            }
            if (innerException.name && innerException.message.indexOf(innerException.name) === -1) {
                message += `, (${innerException.name})`;
            }
        }
    }
    return message;
}

export function getSubDirectories(rootDir: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        fs.readdir(rootDir, (error, files) => {
            if (error) {
                return resolve([]);
            }
            const subDirs = [];
            files.forEach(name => {
                const fullPath = path.join(rootDir, name);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        subDirs.push(fullPath);
                    }
                }
                catch (ex) {
                }
            });
            resolve(subDirs);
        });
    });
}

export async function getCustomEnvVars(resource?: Uri): Promise<{} | undefined | null> {
    const envFile = settings.PythonSettings.getInstance(resource).envFile;
    if (typeof envFile !== 'string' || envFile.length === 0) {
        return null;
    }
    const exists = await fsExtra.pathExists(envFile);
    if (!exists) {
        return null;
    }
    try {
        const vars = parseEnvFile(envFile);
        if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
            return vars;
        }
    } catch (ex) {
        console.error('Failed to parse env file', ex);
    }
    return null;
}
export function getCustomEnvVarsSync(resource?: Uri): {} | undefined | null {
    const envFile = settings.PythonSettings.getInstance(resource).envFile;
    if (typeof envFile !== 'string' || envFile.length === 0) {
        return null;
    }
    const exists = fsExtra.pathExistsSync(envFile);
    if (!exists) {
        return null;
    }
    try {
        const vars = parseEnvFile(envFile);
        if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
            return vars;
        }
    } catch (ex) {
        console.error('Failed to parse env file', ex);
    }
    return null;
}

export function getWindowsLineEndingCount(document: TextDocument, offset: Number) {
    const eolPattern = new RegExp('\r\n', 'g');
    const readBlock = 1024;
    let count = 0;
    let offsetDiff = offset.valueOf();

    // In order to prevent the one-time loading of large files from taking up too much memory
    for (let pos = 0; pos < offset; pos += readBlock) {
        let startAt = document.positionAt(pos);
        let endAt = null;

        if (offsetDiff >= readBlock) {
            endAt = document.positionAt(pos + readBlock);
            offsetDiff = offsetDiff - readBlock;
        } else {
            endAt = document.positionAt(pos + offsetDiff);
        }

        let text = document.getText(new Range(startAt, endAt));
        let cr = text.match(eolPattern);

        count += cr ? cr.length : 0;
    }
    return count;
}

export function arePathsSame(path1: string, path2: string) {
    path1 = IS_WINDOWS ? path1.replace(/\//g, "\\") : path1;
    path2 = IS_WINDOWS ? path2.replace(/\//g, "\\") : path2;
    return path1.toUpperCase() === path2.toUpperCase();
}

export function areBasePathsSame(path1: string, path2: string) {
    path1 = IS_WINDOWS ? path1.replace(/\//g, "\\") : path1;
    path2 = IS_WINDOWS ? path2.replace(/\//g, "\\") : path2;
    return path.dirname(path1).toUpperCase() === path.dirname(path2).toUpperCase();
}
export async function getInterpreterVersion(pythonPath: string) {
    return await new Promise<string>((resolve, reject) => {
        child_process.execFile(pythonPath, ['--version'], (error, stdout, stdErr) => {
            const out = (typeof stdErr === 'string' ? stdErr : '') + os.EOL + (typeof stdout === 'string' ? stdout : '');
            const lines = out.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            resolve(lines.length > 0 ? lines[0] : '');
        });
    });
}
