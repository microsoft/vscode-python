// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OutputChannel, Uri } from 'vscode';
import { Product } from '../../common/installer';
import { ExecutionInfo, IInstaller, ILogger } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IErrorHandler, ILinterHelper } from '../types';

export abstract class BaseErrorHandler implements IErrorHandler {
    private handler: IErrorHandler;
    constructor(protected product: Product, protected installer: IInstaller,
        protected helper: ILinterHelper, protected logger: ILogger,
        protected outputChannel: OutputChannel, protected serviceContainer: IServiceContainer) {

    }
    protected get nextHandler() {
        return this.handler;
    }
    public setNextHandler(handler: IErrorHandler): void {
        this.handler = handler;
    }
    public abstract handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>;
}
