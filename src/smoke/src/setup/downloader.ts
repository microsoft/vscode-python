// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { Quality } from '../../../../out/smoke/vscode/application';
// import { getJson } from '../helpers/http';

function getDownloadPlatform() {
    switch (process.platform) {
        case 'darwin':
            return 'darwin';
        case 'win32':
            return 'win32-archive';
        default:
            return 'linux-x64';
    }
}

const Channels = {
    [Quality.Dev]: 'stable',
    [Quality.Stable]: 'stable',
    [Quality.Insiders]: 'insider'
};

export async function getVSCodeDownloadUrl(quality: Quality) {
    const downloadPlatform = getDownloadPlatform();
    return `https://update.code.visualstudio.com/latest/${downloadPlatform}/${Channels[quality]}`;
}

export function getVSCodeExecutablePath(quality: Quality, parentDir: string) {
    const channel = Channels[quality];
    if (process.platform === 'win32') {
        return path.join(parentDir, channel, quality === Quality.Stable ? 'Code.exe' : 'Code - Insiders.exe');
    } else if (process.platform === 'darwin') {
        return path.join(parentDir, channel, quality === Quality.Stable ? 'Visual Studio Code.app/Contents/MacOS/Electron' : 'Visual Studio Code - Insiders.app/Contents/MacOS/Electron');
    } else {
        return path.join(parentDir, channel, quality === Quality.Stable ? 'VSCode-linux-x64/code' : 'VSCode-linux-x64/code-insiders');
    }
}

export function getVSCodeDirectory(quality: Quality, parentDir: string) {
    const channel = Channels[quality];
    if (process.platform === 'win32') {
        return path.join(parentDir, channel);
    } else if (process.platform === 'darwin') {
        return path.join(parentDir, channel, channel === 'stable' ? 'Visual Studio Code.app' : 'Visual Studio Code - Insiders.app');
    } else {
        return path.join(parentDir, channel, channel === 'stable' ? 'VSCode-linux-x64' : 'VSCode-linux-x64');
    }
}
