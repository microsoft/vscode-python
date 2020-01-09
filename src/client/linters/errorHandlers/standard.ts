import { OutputChannel, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { ExecutionInfo, Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager, LinterId } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class StandardErrorHandler extends BaseErrorHandler {
    constructor(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(product, outputChannel, serviceContainer);
    }
    public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        if (typeof error === 'string' && (error as string).indexOf("OSError: [Errno 2] No such file or directory: '/") > 0) {
            return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : Promise.resolve(false);
        }

        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        const info = linterManager.getLinterInfo(execInfo.product!);

        this.logger.logError(`There was an error in running the linter ${info.id}`, error);
        this.outputChannel.appendLine(`Linting with ${info.id} failed.`);
        this.outputChannel.appendLine(error.toString());

        this.displayLinterError(info.id).ignoreErrors();
        return true;
    }
    private async displayLinterError(linterId: LinterId) {
        const message = `There was an error in running the linter '${linterId}'`;
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        await appShell.showErrorMessage(message, 'View Errors');
        this.outputChannel.show();
    }
}
