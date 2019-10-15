// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import { downloadFile, getOSType, OSType, unzipVSCode } from '../helpers';
import { info } from '../helpers/logger';
import { Channel } from '../types';

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

const DownloadChannel = {
    stable: 'stable',
    insider: 'insider'
};

/**
 * Gets the download url for VS Code.
 * Its possible to hard code the VS Code version number in here for stable versions of VS Code.
 * This would be useful to ensure our CI tests always pass.
 * E.g. if VSC updates CSS in insiders and release a new version tomorrow, then if we haven't had
 * the time to account for the CSS changes, then UI tests will fail.
 * Solution is to tie the UI tests to a specific version of VS Code.
 *
 * @export
 * @param {Channel} channel
 * @returns
 */
export async function getVSCodeDownloadUrl(channel: Channel) {
    const downloadPlatform = getDownloadPlatform();
    return `https://update.code.visualstudio.com/latest/${downloadPlatform}/${DownloadChannel[channel]}`;
}

export function getVSCodeExecutablePath(channel: Channel, testDir: string) {
    if (process.platform === 'win32') {
        return path.join(testDir, channel, channel === 'stable' ? 'Code.exe' : 'Code - Insiders.exe');
    } else if (process.platform === 'darwin') {
        return path.join(testDir, channel, channel === 'stable' ? 'Visual Studio Code.app/Contents/MacOS/Electron' : 'Visual Studio Code - Insiders.app/Contents/MacOS/Electron');
    } else {
        return path.join(testDir, channel, channel === 'stable' ? 'VSCode-linux-x64/code' : 'VSCode-linux-x64/code-insiders');
    }
}

/**
 * Returns the path to the VS Code Electron executable.
 *
 * @export
 * @param {Channel} channel
 * @param {string} testDir
 * @returns
 */
export function getVSCodeElectronPath(channel: Channel, testDir: string) {
    if (process.platform === 'win32') {
        return path.join(testDir, channel, channel === 'stable' ? 'Code.exe' : 'Code - Insiders.exe');
    } else if (process.platform === 'darwin') {
        return path.join(testDir, channel, channel === 'stable' ? 'Visual Studio Code.app/Contents/MacOS/Electron' : 'Visual Studio Code - Insiders.app/Contents/MacOS/Electron');
    } else {
        return path.join(testDir, channel, channel === 'stable' ? 'VSCode-linux-x64/code' : 'VSCode-linux-x64/code-insiders');
    }
}

/**
 * Returns the root directory of the VS Code application.
 *
 * @export
 * @param {Channel} channel
 * @param {string} testDir
 * @returns
 */
export function getVSCodeDirectory(channel: Channel, testDir: string) {
    if (process.platform === 'win32') {
        return path.join(testDir, channel);
    } else if (process.platform === 'darwin') {
        return path.join(testDir, channel, channel === 'stable' ? 'Visual Studio Code.app' : 'Visual Studio Code - Insiders.app');
    } else {
        return path.join(testDir, channel, channel === 'stable' ? 'VSCode-linux-x64' : 'VSCode-linux-x64');
    }
}

/**
 * Download destination for VS Code.
 * If the channel is stable, then this is typically of the form `./.vscode test/stable` else `./.vscode test/insider`.
 * Where `.vscode test` is the value of the argument `testDir`.
 *
 * @param {Channel} channel
 * @param {string} testDir
 * @returns
 */
function getVSCodeDestinationDirectory(channel: Channel, testDir: string) {
    return path.join(testDir, channel === 'stable' ? 'stable' : 'insider');
}

async function hasVSCBeenDownloaded(channel: Channel, testDir: string) {
    const vscodeDir = getVSCodeDestinationDirectory(channel, testDir);
    return fs.pathExists(vscodeDir);
}

export async function downloadVSCode(channel: Channel, testDir: string) {
    if (await hasVSCBeenDownloaded(channel, testDir)) {
        info('VS Code already downloaded.');
        return;
    }
    const targetDir = getVSCodeDestinationDirectory(channel, testDir);
    const url = await getVSCodeDownloadUrl(channel);
    const ostype = getOSType();
    const filePostfix = ostype === OSType.Linux ? 'vscode.tar.gz' : 'vscode.zip';
    const targetFile = await new Promise<string>((resolve, reject) => {
        tmp.tmpName({ postfix: filePostfix }, (ex, fileName) => {
            if (ex) {
                return reject(ex);
            }
            resolve(fileName);
        });
    });
    await downloadFile(url, targetFile, `Downloading VS Code ${channel === 'stable' ? 'Stable' : 'Insider'}`);
    await unzipVSCode(targetFile, targetDir);
    info('VS Code successfully downloaded.');
}
