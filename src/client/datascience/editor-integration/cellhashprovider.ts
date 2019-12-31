// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as hashjs from 'hash.js';
import { inject, injectable, multiInject, optional } from 'inversify';
import { Event, EventEmitter, Position, Range, TextDocumentChangeEvent, TextDocumentContentChangeEvent } from 'vscode';

import { IDebugService, IDocumentManager } from '../../common/application/types';
import { traceError, traceInfo } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { CellMatcher } from '../cellMatcher';
import { splitMultilineString } from '../common';
import { Identifiers } from '../constants';
import { InteractiveWindowMessages, SysInfoReason } from '../interactive-common/interactiveWindowTypes';
import { ICell, ICellHash, ICellHashListener, ICellHashProvider, IFileHashes, IInteractiveWindowListener, INotebookExecutionLogger } from '../types';

interface IRangedCellHash extends ICellHash {
    code: string;
    startOffset: number;
    endOffset: number;
    deleted: boolean;
    realCode: string;
}

// This class provides hashes for debugging jupyter cells. Call getHashes just before starting debugging to compute all of the
// hashes for cells.
@injectable()
export class CellHashProvider implements ICellHashProvider, IInteractiveWindowListener, INotebookExecutionLogger {
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    // Map of file to Map of start line to actual hash
    private hashes: Map<string, IRangedCellHash[]> = new Map<string, IRangedCellHash[]>();
    private executionCount: number = 0;
    private updateEventEmitter: EventEmitter<void> = new EventEmitter<void>();

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @multiInject(ICellHashListener) @optional() private listeners: ICellHashListener[] | undefined
    ) {
        // Watch document changes so we can update our hashes
        this.documentManager.onDidChangeTextDocument(this.onChangedDocument.bind(this));
    }

    public dispose() {
        this.hashes.clear();
    }

    public get updated(): Event<void> {
        return this.updateEventEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.AddedSysInfo:
                if (payload && payload.type) {
                    const reason = payload.type as SysInfoReason;
                    if (reason !== SysInfoReason.Interrupt) {
                        this.hashes.clear();
                        this.executionCount = 0;
                        this.updateEventEmitter.fire();
                    }
                }
                break;

            default:
                break;
        }
    }

    public getHashes(): IFileHashes[] {
        return [...this.hashes.entries()]
            .map(e => {
                return {
                    file: e[0],
                    hashes: e[1].filter(h => !h.deleted)
                };
            })
            .filter(e => e.hashes.length > 0);
    }

    public async preExecute(cell: ICell, silent: boolean): Promise<void> {
        try {
            if (!silent) {
                // Don't log empty cells
                const stripped = this.extractExecutableLines(cell.data.source);
                if (stripped.length > 0 && stripped.find(s => s.trim().length > 0)) {
                    // When the user adds new code, we know the execution count is increasing
                    this.executionCount += 1;

                    // Skip hash on unknown file though
                    if (cell.file !== Identifiers.EmptyFileName) {
                        await this.addCellHash(cell, this.executionCount);
                    }
                }
            }
        } catch (exc) {
            // Don't let exceptions in a preExecute mess up normal operation
            traceError(exc);
        }
    }

    public async postExecute(_cell: ICell, _silent: boolean): Promise<void> {
        noop();
    }

    private onChangedDocument(e: TextDocumentChangeEvent) {
        // See if the document is in our list of docs to watch
        const perFile = this.hashes.get(e.document.fileName);
        if (perFile) {
            // Apply the content changes to the file's cells.
            const docText = e.document.getText();
            e.contentChanges.forEach(c => {
                this.handleContentChange(docText, c, perFile);
            });
        }
    }

    private extractExecutableLines(code: nbformat.MultilineString): string[] {
        const cellMatcher = new CellMatcher(this.configService.getSettings().datascience);
        const lines = splitMultilineString(code);
        // Only strip this off the first line. Otherwise we want the markers in the code.
        if (lines.length > 0 && (cellMatcher.isCode(lines[0]) || cellMatcher.isMarkdown(lines[0]))) {
            return lines.slice(1);
        }
        return lines;
    }

    private handleContentChange(docText: string, c: TextDocumentContentChangeEvent, hashes: IRangedCellHash[]) {
        // First compute the number of lines that changed
        const lineDiff = c.range.start.line - c.range.end.line + c.text.split('\n').length - 1;
        const offsetDiff = c.text.length - c.rangeLength;

        // Compute the inclusive offset that is changed by the cell.
        const endChangedOffset = c.rangeLength <= 0 ? c.rangeOffset : c.rangeOffset + c.rangeLength - 1;

        hashes.forEach(h => {
            // See how this existing cell compares to the change
            if (h.endOffset < c.rangeOffset) {
                // No change. This cell is entirely before the change
            } else if (h.startOffset > endChangedOffset) {
                // This cell is after the text that got replaced. Adjust its start/end lines
                h.line += lineDiff;
                h.endLine += lineDiff;
                h.startOffset += offsetDiff;
                h.endOffset += offsetDiff;
            } else if (h.startOffset === endChangedOffset) {
                // Cell intersects but exactly, might be a replacement or an insertion
                if (h.deleted || c.rangeLength > 0 || lineDiff === 0) {
                    // Replacement
                    h.deleted = docText.substr(h.startOffset, h.endOffset - h.startOffset) !== h.realCode;
                } else {
                    // Insertion
                    h.line += lineDiff;
                    h.endLine += lineDiff;
                    h.startOffset += offsetDiff;
                    h.endOffset += offsetDiff;
                }
            } else {
                // Intersection, delete if necessary
                h.deleted = docText.substr(h.startOffset, h.endOffset - h.startOffset) !== h.realCode;
            }
        });
    }

    private async addCellHash(cell: ICell, expectedCount: number): Promise<void> {
        // Find the text document that matches. We need more information than
        // the add code gives us
        const doc = this.documentManager.textDocuments.find(d => this.fileSystem.arePathsSame(d.fileName, cell.file));
        if (doc) {
            // Compute the code that will really be sent to jupyter
            const lines = splitMultilineString(cell.data.source);
            const stripped = this.extractExecutableLines(cell.data.source);

            // Figure out our true 'start' line. This is what we need to tell the debugger is
            // actually the start of the code as that's what Jupyter will be getting.
            let trueStartLine = cell.line;
            for (let i = 0; i < stripped.length; i += 1) {
                if (stripped[i] !== lines[i]) {
                    trueStartLine += i + 1;
                    break;
                }
            }
            const line = doc.lineAt(trueStartLine);
            const endLine = doc.lineAt(Math.min(trueStartLine + stripped.length - 1, doc.lineCount - 1));

            // Use the original values however to track edits. This is what we need
            // to move around
            const startOffset = doc.offsetAt(new Position(cell.line, 0));
            const endOffset = doc.offsetAt(endLine.rangeIncludingLineBreak.end);

            // Jupyter also removes blank lines at the end. Make sure only one
            let lastLine = stripped[stripped.length - 1];
            while (lastLine !== undefined && (lastLine.length === 0 || lastLine === '\n')) {
                stripped.splice(stripped.length - 1, 1);
                lastLine = stripped[stripped.length - 1];
            }
            // Make sure the last line with actual content ends with a linefeed
            if (!lastLine.endsWith('\n') && lastLine.length > 0) {
                stripped[stripped.length - 1] = `${lastLine}\n`;
            }

            // Compute the runtime line and adjust our cell/stripped source for debugging
            const runtimeLine = this.adjustRuntimeForDebugging(cell, stripped, startOffset, endOffset);
            const hashedCode = stripped.join('');
            const realCode = doc.getText(new Range(new Position(cell.line, 0), endLine.rangeIncludingLineBreak.end));

            const hash: IRangedCellHash = {
                hash: hashjs
                    .sha1()
                    .update(hashedCode)
                    .digest('hex')
                    .substr(0, 12),
                line: line.lineNumber + 1,
                endLine: endLine.lineNumber + 1,
                executionCount: expectedCount,
                startOffset,
                endOffset,
                deleted: false,
                code: hashedCode,
                realCode,
                runtimeLine,
                id: cell.id
            };

            traceInfo(`Adding hash for ${expectedCount} = ${hash.hash} with ${stripped.length} lines`);

            let list = this.hashes.get(cell.file);
            if (!list) {
                list = [];
            }

            // Figure out where to put the item in the list
            let inserted = false;
            for (let i = 0; i < list.length && !inserted; i += 1) {
                const pos = list[i];
                if (hash.line >= pos.line && hash.line <= pos.endLine) {
                    // Stick right here. This is either the same cell or a cell that overwrote where
                    // we were.
                    list.splice(i, 1, hash);
                    inserted = true;
                } else if (pos.line > hash.line) {
                    // This item comes just after the cell we're inserting.
                    list.splice(i, 0, hash);
                    inserted = true;
                }
            }
            if (!inserted) {
                list.push(hash);
            }
            this.hashes.set(cell.file, list);

            // Tell listeners we have new hashes.
            if (this.listeners) {
                const hashes = this.getHashes();
                await Promise.all(this.listeners.map(l => l.hashesUpdated(hashes)));

                // Then fire our event
                this.updateEventEmitter.fire();
            }
        }
    }

    private adjustRuntimeForDebugging(cell: ICell, source: string[], _cellStartOffset: number, _cellEndOffset: number): number {
        if (this.debugService.activeDebugSession && this.configService.getSettings().datascience.stopOnFirstLineWhileDebugging) {
            // Inject the breakpoint line
            source.splice(0, 0, 'breakpoint()\n');
            cell.data.source = source;
            cell.extraLines = [0];

            // Start on the second line
            return 2;
        }
        // No breakpoint necessary, start on the first line
        return 1;
    }
}
