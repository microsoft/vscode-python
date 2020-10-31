// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import {
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType,
} from '../../../../common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonVersion, UNKNOWN_PYTHON_VERSION,
} from '../../../base/info';
import { buildEnvInfo, comparePythonVersionsByHeuristic } from '../../../base/info/env';
import { parseVersion } from '../../../base/info/pythonVersion';
import { ILocator, IPythonEnvsIterator } from '../../../base/locator';
import { PythonEnvsWatcher } from '../../../base/watcher';
import { findInterpretersInDir, getPythonVersionFromNearByFiles } from '../../../common/commonUtils';
import { getFileInfo, getSubDirs, pathExists } from '../../../common/externalDependencies';
import { getPythonVersionFromConda, isCondaEnvironment } from './condaLocator';
import { getPythonVersionFromVenv, isVenvEnvironment } from './virtualEnvironmentIdentifier';

function getPyenvDir(): string {
    // Check if the pyenv environment variables exist: PYENV on Windows, PYENV_ROOT on Unix.
    // They contain the path to pyenv's installation folder.
    // If they don't exist, use the default path: ~/.pyenv/pyenv-win on Windows, ~/.pyenv on Unix.
    // If the interpreter path starts with the path to the pyenv folder, then it is a pyenv environment.
    // See https://github.com/pyenv/pyenv#locating-the-python-installation for general usage,
    // And https://github.com/pyenv-win/pyenv-win for Windows specifics.
    let pyenvDir = getEnvironmentVariable('PYENV_ROOT') ?? getEnvironmentVariable('PYENV');

    if (!pyenvDir) {
        const homeDir = getUserHomeDir() || '';
        pyenvDir = getOSType() === OSType.Windows ? path.join(homeDir, '.pyenv', 'pyenv-win') : path.join(homeDir, '.pyenv');
    }

    return pyenvDir;
}

/**
 * Checks if the given interpreter belongs to a pyenv based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean}: Returns true if the interpreter belongs to a pyenv environment.
 */
export async function isPyenvEnvironment(interpreterPath:string): Promise<boolean> {
    let pathToCheck = interpreterPath;
    let pyenvDir = getPyenvDir();

    if (!await pathExists(pyenvDir)) {
        return false;
    }

    if (!pyenvDir.endsWith(path.sep)) {
        pyenvDir += path.sep;
    }

    if (getOSType() === OSType.Windows) {
        pyenvDir = pyenvDir.toUpperCase();
        pathToCheck = pathToCheck.toUpperCase();
    }

    return pathToCheck.startsWith(pyenvDir);
}

export interface IPyenvVersionStrings {
    pythonVer?: string;
    distro?: string;
    distroVer?:string;
}

/**
 * This function provides parsers for some of the common and known distributions
 * supported by pyenv.
 */
