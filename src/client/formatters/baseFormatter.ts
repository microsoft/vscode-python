import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { OutputChannel, TextEdit, Uri } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { isNotInstalledError } from '../common/helpers';
import { IPythonToolExecutionService } from '../common/process/types';
import { IInstaller, IOutputChannel, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from './../common/editor';
import { IFormatterHelper } from './types';

export abstract class BaseFormatter {
    protected readonly outputChannel: OutputChannel;
    private readonly helper: IFormatterHelper;
    constructor(public Id: string, private product: Product, private serviceContainer: IServiceContainer) {
        this.outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.helper = this.serviceContainer.get<IFormatterHelper>(IFormatterHelper);
    }

    public abstract formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]>;
    protected getDocumentPath(document: vscode.TextDocument, fallbackPath: string) {
        if (path.basename(document.uri.fsPath) === document.uri.fsPath) {
            return fallbackPath;
        }
        return path.dirname(document.fileName);
    }
    protected getWorkspaceUri(document: vscode.TextDocument) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            return workspaceFolder.uri;
        }
        if (Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0].uri;
        }
        return vscode.Uri.file(__dirname);
    }
    protected async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, args: string[], cwd?: string): Promise<vscode.TextEdit[]> {
        this.outputChannel.clear();
        if (typeof cwd !== 'string' || cwd.length === 0) {
            cwd = this.getWorkspaceUri(document).fsPath;
        }

        // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
        // However they don't support returning the diff of the formatted text when reading data from the input stream.
        // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension cpu, i.e. les responsive solution.
        const tmpFileCreated = document.isDirty;
        const filePromise = tmpFileCreated ? getTempFileWithDocumentContents(document) : Promise.resolve(document.fileName);
        const filePath = await filePromise;
        if (token && token.isCancellationRequested) {
            return [];
        }

        const executionInfo = this.helper.getExecutionInfo(this.product, args, document.uri);
        executionInfo.args.push(filePath);
        const pythonToolsExecutionService = this.serviceContainer.get<IPythonToolExecutionService>(IPythonToolExecutionService);
        const promise = pythonToolsExecutionService.exec(executionInfo, { cwd, throwOnStdErr: true, token }, document.uri)
            .then(output => output.stdout)
            .then(data => {
                if (token && token.isCancellationRequested) {
                    return [] as TextEdit[];
                }
                return getTextEditsFromPatch(document.getText(), data);
            })
            .catch(error => {
                if (token && token.isCancellationRequested) {
                    return [] as TextEdit[];
                }
                // tslint:disable-next-line:no-empty
                this.handleError(this.Id, error, document.uri).catch(() => { });
                return [] as TextEdit[];
            })
            .then(edits => {
                // Delete the temporary file created
                if (tmpFileCreated) {
                    fs.unlinkSync(filePath);
                }
                return edits;
            });
        vscode.window.setStatusBarMessage(`Formatting with ${this.Id}`, promise);
        return promise;
    }

    protected async handleError(expectedFileName: string, error: Error, resource?: Uri) {
        let customError = `Formatting with ${this.Id} failed.`;

        if (isNotInstalledError(error)) {
            const installer = this.serviceContainer.get<IInstaller>(IInstaller);
            const isInstalled = await installer.isInstalled(this.product, resource);
            if (!isInstalled) {
                customError += `\nYou could either install the '${this.Id}' formatter, turn it off or use another formatter.`;
                installer.promptToInstall(this.product, resource).catch(ex => console.error('Python Extension: promptToInstall', ex));
            }
        }

        this.outputChannel.appendLine(`\n${customError}\n${error}`);
    }
}
