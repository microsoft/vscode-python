// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../info';
import { buildEnvInfo, getEnvMatcher } from '../../info/env';
import {
    getEnvironmentDirFromPath,
    getInterpreterPathFromDir,
    getPythonVersionFromPath,
} from '../../../common/commonUtils';
import { identifyEnvironment } from '../../../common/environmentIdentifier';
import { getFileInfo, getWorkspaceFolders, isParentPath } from '../../../common/externalDependencies';
import { AnacondaCompanyName, Conda } from '../../../discovery/locators/services/conda';
import { parsePyenvVersion } from '../../../discovery/locators/services/pyenvLocator';
import { Architecture } from '../../../../common/utils/platform';
import { getPythonVersionFromPath as parsePythonVersionFromPath } from '../../info/pythonVersion';

export async function resolveEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
    const resolved = await doResolveEnv(executablePath);
    if (resolved) {
        const folders = getWorkspaceFolders();
        const isRootedEnv = folders.some((f) => isParentPath(executablePath, f));
        if (isRootedEnv) {
            // For environments inside roots, we need to set search location so they can be queried accordingly.
            // Search location particularly for virtual environments is intended as the directory in which the
            // environment was found in.
            // For eg.the default search location for an env containing 'bin' or 'Scripts' directory is:
            //
            // searchLocation <--- Default search location directory
            // |__ env
            //    |__ bin or Scripts
            //        |__ python  <--- executable
            resolved.searchLocation = Uri.file(path.dirname(resolved.location));
        }
    }
    return resolved;
}

async function doResolveEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
    const kind = await identifyEnvironment(executablePath);
    switch (kind) {
        case PythonEnvKind.Conda:
            return resolveCondaEnv(executablePath);
        case PythonEnvKind.Pyenv:
            return _resolvePyenvEnv(executablePath);
        case PythonEnvKind.WindowsStore:
            return _resolveWindowsStoreEnv(executablePath);
        default:
            return resolveSimpleEnv(executablePath, kind);
    }
}

async function resolveSimpleEnv(executablePath: string, kind: PythonEnvKind): Promise<PythonEnvInfo> {
    const envInfo = buildEnvInfo({
        kind,
        version: await getPythonVersionFromPath(executablePath),
        executable: executablePath,
        source: [PythonEnvSource.Other],
    });
    const location = getEnvironmentDirFromPath(executablePath);
    envInfo.location = location;
    envInfo.name = path.basename(location);

    // TODO: Call a general display name provider here to build display name.
    const fileData = await getFileInfo(executablePath);
    envInfo.executable.ctime = fileData.ctime;
    envInfo.executable.mtime = fileData.mtime;
    return envInfo;
}

async function resolveCondaEnv(env: string): Promise<PythonEnvInfo | undefined> {
    const conda = await Conda.getConda();
    if (conda === undefined) {
        traceVerbose(`Couldn't locate the conda binary in resolver`);
        return undefined;
    }
    traceVerbose(`Searching for conda environments using ${conda.command} in resolver`);
    const envs = await conda.getEnvList();
    const matchEnv = getEnvMatcher(env);
    for (const { name, prefix } of envs) {
        const executable = await getInterpreterPathFromDir(prefix);
        if (executable && matchEnv(executable)) {
            const info = buildEnvInfo({
                executable,
                kind: PythonEnvKind.Conda,
                org: AnacondaCompanyName,
                location: prefix,
                source: [PythonEnvSource.Conda],
                version: await getPythonVersionFromPath(executable),
                fileInfo: await getFileInfo(executable),
            });
            if (name) {
                info.name = name;
            }
            return info;
        }
    }
    return undefined;
}

export async function _resolvePyenvEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
    const location = getEnvironmentDirFromPath(executablePath);
    const name = path.basename(location);

    const versionStrings = await parsePyenvVersion(name);

    const envInfo = buildEnvInfo({
        kind: PythonEnvKind.Pyenv,
        executable: executablePath,
        source: [PythonEnvSource.Pyenv],
        location,
        display: `${name}:pyenv`,
        version: await getPythonVersionFromPath(executablePath, versionStrings?.pythonVer),
        org: versionStrings && versionStrings.distro ? versionStrings.distro : '',
        fileInfo: await getFileInfo(executablePath),
    });

    envInfo.name = name;
    return envInfo;
}

export async function _resolveWindowsStoreEnv(executablePath: string): Promise<PythonEnvInfo | undefined> {
    return buildEnvInfo({
        kind: PythonEnvKind.WindowsStore,
        executable: executablePath,
        version: parsePythonVersionFromPath(executablePath),
        org: 'Microsoft',
        arch: Architecture.x64,
        fileInfo: await getFileInfo(executablePath),
        source: [PythonEnvSource.PathEnvVar],
    });
}
