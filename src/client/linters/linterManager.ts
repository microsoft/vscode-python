/* eslint-disable max-classes-per-file */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, TextDocument, Uri } from 'vscode';
import { IConfigurationService, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { traceError } from '../logging';
import { Bandit } from './bandit';
import { Flake8 } from './flake8';
import { LinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { getOrCreateFlake8Prompt } from './prompts/flake8Prompt';
import { getOrCreatePylintPrompt } from './prompts/pylintPrompt';
import { Prospector } from './prospector';
import { Pycodestyle } from './pycodestyle';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import { ILinter, ILinterInfo, ILinterManager, ILintMessage, LinterId } from './types';

class DisabledLinter implements ILinter {
    constructor(private configService: IConfigurationService) {}

    public get info() {
        return new LinterInfo(Product.pylint, LinterId.PyLint, this.configService);
    }

    // eslint-disable-next-line class-methods-use-this
    public async lint(_document: TextDocument, _cancellation: CancellationToken): Promise<ILintMessage[]> {
        return [];
    }
}

@injectable()
export class LinterManager implements ILinterManager {
    protected linters: ILinterInfo[];

    constructor(@inject(IConfigurationService) private configService: IConfigurationService) {
        // Note that we use unit tests to ensure all the linters are here.
        this.linters = [
            new LinterInfo(Product.bandit, LinterId.Bandit, this.configService),
            new LinterInfo(Product.flake8, LinterId.Flake8, this.configService),
            new LinterInfo(Product.pylint, LinterId.PyLint, this.configService, ['pylintrc', '.pylintrc']),
            new LinterInfo(Product.mypy, LinterId.MyPy, this.configService),
            new LinterInfo(Product.pycodestyle, LinterId.PyCodeStyle, this.configService),
            new LinterInfo(Product.prospector, LinterId.Prospector, this.configService),
            new LinterInfo(Product.pydocstyle, LinterId.PyDocStyle, this.configService),
            new LinterInfo(Product.pylama, LinterId.PyLama, this.configService),
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

    public async isLintingEnabled(resource?: Uri): Promise<boolean> {
        const settings = this.configService.getSettings(resource);
        const activeLintersPresent = await this.getActiveLinters(resource);
        return settings.linting.enabled && activeLintersPresent.length > 0;
    }

    public async enableLintingAsync(enable: boolean, resource?: Uri): Promise<void> {
        await this.configService.updateSetting('linting.enabled', enable, resource);
    }

    public async getActiveLinters(resource?: Uri): Promise<ILinterInfo[]> {
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
            const active = await this.getActiveLinters(resource);
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

    public async createLinter(product: Product, serviceContainer: IServiceContainer, resource?: Uri): Promise<ILinter> {
        if (!(await this.isLintingEnabled(resource))) {
            return new DisabledLinter(this.configService);
        }
        const error = 'Linter manager: Unknown linter';
        switch (product) {
            case Product.bandit:
                return new Bandit(serviceContainer);
            case Product.flake8:
                return new Flake8(serviceContainer, getOrCreateFlake8Prompt(serviceContainer));
            case Product.pylint:
                return new Pylint(serviceContainer, getOrCreatePylintPrompt(serviceContainer));
            case Product.mypy:
                return new MyPy(serviceContainer);
            case Product.prospector:
                return new Prospector(serviceContainer);
            case Product.pylama:
                return new PyLama(serviceContainer);
            case Product.pydocstyle:
                return new PyDocStyle(serviceContainer);
            case Product.pycodestyle:
                return new Pycodestyle(serviceContainer);
            default:
                traceError(error);
                break;
        }
        throw new Error(error);
    }
}
