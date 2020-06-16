// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { SemVer } from 'semver';
import '../common/extensions'; // For string.splitLines()
import { getVersion as getPythonVersionCommand } from '../common/process/internal/python';

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

export function parsePythonVersion(raw: string): PythonVersion | undefined {
    if (!raw || raw.trim().length === 0) {
        return;
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

type ExecResult = {
    stdout: string;
};
type ExecFunc = (command: string, args: string[]) => Promise<ExecResult>;

export async function getPythonVersion(pythonPath: string, defaultValue: string, exec: ExecFunc): Promise<string> {
    const [args, parse] = getPythonVersionCommand();
    return exec(pythonPath, args)
        .then((result) => parse(result.stdout).splitLines()[0])
        .then((version) => (version.length === 0 ? defaultValue : version))
        .catch(() => defaultValue);
}
