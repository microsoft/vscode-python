// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { ILocator } from './base/locator';
import { ExtensionLocators, WorkspaceLocators } from './discovery/locators';
import { registerForIOC } from './legacyIOC';

export function activate(serviceManager: IServiceManager, serviceContainer: IServiceContainer) {
    registerForIOC(serviceManager, serviceContainer);

    const [locators, activateLocators] = initLocators();
    activateLocators();
    // We will pass the locators into the component API.
    // tslint:disable-next-line:no-unused-expression
    locators;
}

function initLocators(): [ExtensionLocators, () => void] {
    // We will add locators in similar order
    // to PythonInterpreterLocatorService.getLocators().
    const nonWorkspaceLocators: ILocator[] = [
        // Add an ILocator object here for each non-workspace locator.
    ];

    const workspaceLocators = new WorkspaceLocators([
        // Add an ILocator factory func here for each kind of workspace-rooted locator.
    ]);

    return [
        new ExtensionLocators(nonWorkspaceLocators, workspaceLocators),
        // combined activation func:
        () => {
            // Any non-workspace locator activation goes here.
            workspaceLocators.activate(getWorkspaceFolders());
        }
    ];
}

function getWorkspaceFolders() {
    const rootAdded = new vscode.EventEmitter<vscode.Uri>();
    const rootRemoved = new vscode.EventEmitter<vscode.Uri>();
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const root of event.removed) {
            rootRemoved.fire(root.uri);
        }
        for (const root of event.added) {
            rootAdded.fire(root.uri);
        }
    });
    const folders = vscode.workspace.workspaceFolders;
    return {
        roots: folders ? folders.map((f) => f.uri) : [],
        onAdded: rootAdded.event,
        onRemoved: rootRemoved.event
    };
}
