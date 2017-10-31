'use strict';
import { OutputChannel, Uri, window } from 'vscode';
import { Installer, Product } from '../../common/installer';

export class StandardErrorHandler {
    constructor(protected id: string, protected product: Product, protected installer: Installer, protected outputChannel: OutputChannel) {

    }
    private displayLinterError(resource: Uri) {
        const message = `There was an error in running the linter '${this.id}'`;
        window.showErrorMessage(message, 'Disable linter', 'View Errors').then(item => {
            switch (item) {
                case 'Disable linter': {
                    this.installer.disableLinter(this.product, resource);
                    break;
                }
                case 'View Errors': {
                    this.outputChannel.show();
                    break;
                }
            }
        });
    }

    public handleError(expectedFileName: string, fileName: string, error: Error, resource: Uri): boolean {
        if (typeof error === 'string' && (error as string).indexOf("OSError: [Errno 2] No such file or directory: '/") > 0) {
            return false;
        }
        console.error('There was an error in running the linter');
        console.error(error);

        this.outputChannel.appendLine(`Linting with ${this.id} failed.\n${error + ''}`);
        this.displayLinterError(resource);
        return true;
    }
}
