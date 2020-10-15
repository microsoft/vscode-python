import { inject, injectable } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { CancellationToken, CancellationTokenSource, TextDocument, Uri, WorkspaceEdit } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../common/application/types';
import { Commands, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { traceError } from '../common/logger';
import * as internalScripts from '../common/process/internal/scripts';
import { IProcessServiceFactory, IPythonExecutionFactory, ObservableExecutionResult } from '../common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IEditorUtils,
    IOutputChannel,
    IPersistentStateFactory
} from '../common/types';
import { createDeferred, createDeferredFromPromise, Deferred } from '../common/utils/async';
import { Common, Diagnostics } from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ISortImportsEditingProvider } from './types';

const doNotDisplayPromptStateKey = 'ISORT5_UPGRADE_WARNING_KEY';

@injectable()
export class SortImportsEditingProvider implements ISortImportsEditingProvider {
    private readonly isortPromises = new Map<
        string,
        { deferred: Deferred<WorkspaceEdit | undefined>; tokenSource: CancellationTokenSource }
    >();
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly pythonExecutionFactory: IPythonExecutionFactory;
    private readonly shell: IApplicationShell;
    private readonly persistentStateFactory: IPersistentStateFactory;
    private readonly documentManager: IDocumentManager;
    private readonly configurationService: IConfigurationService;
    private readonly editorUtils: IEditorUtils;
    private readonly output: IOutputChannel;

    public constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.shell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.pythonExecutionFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.editorUtils = serviceContainer.get<IEditorUtils>(IEditorUtils);
        this.output = serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.persistentStateFactory = serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
    }

    @captureTelemetry(EventName.FORMAT_SORT_IMPORTS)
    public async provideDocumentSortImportsEdits(uri: Uri): Promise<WorkspaceEdit | undefined> {
        if (this.isortPromises.has(uri.fsPath)) {
            const isortPromise = this.isortPromises.get(uri.fsPath)!;
            if (!isortPromise.deferred.completed) {
                // Cancelling the token will kill the previous isort process & discard its result.
                isortPromise.tokenSource.cancel();
            }
        }
        const tokenSource = new CancellationTokenSource();
        const promise = this._provideDocumentSortImportsEdits(uri, tokenSource.token);
        const deferred = createDeferredFromPromise(promise);
        this.isortPromises.set(uri.fsPath, { deferred, tokenSource });
        // If token has been cancelled discard the result.
        return promise.then((edit) => (tokenSource.token.isCancellationRequested ? undefined : edit));
    }

    public async _provideDocumentSortImportsEdits(
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
        if (token && token.isCancellationRequested) {
            return;
        }
        const diffPatch = await execIsort(document.getText());

        return diffPatch
            ? this.editorUtils.getWorkspaceEditsFromPatch(document.getText(), diffPatch, document.uri)
            : undefined;
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

    public async _showWarningAndOptionallyShowOutput() {
        const neverShowAgain = this.persistentStateFactory.createGlobalPersistentState(
            doNotDisplayPromptStateKey,
            false
        );
        if (neverShowAgain.value) {
            return;
        }
        const selection = await this.shell.showWarningMessage(
            Diagnostics.checkIsort5UpgradeGuide(),
            Common.openOutputPanel(),
            Common.doNotShowAgain()
        );
        if (selection === Common.openOutputPanel()) {
            this.output.show(true);
        } else if (selection === Common.doNotShowAgain()) {
            await neverShowAgain.updateValue(true);
        }
    }

    private async getExecIsort(
        document: TextDocument,
        uri: Uri,
        token?: CancellationToken
    ): Promise<(documentText: string) => Promise<string>> {
        const settings = this.configurationService.getSettings(uri);
        const _isort = settings.sortImports.path;
        const isort = typeof _isort === 'string' && _isort.length > 0 ? _isort : undefined;
        const isortArgs = settings.sortImports.args;

        // We pass the content of the file to be sorted via stdin. This avoids
        // saving the file (as well as a potential temporary file), but does
        // mean that we need another way to tell `isort` where to look for
        // configuration. We do that by setting the working directory to the
        // directory which contains the file.
        const filename = '-';

        const spawnOptions = {
            token,
            cwd: path.dirname(uri.fsPath)
        };

        if (isort) {
            const procService = await this.processServiceFactory.create(document.uri);
            // Use isort directly instead of the internal script.
            return async (documentText: string) => {
                const args = getIsortArgs(filename, isortArgs);
                const result = procService.execObservable(isort, args, spawnOptions);
                return this.communicateWithIsortProcess(result, documentText);
            };
        } else {
            const procService = await this.pythonExecutionFactory.create({ resource: document.uri });
            return async (documentText: string) => {
                const [args, parse] = internalScripts.sortImports(filename, isortArgs);
                const result = procService.execObservable(args, spawnOptions);
                return parse(await this.communicateWithIsortProcess(result, documentText));
            };
        }
    }

    private async communicateWithIsortProcess(
        observableResult: ObservableExecutionResult<string>,
        inputText: string
    ): Promise<string> {
        // Configure our listening to the output from isort ...
        let outputBuffer = '';
        let isAnyErrorRelatedToUpgradeGuide = false;
        const isortOutput = createDeferred<string>();
        observableResult.out.subscribe({
            next: (output) => {
                if (output.source === 'stdout') {
                    outputBuffer += output.out;
                } else {
                    // All the W0500 warning codes point to isort5 upgrade guide: https://pycqa.github.io/isort/docs/warning_and_error_codes/W0500/
                    // Do not throw error on these types of stdErrors
                    isAnyErrorRelatedToUpgradeGuide = isAnyErrorRelatedToUpgradeGuide || output.out.includes('W050');
                    traceError(output.out);
                    if (!output.out.includes('W050')) {
                        isortOutput.reject(output.out);
                    }
                }
            },
            complete: () => {
                isortOutput.resolve(outputBuffer);
            }
        });

        // ... then send isort the document content ...
        observableResult.proc?.stdin.write(inputText);
        observableResult.proc?.stdin.end();

        // .. and finally wait for isort to do its thing
        await isortOutput.promise;

        if (isAnyErrorRelatedToUpgradeGuide) {
            this._showWarningAndOptionallyShowOutput().ignoreErrors();
        }
        return outputBuffer;
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
