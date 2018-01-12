import { OutputChannel, Uri, window } from 'vscode';
import { ExecutionInfo, IInstaller, ILogger, Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager, LinterId } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class StandardErrorHandler extends BaseErrorHandler {
    constructor(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(product, outputChannel, serviceContainer);
    }
    public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        if (typeof error === 'string' && (error as string).indexOf('OSError: [Errno 2] No such file or directory: \'/') > 0) {
            return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : Promise.resolve(false);
        }

        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        const info = linterManager.getLinterInfo(execInfo.product!);

        this.logger.logError(`There was an error in running the linter ${info.id}`, error);
        this.outputChannel.appendLine(`Linting with ${info.id} failed.`);
        this.outputChannel.appendLine(error.toString());

        this.displayLinterError(info.id, resource);
        return true;
    }
    private async displayLinterError(linterId: LinterId, resource: Uri) {
        const message = `There was an error in running the linter '${linterId}'`;
        const item = await window.showErrorMessage(message, 'Disable linter', 'View Errors');
        switch (item) {
            case 'Disable linter': {
                this.installer.disableLinter(this.product, resource)
                    .catch(this.logger.logError.bind(this, 'StandardErrorHandler.displayLinterError'));
                break;
            }
            case 'View Errors': {
                this.outputChannel.show();
                break;
            }
            default: {
                // Ignore this selection (e.g. user hit cancel).
            }
        }
    }
}
