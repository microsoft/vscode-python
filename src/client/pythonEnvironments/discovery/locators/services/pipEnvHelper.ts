// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { pathExists, readFile } from '../../../../common/platform/fileSystem';
import { getEnvironmentVariable } from '../../../../common/utils/platform';

/**
 * Returns the path to Pipfile associated with the provided directory.
 * @param searchDir the directory to look into
 * @param lookIntoParentDirectories set to true if we should also search for Pipfile in parent directory
 */
async function getAssociatedPipfile(
    searchDir: string,
    lookIntoParentDirectories: boolean,
): Promise<string | undefined> {
    const pipFileName = getEnvironmentVariable('PIPENV_PIPFILE') || 'Pipfile';
    let depthToSearch = 1;
    if (lookIntoParentDirectories) {
        // PIPENV_MAX_DEPTH tells pipenv the maximum number of directories to recursively search for
        // a Pipfile, defaults to 3: https://pipenv.pypa.io/en/latest/advanced/#pipenv.environments.PIPENV_MAX_DEPTH
        const maxDepth = getEnvironmentVariable('PIPENV_MAX_DEPTH');
        if (maxDepth) {
            depthToSearch = +maxDepth;
        } else {
            depthToSearch = 3;
        }
    }
    while (depthToSearch > 0 && searchDir !== path.dirname(searchDir)) {
        const pipFile = path.join(searchDir, pipFileName);
        // eslint-disable-next-line no-await-in-loop
        if (await pathExists(pipFile)) {
            return pipFile;
        }
        searchDir = path.dirname(searchDir);
        depthToSearch -= 1;
    }
    return undefined;
}

/**
 * If interpreter path belongs to a pipenv environment which is located inside a project, return associated Pipfile,
 * otherwise return `undefined`.
 * @param interpreterPath Absolute path to any python interpreter.
 */
async function getPipfileIfLocalPipenvEnvironment(interpreterPath: string): Promise<string | undefined> {
    // Local pipenv environments are created by setting PIPENV_VENV_IN_PROJECT to 1, which always names the environment
    // folder '.venv': https://pipenv.pypa.io/en/latest/advanced/#pipenv.environments.PIPENV_VENV_IN_PROJECT
    // This is the layout we wish to verify.
    // project
    // |__ Pipfile  <--- check if Pipfile exists here
    // |__ .venv    <--- check if name of the folder is '.venv'
    //     |__ Scripts/bin
    //         |__ python  <--- interpreterPath
    const venvFolder = path.dirname(path.dirname(interpreterPath));
    if (path.basename(venvFolder) !== '.venv') {
        return undefined;
    }
    const directoryWhereVenvResides = path.dirname(venvFolder);
    return getAssociatedPipfile(directoryWhereVenvResides, false);
}

/**
 * If interpreter path belongs to a global pipenv environment, return associated Pipfile, otherwise return `undefined`.
 * @param interpreterPath Absolute path to any python interpreter.
 */
async function getPipfileIfGlobalPipenvEnvironment(interpreterPath: string): Promise<string | undefined> {
    // Global pipenv environments have a .project file with the absolute path to the project
    // See https://github.com/pypa/pipenv/blob/9299ae1f7353bdd523a1829f3c7cad0ee67c2e3b/CHANGELOG.rst#L754
    // Also, the name of the directory where Pipfile resides is used as a prefix in the environment folder.
    // This is the layout we wish to verify.
    // <Environment folder>
    // |__ .project  <--- check if .project exists here
    // |__ Scripts/bin
    //     |__ python  <--- interpreterPath
    const dotProjectFile = path.join(path.dirname(path.dirname(interpreterPath)), '.project');
    if (!(await pathExists(dotProjectFile))) {
        return undefined;
    }

    const project = await readFile(dotProjectFile);
    if (!(await pathExists(project))) {
        return undefined;
    }

    // The name of the directory where Pipfile resides is used as a prefix in the environment folder.
    if (interpreterPath.indexOf(`${path.sep}${path.basename(project)}-`) === -1) {
        return undefined;
    }

    return getAssociatedPipfile(project, false);
}

/**
 * Checks if the given interpreter path belongs to a pipenv environment, by locating the Pipfile which was used to
 * create the environment.
 * @param interpreterPath: Absolute path to any python interpreter.
 */
export async function isPipenvEnvironment(interpreterPath: string): Promise<boolean> {
    if (await getPipfileIfLocalPipenvEnvironment(interpreterPath)) {
        return true;
    }
    if (await getPipfileIfGlobalPipenvEnvironment(interpreterPath)) {
        return true;
    }
    return false;
}

/**
 * Returns true if interpreter path belongs to a global pipenv environment which is associated with a particular folder,
 * false otherwise.
 * @param interpreterPath Absolute path to any python interpreter.
 */
export async function isPipenvEnvironmentRelatedToFolder(interpreterPath: string, folder: string): Promise<boolean> {
    const pipFileAssociatedWithEnvironment = await getPipfileIfGlobalPipenvEnvironment(interpreterPath);
    if (!pipFileAssociatedWithEnvironment) {
        return false;
    }

    // PIPENV_NO_INHERIT is used to tell pipenv not to look for Pipfile in parent directories
    // https://pipenv.pypa.io/en/latest/advanced/#pipenv.environments.PIPENV_NO_INHERIT
    const pipFileAssociatedWithFolder = await getAssociatedPipfile(folder, !getEnvironmentVariable('PIPENV_NO_INHERIT'));
    if (!pipFileAssociatedWithFolder) {
        return false;
    }
    return pipFileAssociatedWithEnvironment === pipFileAssociatedWithFolder;
}
