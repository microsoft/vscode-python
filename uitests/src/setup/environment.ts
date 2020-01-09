// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { spawnSync } from 'child_process';
import { HookScenarioResult, pickle } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { uitestsRootPath } from '../constants';
import { sleep } from '../helpers';
import { debug } from '../helpers/logger';
import { IApplication } from '../types';

/**
 * Dismiss messages that are not required.
 * E.g. attempt to dismiss messages such that they never appear.
 */
export async function dismissMessages(app: IApplication) {
    const messages = [
        { content: 'Try out Preview of our new Python Language Server', buttonText: 'No thanks' },
        { content: 'Tip: you can change the Python interpreter used by the', buttonText: 'Got it!' },
        { content: 'Help improve VS Code by allowing' },
        { content: 'Linter pylint is not installed', buttonText: 'Do not show again' },
        { content: 'Would you like to run code in the', buttonText: 'No' }
    ];
    await app.notifications.dismiss(messages, 1000);
}

/**
 * When we close VS Code and reopen it, the un saved files are still left open in VSC.
 * We need to close them before shutting down VS Code.
 *
 * @export
 * @returns
 */
export async function clearWorkspace(app: IApplication) {
    if (!app.isAlive) {
        debug('Not clearing workspace as application is not alive');
        return;
    }
    const commands = [
        // Custom command in our bootstrap extension.
        // We can use the command `Debug: Stop` from the command palette only if a debug session is active.
        // Using this approach we can send a command regardless, easy.
        // 'Stop Debugging Python',
        // Assume we have a max of 2 editors, revert changes and close all of them.
        // Hence execute this command twice.
        'View: Revert and Close Editor',
        'View: Revert and Close Editor',
        // 'Terminal: Kill the Active Terminal Instance',
        'Debug: Remove All Breakpoints',
        // Clear this, else when trying to open files, VSC will list files in file picker dropdown that don't exist.
        // This will cause serious issues.
        // Assume in a test we had a file named `abc.py`.
        // Next test we create a file named `ab.py`. At this point, VSC will remember the file from previous session and will display `abc.py`.
        // Thats a serious problem.
        'File: Clear Recently Opened',
        // Same reason as clearing `Recently Opened`
        'Clear Editor History',
        // Same reason as clearing `Recently Opened`
        // We don't want the command history to be polluted (we don't care about previous sessions).
        'Clear Command History',
        'View: Close All Editors',
        'Notifications: Clear All Notifications',
        'View: Close Panel'
    ];

    for (const command of commands) {
        await app.quickopen.runCommand(command);
    }
    // Wait for UI to get updated (closing editors, closing panel, etc).
    await sleep(200);
}

/**
 * Gets the git repo that needs to be downloaded for given tags.
 *
 * @param {pickle.Tag[]} tags
 * @returns {({ url: string; subDirectory?: string } | undefined)}
 */
export function getGitRepo(tags: pickle.Tag[]): { url: string; subDirectory?: string } | undefined {
    const tagWithUrl = tags.find(tag => tag.name.toLowerCase().startsWith('@https://github.com/'));
    const url = tagWithUrl ? tagWithUrl.name.substring(1) : undefined;
    if (!url) {
        return;
    }
    if (url.toLowerCase().endsWith('.git')) {
        return { url };
    }
    const repoParts = url.substring('https://github.com/'.length).split('/');
    let subDirectory: string | undefined;
    if (repoParts.length > 2) {
        subDirectory = repoParts.filter((_, i) => i > 1).join('/');
    }
    return {
        url: `https://github.com/${repoParts[0]}/${repoParts[1]}`,
        subDirectory
    };
}

/**
 * Gets the path to the folder that contains the source for the test.
 *
 * @param {pickle.Tag[]} tags
 * @returns {({ url: string; subDirectory?: string } | undefined)}
 */
export function getSourceFolder(tags: pickle.Tag[]): string | undefined {
    const sourceFolder = tags.find(tag => tag.name.toLowerCase().startsWith('@code:'));
    if (!sourceFolder) {
        return;
    }
    return path.join(uitestsRootPath, sourceFolder.name.substring('@code:'.length));
}

/**
 * Clones the git repo into the provided directory.
 * @param {{ url: string; subDirectory?: string }} repo
 * @param {string} cwd
 * @returns {Promise<void>}
 */
async function cloneGitRepo({ url }: { url: string }, cwd: string): Promise<void> {
    debug(`Clone git repo ${url}`);
    await new Promise((resolve, reject) => {
        const proc = spawnSync('git', ['clone', url, '.'], { cwd });
        return proc.error ? reject(proc.error) : resolve();
    });
}

/**
 * Initializes the workspace folder with the required code (downloads the git repo if required).
 * Returns the new workspace folder.
 *
 * @export
 * @param {HookScenarioResult} scenario
 * @param {string} workspaceFolder
 * @returns {(Promise<string | undefined>)}
 */
export async function initializeWorkspace(scenario: HookScenarioResult, workspaceFolder: string): Promise<string | undefined> {
    const sourceFolder = getSourceFolder(scenario.pickle.tags);
    if (sourceFolder) {
        debug(`initializeWorkspace for ${sourceFolder}`);
        // Copy files from source folder into workspace folder.
        await fs.copy(sourceFolder, workspaceFolder);
        return;
    }

    const repo = getGitRepo(scenario.pickle.tags);
    if (!repo) {
        debug('initializeWorkspace without a repo');
        return;
    }
    debug(`initializeWorkspace for ${repo.url}`);
    await cloneGitRepo(repo, workspaceFolder);

    // Its possible source_repo is https://github.com/Microsoft/vscode-python/tree/master/build
    // Meaning, we want to glon https://github.com/Microsoft/vscode-python
    // and want the workspace folder to be tree / master / build when cloned.
    if (repo.subDirectory) {
        debug(`initializeWorkspace for ${repo.url} in subdirectory ${repo.subDirectory}`);
        return path.join(workspaceFolder, ...repo.subDirectory.replace(/\\/g, '/').split('/'));
    }
}
