// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { QuickPickItem, WorkspaceFolder } from 'vscode';
import { showErrorMessage, showQuickPick } from '../../../common/vscodeApis/windowApis';
import { getWorkspaceFolders } from '../../../common/vscodeApis/workspaceApis';
import { CreateEnv } from '../../../common/utils/localize';

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
            description: (await hasVirtualEnv(workspace)) ? CreateEnv.hasVirtualEnv : undefined,
        });
    }

    return items;
}

export interface PickWorkspaceFolderOptions {
    allowMultiSelect?: boolean;
}

export async function pickWorkspaceFolder(
    options?: PickWorkspaceFolderOptions,
): Promise<WorkspaceFolder | WorkspaceFolder[] | undefined> {
    const workspaces = getWorkspaceFolders();

    if (!workspaces || workspaces.length === 0) {
        showErrorMessage(CreateEnv.noWorkspace);
        return undefined;
    }

    if (workspaces.length === 1) {
        return workspaces[0];
    }

    // This is multi-root scenario.
    const selected = await showQuickPick(getWorkspacesForQuickPick(workspaces), {
        title: CreateEnv.pickWorkspaceTitle,
        ignoreFocusOut: true,
        canPickMany: options?.allowMultiSelect,
    });

    if (selected) {
        if (options?.allowMultiSelect) {
            const details = ((selected as unknown) as QuickPickItem[])
                .map((s: QuickPickItem) => s.detail)
                .filter((s) => s !== undefined);
            return workspaces.filter((w) => details.includes(w.uri.fsPath));
        }
        return workspaces.filter((w) => w.uri.fsPath === selected.detail)[0];
    }

    return undefined;
}
