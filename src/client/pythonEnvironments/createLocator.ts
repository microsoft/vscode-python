import * as vscode from 'vscode';
import { ExtensionState } from '../components';
import { BasicEnvInfo, IDiscoveryAPI, ILocator } from './base/locator';
import { WindowsPathEnvVarLocator } from './base/locators/lowLevel/windowsKnownPathsLocator';
import { WorkspaceVirtualEnvironmentLocator } from './base/locators/lowLevel/workspaceVirtualEnvLocator';
import { WatchRootsArgs, WorkspaceLocators } from './base/locators/wrappers';
import { CustomVirtualEnvironmentLocator } from './base/locators/lowLevel/customVirtualEnvLocator';
import { CondaEnvironmentLocator } from './base/locators/lowLevel/condaLocator';
import { GlobalVirtualEnvironmentLocator } from './base/locators/lowLevel/globalVirtualEnvronmentLocator';
import { PosixKnownPathsLocator } from './base/locators/lowLevel/posixKnownPathsLocator';
import { PyenvLocator } from './base/locators/lowLevel/pyenvLocator';
import { WindowsRegistryLocator } from './base/locators/lowLevel/windowsRegistryLocator';
import { MicrosoftStoreLocator } from './base/locators/lowLevel/microsoftStoreLocator';
import { PoetryLocator } from './base/locators/lowLevel/poetryLocator';
import {
    createCollectionCache as createCache,
    IEnvsCollectionCache,
} from './base/locators/composite/envsCollectionCache';
import { IDisposable } from '../common/types';
import { ActiveStateLocator } from './base/locators/lowLevel/activeStateLocator';

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
    }
    if (/^darwin/.test(platform)) {
        return OSType.OSX;
    }
    if (/^linux/.test(platform)) {
        return OSType.Linux;
    }
    return OSType.Unknown;
}
/**
 * Get the locator to use in the component.
 */

export async function createLocator(): Promise<IDiscoveryAPI> {
    return ([] as unknown) as IDiscoveryAPI;
}
function watchRoots(args: WatchRootsArgs): IDisposable {
    const { initRoot, addRoot, removeRoot } = args;

    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        folders.map((f) => f.uri).forEach(initRoot);
    }

    return vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const root of event.removed) {
            removeRoot(root.uri);
        }
        for (const root of event.added) {
            addRoot(root.uri);
        }
    });
}
