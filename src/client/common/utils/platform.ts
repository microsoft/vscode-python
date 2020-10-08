// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EnvironmentVariables } from '../variables/types';

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum OSType {
    Unknown = 'Unknown',
    Windows = 'Windows',
    OSX = 'OSX',
    Linux = 'Linux'
}

// Return the OS type for the given platform string.
export function getOSType(platform: string = process.platform): OSType {
    if (/^win/.test(platform)) {
        return OSType.Windows;
    } else if (/^darwin/.test(platform)) {
        return OSType.OSX;
    } else if (/^linux/.test(platform)) {
        return OSType.Linux;
    } else {
        return OSType.Unknown;
    }
}

const architectures: Record<string, Architecture> = {
    x86: Architecture.x86, // 32-bit
    x64: Architecture.x64, // 64-bit
};

/**
 * Identify the host's native architecture/bitness.
 */
export function getArchitecture(): Architecture {
    return architectures[process.arch] || Architecture.Unknown;
}

export function getEnvironmentVariable(key: string): string | undefined {
    // tslint:disable-next-line: no-any
    return ((process.env as any) as EnvironmentVariables)[key];
}

// Code under `src/client/common/platform` duplicates some of the
// following functionality.  The code here is authoritative.

/**
 * Get the env var name to use for the OS executable lookup "path".
 */
export function getPathEnvironmentVariableName(): 'Path' | 'PATH' {
    return getOSType() === OSType.Windows ? 'Path' : 'PATH';
}

export function getPathEnvironmentVariable(): string | undefined {
    const envVarName = getPathEnvironmentVariableName();
    return getEnvironmentVariable(envVarName);
}

export function getUserHomeDir(): string | undefined {
    if (getOSType() === OSType.Windows) {
        return getEnvironmentVariable('USERPROFILE');
    }
    return getEnvironmentVariable('HOME') || getEnvironmentVariable('HOMEPATH');
}
