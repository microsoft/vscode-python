// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, OutputChannel, TextDocument, Uri } from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { traceError } from '../common/logger';
import { IConfigurationService, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Bandit } from './bandit';
import { Flake8 } from './flake8';
import { LinterInfo, PylintLinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { Prospector } from './prospector';
import { Pycodestyle } from './pycodestyle';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import { IAvailableLinterActivator, ILinter, ILinterInfo, ILinterManager, ILintMessage } from './types';

class DisabledLinter implements ILinter {
    constructor(private configService: IConfigurationService) {}
    public get info() {
        return new LinterInfo(Product.pylint, 'pylint', this.configService);
    }
    public async lint(_document: TextDocument, _cancellation: CancellationToken): Promise<ILintMessage[]> {
        return [];
    }
}

@injectable()
export class LinterManager implements ILinterManager {
    protected linters: ILinterInfo[];
    private configService: IConfigurationService;
    private checkedForInstalledLinters = new Set<string>();

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        // Note that we use unit tests to ensure all the linters are here.
        this.linters = [
            new LinterInfo(Product.bandit, 'bandit', this.configService),
            new LinterInfo(Product.flake8, 'flake8', this.configService),
            new PylintLinterInfo(this.configService, this.workspaceService, ['.pylintrc', 'pylintrc']),
            new LinterInfo(Product.mypy, 'mypy', this.configService),
            new LinterInfo(Product.pycodestyle, 'pycodestyle', this.configService),
            new LinterInfo(Product.prospector, 'prospector', this.configService),
            new LinterInfo(Product.pydocstyle, 'pydocstyle', this.configService),
            new LinterInfo(Product.pylama, 'pylama', this.configService),
        ];
    }

    public getAllLinterInfos(): ILinterInfo[] {
        return this.linters;
    }

    public getLinterInfo(product: Product): ILinterInfo {
        const x = this.linters.findIndex((value, _index, _obj) => value.product === product);
        if (x >= 0) {
            return this.linters[x];
        }
        throw new Error(`Invalid linter '${Product[product]}'`);
    }

    public async isLintingEnabled(silent: boolean, resource?: Uri): Promise<boolean> {
        const settings = this.configService.getSettings(resource);
        const activeLintersPresent = await this.getActiveLinters(silent, resource);
        return settings.linting.enabled && activeLintersPresent.length > 0;
    }

    public async enableLintingAsync(enable: boolean, resource?: Uri): Promise<void> {
        await this.configService.updateSetting('linting.enabled', enable, resource);
    }

    public async getActiveLinters(silent: boolean, resource?: Uri): Promise<ILinterInfo[]> {
        if (!silent) {
            await this.enableUnconfiguredLinters(resource);
        }
        return this.linters.filter((x) => x.isEnabled(resource));
    }

    public async setActiveLintersAsync(products: Product[], resource?: Uri): Promise<void> {
        // ensure we only allow valid linters to be set, otherwise leave things alone.
        // filter out any invalid products:
        const validProducts = products.filter((product) => {
            const foundIndex = this.linters.findIndex((validLinter) => validLinter.product === product);
            return foundIndex !== -1;
        });

        // if we have valid linter product(s), enable only those
        if (validProducts.length > 0) {
            const active = await this.getActiveLinters(true, resource);
            for (const x of active) {
                await x.enableAsync(false, resource);
            }
            if (products.length > 0) {
                const toActivate = this.linters.filter((x) => products.findIndex((p) => x.product === p) >= 0);
                for (const x of toActivate) {
                    await x.enableAsync(true, resource);
                }
                await this.enableLintingAsync(true, resource);
            }
        }
    }

    public async createLinter(
        product: Product,
        outputChannel: OutputChannel,
        serviceContainer: IServiceContainer,
        resource?: Uri
    ): Promise<ILinter> {
        if (!(await this.isLintingEnabled(true, resource))) {
            return new DisabledLinter(this.configService);
        }
        const error = 'Linter manager: Unknown linter';
        switch (product) {
            case Product.bandit:
                return new Bandit(outputChannel, serviceContainer);
            case Product.flake8:
                return new Flake8(outputChannel, serviceContainer);
            case Product.pylint:
                return new Pylint(outputChannel, serviceContainer);
            case Product.mypy:
                return new MyPy(outputChannel, serviceContainer);
            case Product.prospector:
                return new Prospector(outputChannel, serviceContainer);
            case Product.pylama:
                return new PyLama(outputChannel, serviceContainer);
            case Product.pydocstyle:
                return new PyDocStyle(outputChannel, serviceContainer);
            case Product.pycodestyle:
                return new Pycodestyle(outputChannel, serviceContainer);
            default:
                traceError(error);
                break;
        }
        throw new Error(error);
    }

    protected async enableUnconfiguredLinters(resource?: Uri): Promise<void> {
        const settings = this.configService.getSettings(resource);
        if (!settings.linting.pylintEnabled || !settings.linting.enabled) {
            return;
        }
        // If we've already checked during this session for the same workspace and Python path, then don't bother again.
        const workspaceKey = `${this.workspaceService.getWorkspaceFolderIdentifier(resource)}${settings.pythonPath}`;
        if (this.checkedForInstalledLinters.has(workspaceKey)) {
            return;
        }
        this.checkedForInstalledLinters.add(workspaceKey);

        // only check & ask the user if they'd like to enable pylint
        const pylintInfo = this.linters.find((linter) => linter.id === 'pylint');
        const activator = this.serviceContainer.get<IAvailableLinterActivator>(IAvailableLinterActivator);
        await activator.promptIfLinterAvailable(pylintInfo!, resource);
    }
}
