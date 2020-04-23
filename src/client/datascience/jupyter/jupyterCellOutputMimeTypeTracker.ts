// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import { sha256 } from 'hash.js';
import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { CellState, ICell, INotebookEditor, INotebookEditorProvider, INotebookExecutionLogger } from '../types';
// tslint:disable-next-line:no-require-imports no-var-requires
const flatten = require('lodash/flatten') as typeof import('lodash/flatten');

@injectable()
export class CellOutputMimeTypeTracker implements IExtensionSingleActivationService, INotebookExecutionLogger {
    private pendingChecks = new Map<string, NodeJS.Timer | number>();
    private sentMimeTypes: Set<string> = new Set<string>();

    constructor(@inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider) {
        this.notebookEditorProvider.onDidOpenNotebookEditor((t) => this.onOpenedOrClosedNotebook(t));
    }

    public onKernelRestarted() {
        // Do nothing on restarted
    }
    public async preExecute(_cell: ICell, _silent: boolean): Promise<void> {
        // Do nothing on pre execute
    }
    public async postExecute(cell: ICell, silent: boolean): Promise<void> {
        if (!silent && cell.data.cell_type === 'code') {
            this.scheduleCheck(this.createCellKey(cell), this.checkCell.bind(this, cell));
        }
    }
    public async activate(): Promise<void> {
        // Act like all of our open documents just opened; our timeout will make sure this is delayed.
        this.notebookEditorProvider.editors.forEach((e) => this.onOpenedOrClosedNotebook(e));
    }

    private onOpenedOrClosedNotebook(e: INotebookEditor) {
        if (e.file) {
            this.scheduleCheck(e.file.fsPath, this.checkNotebook.bind(this, e));
        }
    }
    private getCellOutputMimeTypes(cell: ICell): string[] {
        if (cell.data.cell_type === 'markdown') {
            return ['markdown'];
        }
        if (cell.data.cell_type !== 'code') {
            return [];
        }
        if (!Array.isArray(cell.data.outputs)) {
            return [];
        }
        switch (cell.state) {
            case CellState.editing:
            case CellState.error:
            case CellState.executing:
                return [];
            default: {
                return flatten(cell.data.outputs.map(this.getOutputMimeTypes.bind(this)));
            }
        }
    }
    private getOutputMimeTypes(output: nbformat.IOutput): string[] {
        // tslint:disable-next-line: no-any
        const outputType: nbformat.OutputType = output.output_type as any;
        switch (outputType) {
            case 'error':
                return [];
            case 'stream':
                return ['stream'];
            case 'display_data':
            case 'update_display_data':
            case 'execute_result':
                // tslint:disable-next-line: no-any
                const data = (output as any).data;
                return data ? Object.keys(data) : [];
            default:
                // If we have a large number of these, then something is wrong.
                return ['unrecognized_cell_output'];
        }
    }

    private scheduleCheck(id: string, check: () => void) {
        // If already scheduled, cancel.
        const currentTimeout = this.pendingChecks.get(id);
        if (currentTimeout) {
            // tslint:disable-next-line: no-any
            clearTimeout(currentTimeout as any);
            this.pendingChecks.delete(id);
        }

        // Now schedule a new one.
        // Wait five seconds to make sure we don't already have this document pending.
        this.pendingChecks.set(id, setTimeout(check, 5000));
    }

    private createCellKey(cell: ICell): string {
        return `${cell.file}${cell.id}`;
    }

    @captureTelemetry(Telemetry.HashedCellOutputMimeTypePerf)
    private checkCell(cell: ICell) {
        this.pendingChecks.delete(this.createCellKey(cell));
        this.getCellOutputMimeTypes(cell).forEach(this.sendTelemetry.bind(this));
    }

    @captureTelemetry(Telemetry.HashedNotebookCellOutputMimeTypePerf)
    private checkNotebook(e: INotebookEditor) {
        this.pendingChecks.delete(e.file.fsPath);
        e.model?.cells.forEach(this.checkCell.bind(this));
    }

    private sendTelemetry(mimeType: string) {
        // No need to send duplicate telemetry or waste CPU cycles on an unneeded hash.
        if (this.sentMimeTypes.has(mimeType)) {
            return;
        }
        this.sentMimeTypes.add(mimeType);
        // Hash the package name so that we will never accidentally see a
        // user's private package name.
        const hashedName = sha256().update(mimeType).digest('hex');

        const lowerMimeType = mimeType.toLowerCase();
        // The following gives us clues of the mimetype.
        const props = {
            hashedName,
            hasText: lowerMimeType.includes('text'),
            hasLatex: lowerMimeType.includes('latex'),
            hasHtml: lowerMimeType.includes('html'),
            hasSvg: lowerMimeType.includes('svg'),
            hasXml: lowerMimeType.includes('xml'),
            hasJson: lowerMimeType.includes('json'),
            hasImage: lowerMimeType.includes('image'),
            hasGeo: lowerMimeType.includes('geo'),
            hasPlotly: lowerMimeType.includes('plotly'),
            hasVega: lowerMimeType.includes('vega'),
            hasWidget: lowerMimeType.includes('widget'),
            hasJupyter: lowerMimeType.includes('jupyter'),
            hasVnd: lowerMimeType.includes('vnd')
        };
        sendTelemetryEvent(Telemetry.HashedCellOutputMimeType, undefined, props);
    }
}
