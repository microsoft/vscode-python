import * as path from 'path';
import * as vscode from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import '../common/extensions';
import { isNotInstalledError } from '../common/helpers';
import { IFileSystem } from '../common/platform/types';
import { IPythonToolExecutionService } from '../common/process/types';
import { IDisposableRegistry, IInstaller, Product } from '../common/types';
import { isNotebookCell } from '../common/utils/misc';
import { IServiceContainer } from '../ioc/types';
import { traceError } from '../logging';
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from './../common/editor';
import { IFormatterHelper } from './types';
import { IInstallFormatterPrompt } from '../providers/prompts/types';

export abstract class BaseFormatter {
    protected readonly workspace: IWorkspaceService;
    private readonly helper: IFormatterHelper;
    private errorShown: boolean = false;

    constructor(public Id: string, private product: Product, protected serviceContainer: IServiceContainer) {
        this.helper = serviceContainer.get<IFormatterHelper>(IFormatterHelper);
        this.workspace = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public abstract formatDocument(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken,
        range?: vscode.Range,
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
        cwd?: string,
    ): Promise<vscode.TextEdit[]> {
        if (typeof cwd !== 'string' || cwd.length === 0) {
            cwd = this.getWorkspaceUri(document).fsPath;
        }

        // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
        // However they don't support returning the diff of the formatted text when reading data from the input stream.
        // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
        // Also, always create temp files for Notebook cells.
        const tempFile = await this.createTempFile(document);
        if (this.checkCancellation(document.fileName, tempFile, token)) {
            return [];
        }

        const executionInfo = this.helper.getExecutionInfo(this.product, args, document.uri);
        executionInfo.args.push(tempFile);
        const pythonToolsExecutionService = this.serviceContainer.get<IPythonToolExecutionService>(
            IPythonToolExecutionService,
        );
        const promise = pythonToolsExecutionService
            .exec(executionInfo, { cwd, throwOnStdErr: false, token }, document.uri)
            .then((output) => output.stdout)
            .then((data) => {
                if (this.checkCancellation(document.fileName, tempFile, token)) {
                    return [] as vscode.TextEdit[];
                }
                return getTextEditsFromPatch(document.getText(), data);
            })
            .catch((error) => {
                if (this.checkCancellation(document.fileName, tempFile, token)) {
                    return [] as vscode.TextEdit[];
                }

                this.handleError(this.Id, error, document.uri).catch(() => {});
                return [] as vscode.TextEdit[];
            })
            .then((edits) => {
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
        if (isNotInstalledError(error)) {
            const prompt = this.serviceContainer.get<IInstallFormatterPrompt>(IInstallFormatterPrompt);
            if (!(await prompt.showInstallFormatterPrompt(resource))) {
                const installer = this.serviceContainer.get<IInstaller>(IInstaller);
                const isInstalled = await installer.isInstalled(this.product, resource);
                if (!isInstalled && !this.errorShown) {
                    traceError(
                        `\nPlease install '${this.Id}' into your environment.`,
                        "\nIf you don't want to use it you can turn it off or use another formatter in the settings.",
                    );
                    this.errorShown = true;
                }
            }
        }

        traceError(`Formatting with ${this.Id} failed:\n${error}`);
    }

    /**
     * Always create a temporary file when formatting notebook cells.
     * This is because there is no physical file associated with notebook cells (they are all virtual).
     */
    private async createTempFile(document: vscode.TextDocument): Promise<string> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        return document.isDirty || isNotebookCell(document)
            ? getTempFileWithDocumentContents(document, fs)
            : document.fileName;
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
