// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    CancellationToken, OutputChannel, TextDocument, Uri
} from 'vscode';
import {
    IConfigurationService, ILogger, Product
} from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Bandit } from './bandit';
import { Flake8 } from './flake8';
import { LinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { Pep8 } from './pep8';
import { Prospector } from './prospector';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import {
    IAvailableLinterActivator, ILinter, ILinterInfo, ILinterManager, ILintMessage
} from './types';

class DisabledLinter implements ILinter {
    constructor(private configService: IConfigurationService) { }
    public get info() {
        return new LinterInfo(Product.pylint, 'pylint', this.configService);
    }
    public async lint(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        return [];
    }
}

@injectable()
export class LinterManager implements ILinterManager {
    private lintingEnabledSettingName = 'enabled';
    private linters: ILinterInfo[];
    private configService: IConfigurationService;
    private checkedForInstalledLinters: boolean = false;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.linters = [
            new LinterInfo(Product.bandit, 'bandit', this.configService),
            new LinterInfo(Product.flake8, 'flake8', this.configService),
            new LinterInfo(Product.pylint, 'pylint', this.configService, ['.pylintrc', 'pylintrc']),
            new LinterInfo(Product.mypy, 'mypy', this.configService),
            new LinterInfo(Product.pep8, 'pep8', this.configService),
            new LinterInfo(Product.prospector, 'prospector', this.configService),
            new LinterInfo(Product.pydocstyle, 'pydocstyle', this.configService),
            new LinterInfo(Product.pylama, 'pylama', this.configService)
        ];
    }

    public getAllLinterInfos(): ILinterInfo[] {
        return this.linters;
    }

    public getLinterInfo(product: Product): ILinterInfo {
        const x = this.linters.findIndex((value, index, obj) => value.product === product);
        if (x >= 0) {
            return this.linters[x];
        }
        throw new Error('Invalid linter');
    }

    public async isLintingEnabled(silent: boolean, resource?: Uri): Promise<boolean> {
        const settings = this.configService.getSettings(resource);
        const activeLintersPresent = await this.getActiveLinters(silent, resource);
        return (settings.linting[this.lintingEnabledSettingName] as boolean) && activeLintersPresent.length > 0;
    }

    public async enableLintingAsync(enable: boolean, resource?: Uri): Promise<void> {
        await this.configService.updateSetting(`linting.${this.lintingEnabledSettingName}`, enable, resource);
    }

    public async getActiveLinters(silent: boolean, resource?: Uri): Promise<ILinterInfo[]> {
        if (!silent) {
            await this.enableUnconfiguredLinters(resource);
        }
        return this.linters.filter(x => x.isEnabled(resource));
    }

    public async setActiveLintersAsync(products: Product[], resource?: Uri): Promise<void> {
        // ensure we only allow valid linters to be set, otherwise leave things alone.
        // filter out any invalid products:
        const validProducts = products.filter(product => {
            const foundIndex = this.linters.findIndex(validLinter => validLinter.product === product);
            return foundIndex !== -1;
        });

        // if we have valid linter product(s), enable only those
        if (validProducts.length > 0) {
            const active = await this.getActiveLinters(true, resource);
            for (const x of active) {
                await x.enableAsync(false, resource);
            }
            if (products.length > 0) {
                const toActivate = this.linters.filter(x => products.findIndex(p => x.product === p) >= 0);
                for (const x of toActivate) {
                    await x.enableAsync(true, resource);
                }
                await this.enableLintingAsync(true, resource);
            }
        }
    }

    public async createLinter(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer, resource?: Uri): Promise<ILinter> {
        if (!await this.isLintingEnabled(true, resource)) {
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
            case Product.pep8:
                return new Pep8(outputChannel, serviceContainer);
            default:
                serviceContainer.get<ILogger>(ILogger).logError(error);
                break;
        }
        throw new Error(error);
    }

    protected async enableUnconfiguredLinters(resource?: Uri): Promise<boolean> {
        // if we've already checked during this session, don't bother again
        if (this.checkedForInstalledLinters) {
            return false;
        }
        this.checkedForInstalledLinters = true;

        // only check & ask the user if they'd like to enable pylint
        const pylintInfo = this.linters.find(
            (linter: ILinterInfo) => linter.id === 'pylint'
        );

        // If linting is disabled, don't bother checking further.
        if (pylintInfo && await this.isLintingEnabled(true, resource)) {
            const activator = this.serviceContainer.get<IAvailableLinterActivator>(IAvailableLinterActivator);
            return activator.promptIfLinterAvailable(pylintInfo, resource);
        }
        return false;
    }
}
