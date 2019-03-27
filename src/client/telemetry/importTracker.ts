// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { TextDocument } from 'vscode';

import { sendTelemetryEvent } from '.';
import { noop } from '../../test/core';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { IHistoryProvider } from '../datascience/types';
import { ICodeExecutionManager } from '../terminals/types';
import { EventName } from './constants';
import { IImportTracker } from './types';

const ImportRegEx = /^(?!['"#]).*from\s+([a-zA-Z0-9_\.]+)\s+import.*(?!['"])|^(?!['"#]).*import\s+([a-zA-Z0-9_\., ]+).*(?!['"])/;
const MAX_DOCUMENT_LINES = 1000;

// Capture isTestExecution on module load so that a test can turn it off and still
// have this value set.
const testExecution = isTestExecution();

@injectable()
export class ImportTracker implements IImportTracker {

    private pendingDocs = new Map<string, NodeJS.Timer>();
    private sentMatches: Set<string> = new Set<string>();
    // tslint:disable-next-line:no-require-imports
    private hashFn = require('hash.js').sha256;

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IHistoryProvider) private historyProvider: IHistoryProvider,
        @inject(ICodeExecutionManager) private executionManager: ICodeExecutionManager
    ) {
        // Sign up for document open/save events so we can track known imports
        this.documentManager.onDidOpenTextDocument((t) => this.onOpenedOrSavedDocument(t));
        this.documentManager.onDidSaveTextDocument((t) => this.onOpenedOrSavedDocument(t));

        // Sign up for history execution events (user can input code here too)
        this.historyProvider.onExecutedCode(c => this.onExecutedCode(c));

        // Sign up for terminal execution events (user can send code to the terminal)
        // However we won't get any text typed directly into the terminal. Not part of the VS code API
        // Could potentially hook stdin? Not sure that's possible.
        this.executionManager.onExecutedCode(c => this.onExecutedCode(c));
    }

    public async activate(): Promise<void> {
        // Act like all of our open documents just opened. Our timeout will make sure this is delayed
        this.documentManager.textDocuments.forEach(d => this.onOpenedOrSavedDocument(d));
    }

    private getDocumentLines(document: TextDocument) : (string | undefined)[] {
        const array = Array<string>(Math.min(document.lineCount, MAX_DOCUMENT_LINES)).fill('');
        return array.map((_a: string, i: number) => {
            const line = document.lineAt(i);
            if (line && !line.isEmptyOrWhitespace) {
                return line.text;
            }
            return undefined;
        }).filter((f: string | undefined) => f);
    }

    private onOpenedOrSavedDocument(document: TextDocument) {
        // Make sure this is a python file.
        if (path.extname(document.fileName) === '.py') {
            // Parse the contents of the document, looking for import matches on each line
            this.scheduleDocument(document);
        }
    }

    private scheduleDocument(document: TextDocument) {
        // If already scheduled, cancel.
        const currentTimeout = this.pendingDocs.get(document.fileName);
        if (currentTimeout) {
            clearTimeout(currentTimeout);
            this.pendingDocs.delete(document.fileName);
        }

        // Now schedule a new one.
        if (testExecution) {
            // During a test, check right away. It needs to be synchronous.
            this.checkDocument(document);
        } else {
            // Wait five seconds to make sure we don't already have this document pending.
            this.pendingDocs.set(document.fileName, setTimeout(() => this.checkDocument(document), 5000));
        }
    }

    private checkDocument(document: TextDocument) {
        this.pendingDocs.delete(document.fileName);
        const lines = this.getDocumentLines(document);
        this.lookForImports(lines, EventName.KNOWN_IMPORT_FROM_FILE);
    }

    private onExecutedCode(code: string) {
        const lines = code.splitLines({ trim: true, removeEmptyEntries: true });
        this.lookForImports(lines, EventName.KNOWN_IMPORT_FROM_EXECUTION);
    }

    private lookForImports(lines: (string | undefined)[], eventName: string) {
        try {
            // Use a regex to parse each line, looking for imports
            const matches: Set<string> = new Set<string>();
            for (const s of lines) {
                const match = s ? ImportRegEx.exec(s) : null;
                if (match && match.length > 2) {
                    // Could be a from or a straight import. from is the first entry.
                    const actual = match[1] ? match[1] : match[2];

                    // Use just the bits to the left of ' as '
                    const left = actual.split(' as ')[0];

                    // Now split this based on, and chop off all .
                    const baseNames = left.split(',').map(l => l.split('.')[0].trim());
                    baseNames.forEach(l => {
                        // Hash this value and save this in our import
                        const hash = this.hashFn().update(l).digest('hex');
                        if (!this.sentMatches.has(hash)) {
                            matches.add(hash);
                        }
                    });
                }
            }

            // For each unique match, emit a new telemetry event.
            matches.forEach(s => {
                sendTelemetryEvent(
                    eventName === EventName.KNOWN_IMPORT_FROM_FILE ? EventName.KNOWN_IMPORT_FROM_FILE : EventName.KNOWN_IMPORT_FROM_EXECUTION,
                    0,
                    { import: s });
                this.sentMatches.add(s);
            });
        } catch {
            noop();
        }
    }
}