function getKnownPyenvVersionParsers() : Map<string, (path:string) => Promise<IPyenvVersionStrings|undefined>> {
    /**
     * This function parses versions that are plain python versions.
     * @param str string to parse
     *
     * Parses :
     *   2.7.18
     *   3.9.0
     */
    function pythonOnly(str:string): Promise<IPyenvVersionStrings> {
        return Promise.resolve({
            pythonVer: str,
            distro: undefined,
            distroVer: undefined,
        });
    }

    /**
     * This function parses versions that are distro versions.
     * @param str string to parse
     *
     * Examples:
     *   miniconda3-4.7.12
     *   anaconda3-2020.07
     */
    function distroOnly(str:string): Promise<IPyenvVersionStrings|undefined> {
        const parts = str.split('-');
        if (parts.length === 3) {
            return Promise.resolve({
                pythonVer: undefined,
                distroVer: `${parts[1]}-${parts[2]}`,
                distro: parts[0],
            });
        } if (parts.length === 2) {
            return Promise.resolve({
                pythonVer: undefined,
                distroVer: parts[1],
                distro: parts[0],
            });
        }
        return Promise.resolve({
            pythonVer: undefined,
            distroVer: undefined,
            distro: str,
        });
    }

    /**
     * This function parser pypy environments supported by the pyenv install command
     * @param str string to parse
     *
     * Examples:
     *  pypy-c-jit-latest
     *  pypy-c-nojit-latest
     *  pypy-dev
     *  pypy-stm-2.3
     *  pypy-stm-2.5.1
     *  pypy-1.5-src
     *  pypy-1.5
     *  pypy3.5-5.7.1-beta-src
     *  pypy3.5-5.7.1-beta
     *  pypy3.5-5.8.0-src
     *  pypy3.5-5.8.0
     */
    function pypyParser(str:string): Promise<IPyenvVersionStrings|undefined> {
        const pattern = /[0-9\.]+/;

        const parts = str.split('-');
        const pythonVer = parts[0].search(pattern) > 0 ? parts[0].substr('pypy'.length) : undefined;
        if (parts.length === 2) {
            return Promise.resolve({
                pythonVer,
                distroVer: parts[1],
                distro: 'pypy',
            });
        } if (parts.length === 3 && (parts[2].startsWith('src') || parts[2].startsWith('beta') || parts[2].startsWith('alpha'))) {
            return Promise.resolve({
                pythonVer,
                distroVer: `${parts[1]}-${parts[2]}`,
                distro: 'pypy',
            });
        } if (parts.length === 3 && (parts[1] === 'stm')) {
            return Promise.resolve({
                pythonVer,
                distroVer: parts[2],
                distro: `${parts[0]}-${parts[1]}`,
            });
        } if (parts.length === 4 && parts[1] === 'c') {
            return Promise.resolve({
                pythonVer,
                distroVer: parts[3],
                distro: `pypy-${parts[1]}-${parts[2]}`,
            });
        } if (parts.length === 4 && parts[3].startsWith('src')) {
            return Promise.resolve({
                pythonVer,
                distroVer: `${parts[1]}-${parts[2]}-${parts[3]}`,
                distro: 'pypy',
            });
        }

        return Promise.resolve({
            pythonVer,
            distroVer: undefined,
            distro: 'pypy',
        });
    }

    const parsers: Map<string, (path:string) => Promise<IPyenvVersionStrings|undefined>> = new Map();
    parsers.set('activepython', distroOnly);
    parsers.set('anaconda', distroOnly);
    parsers.set('graalpython', distroOnly);
    parsers.set('ironpython', distroOnly);
    parsers.set('jython', distroOnly);
    parsers.set('micropython', distroOnly);
    parsers.set('miniconda', distroOnly);
    parsers.set('pypy', pypyParser);
    parsers.set('pyston', distroOnly);
    parsers.set('stackless', distroOnly);
    parsers.set('3', pythonOnly);
    parsers.set('2', pythonOnly);

    return parsers;
}

/**
 * This function parses the name of the commonly installed versions of pyenv based environments.
 * @param str string to parse.
 *
 * Remarks: Depending on the environment, the name itself can contain distribution info like
 * name and version. Sometimes it may also have python version as a part of the name. This function
 * extracts the various strings.
 */
export function parsePyenvVersion(str:string): Promise<IPyenvVersionStrings|undefined> {
    const allParsers = getKnownPyenvVersionParsers();
    const knownPrefixes = Array.from(allParsers.keys());

    const parsers = knownPrefixes
        .filter((k) => str.startsWith(k))
        .map((p) => allParsers.get(p))
        .filter((p) => p !== undefined);

    if (parsers.length > 0 && parsers[0]) {
        return parsers[0](str);
    }

    return Promise.resolve(undefined);
}

/**
 * This function looks for python or python.exe binary in the sub folders of a given
 * environment directory.
 * @param envDir Absolute path to the pyenv environment directory
 */
async function getInterpreterPathFromDir(envDir:string): Promise<string|undefined> {
    // Ignore any folders or files that not directly python binary related.
    function filter(str:string):boolean {
        const lower = str.toLowerCase();
        return ['bin', 'scripts'].includes(lower) || lower.search('python') >= 0;
    }

    // Search in the sub-directories for python binary
    for await (const bin of findInterpretersInDir(envDir, 2, filter)) {
        const base = path.basename(bin).toLowerCase();
        if (base === 'python.exe' || base === 'python') {
            return bin;
        }
    }
    return undefined;
}

/**
 * This function does the best effort of finding version of python without running the
 * python binary.
 * @param interpreterPath Absolute path to the interpreter.
 * @param hint Any string that might contain version info.
 */
async function getPythonVersionFromPath(
    interpreterPath:string|undefined,
    hint:string|undefined,
): Promise<PythonVersion> {
    let versionA;
    try {
        versionA = hint ? parseVersion(hint) : UNKNOWN_PYTHON_VERSION;
    } catch (ex) {
        versionA = UNKNOWN_PYTHON_VERSION;
    }
    const versionB = interpreterPath ? await getPythonVersionFromNearByFiles(interpreterPath) : UNKNOWN_PYTHON_VERSION;
    const versionC = interpreterPath ? await getPythonVersionFromVenv(interpreterPath) : UNKNOWN_PYTHON_VERSION;
    const versionD = interpreterPath ? await getPythonVersionFromConda(interpreterPath) : UNKNOWN_PYTHON_VERSION;

    let version = UNKNOWN_PYTHON_VERSION;
    for (const v of [versionA, versionB, versionC, versionD]) {
        version = comparePythonVersionsByHeuristic(version, v) > 0 ? version : v;
    }
    return version;
}

