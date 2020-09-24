// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import {
    PythonEnvInfo, PythonEnvKind, PythonExecutableInfo, PythonVersion,
} from '.';
import { arePathsSame } from '../../common/externalDependencies';
import { areEqualVersions } from './versionHelpers';

export function areSameEnvironment(
    left: string | PythonEnvInfo,
    right: string | PythonEnvInfo,
    allowPartialMatch?:boolean,
): boolean {
    const leftFilename = typeof left === 'string' ? left : left.executable.filename;
    const rightFilename = typeof right === 'string' ? right : right.executable.filename;

    if (arePathsSame(leftFilename, rightFilename)) {
        return true;
    }

    if (arePathsSame(path.dirname(leftFilename), path.dirname(rightFilename))) {
        const leftVersion = typeof left === 'string' ? undefined : left.version;
        const rightVersion = typeof right === 'string' ? undefined : right.version;
        if (leftVersion && rightVersion) {
            if (areEqualVersions(leftVersion, rightVersion)) {
                return true;
            }

            if (
                allowPartialMatch
                && leftVersion.major === rightVersion.major
                && leftVersion.minor === rightVersion.minor
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Returns a heuristic value on how much information is available in the given version object.
 * @param {PythonVersion} version version object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getVersionInfoHeuristic(version:PythonVersion): number {
    let infoLevel = 0;
    if (version.major > 0) {
        infoLevel += 20; // W4
    }

    if (version.minor >= 0) {
        infoLevel += 10; // W3
    }

    if (version.micro >= 0) {
        infoLevel += 5; // W2
    }

    if (version.release.level) {
        infoLevel += 3; // W1
    }

    if (version.release.serial || version.sysVersion) {
        infoLevel += 1; // W0
    }

    return infoLevel;
}

/**
 * Returns a heuristic value on how much information is available in the given executable object.
 * @param {PythonExecutableInfo} executable executable object to generate heuristic from.
 * @returns A heuristic value indicating the amount of info available in the object
 * weighted by most important to least important fields.
 * Wn > Wn-1 + Wn-2 + ... W0
 */
function getExecutableInfoHeuristic(executable:PythonExecutableInfo): number {
    let infoLevel = 0;
    if (executable.filename.length > 0) {
        infoLevel += 10; // W3
    }

    if (executable.sysPrefix.length > 0) {
        infoLevel += 5; // W2
    }

    if (executable.mtime) {
        infoLevel += 2; // W1
    }

    if (executable.ctime) {
        infoLevel += 1; // W0
    }

    return infoLevel;
}

/**
 * Gets a prioritized list of environment types for identification.
 * @returns {PythonEnvKind[]} : List of environments ordered by identification priority
 *
 * Remarks: This is the order of detection based on how the various distributions and tools
 * configure the environment, and the fall back for identification.
 * Top level we have the following environment types, since they leave a unique signature
 * in the environment or * use a unique path for the environments they create.
 *  1. Conda
 *  2. Windows Store
 *  3. PipEnv
 *  4. Pyenv
 *  5. Poetry
 *
 * Next level we have the following virtual environment tools. The are here because they
 * are consumed by the tools above, and can also be used independently.
 *  1. venv
 *  2. virtualenvwrapper
 *  3. virtualenv
 *
 * Last category is globally installed python, or system python.
 */
export function getPrioritizedEnvironmentKind(): PythonEnvKind[] {
    return [
        PythonEnvKind.CondaBase,
        PythonEnvKind.Conda,
        PythonEnvKind.WindowsStore,
        PythonEnvKind.Pipenv,
        PythonEnvKind.Pyenv,
        PythonEnvKind.Poetry,
        PythonEnvKind.Venv,
        PythonEnvKind.VirtualEnvWrapper,
        PythonEnvKind.VirtualEnv,
        PythonEnvKind.OtherVirtual,
        PythonEnvKind.OtherGlobal,
        PythonEnvKind.MacDefault,
        PythonEnvKind.System,
        PythonEnvKind.Custom,
        PythonEnvKind.Unknown,
    ];
}

/**
 * Selects an environment kind based on the environment selection priority. This should
 * match the priority in the environment identifier.
 * @param left
 * @param right
 */
function pickEnvironmentKind(left: PythonEnvInfo, right: PythonEnvInfo): PythonEnvKind {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: When we consolidate the PythonEnvKind and EnvironmentType we should have
    // one location where we define priority and
    const envKindByPriority:PythonEnvKind[] = getPrioritizedEnvironmentKind();

    return envKindByPriority.find((env) => left.kind === env || right.kind === env) ?? PythonEnvKind.Unknown;
}

export function mergeEnvironments(left: PythonEnvInfo, right: PythonEnvInfo): PythonEnvInfo {
    const kind = pickEnvironmentKind(left, right);
    const version = (getVersionInfoHeuristic(left.version) > getVersionInfoHeuristic(right.version)
        ? left.version : right.version
    );
    const executable = (getExecutableInfoHeuristic(left.executable) > getExecutableInfoHeuristic(right.executable)
        ? left.executable : right.executable
    );
    const preferredEnv:PythonEnvInfo = left.kind === kind ? left : right;
    const merged = cloneDeep(preferredEnv);
    merged.version = cloneDeep(version);
    merged.executable = cloneDeep(executable);

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: compute id for the merged environment
    merged.id = '';
    return merged;
}
