// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { getOSType, OSType } from '../common/utils/platform';
import { BasicEnvInfo, ILocator, IResolvingLocator } from './base/locator';
import { PythonEnvsReducer } from './base/locators/composite/envsReducer';
import { PythonEnvsResolver } from './base/locators/composite/envsResolver';
import { WindowsPathEnvVarLocator } from './base/locators/lowLevel/windowsKnownPathsLocator';
import { WorkspaceVirtualEnvironmentLocator } from './base/locators/lowLevel/workspaceVirtualEnvLocator';
import { ExtensionLocators, WorkspaceLocators } from './base/locators/wrappers';
import { CustomVirtualEnvironmentLocator } from './base/locators/lowLevel/customVirtualEnvLocator';
import { CondaEnvironmentLocator } from './base/locators/lowLevel/condaLocator';
import { GlobalVirtualEnvironmentLocator } from './base/locators/lowLevel/globalVirtualEnvronmentLocator';
import { PosixKnownPathsLocator } from './base/locators/lowLevel/posixKnownPathsLocator';
import { PyenvLocator } from './base/locators/lowLevel/pyenvLocator';
import { WindowsRegistryLocator } from './base/locators/lowLevel/windowsRegistryLocator';
import { MicrosoftStoreLocator } from './base/locators/lowLevel/microsoftStoreLocator';
import { getEnvironmentInfoService } from './base/info/environmentInfoService';
import { PoetryLocator } from './base/locators/lowLevel/poetryLocator';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { ActiveStateLocator } from './base/locators/lowLevel/activeStateLocator';

/**
 * Get the locator to use in the component.
 */
export function createSubLocators(
    folders: readonly vscode.WorkspaceFolder[] | undefined,
): {
    locator: IResolvingLocator;
    disposables: IDisposableRegistry;
    workspaceLocator: WorkspaceLocators;
} {
    const disposables: IDisposableRegistry = [];
    // Create the low-level locators.
    const workspaceLocator = createWorkspaceLocator(folders, disposables);
    const locators: ILocator<BasicEnvInfo> = new ExtensionLocators<BasicEnvInfo>(
        // Here we pull the locators together.
        createNonWorkspaceLocators(disposables),
        workspaceLocator,
    );

    // Create the env info service used by ResolvingLocator and CachingLocator.
    const envInfoService = getEnvironmentInfoService(disposables);

    // Build the stack of composite locators.
    const reducer = new PythonEnvsReducer(locators);
    const resolvingLocator = new PythonEnvsResolver(
        reducer,
        // These are shared.
        envInfoService,
        folders,
    );
    return { locator: resolvingLocator, disposables, workspaceLocator };
}

function createNonWorkspaceLocators(disposables: IDisposableRegistry): ILocator<BasicEnvInfo>[] {
    const locators: (ILocator<BasicEnvInfo> & Partial<IDisposable>)[] = [];
    locators.push(
        // OS-independent locators go here.
        new PyenvLocator(),
        new CondaEnvironmentLocator(),
        new ActiveStateLocator(),
        new GlobalVirtualEnvironmentLocator(),
        new CustomVirtualEnvironmentLocator(),
    );

    if (getOSType() === OSType.Windows) {
        locators.push(
            // Windows specific locators go here.
            new WindowsRegistryLocator(),
            new MicrosoftStoreLocator(),
            new WindowsPathEnvVarLocator(),
        );
    } else {
        locators.push(
            // Linux/Mac locators go here.
            new PosixKnownPathsLocator(),
        );
    }

    const more = locators.filter((d) => d.dispose !== undefined) as IDisposable[];
    disposables.push(...more);
    return locators;
}

function createWorkspaceLocator(
    folders: readonly vscode.WorkspaceFolder[] | undefined,
    disposables: IDisposableRegistry,
): WorkspaceLocators {
    const locators = new WorkspaceLocators(folders, [
        (root: vscode.Uri) => [new WorkspaceVirtualEnvironmentLocator(root.fsPath), new PoetryLocator(root.fsPath)],
        // Add an ILocator factory func here for each kind of workspace-rooted locator.
    ]);
    disposables.push(locators);
    return locators;
}
