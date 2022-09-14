// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as nls from 'vscode-nls';
import * as fsapi from 'fs-extra';
import * as path from 'path';
import { QuickPickItem, WorkspaceFolder } from 'vscode';
import { showErrorMessage, showQuickPick } from '../../../common/vscodeApis/windowApis';
import { getWorkspaceFolders } from '../../../common/vscodeApis/workspaceApis';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

function hasVirtualEnv(workspace: WorkspaceFolder): Promise<boolean> {
    return Promise.race([
        fsapi.pathExists(path.join(workspace.uri.fsPath, '.venv')),
        fsapi.pathExists(path.join(workspace.uri.fsPath, '.conda')),
    ]);
}

async function getWorkspacesForQuickPick(workspaces: readonly WorkspaceFolder[]): Promise<QuickPickItem[]> {
    const items: QuickPickItem[] = [];
    for (const workspace of workspaces) {
        items.push({
            label: workspace.name,
            detail: workspace.uri.fsPath,
            description: (await hasVirtualEnv(workspace))
                ? localize('python.venv.hasVenv', 'Workspace folder contains a virtual environment.')
                : undefined,
        });
    }

    return items;
}

export async function getVenvWorkspaceFolder(): Promise<WorkspaceFolder | undefined> {
    const workspaces = getWorkspaceFolders();

    if (!workspaces || workspaces.length === 0) {
        await showErrorMessage(
            localize('python.venv.noWorkspace', 'Please open a directory when creating an environment using venv.'),
        );
        return undefined;
    }

    if (workspaces.length === 1) {
        if (await hasVirtualEnv(workspaces[0])) {
            await showErrorMessage(localize('python.venv.hasVenv', '".venv" already exists for this workspace.'));
            return undefined;
        }
        return workspaces[0];
    }

    // This is multi-root scenario.
    const selected = await showQuickPick(getWorkspacesForQuickPick(workspaces), {
        title: localize('python.venv.workspaceQuickPick.title', 'Select workspace to create `venv` environment.'),
        ignoreFocusOut: true,
    });

    if (selected) {
        return workspaces.filter((w) => w.uri.fsPath === selected.detail)[0];
    }

    return undefined;
}
