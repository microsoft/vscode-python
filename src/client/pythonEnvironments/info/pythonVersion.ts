// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { SemVer } from 'semver';
import '../../common/extensions'; // For string.splitLines()
import { getVersion as getPythonVersionCommand } from '../../common/process/internal/python';

/**
 * A representation of a Python runtime's version.
 *
 * @prop raw - the original version string
 * @prop major - the "major" version
 * @prop minor - the "minor" version
 * @prop patch - the "patch" (or "micro") version
 * @prop build - the build ID of the executable
 * @prop prerelease - identifies a tag in the release process (e.g. beta 1)
 */
// Note that this is currently compatible with SemVer objects,
// but we may change it to match the format of sys.version_info.
export type PythonVersion = {
    raw: string;
    major: number;
    minor: number;
    patch: number;
    // Eventually it may be useful to match what sys.version_info
    // provides for the remainder here:
    // * releaseLevel: 'alpha' | 'beta' | 'candidate' | 'final';
    // * serial: number;
    build: string[];
    prerelease: string[];
};

/**
 * Convert a Python version string.
 *
 * The supported formats are:
 *
 *  * MAJOR.MINOR.MICRO-RELEASE_LEVEL
 *
 *  (where RELEASE_LEVEL is one of {alpha,beta,candidate,final})
 *
 * Everything else, including an empty string, results in `undefined`.
 */
// Eventually we will want to also support the release serial
// (e.g. beta1, candidate3) and maybe even release abbreviations
// (e.g. 3.9.2b1, 3.8.10rc3).
export function parsePythonVersion(raw: string): PythonVersion | undefined {
    if (!raw || raw.trim().length === 0) {
        return undefined;
    }
    const versionParts = (raw || '')
        .split('.')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .filter((_, index) => index < 4);

    if (versionParts.length > 0 && versionParts[versionParts.length - 1].indexOf('-') > 0) {
        const lastPart = versionParts[versionParts.length - 1];
        versionParts[versionParts.length - 1] = lastPart.split('-')[0].trim();
        versionParts.push(lastPart.split('-')[1].trim());
    }
    while (versionParts.length < 4) {
        versionParts.push('');
    }
    // Exclude PII from `version_info` to ensure we don't send this up via telemetry.
    for (let index = 0; index < 3; index += 1) {
        versionParts[index] = /^\d+$/.test(versionParts[index]) ? versionParts[index] : '0';
    }
    if (['alpha', 'beta', 'candidate', 'final'].indexOf(versionParts[3]) === -1) {
        versionParts.pop();
    }
    const numberParts = `${versionParts[0]}.${versionParts[1]}.${versionParts[2]}`;
    const rawVersion = versionParts.length === 4 ? `${numberParts}-${versionParts[3]}` : numberParts;
    return new SemVer(rawVersion);
}

/**
 * Determine if the given versions are the same.
 *
 * @param version1 - one of the two versions to compare
 * @param version2 - one of the two versions to compare
 */
export function areSameVersion(version1?: PythonVersion, version2?: PythonVersion): boolean {
    if (!version1 || !version2) {
        return false;
    }
    return version1.raw === version2.raw;
}

type ExecResult = {
    stdout: string;
};
type ExecFunc = (command: string, args: string[]) => Promise<ExecResult>;

/**
 * Get the version string of the given Python executable by running it.
 *
 * Effectively, we look up `sys.version`.
 *
 * @param pythonPath - the Python executable to exec
 * @param defaultValue - the value to return if anything goes wrong
 * @param exec - the function to call to run the Python executable
 */
export async function getPythonVersion(pythonPath: string, defaultValue: string, exec: ExecFunc): Promise<string> {
    const [args, parse] = getPythonVersionCommand();
    // It may make sense eventually to use buildPythonExecInfo() here
    // instead of using pythonPath and args directly.  That would allow
    // buildPythonExecInfo() to assume any burden of flexibility.
    return exec(pythonPath, args)
        .then((result) => parse(result.stdout).splitLines()[0])
        .then((version) => (version.length === 0 ? defaultValue : version))
        .catch(() => defaultValue);
}
