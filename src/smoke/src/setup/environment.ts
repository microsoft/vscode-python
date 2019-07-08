// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { spawnSync } from 'child_process';
import { pickle } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { context } from '../application';
import { isCI } from '../constants';
import { noop, sleep } from '../helpers';
import { getSelector } from '../selectors';
import { waitForExtensionToActivate } from '../steps/core';
import { IApplication } from '../types';

/**
 * Dismiss one time messages displayed by VSC and Python Extension.
 * We don't want these displayed, else it pollutes the UI when taking screenshots.
 * E.g. notifications, tips, etc...
 * @param {Application} app
 */
export async function activateAndDismissMessages(app: IApplication) {
    // Dismiss any VSC Specific messages (never to show again).
    await dismissMessages();
    // Wait for bootstrap extension to get activated.
    await app.code.waitForElement(getSelector('PyBootstrapStatusBar'));
    // Faster local development/debugging.
    if (!isCI) {
        return;
    }
    /**
     * Wait for around n seconds and dismiss all Extension specific messages.
     * @param {number} seconds
     */
    async function dismissMessagesEvery1SecondForNextNSeconds(seconds: number) {
        // tslint:disable-next-line: prefer-array-literal
        for (const _ of [...new Array(seconds)]) {
            await sleep(1_000);
            await dismissMessages();
        }
    }
    // Ensure Python extension loads and gets activated.
    // & dismiss all python extension and VSC specific messages.
    await Promise.all([waitForExtensionToActivate(30_000), dismissMessagesEvery1SecondForNextNSeconds(5)]);
    // If extension gets activated in 5 seconds, then wait till 5s after extension gets activated.
    await dismissMessagesEvery1SecondForNextNSeconds(5);
}

/**
 * Dismiss messages that are not required.
 * E.g. attempt to dismiss messages such that they never appear.
 */
export async function dismissMessages() {
    const messages = [
        { content: 'Try out Preview of our new Python Language Server', buttonText: 'No thanks' },
        { content: 'Tip: you can change the Python interpreter used by the', buttonText: 'Got it!' },
        { content: 'Help improve VS Code by allowing' },
        { content: 'Linter pylint is not installed', buttonText: 'Do not show again' },
        { content: 'Would you like to run code in the', buttonText: 'No' }
    ];
    await context.app.workbench.notifications.dismiss(messages, 1000);
}

export async function clearWorkspace() {
    if (!context.app.isRunning) {
        return;
    }
    const commands = [
        // Custom command in our bootstrap extension.
        // We can use the command `Debug: Stop` from the command palette only if a debug session is active.
        // Using this approach we can send a command regardless, easy.
        'Stop Debugging Python',
        // Assume we have a max of 2 editors, revert changes and close all of them.
        // Hence execute this command twice.
        'View: Revert and Close Editor',
        'View: Revert and Close Editor',
        'Terminal: Kill the Active Terminal Instance',
        'Debug: Remove All Breakpoints',
        // Clear this, else when trying to open files, VSC will list files in file picker dropdown that don't exist.
        'File: Clear Recently Opened',
        'Clear Editor History',
        'Clear Command History',
        'View: Close All Editors',
        'View: Close Panel',
        'Notifications: Clear All Notifications'
    ];

    for (const command of commands) {
        await context.app.workbench.quickopen.runCommand(command);
    }
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

async function cloneGitRepo(repo: { url: string; subDirectory?: string }) {
    await new Promise((resolve, reject) => {
        const proc = spawnSync('git', ['clone', repo.url, '.'], { cwd: context.options.workspacePathOrFolder });
        return proc.error ? reject(proc.error) : resolve();
    });

    // Its possible source_repo is https://github.com/Microsoft/vscode-python/tree/master/build
    // Meaning, we want to glon https://github.com/Microsoft/vscode-python
    // and want the workspace folder to be tree / master / build when cloned.
    if (repo.subDirectory) {
        context.options.workspacePathOrFolder = path.join(context.options.workspacePathOrFolder, ...repo.subDirectory.split('/'));
    }
}

/**
 * Use a new workspace folder (new unique name) everytime.
 * 1. VSC caches file names per workspace, so if we try to open a file by a name
 * & it existed in the previous test within a different sub directory, then vsc will attempt
 * to open that file with the old name & since the file doesn't exist, vsc will throw an error (display to user)
 * This is possibly because vsc is trying to `open recent` file with same name.
 * 2. Deleting files on Windows is slow and flaky as part of the UI Tests.
 * (flaky because windows will not delete files if they are in use, etc).
 *
 * Solution, use different workspace folder names everytime.
 * @returns
 */
export async function resetWorkspace() {
    const repo = getGitRepo(context.scenario.pickle.tags);
    await createNewWorkspaceFolder();
    await fs.emptyDir(context.options.workspacePathOrFolder);
    if (repo) {
        await cloneGitRepo(repo);
    }
}

let workspaceFolderCounter = 0;
export async function createNewWorkspaceFolder() {
    await fs.emptyDir(context.options.workspacePathOrFolder);
    context.options.workspacePathOrFolder = path.join(context.options.tempPath, `workspace folder ${workspaceFolderCounter += 1}`);
    await fs.ensureDir(context.options.workspacePathOrFolder).catch(noop);
}
