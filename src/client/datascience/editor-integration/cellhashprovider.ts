// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as hashjs from 'hash.js';
import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Position, Range, TextDocumentChangeEvent, TextDocumentContentChangeEvent } from 'vscode';

import { IDocumentManager } from '../../common/application/types';
import { IConfigurationService } from '../../common/types';
import { generateCells } from '../cellFactory';
import { CellMatcher } from '../cellMatcher';
import { splitMultilineString } from '../common';
import { Identifiers } from '../constants';
import { InteractiveWindowMessages, IRemoteAddCode, SysInfoReason } from '../interactive-window/interactiveWindowTypes';
import { ICellHash, ICellHashProvider, IFileHashes, IInteractiveWindowListener } from '../types';

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
export class CellHashProvider implements ICellHashProvider, IInteractiveWindowListener {

    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{message: string; payload: any}> = new EventEmitter<{message: string; payload: any}>();
    // Map of file to Map of start line to actual hash
    private hashes : Map<string, IRangedCellHash[]> = new Map<string, IRangedCellHash[]>();
    private executionCount: number = 0;

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IConfigurationService) private configService: IConfigurationService
        )
    {
        // Watch document changes so we can update our hashes
        this.documentManager.onDidChangeTextDocument(this.onChangedDocument.bind(this));
    }

    public dispose() {
        this.hashes.clear();
    }

    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.RemoteAddCode:
                if (payload) {
                    this.onAboutToAddCode(payload);
                }
                break;

            case InteractiveWindowMessages.AddedSysInfo:
                if (payload && payload.type) {
                    const reason = payload.type as SysInfoReason;
                    if (reason !== SysInfoReason.Interrupt) {
                        this.hashes.clear();
                    }
                }
                break;

            default:
                break;
        }
    }

    public getHashes(): IFileHashes[] {
        return [...this.hashes.entries()].map(e => {
            return {
                file: e[0],
                hashes: e[1].filter(h => !h.deleted)
            };
        }).filter(e => e.hashes.length > 0);
    }

    private onAboutToAddCode(args: IRemoteAddCode) {
        // Make sure this is valid
        if (args && args.code && args.line !== undefined && args.file) {
            // First make sure not a markdown cell. Those can be ignored. Just get out the first code cell.
            // Regardless of how many 'code' cells exist in the code sent to us, we'll only ever send one at most.
            // The code sent to this function is either a cell as defined by #%% or the selected text (which is treated as one cell)
            const cells = generateCells(this.configService.getSettings().datascience, args.code, args.file, args.line, true, args.id);
            const codeCell = cells.find(c => c.data.cell_type === 'code');
            if (codeCell) {
                // When the user adds new code, we know the execution count is increasing
                this.executionCount += 1;

                // Skip hash on unknown file though
                if (args.file !== Identifiers.EmptyFileName) {
                    this.addCellHash(splitMultilineString(codeCell.data.source), codeCell.line, codeCell.file, this.executionCount);
                }
            }
        }
    }

    private onChangedDocument(e: TextDocumentChangeEvent) {
        // See if the document is in our list of docs to watch
        const perFile = this.hashes.get(e.document.fileName);
        if (perFile) {
            // Apply the content changes to the file's cells.
            let prevText = e.document.getText();
            e.contentChanges.forEach(c => {
                prevText = this.handleContentChange(prevText, c, perFile);
            });
        }
    }

    private handleContentChange(docText: string, c: TextDocumentContentChangeEvent, hashes: IRangedCellHash[]) : string {
        // First compute the number of lines that changed
        const lineDiff = c.text.split('\n').length - docText.substr(c.rangeOffset, c.rangeLength).split('\n').length;
        const offsetDiff = c.text.length - c.rangeLength;

        // Compute the inclusive offset that is changed by the cell.
        const endChangedOffset = c.rangeLength <= 0 ? c.rangeOffset : c.rangeOffset + c.rangeLength - 1;

        // Also compute the text of the document with the change applied
        const appliedText = this.applyChange(docText, c);

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
            } else {
                // Cell intersects. Mark as deleted if not exactly the same (user could type over the exact same values)
                h.deleted = appliedText.substr(h.startOffset, h.endOffset - h.startOffset) !== h.realCode;
            }
        });

        return appliedText;
    }

    private applyChange(docText: string, c: TextDocumentContentChangeEvent) : string {
        const before = docText.substr(0, c.rangeOffset);
        const after = docText.substr(c.rangeOffset + c.rangeLength);
        return `${before}${c.text}${after}`;
    }

    private addCellHash(lines: string[], startLine: number, file: string, expectedCount: number) {
        // Find the text document that matches. We need more information than
        // the add code gives us
        const doc = this.documentManager.textDocuments.find(d => d.fileName === file);
        if (doc) {
            const cellMatcher = new CellMatcher(this.configService.getSettings().datascience);

            // Compute the code that will really be sent to jupyter
            const stripped = lines.filter(l => !cellMatcher.isCode(l));

            // Figure out our true 'start' line. This is what we need to tell the debugger is
            // actually the start of the code as that's what Jupyter will be getting.
            let trueStartLine = startLine;
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
            const startOffset = doc.offsetAt(new Position(startLine, 0));
            const endOffset = doc.offsetAt(endLine.rangeIncludingLineBreak.end);

            // Jupyter also removes blank lines at the end.
            let lastLine = stripped[stripped.length - 1];
            while (lastLine.length === 0 || lastLine === '\n') {
                stripped.splice(stripped.length - 1, 1);
                lastLine = stripped[stripped.length - 1];
            }
            // Make sure the last line with actual content ends with a linefeed
            if (!lastLine.endsWith('\n')) {
                stripped[stripped.length - 1] = `${lastLine}\n`;
            }
            const hashedCode = stripped.join('');
            const realCode = doc.getText(new Range(new Position(startLine, 0), endLine.rangeIncludingLineBreak.end));

            const hash : IRangedCellHash = {
                hash: hashjs.sha1().update(hashedCode).digest('hex').substr(0, 12),
                line: line.lineNumber + 1,
                endLine: endLine.lineNumber + 1,
                executionCount: expectedCount,
                startOffset,
                endOffset,
                deleted: false,
                code: hashedCode,
                realCode
            };

            let list = this.hashes.get(file);
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
            this.hashes.set(file, list);
        }
    }
}
