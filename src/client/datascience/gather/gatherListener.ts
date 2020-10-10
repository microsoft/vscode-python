import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import * as uuid from 'uuid/v4';
import { env, Event, EventEmitter, Position, UIKind, Uri, ViewColumn } from 'vscode';
import { createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceError } from '../../common/logger';

import type { nbformat } from '@jupyterlab/coreutils';
import { IConfigurationService, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { generateCellsFromString } from '../cellFactory';
import { Identifiers, Telemetry } from '../constants';
import {
    IInteractiveWindowMapping,
    INotebookIdentity,
    InteractiveWindowMessages
} from '../interactive-common/interactiveWindowTypes';
import {
    ICell,
    IDataScienceFileSystem,
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
    private linesSubmitted: number = 0;
    private cellsSubmitted: number = 0;

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter,
        @inject(INotebookEditorProvider) private ipynbProvider: INotebookEditorProvider,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDataScienceFileSystem) private fs: IDataScienceFileSystem
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
                this.postEmitter.fire({
                    message: InteractiveWindowMessages.Gathering,
                    payload: { cellId: payload.id, gathering: true }
                });
                this.handleMessage(message, payload, this.doGather);
                break;

            case InteractiveWindowMessages.GatherCodeToScript:
                this.postEmitter.fire({
                    message: InteractiveWindowMessages.Gathering,
                    payload: { cellId: payload.id, gathering: true }
                });
                this.handleMessage(message, payload, this.doGatherToScript);
                break;

            case InteractiveWindowMessages.RestartKernel:
                this.linesSubmitted = 0;
                this.cellsSubmitted = 0;
                if (this.gatherProvider) {
                    try {
                        this.gatherProvider.resetLog();
                    } catch (e) {
                        traceError('Gather: Exception at Reset Log', e);
                        sendTelemetryEvent(Telemetry.GatherException, undefined, { exceptionType: 'reset' });
                    }
                }
                break;

            case InteractiveWindowMessages.FinishCell:
                const cell = payload.cell as ICell;
                if (cell && cell.data && cell.data.source) {
                    const lineCount: number = cell.data.source.length as number;
                    this.linesSubmitted += lineCount;
                    this.cellsSubmitted += 1;
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

    private doInitGather(payload: INotebookIdentity & { owningResource: Resource }): void {
        this.initGather(payload).ignoreErrors();
    }

    private async initGather(identity: INotebookIdentity & { owningResource: Resource }) {
        this.notebookUri = identity.resource;

        const nb = await this.notebookProvider.getOrCreateNotebook({ identity: this.notebookUri, getOnly: true });
        // If we have an executing notebook, get its gather execution service.
        if (nb) {
            this.gatherProvider = this.getGatherProvider(nb);
        }
    }

    private getGatherProvider(nb: INotebook): any | undefined {
        const gatherLogger = <IGatherLogger>(
            nb.getLoggers().find((logger: INotebookExecutionLogger) => (<IGatherLogger>logger).getGatherProvider)
        );

        if (gatherLogger) {
            return gatherLogger.getGatherProvider();
        }
    }

    private doGather(payload: ICell): Promise<void> {
        return this.gatherCodeInternal(payload)
            .catch((err) => {
                traceError(`Gather to Notebook error: ${err}`);
                this.applicationShell.showErrorMessage(err);
            })
            .finally(() =>
                this.postEmitter.fire({
                    message: InteractiveWindowMessages.Gathering,
                    payload: { cellId: payload.id, gathering: false }
                })
            );
    }

    private doGatherToScript(payload: ICell): Promise<void> {
        return this.gatherCodeInternal(payload, true)
            .catch((err) => {
                traceError(`Gather to Script error: ${err}`);
                this.applicationShell.showErrorMessage(err);
            })
            .finally(() =>
                this.postEmitter.fire({
                    message: InteractiveWindowMessages.Gathering,
                    payload: { cellId: payload.id, gathering: false }
                })
            );
    }

    private gatherCodeInternal = async (cell: ICell, toScript: boolean = false) => {
        this.gatherTimer = new StopWatch();
        let slicedProgram: string | undefined;

        try {
            slicedProgram = this.gatherProvider
                ? this.gatherProvider.gatherCode(cell)
                : localize.DataScience.gatherError();
        } catch (e) {
            traceError('Gather: Exception at gatherCode', e);
            sendTelemetryEvent(Telemetry.GatherException, undefined, { exceptionType: 'gather' });
            const newline = '\n';
            const defaultCellMarker =
                this.configService.getSettings().datascience.defaultCellMarker || Identifiers.DefaultCodeCellMarker;
            slicedProgram = defaultCellMarker + newline + localize.DataScience.gatherError() + newline + (e as string);
        }

        if (!slicedProgram) {
            sendTelemetryEvent(Telemetry.GatherCompleted, this.gatherTimer?.elapsedTime, { result: 'err' });
        } else {
            const gatherToScript: boolean = this.configService.getSettings().datascience.gatherToScript || toScript;

            if (gatherToScript) {
                await this.showFile(slicedProgram, cell.file);
                sendTelemetryEvent(Telemetry.GatherCompleted, this.gatherTimer?.elapsedTime, { result: 'script' });
            } else {
                await this.showNotebook(slicedProgram, cell);
                sendTelemetryEvent(Telemetry.GatherCompleted, this.gatherTimer?.elapsedTime, {
                    result: 'notebook'
                });
            }

            sendTelemetryEvent(Telemetry.GatherStats, undefined, {
                linesSubmitted: this.linesSubmitted,
                cellsSubmitted: this.cellsSubmitted,
                linesGathered: slicedProgram.trim().splitLines().length,
                cellsGathered: generateCellsFromString(slicedProgram).length
            });
        }
    };

    private async showNotebook(slicedProgram: string, cell: ICell) {
        if (slicedProgram) {
            const file =
                cell.file === Identifiers.EmptyFileName && this.notebookUri ? this.notebookUri.fsPath : cell.file;

            const data =
                env.uiKind === UIKind?.Web
                    ? createMarkdownCell(
                          localize.DataScience.gatheredNotebookDescriptionInMarkdownWithoutSurvey().format(file)
                      )
                    : createMarkdownCell(localize.DataScience.gatheredNotebookDescriptionInMarkdown().format(file));

            let cells: ICell[] = [
                {
                    id: uuid(),
                    file: '',
                    line: 0,
                    state: 0,
                    data
                }
            ];

            // Create new notebook with the returned program and open it.
            cells = cells.concat(generateCellsFromString(slicedProgram));

            // Try to get a kernelspec
            let kernelspec: nbformat.IKernelspecMetadata | undefined;
            try {
                const text = await this.fs.readLocalFile(file);
                const json = JSON.parse(text);
                kernelspec = json.metadata.kernelspec;
            } catch (e) {
                traceError('Gather: No kernelspec found', e);
            }

            const notebook = await this.jupyterExporter.translateToNotebook(cells, undefined, kernelspec);
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

        const annotatedScript =
            env?.uiKind === UIKind?.Web
                ? `${localize.DataScience.gatheredScriptDescriptionWithoutSurvey()}${defaultCellMarker}\n${slicedProgram}`
                : `${localize.DataScience.gatheredScriptDescription()}${defaultCellMarker}\n${slicedProgram}`;

        // Don't want to open the gathered code on top of the interactive window
        let viewColumn: ViewColumn | undefined;
        const fileNameMatch = this.documentManager.visibleTextEditors.filter((textEditor) =>
            this.fs.areLocalPathsSame(textEditor.document.fileName, filename)
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
