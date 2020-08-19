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

export function getEnv(n: string): string | undefined {
    // tslint:disable-next-line: no-any
    return ((process as any) as EnvironmentVariables)[n];
}

export function getPathEnv(): string | undefined {
    return getEnv('Path') || getEnv('PATH');
}

export function getUserHomeDir(): string | undefined {
    if (getOSType() === OSType.Windows) {
        return getEnv('USERPROFILE');
    }
    return getEnv('HOME');
}
