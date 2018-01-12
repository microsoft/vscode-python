// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { OutputChannel } from 'vscode';
import { ILogger, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Flake8 } from './flake8';
import { LinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { Pep8 } from './pep8Linter';
import { Prospector } from './prospector';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import { ILinter, ILinterInfo, ILinterManager } from './types';

@injectable()
export class LinterManager implements ILinterManager {
    private linters: ILinterInfo[] = [
        new LinterInfo(Product.pylint, 'pylint'),
        new LinterInfo(Product.mypy, 'mypy'),
        new LinterInfo(Product.pep8, 'pep8'),
        new LinterInfo(Product.prospector, 'prospector'),
        new LinterInfo(Product.pydocstyle, 'pydocstyle'),
        new LinterInfo(Product.pylama, 'pylama')
    ];
    private factories = new Map<Product, () => ILinter>();

    public getLinterInfos(): ILinterInfo[] {
        return this.linters;
    }
    public getLinterInfo(product: Product): ILinterInfo | undefined {
        const x = this.linters.findIndex((value, index, obj) => value.product === product);
        return x >= 0 ? this.linters[x] : undefined;
    }
    public createLinter(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer): ILinter | undefined {
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
                serviceContainer.get<ILogger>(ILogger).logError('Linter manager: Unknown linter');
                break;
        }
    }
}
