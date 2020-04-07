import { inject, injectable } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { CancellationToken, TextDocument, Uri, WorkspaceEdit } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../common/application/types';
import { Commands, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { traceError } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import * as internalScripts from '../common/process/internal/scripts';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types';
import { IConfigurationService, IDisposableRegistry, IEditorUtils, IOutputChannel } from '../common/types';
import { noop } from '../common/utils/misc';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ISortImportsEditingProvider } from './types';

async function withRealFile<T>(
    document: TextDocument,
    fs: IFileSystem,
    useFile: (filename: string) => Promise<T>
): Promise<[string, T]> {
    const filename = document.uri.fsPath;
    const text = document.getText();
    if (document.isDirty) {
        const tmpFile = await fs.createTemporaryFile(path.extname(filename));
        try {
            await fs.writeFile(tmpFile.filePath, text);
            const result = await useFile(tmpFile.filePath);
            return [text, result];
        } finally {
            tmpFile.dispose();
        }
    } else {
        const result = await useFile(filename);
        return [text, result];
    }
}

@injectable()
export class SortImportsEditingProvider implements ISortImportsEditingProvider {
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly pythonExecutionFactory: IPythonExecutionFactory;
    private readonly shell: IApplicationShell;
    private readonly documentManager: IDocumentManager;
    private readonly configurationService: IConfigurationService;
    private readonly editorUtils: IEditorUtils;
    public constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.shell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.pythonExecutionFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.editorUtils = serviceContainer.get<IEditorUtils>(IEditorUtils);
    }

    @captureTelemetry(EventName.FORMAT_SORT_IMPORTS)
    public async provideDocumentSortImportsEdits(
        uri: Uri,
        token?: CancellationToken
    ): Promise<WorkspaceEdit | undefined> {
        const document = await this.documentManager.openTextDocument(uri);
        if (!document) {
            return;
        }
        if (document.lineCount <= 1) {
            return;
        }

        const execIsort = await this.getExecIsort(document, uri, token);

        // isort does have the ability to read from the process input stream and return the formatted code out of the output stream.
        // However they don't support returning the diff of the formatted text when reading data from the input stream.
        // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension cpu, i.e. less responsive solution.
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const [text, diffPatch] = await withRealFile(document, fs, async (filename: string) => {
            if (token && token.isCancellationRequested) {
                return;
            }

            return execIsort(filename);
        });
        return diffPatch ? this.editorUtils.getWorkspaceEditsFromPatch(text, diffPatch, document.uri) : undefined;
    }

    public registerCommands() {
        const cmdManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposable = cmdManager.registerCommand(Commands.Sort_Imports, this.sortImports, this);
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(disposable);
    }

    public async sortImports(uri?: Uri): Promise<void> {
        if (!uri) {
            const activeEditor = this.documentManager.activeTextEditor;
            if (!activeEditor || activeEditor.document.languageId !== PYTHON_LANGUAGE) {
                this.shell.showErrorMessage('Please open a Python file to sort the imports.').then(noop, noop);
                return;
            }
            uri = activeEditor.document.uri;
        }

        const document = await this.documentManager.openTextDocument(uri);
        if (document.lineCount <= 1) {
            return;
        }

        // Hack, if the document doesn't contain an empty line at the end, then add it
        // Else the library strips off the last line
        const lastLine = document.lineAt(document.lineCount - 1);
        if (lastLine.text.trim().length > 0) {
            const edit = new WorkspaceEdit();
            edit.insert(uri, lastLine.range.end, EOL);
            await this.documentManager.applyEdit(edit);
        }

        try {
            const changes = await this.provideDocumentSortImportsEdits(uri);
            if (!changes || changes.entries().length === 0) {
                return;
            }
            await this.documentManager.applyEdit(changes);
        } catch (error) {
            const message = typeof error === 'string' ? error : error.message ? error.message : error;
            const outputChannel = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
            outputChannel.appendLine(error);
            traceError(`Failed to format imports for '${uri.fsPath}'.`, error);
            this.shell.showErrorMessage(message).then(noop, noop);
        }
    }

    private async getExecIsort(document: TextDocument, uri: Uri, token?: CancellationToken) {
        const settings = this.configurationService.getSettings(uri);
        const _isort = settings.sortImports.path;
        const isort = typeof _isort === 'string' && _isort.length > 0 ? _isort : undefined;
        const isortArgs = settings.sortImports.args;

        if (isort) {
            const procService = await this.processServiceFactory.create(document.uri);
            // Use isort directly instead of the internal script.
            return async (filename: string) => {
                const args = getIsortArgs(filename, isortArgs);
                const proc = await procService.exec(isort, args, { throwOnStdErr: true, token });
                return proc.stdout;
            };
        } else {
            const procService = await this.pythonExecutionFactory.create({ resource: document.uri });
            return async (filename: string) => {
                const [args, parse] = internalScripts.sortImports(filename, isortArgs);
                const proc = await procService.exec(args, { throwOnStdErr: true, token });
                return parse(proc.stdout);
            };
        }
    }
}

function getIsortArgs(filename: string, extraArgs?: string[]): string[] {
    // We could just adapt internalScripts.sortImports().  However,
    // the following is simpler and the alternative doesn't offer
    // any signficant benefit.
    const args = [filename, '--diff'];
    if (extraArgs) {
        args.push(...extraArgs);
    }
    return args;
}
