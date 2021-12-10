import { Uri } from 'vscode';
import { ExecutionInfo, Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IErrorHandler } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';
import { NotInstalledErrorHandler } from './notInstalled';
import { StandardErrorHandler } from './standard';

export class ErrorHandler implements IErrorHandler {
    private handler: BaseErrorHandler;

    constructor(product: Product, serviceContainer: IServiceContainer) {
        // Create chain of handlers.
        const standardErrorHandler = new StandardErrorHandler(product, serviceContainer);
        this.handler = new NotInstalledErrorHandler(product, serviceContainer);
        this.handler.setNextHandler(standardErrorHandler);
    }

    public handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        return this.handler.handleError(error, resource, execInfo);
    }
}
