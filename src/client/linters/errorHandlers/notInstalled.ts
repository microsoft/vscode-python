'use strict';
import { Uri } from 'vscode';
import { isNotInstalledError } from '../../common/helpers';
import { StandardErrorHandler } from './standard';

export class NotInstalledErrorHandler extends StandardErrorHandler {
    public handleError(expectedFileName: string, fileName: string, error: Error, resource?: Uri): boolean {
        if (!isNotInstalledError(error)) {
            return false;
        }

        this.installer.promptToInstall(this.product, resource)
            .catch(ex => console.error('Python Extension: NotInstalledErrorHandler.promptToInstall', ex));
        const customError = `Linting with ${this.id} failed.\nYou could either install the '${this.id}' linter or turn it off in setings.json via "python.linting.${this.id}Enabled = false".`;
        this.outputChannel.appendLine(`\n${customError}\n${error + ''}`);
        return true;
    }
}
