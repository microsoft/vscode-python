// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { ExecutionInfo, IInstaller, Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IErrorHandler } from '../types';

export abstract class BaseErrorHandler implements IErrorHandler {
    protected installer: IInstaller;

    private handler?: IErrorHandler;

    constructor(protected product: Product, protected serviceContainer: IServiceContainer) {
        this.installer = this.serviceContainer.get<IInstaller>(IInstaller);
    }

    protected get nextHandler(): IErrorHandler | undefined {
        return this.handler;
    }

    public setNextHandler(handler: IErrorHandler): void {
        this.handler = handler;
    }

    public abstract handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>;
}
