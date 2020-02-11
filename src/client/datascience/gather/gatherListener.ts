import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Position, Uri, ViewColumn } from 'vscode';
import { createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { generateCellsFromString } from '../cellFactory';
import { Identifiers } from '../constants';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import {
    ICell,
    IGatherExecution,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterExecution,
    INotebook,
    INotebookEditorProvider,
    INotebookExporter
} from '../types';
import { GatherLogger } from './gatherLogger';

@injectable()
export class GatherListener implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private gatherLogger: GatherLogger;
    private notebookUri: Uri | undefined;

    constructor(
        @inject(IGatherExecution) private gather: IGatherExecution,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter,
        @inject(INotebookEditorProvider) private ipynbProvider: INotebookEditorProvider,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        this.gatherLogger = new GatherLogger(this.gather, this.configService);
    }

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
                this.handleMessage(message, payload, this.doSetLogger);
                break;

            case InteractiveWindowMessages.GatherCodeRequest:
                this.handleMessage(message, payload, this.doGather);
                break;

            case InteractiveWindowMessages.RestartKernel:
                this.gather.resetLog();
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

    private doSetLogger(payload: string): void {
        this.setLogger(payload).ignoreErrors();
    }

    private async setLogger(notebookUri: string) {
        this.notebookUri = Uri.parse(notebookUri);

        // First get the active server
        const activeServer = await this.jupyterExecution.getServer(
            await this.interactiveWindowProvider.getNotebookOptions()
        );

        let nb: INotebook | undefined;
        // If that works, see if there's a matching notebook running
        if (activeServer) {
            nb = await activeServer.getNotebook(this.notebookUri);

            // If we have an executing notebook, add the gather logger.
            if (nb) {
                nb.addLogger(this.gatherLogger);
            }
        }
    }

    private doGather(payload: ICell): void {
        this.gatherCodeInternal(payload).catch(err => {
            this.applicationShell.showErrorMessage(err);
        });
    }

    private gatherCodeInternal = async (cell: ICell) => {
        const slicedProgram = this.gather.gatherCode(cell);

        if (this.configService.getSettings().datascience.gatherToScript) {
            await this.showFile(slicedProgram, cell.file);
        } else {
            await this.showNotebook(slicedProgram, cell);
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
            const contents = JSON.stringify(notebook);
            await this.ipynbProvider.createNew(contents);
        }
    }

    private async showFile(slicedProgram: string, filename: string) {
        // Don't want to open the gathered code on top of the interactive window
        let viewColumn: ViewColumn | undefined;
        const fileNameMatch = this.documentManager.visibleTextEditors.filter(textEditor =>
            this.fileSystem.arePathsSame(textEditor.document.fileName, filename)
        );
        const definedVisibleEditors = this.documentManager.visibleTextEditors.filter(
            textEditor => textEditor.viewColumn !== undefined
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
            content: slicedProgram,
            language: PYTHON_LANGUAGE
        });
        const editor = await this.documentManager.showTextDocument(doc, viewColumn);

        // Edit the document so that it is dirty (add a space at the end)
        editor.edit(editBuilder => {
            editBuilder.insert(new Position(editor.document.lineCount, 0), '\n');
        });
    }
}
