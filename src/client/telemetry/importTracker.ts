// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { TextDocument } from 'vscode';

import { sendTelemetryEvent } from '.';
import { noop, sleep } from '../../test/core';
import { IDocumentManager } from '../common/application/types';
import { IHistoryProvider } from '../datascience/types';
import { ICodeExecutionManager } from '../terminals/types';
import { EventName } from './constants';
import { IImportTracker } from './types';

const ImportRegEx = /^(?!['"#]).*from\s+([a-zA-Z0-9_\.]+)\s+import.*(?!['"])|^(?!['"#]).*import\s+([a-zA-Z0-9_\., ]+).*(?!['"])/;
const MAX_DOCUMENT_LINES = 1000;

@injectable()
export class ImportTracker implements IImportTracker {

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
        // Act like all of our open documents just opened. Don't do this now though. We don't want
        // to hold up the activate.
        await sleep(1000);
        this.documentManager.textDocuments.forEach(d => this.onOpenedOrSavedDocument(d));
    }

    private onOpenedOrSavedDocument(document: TextDocument) {
        // Make sure this is a python file.
        if (path.extname(document.fileName) === '.py') {
            // Parse the contents of the document, looking for import matches on each line
            const lines = document.getText().splitLines({ trim: true, removeEmptyEntries: true });
            this.lookForImports(lines.slice(0, Math.min(lines.length, MAX_DOCUMENT_LINES)), EventName.KNOWN_IMPORT_FROM_FILE);
        }
    }

    private onExecutedCode(code: string) {
        const lines = code.splitLines({ trim: true, removeEmptyEntries: true });
        this.lookForImports(lines, EventName.KNOWN_IMPORT_FROM_EXECUTION);
    }

    private lookForImports(lines: string[], eventName: string) {
        try {
            // Use a regex to parse each line, looking for imports
            const matches: Set<string> = new Set<string>();
            for (const s of lines) {
                const match = ImportRegEx.exec(s);
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
