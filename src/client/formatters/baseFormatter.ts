import * as path from 'path';
import * as vscode from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { isNotInstalledError } from '../common/helpers';
import { traceError } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IPythonToolExecutionService } from '../common/process/types';
import { IDisposableRegistry, IInstaller, IOutputChannel, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from './../common/editor';
import { IFormatterHelper } from './types';

export abstract class BaseFormatter {
    protected readonly outputChannel: vscode.OutputChannel;
    protected readonly workspace: IWorkspaceService;
    private readonly helper: IFormatterHelper;

    constructor(public Id: string, private product: Product, protected serviceContainer: IServiceContainer) {
        this.outputChannel = serviceContainer.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.helper = serviceContainer.get<IFormatterHelper>(IFormatterHelper);
        this.workspace = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public abstract formatDocument(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken,
        range?: vscode.Range
    ): Thenable<vscode.TextEdit[]>;
    protected getDocumentPath(document: vscode.TextDocument, fallbackPath: string) {
        if (path.basename(document.uri.fsPath) === document.uri.fsPath) {
            return fallbackPath;
        }
        return path.dirname(document.fileName);
    }
    protected getWorkspaceUri(document: vscode.TextDocument) {
        const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            return workspaceFolder.uri;
        }
        const folders = this.workspace.workspaceFolders;
        if (Array.isArray(folders) && folders.length > 0) {
            return folders[0].uri;
        }
        return vscode.Uri.file(__dirname);
    }
    protected async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        token: vscode.CancellationToken,
        args: string[],
        cwd?: string
    ): Promise<vscode.TextEdit[]> {
        if (typeof cwd !== 'string' || cwd.length === 0) {
            cwd = this.getWorkspaceUri(document).fsPath;
        }

        // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
        // However they don't support returning the diff of the formatted text when reading data from the input stream.
        // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
        const tempFile = await this.createTempFile(document);
        if (this.checkCancellation(document.fileName, tempFile, token)) {
            return [];
        }

        const executionInfo = this.helper.getExecutionInfo(this.product, args, document.uri);
        executionInfo.args.push(tempFile);
        const pythonToolsExecutionService = this.serviceContainer.get<IPythonToolExecutionService>(IPythonToolExecutionService);
        const promise = pythonToolsExecutionService
            .exec(executionInfo, { cwd, throwOnStdErr: false, token }, document.uri)
            .then(output => output.stdout)
            .then(data => {
                if (this.checkCancellation(document.fileName, tempFile, token)) {
                    return [] as vscode.TextEdit[];
                }
                return getTextEditsFromPatch(document.getText(), data);
            })
            .catch(error => {
                if (this.checkCancellation(document.fileName, tempFile, token)) {
                    return [] as vscode.TextEdit[];
                }
                // tslint:disable-next-line:no-empty
                this.handleError(this.Id, error, document.uri).catch(() => {});
                return [] as vscode.TextEdit[];
            })
            .then(edits => {
                this.deleteTempFile(document.fileName, tempFile).ignoreErrors();
                return edits;
            });

        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const disposableRegistry = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        const disposable = appShell.setStatusBarMessage(`Formatting with ${this.Id}`, promise);
        disposableRegistry.push(disposable);
        return promise;
    }

    protected async handleError(_expectedFileName: string, error: Error, resource?: vscode.Uri) {
        let customError = `Formatting with ${this.Id} failed.`;

        if (isNotInstalledError(error)) {
            const installer = this.serviceContainer.get<IInstaller>(IInstaller);
            const isInstalled = await installer.isInstalled(this.product, resource);
            if (!isInstalled) {
                customError += `\nYou could either install the '${this.Id}' formatter, turn it off or use another formatter.`;
                installer.promptToInstall(this.product, resource).catch(ex => traceError('Python Extension: promptToInstall', ex));
            }
        }

        this.outputChannel.appendLine(`\n${customError}\n${error}`);
    }

    private async createTempFile(document: vscode.TextDocument): Promise<string> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        return document.isDirty ? getTempFileWithDocumentContents(document, fs) : document.fileName;
    }

    private deleteTempFile(originalFile: string, tempFile: string): Promise<void> {
        if (originalFile !== tempFile) {
            const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
            return fs.deleteFile(tempFile);
        }
        return Promise.resolve();
    }

    private checkCancellation(originalFile: string, tempFile: string, token?: vscode.CancellationToken): boolean {
        if (token && token.isCancellationRequested) {
            this.deleteTempFile(originalFile, tempFile).ignoreErrors();
            return true;
        }
        return false;
    }
}
