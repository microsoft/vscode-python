// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3,
}
export enum OSType {
    Unknown = 'Unknown',
    Windows = 'Windows',
    OSX = 'OSX',
    Linux = 'Linux',
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
