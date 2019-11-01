import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { generateCellsFromString } from '../cellFactory';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { ICell, IGatherExecution, IInteractiveWindowListener, IInteractiveWindowProvider, IJupyterExecution, INotebook, INotebookEditorProvider, INotebookExporter } from '../types';
import { GatherLogger } from './gatherLogger';

@injectable()
export class GatherListener implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    private gatherLogger: GatherLogger;

    constructor(
        @inject(IGatherExecution) private gather: IGatherExecution,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter,
        @inject(INotebookEditorProvider) private ipynbProvider: INotebookEditorProvider,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IConfigurationService) private configService: IConfigurationService

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

    // tslint:disable:no-any
    private handleMessage<M extends IInteractiveWindowMapping, T extends keyof M>(_message: T, payload: any, handler: (args: M[T]) => void) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    private doSetLogger(payload: Uri): void {
        this.setLogger(payload).ignoreErrors();
    }

    private async setLogger(notebookUri: Uri) {
        // First get the active server
        const activeServer = await this.jupyterExecution.getServer(await this.interactiveWindowProvider.getNotebookOptions());

        let nb: INotebook | undefined;
        // If that works, see if there's a matching notebook running
        if (activeServer) {
            nb = await activeServer.getNotebook(notebookUri);

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
        if (slicedProgram) {
            let cells: ICell[] = [{
                id: uuid(),
                file: '',
                line: 0,
                state: 0,
                data: {
                    cell_type: 'markdown',
                    source: localize.DataScience.gatheredNotebookDescriptionInMarkdown(),
                    metadata: {}
                }
            }];

            // Create new notebook with the returned program and open it.
            cells = cells.concat(generateCellsFromString(slicedProgram));

            const notebook = await this.jupyterExporter.translateToNotebook(cells);
            const contents = JSON.stringify(notebook);
            await this.ipynbProvider.createNew(contents);
        }
    }
}
