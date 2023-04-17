import { l10n, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { ExecutionInfo, ILogOutputChannel } from '../../common/types';
import { traceError, traceLog } from '../../logging';
import { ILinterManager, LinterId } from '../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class StandardErrorHandler extends BaseErrorHandler {
    public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
        if (
            typeof error === 'string' &&
            (error as string).includes("OSError: [Errno 2] No such file or directory: '/")
        ) {
            return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : Promise.resolve(false);
        }

        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        const info = linterManager.getLinterInfo(execInfo.product!);

        traceError(`There was an error in running the linter ${info.id}`, error);
        traceLog(`Linting with ${info.id} failed.`);
        traceLog(error.toString());

        this.displayLinterError(info.id).ignoreErrors();
        return true;
    }

    private async displayLinterError(linterId: LinterId) {
        const message = l10n.t("There was an error in running the linter '{0}'", linterId);
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const outputChannel = this.serviceContainer.get<ILogOutputChannel>(ILogOutputChannel);
        const action = await appShell.showErrorMessage(message, 'View Errors');
        if (action === 'View Errors') {
            outputChannel.show();
        }
    }
}
