import { OutputChannel, Uri } from 'vscode';
import { isNotInstalledError } from '../../common/helpers';
import { Product } from '../../common/installer';
import { IPythonExecutionFactory } from '../../common/process/types';
import { ExecutionInfo, IInstaller, ILogger } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterHelper } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class ModuleNotInstalledErrorHandler extends BaseErrorHandler {
    constructor(product: Product, installer: IInstaller,
        helper: ILinterHelper, logger: ILogger,
        outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(product, installer, helper, logger, outputChannel, serviceContainer);
    }
    public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        if (!isNotInstalledError(error) || !execInfo.moduleName) {
            return this.nextHandler ? await this.nextHandler.handleError(error, resource, execInfo) : false;
        }

        const pythonExecutionService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(resource);
        const isModuleInstalled = await pythonExecutionService.isModuleInstalled(execInfo.moduleName!);
        if (!isModuleInstalled) {
            return this.nextHandler ? await this.nextHandler.handleError(error, resource, execInfo) : false;
        }

        this.installer.promptToInstall(this.product, resource)
            .catch(this.logger.logError.bind(this, 'NotInstalledErrorHandler.promptToInstall'));

        const id = this.helper.translateToId(execInfo.product!);
        const customError = `Linting with ${id} failed.\nYou could either install the '${id}' linter or turn it off in setings.json via "python.linting.${id}Enabled = false".`;
        this.outputChannel.appendLine(`\n${customError}\n${error}`);
        this.logger.logWarning(customError, error);
        return true;
    }
}
