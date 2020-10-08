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

/**
 * Look up the requested env var value (or  undefined` if not set).
 */
export function getEnvironmentVariable(key: string): string | undefined {
    // tslint:disable-next-line: no-any
    return ((process.env as any) as EnvironmentVariables)[key];
}

/**
 * Get the current user's home directory.
 *
 * The lookup is limited to environment variables.
 */
export function getUserHomeDir(): string | undefined {
    if (getOSType() === OSType.Windows) {
        return getEnvironmentVariable('USERPROFILE');
    }
    return getEnvironmentVariable('HOME') || getEnvironmentVariable('HOMEPATH');
}