/**
 * Gets all the pyenv environments.
 *
 * Remarks: This function looks at the <pyenv dir>/versions directory and gets
 * all the environments (global or virtual) in that directory. It also makes the
 * best effort at identifying the versions and distribution information.
 */
async function* getPyenvEnvironments(): AsyncIterableIterator<PythonEnvInfo> {
    const pyenvVersionDir = path.join(getPyenvDir(), 'versions');

    const subDirs = getSubDirs(pyenvVersionDir);
    for await (const subDir of subDirs) {
        const envDir = path.join(pyenvVersionDir, subDir);
        const interpreterPath = await getInterpreterPathFromDir(envDir);

        if (interpreterPath) {
            const versionStrings = await parsePyenvVersion(subDir);
            const pythonVersion = await getPythonVersionFromPath(interpreterPath, versionStrings?.pythonVer);

            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: interpreterPath,
                location: envDir,
                version: pythonVersion,
            });

            if (await isCondaEnvironment(interpreterPath)) {
                // Even though these environments are technically conda they have to be
                // activated the same way as pyenv. There are some issues here, it works
                // only if the environment was created using command like this:
                // `pyenv virtualenv miniconda-latest env1`
                // If it was created using `conda create env1` then it does not work
                // correctly, pyenv does not see it and can't correctly activate it.
                envInfo.defaultDisplayName = `${subDir}:pyenv-conda`;
            } else if (await isVenvEnvironment(interpreterPath)) {
                // These are virtual envs created using `pyenv virutalenv 3.9.0 env1`
                // command. They behave like virtual envs and have to be activated
                // using pyenv
                envInfo.defaultDisplayName = `${subDir}:pyenv`;
            } else {
                // These are global environments created when you run `pyenv install 3.9.0`.
                envInfo.defaultDisplayName = `${subDir}:pyenv`;
            }

            envInfo.name = subDir;
            envInfo.distro.org = (versionStrings && versionStrings.distro)
                ? versionStrings.distro : envInfo.distro.org;

            const fileData = await getFileInfo(interpreterPath);
            envInfo.executable.ctime = fileData.ctime;
            envInfo.executable.mtime = fileData.mtime;

            yield envInfo;
        }
    }
}

/**
 *
 * @param interpreterPath Absolute path to the python interpreter
 */
function getPyenvEnvironmentDirFromPath(interpreterPath:string): string {
    const skipDirs = ['bin', 'scripts'];

    // env <--- Return this directory if it si not 'bin' or 'scripts'
    // |__ python  <--- interpreterPath
    const dir = path.basename(path.dirname(interpreterPath));
    if (!skipDirs.includes(dir.toLowerCase())) {
        return path.dirname(interpreterPath);
    }

    // This is the best next guess.
    // env <--- Return this directory if it si not 'bin' or 'scripts'
    // |__ bin or Scripts
    //     |__ python  <--- interpreterPath
    return path.dirname(path.dirname(interpreterPath));
}

export class PyenvLocator extends PythonEnvsWatcher implements ILocator {
    // eslint-disable-next-line class-methods-use-this
    public iterEnvs(): IPythonEnvsIterator {
        return getPyenvEnvironments();
    }

    // eslint-disable-next-line class-methods-use-this
    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;

        if (await isPyenvEnvironment(executablePath)) {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: executablePath,
            });

            const location = getPyenvEnvironmentDirFromPath(executablePath);
            envInfo.location = location;
            envInfo.name = path.basename(location);
            envInfo.defaultDisplayName = `${envInfo.name}:pyenv`;

            const versionStrings = await parsePyenvVersion(envInfo.name);
            envInfo.version = await getPythonVersionFromPath(executablePath, versionStrings?.pythonVer);
            envInfo.distro.org = (versionStrings && versionStrings.distro)
                ? versionStrings.distro : envInfo.distro.org;

            const fileData = await getFileInfo(executablePath);
            envInfo.executable.ctime = fileData.ctime;
            envInfo.executable.mtime = fileData.mtime;

            return envInfo;
        }
        return undefined;
    }
}
