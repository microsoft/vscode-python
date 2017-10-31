'use strict';
import { OutputChannel, Uri } from 'vscode';
import { Installer, Product } from '../../common/installer';
import { InvalidArgumentsErrorHandler } from './invalidArgs';
import { NotInstalledErrorHandler } from './notInstalled';
import { StandardErrorHandler } from './standard';

export class ErrorHandler {
    // tslint:disable-next-line:variable-name
    private _errorHandlers: StandardErrorHandler[] = [];
    constructor(protected id: string, protected product: Product, protected installer: Installer, protected outputChannel: OutputChannel) {
        this._errorHandlers = [
            new InvalidArgumentsErrorHandler(this.id, this.product, this.installer, this.outputChannel),
            new NotInstalledErrorHandler(this.id, this.product, this.installer, this.outputChannel),
            new StandardErrorHandler(this.id, this.product, this.installer, this.outputChannel)
        ];
    }

    public handleError(expectedFileName: string, fileName: string, error: Error, resource: Uri) {
        this._errorHandlers.some(handler => handler.handleError(expectedFileName, fileName, error, resource));
    }
}
