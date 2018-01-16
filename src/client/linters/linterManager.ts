// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { OutputChannel, Uri } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { ILogger, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Flake8 } from './flake8';
import { LinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { Pep8 } from './pep8';
import { Prospector } from './prospector';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import { ILinter, ILinterInfo, ILinterManager } from './types';

@injectable()
export class LinterManager implements ILinterManager {
    private lintingEnabledSettingName = 'enabled';
    private currentLinterSettingName = 'currentLinter';
    private linters: ILinterInfo[] = [
        new LinterInfo(Product.flake8, 'flake8'),
        new LinterInfo(Product.pylint, 'pylint'),
        new LinterInfo(Product.mypy, 'mypy'),
        new LinterInfo(Product.pep8, 'pep8'),
        new LinterInfo(Product.prospector, 'prospector'),
        new LinterInfo(Product.pydocstyle, 'pydocstyle'),
        new LinterInfo(Product.pylama, 'pylama')
    ];

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
        const settings = PythonSettings.getInstance(resource);
        return (settings.linting[this.lintingEnabledSettingName] as boolean) && this.getCurrentLinter(resource) !== undefined;
    }

    public enableLinting(enable: boolean, resource?: Uri): void {
        const settings = PythonSettings.getInstance(resource);
        settings.linting[this.lintingEnabledSettingName] = enable;
        if (this.getCurrentLinterIndex(resource) < 0) {
            this.setCurrentLinter(Product.pylint, resource);
        }
    }

    public getCurrentLinter(resource?: Uri): ILinterInfo | undefined {
        const index = this.getCurrentLinterIndex(resource);
        return index >= 0 ? this.linters[index] : undefined;
    }

    public setCurrentLinter(product: Product, resource?: Uri) {
        const oldLinterIndex = this.getCurrentLinterIndex(resource);
        const newLinterIndex = this.linters.findIndex(x => x.product === product);
        if (newLinterIndex < 0 || newLinterIndex === oldLinterIndex) {
            return;
        }
        const settings = PythonSettings.getInstance(resource);
        settings.linting[this.currentLinterSettingName] = this.linters[newLinterIndex].id;
    }

    public createLinter(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer): ILinter {
        const error = 'Linter manager: Unknown linter';
        switch (product) {
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

    private getCurrentLinterIndex(resource?: Uri): number {
        const settings = PythonSettings.getInstance(resource);
        const id = settings.linting[this.currentLinterSettingName] as string;
        return this.getAllLinterInfos().findIndex(x => x.id === id);
    }
}
