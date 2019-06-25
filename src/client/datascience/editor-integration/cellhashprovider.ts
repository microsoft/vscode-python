// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as hashjs from 'hash.js';
import { inject, injectable } from 'inversify';
import {
    Event,
    EventEmitter,
    Position,
    Range,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentContentChangeEvent
} from 'vscode';

import { IDocumentManager } from '../../common/application/types';
import { IConfigurationService } from '../../common/types';
import { generateCells } from '../cellFactory';
import { concatMultilineString } from '../common';
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

            case InteractiveWindowMessages.RestartKernel:
                this.hashes.clear();
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

    public async getHashes(): Promise<IFileHashes[]> {
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
            // First make sure not a markdown cell. Those can be ignored. Just get out the first code cell
            const cells = generateCells(this.configService.getSettings().datascience, args.code, args.file, args.line, true, args.id);
            const codeCell = cells.find(c => c.data.cell_type === 'code');
            if (codeCell) {
                // When the user adds new code, we know the execution count is increasing
                this.executionCount += 1;

                // Skip hash on unknown file though
                if (args.file !== Identifiers.EmptyFileName) {
                    this.addCellHash(concatMultilineString(codeCell.data.source), codeCell.line, codeCell.file, this.executionCount);
                }
            }
        }
    }

    private onChangedDocument(e: TextDocumentChangeEvent) {
        // See if the document is in our list of docs to watch
        const perFile = this.hashes.get(e.document.fileName);
        if (perFile) {
            // Apply the content changes to the file's cells
            e.contentChanges.forEach(c => this.handleContentChange(e.document, c, perFile));
        }
    }

    private handleContentChange(d: TextDocument, c: TextDocumentContentChangeEvent, hashes: IRangedCellHash[]) {
        // First compute the number of lines that changed
        const lineDiff = c.text.split('\n').length - d.getText(c.range).split('\n').length;
        const offsetDiff = c.text.length - c.rangeLength;

        // Also compute the text of the document with the change applied
        const appliedText = this.applyChange(d, c);

        hashes.forEach(h => {
            // See how this existing cell compares to the change
            if (!h.deleted) {
                if (h.endOffset < c.rangeOffset) {
                    // No change. This cell is entirely before the change
                } else if (h.startOffset >= c.rangeOffset + c.rangeLength) {
                    // This cell is after the text that got replaced. Adjust its start/end lines
                    h.line += lineDiff;
                    h.endLine += lineDiff;
                    h.startOffset += offsetDiff;
                    h.endOffset += offsetDiff;
                } else {
                    // Cell intersects. Mark as deleted
                    h.deleted = true;
                }
            // See if this deleted cell suddenly reappeared.
            } else {
                const index = appliedText.indexOf(h.realCode);
                if (index >= 0) {
                    h.deleted = false;
                    h.startOffset = index;
                    h.endOffset = index + h.realCode.length;
                    const lineSize = h.endLine - h.line;
                    h.line = appliedText.substr(0, index).split('\n').length;
                    h.endLine = h.line + lineSize;
                }
            }
        });
    }

    private applyChange(d: TextDocument, c: TextDocumentContentChangeEvent) : string {
        const text = d.getText();
        const before = text.substr(0, c.rangeOffset);
        const after = text.substr(c.rangeOffset + c.rangeLength);
        return `${before}${c.text}${after}`;
    }

    private addCellHash(code: string, startLine: number, file: string, expectedCount: number) {
        // Find the text document that matches. We need more information than
        // the add code gives us
        const doc = this.documentManager.textDocuments.find(d => d.fileName === file);
        if (doc) {
            // The code we get is not actually what's in the document. The interactiveWindow massages it somewhat.
            // We need the real code so that we can match document edits later.
            const split = code.split('\n');
            const lineCount = split.length;
            const line = doc.lineAt(startLine);
            const endLine = doc.lineAt(Math.min(startLine + lineCount - 1, doc.lineCount - 1));
            const startOffset = doc.offsetAt(new Position(startLine, 0));
            const endOffset = doc.offsetAt(endLine.rangeIncludingLineBreak.end);
            const realCode = doc.getText(new Range(line.range.start, endLine.rangeIncludingLineBreak.end));
            const hash : IRangedCellHash = {
                hash: hashjs.sha1().update(code).digest('hex').substr(0, 12),
                line: startLine + 1,
                endLine: startLine + lineCount,
                executionCount: expectedCount,
                startOffset,
                endOffset,
                deleted: false,
                code,
                realCode
            };

            const list = this.hashes.get(file);
            if (!list) {
                this.hashes.set(file, [hash]);
            } else {
                // Figure out where to stick the hash in the list.
                // Note: List should always be up to date because we're tracking edits to the files
                const firstGreatest = list.findIndex(h => h.line > startLine);
                if (firstGreatest >= 0) {
                    list.splice(firstGreatest, 0, hash);
                } else {
                    list.push(hash);
                }
            }
        }
    }
}
