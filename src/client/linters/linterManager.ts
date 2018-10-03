// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, OutputChannel, TextDocument, Uri } from 'vscode';
import { IConfigurationService, ILogger, Product } from '../common/types';
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
import { ILinter, ILinterInfo, ILinterManager, ILintMessage } from './types';

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

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
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

    public isLintingEnabled(resource?: Uri): boolean {
        const settings = this.configService.getSettings(resource);
        return (settings.linting[this.lintingEnabledSettingName] as boolean) && this.getActiveLinters(resource).length > 0;
    }

    public async enableLintingAsync(enable: boolean, resource?: Uri): Promise<void> {
        await this.configService.updateSettingAsync(`linting.${this.lintingEnabledSettingName}`, enable, resource);

        // If nothing is enabled, fix it up to PyLint (default).
        if (enable && this.getActiveLinters(resource).length === 0) {
            await this.setActiveLintersAsync([Product.pylint], resource);
        }
    }

    public getActiveLinters(resource?: Uri): ILinterInfo[] {
        return this.linters.filter(x => x.isEnabled(resource));
    }

    public async setActiveLintersAsync(products: Product[], resource?: Uri): Promise<void> {
        const active = this.getActiveLinters(resource);
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

    public createLinter(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer, resource?: Uri): ILinter {
        if (!this.isLintingEnabled(resource)) {
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
}
