// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { QuickPickItem, Uri } from 'vscode';
import { IInterpreterService, InterpreterType } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationShell } from '../application/types';
import { IPlatformService } from '../platform/types';
import { Product } from '../types';
import { ProductNames } from './productNames';
import { IInstallationChannelManager, IModuleInstaller } from './types';

@injectable()
export class InstallationChannelManager implements IInstallationChannelManager {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) { }

    public async getInstallationChannel(product: Product, resource?: Uri): Promise<IModuleInstaller | undefined> {
        const channels = await this.getInstallationChannels(resource);
        if (channels.length === 1) {
            return channels[0];
        }

        const productName = ProductNames.get(product)!;
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        if (channels.length === 0) {
            await this.showNoInstallersMessage(resource);
            return;
        }

        const placeHolder = `Select an option to install ${productName}`;
        const options = channels.map(installer => {
            return {
                label: `Install using ${installer.displayName}`,
                description: '',
                installer
            } as QuickPickItem & { installer: IModuleInstaller };
        });
        const selection = await appShell.showQuickPick(options, { matchOnDescription: true, matchOnDetail: true, placeHolder });
        return selection ? selection.installer : undefined;
    }

    public async getInstallationChannels(resource?: Uri): Promise<IModuleInstaller[]> {
        const installers = this.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const supportedInstallers: IModuleInstaller[] = [];
        for (const mi of installers) {
            if (await mi.isSupported(resource)) {
                supportedInstallers.push(mi);
            }
        }
        return supportedInstallers;
    }

    public async showNoInstallersMessage(resource?: Uri): Promise<void> {
        const interpreters = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const interpreter = await interpreters.getActiveInterpreter(resource);
        if (!interpreter) {
            return; // Handled in the Python installation check.
        }

        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const search = 'Search for help';
        let result: string | undefined;
        if (interpreter.type === InterpreterType.Conda) {
            result = await appShell.showErrorMessage('There is no Conda or Pip installer available in the selected environment.', search);
        } else {
            result = await appShell.showErrorMessage('There is no Pip installer available in the selected environment.', search);
        }
        if (result === search) {
            const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
            const osName = platform.isWindows
                ? 'Windows'
                : (platform.isMac ? 'MacOS' : 'Linux');
            appShell.openUrl(`https://www.bing.com/search?q=Install Pip ${osName} ${(interpreter.type === InterpreterType.Conda) ? 'Conda' : ''}`);
        }
    }
}
