// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { traceError, traceWarning } from '../../../../common/logger';
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

function getResolvers(): Map<PythonEnvKind, (executablePath: string) => Promise<PythonEnvInfo>> {
    const resolvers = new Map<PythonEnvKind, (_: string) => Promise<PythonEnvInfo>>();
    const defaultResolver = (k: PythonEnvKind) => (e: string) => resolveSimpleEnv(e, k);
    Object.values(PythonEnvKind).forEach((k) => {
        resolvers.set(k, defaultResolver(k));
    });
    resolvers.set(PythonEnvKind.Conda, resolveCondaEnv);
    resolvers.set(PythonEnvKind.WindowsStore, resolveWindowsStoreEnv);
    resolvers.set(PythonEnvKind.Pyenv, resolvePyenvEnv);
    return resolvers;
}

/**
 * Find as much info about the given Python environment as possible without running the
 * Python executable and returns it. Notice `undefined` is never returned, so environment
 * returned could still be invalid.
 */
export async function resolveEnv(executablePath: string): Promise<PythonEnvInfo> {
    const kind = await identifyEnvironment(executablePath);
    const resolvers = getResolvers();
    const resolverForKind = resolvers.get(kind)!;
    const resolvedEnv = await resolverForKind(executablePath);
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
        resolvedEnv.searchLocation = Uri.file(path.dirname(resolvedEnv.location));
    }
    return resolvedEnv;
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
    const fileData = await getFileInfo(executablePath);
    envInfo.executable.ctime = fileData.ctime;
    envInfo.executable.mtime = fileData.mtime;
    return envInfo;
}

async function resolveCondaEnv(executablePath: string): Promise<PythonEnvInfo> {
    const conda = await Conda.getConda();
    if (conda === undefined) {
        traceWarning(`${executablePath} identified as Conda environment even though Conda is not installed`);
    }
    const envs = (await conda?.getEnvList()) ?? [];
    const matchEnv = getEnvMatcher(executablePath);
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
    traceError(
        `${executablePath} identified as a Conda environment but is not returned via '${conda?.command} info' command`,
    );
    // Environment could still be valid, resolve as a simple env.
    return resolveSimpleEnv(executablePath, PythonEnvKind.Conda);
}

async function resolvePyenvEnv(executablePath: string): Promise<PythonEnvInfo> {
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

async function resolveWindowsStoreEnv(executablePath: string): Promise<PythonEnvInfo> {
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
