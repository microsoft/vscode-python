// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { getEnvironmentVariable, getOSType, getUserHomeDir, OSType } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator } from '../../../base/locator';
import { FSWatchingLocator } from '../../../base/locators/lowLevel/fsWatchingLocator';
import {
    getEnvironmentDirFromPath,
    getInterpreterPathFromDir,
    getPythonVersionFromPath,
} from '../../../common/commonUtils';
import { getFileInfo, getSubDirs, pathExists } from '../../../common/externalDependencies';

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
        pyenvDir =
            getOSType() === OSType.Windows ? path.join(homeDir, '.pyenv', 'pyenv-win') : path.join(homeDir, '.pyenv');
    }

    return pyenvDir;
}

function getPyenvVersionsDir(): string {
    return path.join(getPyenvDir(), 'versions');
}

/**
 * Checks if the given interpreter belongs to a pyenv based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean}: Returns true if the interpreter belongs to a pyenv environment.
 */
export async function isPyenvEnvironment(interpreterPath: string): Promise<boolean> {
    let pathToCheck = interpreterPath;
    let pyenvDir = getPyenvDir();

    if (!(await pathExists(pyenvDir))) {
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
    distroVer?: string;
}

/**
 * This function provides parsers for some of the common and known distributions
 * supported by pyenv. To get the list of supported pyenv distributions, run
 * `pyenv install --list`
 *
 * The parsers below were written based on the list obtained from pyenv version 1.2.21
 */
function getKnownPyenvVersionParsers(): Map<string, (path: string) => Promise<IPyenvVersionStrings | undefined>> {
    /**
     * This function parses versions that are plain python versions.
     * @param str string to parse
     *
     * Parses :
     *   2.7.18
     *   3.9.0
     */
    function pythonOnly(str: string): Promise<IPyenvVersionStrings> {
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
    function distroOnly(str: string): Promise<IPyenvVersionStrings | undefined> {
        const parts = str.split('-');
        if (parts.length === 3) {
            return Promise.resolve({
                pythonVer: undefined,
                distroVer: `${parts[1]}-${parts[2]}`,
                distro: parts[0],
            });
        }

        if (parts.length === 2) {
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
    function pypyParser(str: string): Promise<IPyenvVersionStrings | undefined> {
        const pattern = /[0-9\.]+/;

        const parts = str.split('-');
        const pythonVer = parts[0].search(pattern) > 0 ? parts[0].substr('pypy'.length) : undefined;
        if (parts.length === 2) {
            return Promise.resolve({
                pythonVer,
                distroVer: parts[1],
                distro: 'pypy',
            });
        }

        if (
            parts.length === 3 &&
            (parts[2].startsWith('src') || parts[2].startsWith('beta') || parts[2].startsWith('alpha'))
        ) {
            return Promise.resolve({
                pythonVer,
                distroVer: `${parts[1]}-${parts[2]}`,
                distro: 'pypy',
            });
        }

        if (parts.length === 3 && parts[1] === 'stm') {
            return Promise.resolve({
                pythonVer,
                distroVer: parts[2],
                distro: `${parts[0]}-${parts[1]}`,
            });
        }

        if (parts.length === 4 && parts[1] === 'c') {
            return Promise.resolve({
                pythonVer,
                distroVer: parts[3],
                distro: `pypy-${parts[1]}-${parts[2]}`,
            });
        }

        if (parts.length === 4 && parts[3].startsWith('src')) {
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

    const parsers: Map<string, (path: string) => Promise<IPyenvVersionStrings | undefined>> = new Map();
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
export function parsePyenvVersion(str: string): Promise<IPyenvVersionStrings | undefined> {
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
 * Gets all the pyenv environments.
 *
 * Remarks: This function looks at the <pyenv dir>/versions directory and gets
 * all the environments (global or virtual) in that directory. It also makes the
 * best effort at identifying the versions and distribution information.
 */
async function* getPyenvEnvironments(): AsyncIterableIterator<PythonEnvInfo> {
    const pyenvVersionDir = getPyenvVersionsDir();

    const subDirs = getSubDirs(pyenvVersionDir);
    for await (const subDir of subDirs) {
        const envDir = path.join(pyenvVersionDir, subDir);
        const interpreterPath = await getInterpreterPathFromDir(envDir);

        if (interpreterPath) {
            // The sub-directory name sometimes can contain distro and python versions.
            // here we attempt to extract the texts out of the name.
            const versionStrings = await parsePyenvVersion(subDir);

            // Here we look for near by files, or config files to see if we can get python version info
            // without running python itself.
            const pythonVersion = await getPythonVersionFromPath(interpreterPath, versionStrings?.pythonVer);

            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: interpreterPath,
                location: envDir,
                version: pythonVersion,
            });

            // Pyenv environments can fall in to these three categories:
            // 1. Global Installs : These are environments that are created when you install
            //    a supported python distribution using `pyenv install <distro>` command.
            //    These behave similar to globally installed version of python or distribution.
            //
            // 2. Virtual Envs    : These are environments that are created when you use
            //    `pyenv virtualenv <distro> <env-name>`. These are similar to environments
            //    created using `python -m venv <env-name>`.
            //
            // 3. Conda Envs      : These are environments that are created when you use
            //    `pyenv virtualenv <miniconda|anaconda> <env-name>`. These are similar to
            //    environments created using `conda create -n <env-name>.
            //
            // All these environments are fully handled by `pyenv` and should be activated using
            // `pyenv local|global <env-name>` or `pyenv shell <env-name>`
            //
            // For the display name we are going to treat these as `pyenv` environments.
            envInfo.defaultDisplayName = `${subDir}:pyenv`;

            envInfo.name = subDir;
            envInfo.distro.org = versionStrings && versionStrings.distro ? versionStrings.distro : envInfo.distro.org;

            const fileData = await getFileInfo(interpreterPath);
            envInfo.executable.ctime = fileData.ctime;
            envInfo.executable.mtime = fileData.mtime;

            yield envInfo;
        }
    }
}

export class PyenvLocator extends FSWatchingLocator {
    constructor() {
        super(getPyenvVersionsDir, async () => PythonEnvKind.Pyenv);
    }

    // eslint-disable-next-line class-methods-use-this
    public doIterEnvs(): IPythonEnvsIterator {
        return getPyenvEnvironments();
    }

    // eslint-disable-next-line class-methods-use-this
    public async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;

        if (await isPyenvEnvironment(executablePath)) {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: executablePath,
            });

            const location = getEnvironmentDirFromPath(executablePath);
            envInfo.location = location;
            envInfo.name = path.basename(location);
            envInfo.defaultDisplayName = `${envInfo.name}:pyenv`;

            const versionStrings = await parsePyenvVersion(envInfo.name);
            envInfo.version = await getPythonVersionFromPath(executablePath, versionStrings?.pythonVer);
            envInfo.distro.org = versionStrings && versionStrings.distro ? versionStrings.distro : envInfo.distro.org;

            const fileData = await getFileInfo(executablePath);
            envInfo.executable.ctime = fileData.ctime;
            envInfo.executable.mtime = fileData.mtime;

            return envInfo;
        }
        return undefined;
    }
}
