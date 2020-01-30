import { OutputChannel, Uri } from 'vscode';
import { traceError, traceWarning } from '../../common/logger';
import { IPythonExecutionFactory } from '../../common/process/types';
import { ExecutionInfo, Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class NotInstalledErrorHandler extends BaseErrorHandler {
    constructor(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(product, outputChannel, serviceContainer);
    }
    public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        const pythonExecutionService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource });
        const isModuleInstalled = await pythonExecutionService.isModuleInstalled(execInfo.moduleName!);
        if (isModuleInstalled) {
            return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : false;
        }

        this.installer.promptToInstall(this.product, resource).catch(ex => traceError('NotInstalledErrorHandler.promptToInstall', ex));

        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        const info = linterManager.getLinterInfo(execInfo.product!);
        const customError = `Linter '${info.id}' is not installed. Please install it or select another linter".`;
        this.outputChannel.appendLine(`\n${customError}\n${error}`);
        traceWarning(customError, error);
        return true;
    }
}
