import { inject, injectable } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { CancellationToken, Uri, WorkspaceEdit } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../common/application/types';
import { Commands, EXTENSION_ROOT_DIR, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { traceError } from '../common/logger';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types';
import { IConfigurationService, IDisposableRegistry, IEditorUtils, IOutputChannel } from '../common/types';
import { noop } from '../common/utils/misc';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ISortImportsEditingProvider } from './types';

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
        const importScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py');
        const settings = this.configurationService.getSettings(uri);
        const isort = settings.sortImports.path;
        let diffPatch: string;

        // We pass the content of the file to be sorted via stdin. This avoids
        // saving the file (as well as a potential temporary file), but does
        // mean that we need another way to tell `isort` where to look for
        // configuration. We do that by setting the working directory to the
        // directory which contains the file.
        const args = ['-', '--diff'].concat(settings.sortImports.args);
        const spawnOptions = {
            token,
            throwOnStdErr: true,
            input: document.getText(),
            cwd: path.dirname(uri.fsPath)
        };

        if (token && token.isCancellationRequested) {
            return;
        }

        if (typeof isort === 'string' && isort.length > 0) {
            // Lets just treat this as a standard tool.
            const processService = await this.processServiceFactory.create(document.uri);
            diffPatch = (await processService.exec(isort, args, spawnOptions)).stdout;
        } else {
            const processExeService = await this.pythonExecutionFactory.create({ resource: document.uri });
            diffPatch = (await processExeService.exec([importScript].concat(args), spawnOptions)).stdout;
        }

        return this.editorUtils.getWorkspaceEditsFromPatch(document.getText(), diffPatch, document.uri);
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
}
