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
        if (info.id === LinterId.PyLint) {
            traceError('Support for "pylint" is moved to ms-python.pylint extension.');
            traceError(
                'Please install the extension from: https://marketplace.visualstudio.com/items?itemName=ms-python.pylint',
            );
        } else if (info.id === LinterId.Flake8) {
            traceError('Support for "flake8" is moved to ms-python.flake8 extension.');
            traceError(
                'Please install the extension from: https://marketplace.visualstudio.com/items?itemName=ms-python.flake8',
            );
        } else if (info.id === LinterId.MyPy) {
            traceError('Support for "mypy" is moved to ms-python.mypy-type-checker extension.');
            traceError(
                'Please install the extension from: https://marketplace.visualstudio.com/items?itemName=ms-python.mypy-type-checker',
            );
        }
        traceError(`If the error is due to missing ${info.id}, please install ${info.id} using pip manually.`);
        traceError('Learn more here: https://aka.ms/AAlgvkb');
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
