import { OutputChannel, Uri } from 'vscode';
import { Product } from '../../common/installer';
import { ExecutionInfo, IInstaller, ILogger } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IErrorHandler, ILinterHelper } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';
import { ModuleNotInstalledErrorHandler } from './notInstalled';
import { StandardErrorHandler } from './standard';

export class ErrorHandler implements IErrorHandler {
    private handlder: BaseErrorHandler;
    constructor(product: Product, installer: IInstaller,
        helper: ILinterHelper, logger: ILogger,
        outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        // Create chain of handlers.
        const moduleNotInstalledErrorHandler = new ModuleNotInstalledErrorHandler(product, installer, helper, logger, outputChannel, serviceContainer);
        this.handlder = new StandardErrorHandler(product, installer, helper, logger, outputChannel, serviceContainer);
        this.handlder.setNextHandler(moduleNotInstalledErrorHandler);
    }

    public handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        return this.handlder.handleError(error, resource, execInfo);
    }
}
