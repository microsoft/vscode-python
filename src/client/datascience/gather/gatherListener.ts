import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Position, Uri, ViewColumn } from 'vscode';
import { createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { generateCellsFromString } from '../cellFactory';
import { Identifiers, Telemetry } from '../constants';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import {
    ICell,
    IGatherLogger,
    IGatherProvider,
    IInteractiveWindowListener,
    INotebook,
    INotebookEditorProvider,
    INotebookExecutionLogger,
    INotebookExporter,
    INotebookProvider
} from '../types';

@injectable()
export class GatherListener implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private notebookUri: Uri | undefined;
    private gatherProvider: IGatherProvider | undefined;
    private gatherTimer: StopWatch | undefined;

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter,
        @inject(INotebookEditorProvider) private ipynbProvider: INotebookEditorProvider,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {}

    public dispose() {
        noop();
    }

    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.NotebookExecutionActivated:
                this.handleMessage(message, payload, this.doInitGather);
                break;

            case InteractiveWindowMessages.GatherCode:
                this.handleMessage(message, payload, this.doGather);
                break;

            case InteractiveWindowMessages.GatherCodeToScript:
                this.handleMessage(message, payload, this.doGatherToScript);
                break;

            case InteractiveWindowMessages.RestartKernel:
                if (this.gatherProvider) {
                    this.gatherProvider.resetLog();
                }
                break;

            default:
                break;
        }
    }

    private handleMessage<M extends IInteractiveWindowMapping, T extends keyof M>(
        _message: T,
        // tslint:disable:no-any
        payload: any,
        handler: (args: M[T]) => void
    ) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    private doInitGather(payload: string): void {
        this.initGather(payload).ignoreErrors();
    }

    private async initGather(notebookUri: string) {
        this.notebookUri = Uri.parse(notebookUri);

        const nb = await this.notebookProvider.getOrCreateNotebook({ identity: this.notebookUri, getOnly: true });
        // If we have an executing notebook, get its gather execution service.
        if (nb) {
            this.gatherProvider = this.getGatherProvider(nb);
        }
    }

    private getGatherProvider(nb: INotebook): IGatherProvider | undefined {
        const gatherLogger = <IGatherLogger>(
            nb.getLoggers().find((logger: INotebookExecutionLogger) => (<IGatherLogger>logger).getGatherProvider)
        );

        if (gatherLogger) {
            return gatherLogger.getGatherProvider();
        }
    }

    private doGather(payload: ICell): void {
        this.gatherCodeInternal(payload).catch((err) => {
            traceError(`Gather to Notebook error: ${err}`);
            this.applicationShell.showErrorMessage(err);
        });
    }

    private doGatherToScript(payload: ICell): void {
        this.gatherCodeInternal(payload, true).catch((err) => {
            traceError(`Gather to Script error: ${err}`);
            this.applicationShell.showErrorMessage(err);
        });
    }

    private gatherCodeInternal = async (cell: ICell, toScript: boolean = false) => {
        this.gatherTimer = new StopWatch();

        const slicedProgram = this.gatherProvider ? this.gatherProvider.gatherCode(cell) : 'Gather internal error';

        if (!slicedProgram) {
            sendTelemetryEvent(Telemetry.GatherCompleted, this.gatherTimer?.elapsedTime, { result: 'err' });
        } else {
            const gatherToScript: boolean = this.configService.getSettings().datascience.gatherToScript || toScript;

            if (gatherToScript) {
                await this.showFile(slicedProgram, cell.file);
                sendTelemetryEvent(Telemetry.GatherCompleted, this.gatherTimer?.elapsedTime, { result: 'script' });
            } else {
                await this.showNotebook(slicedProgram, cell);
                sendTelemetryEvent(Telemetry.GatherCompleted, this.gatherTimer?.elapsedTime, { result: 'notebook' });
            }
        }
    };

    private async showNotebook(slicedProgram: string, cell: ICell) {
        if (slicedProgram) {
            let cells: ICell[] = [
                {
                    id: uuid(),
                    file: '',
                    line: 0,
                    state: 0,
                    data: createMarkdownCell(
                        localize.DataScience.gatheredNotebookDescriptionInMarkdown().format(
                            cell.file === Identifiers.EmptyFileName && this.notebookUri
                                ? this.notebookUri.fsPath
                                : cell.file
                        )
                    )
                }
            ];

            // Create new notebook with the returned program and open it.
            cells = cells.concat(generateCellsFromString(slicedProgram));

            const notebook = await this.jupyterExporter.translateToNotebook(cells);
            if (notebook) {
                const contents = JSON.stringify(notebook);
                const editor = await this.ipynbProvider.createNew(contents);

                let disposableNotebookSaved: IDisposable;
                let disposableNotebookClosed: IDisposable;

                const savedHandler = () => {
                    sendTelemetryEvent(Telemetry.GatheredNotebookSaved);
                    if (disposableNotebookSaved) {
                        disposableNotebookSaved.dispose();
                    }
                    if (disposableNotebookClosed) {
                        disposableNotebookClosed.dispose();
                    }
                };

                const closedHandler = () => {
                    if (disposableNotebookSaved) {
                        disposableNotebookSaved.dispose();
                    }
                    if (disposableNotebookClosed) {
                        disposableNotebookClosed.dispose();
                    }
                };

                disposableNotebookSaved = editor.saved(savedHandler);
                disposableNotebookClosed = editor.closed(closedHandler);
            }
        }
    }

    private async showFile(slicedProgram: string, filename: string) {
        const defaultCellMarker =
            this.configService.getSettings().datascience.defaultCellMarker || Identifiers.DefaultCodeCellMarker;

        if (slicedProgram) {
            // Remove all cell definitions and newlines
            const re = new RegExp(`^(${defaultCellMarker}.*|\\s*)\n`, 'gm');
            slicedProgram = slicedProgram.replace(re, '');
        }

        const annotatedScript = `${localize.DataScience.gatheredScriptDescription()}${defaultCellMarker}\n${slicedProgram}`;

        // Don't want to open the gathered code on top of the interactive window
        let viewColumn: ViewColumn | undefined;
        const fileNameMatch = this.documentManager.visibleTextEditors.filter((textEditor) =>
            this.fileSystem.arePathsSame(textEditor.document.fileName, filename)
        );
        const definedVisibleEditors = this.documentManager.visibleTextEditors.filter(
            (textEditor) => textEditor.viewColumn !== undefined
        );
        if (this.documentManager.visibleTextEditors.length > 0 && fileNameMatch.length > 0) {
            // Original file is visible
            viewColumn = fileNameMatch[0].viewColumn;
        } else if (this.documentManager.visibleTextEditors.length > 0 && definedVisibleEditors.length > 0) {
            // There is a visible text editor, just not the original file. Make sure viewColumn isn't undefined
            viewColumn = definedVisibleEditors[0].viewColumn;
        } else {
            // Only one panel open and interactive window is occupying it, or original file is open but hidden
            viewColumn = ViewColumn.Beside;
        }

        // Create a new open editor with the returned program in the right panel
        const doc = await this.documentManager.openTextDocument({
            content: annotatedScript,
            language: PYTHON_LANGUAGE
        });
        const editor = await this.documentManager.showTextDocument(doc, viewColumn);

        // Edit the document so that it is dirty (add a space at the end)
        editor.edit((editBuilder) => {
            editBuilder.insert(new Position(editor.document.lineCount, 0), '\n');
        });
    }
}
