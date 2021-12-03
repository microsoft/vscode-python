import { Uri } from 'vscode';
import { IPythonExecutionFactory } from '../../common/process/types';
import { ExecutionInfo, Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { traceError, traceLog, traceWarn } from '../../logging';
import { ILinterManager } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class NotInstalledErrorHandler extends BaseErrorHandler {
    constructor(product: Product, serviceContainer: IServiceContainer) {
        super(product, serviceContainer);
    }
    public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        const pythonExecutionService = await this.serviceContainer
            .get<IPythonExecutionFactory>(IPythonExecutionFactory)
            .create({ resource });
        const isModuleInstalled = await pythonExecutionService.isModuleInstalled(execInfo.moduleName!);
        if (isModuleInstalled) {
            return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : false;
        }

        this.installer
            .promptToInstall(this.product, resource)
            .catch((ex) => traceError('NotInstalledErrorHandler.promptToInstall', ex));

        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        const info = linterManager.getLinterInfo(execInfo.product!);
        const customError = `Linter '${info.id}' is not installed. Please install it or select another linter".`;
        traceLog(`\n${customError}\n${error}`);
        traceWarn(customError, error);
        return true;
    }
}
