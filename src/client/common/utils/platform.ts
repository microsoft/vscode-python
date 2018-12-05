// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

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
export enum OSDistro {
    Unknown = 'Unknown',
    // linux:
    Ubuntu = 'Ubuntu',
    Debian = 'Debian',
    RHEL = 'RHEL',
    Fedora = 'Fedora',
    Alpine = 'Alpine',
    CentOS = 'CentOS',
    Oracle = 'Oracle',
    Suse = 'Suse',
    Gentoo = 'Gentoo',
    Arch = 'Arch',
    Mint = 'Mint'
}
