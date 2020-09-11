// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { TextDocument } from 'vscode';
import { captureTelemetry, sendTelemetryEvent } from '.';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import '../common/extensions';
import { noop } from '../common/utils/misc';
import { EventName } from './constants';

/*
Python has a fairly rich import statement. Originally the matching regexp was kept simple for
performance worries, but it led to false-positives due to matching things like docstrings with
phrases along the lines of "from the thing" or "import the thing". To minimize false-positives the
regexp does its best to validate the structure of the import line _within reason_. This leads to
us supporting the following (where `pkg` represents what we are actually capturing for telemetry):

- `from pkg import _`
- `from pkg import _, _`
- `from pkg import _ as _`
- `import pkg`
- `import pkg, pkg`
- `import pkg as _`

Things we are ignoring the following for simplicity/performance:

- `from pkg import (...)` (this includes single-line and multi-line imports with parentheses)
- `import pkg  # ... and anything else with a trailing comment.`
- Non-standard whitespace separators within the import statement (i.e. more than a single space, tabs)

*/
const ImportRegEx = /^\s*(from (?<fromImport>\w+)(?:\.\w+)* import \w+(?:, \w+)*(?: as \w+)?|import (?<importImport>\w+(?:, \w+)*)(?: as \w+)?)$/;
const MAX_DOCUMENT_LINES = 1000;

// Capture isTestExecution on module load so that a test can turn it off and still
// have this value set.
const testExecution = isTestExecution();

@injectable()
export class ImportTracker implements IExtensionSingleActivationService {
    private pendingChecks = new Map<string, NodeJS.Timer | number>();
    private sentMatches: Set<string> = new Set<string>();
    // tslint:disable-next-line:no-require-imports
    private hashFn = require('hash.js').sha256;

    constructor(@inject(IDocumentManager) private documentManager: IDocumentManager) {
        this.documentManager.onDidOpenTextDocument((t) => this.onOpenedOrSavedDocument(t));
        this.documentManager.onDidSaveTextDocument((t) => this.onOpenedOrSavedDocument(t));
    }

    public dispose() {
        this.pendingChecks.clear();
    }

    public async activate(): Promise<void> {
        // Act like all of our open documents just opened; our timeout will make sure this is delayed.
        this.documentManager.textDocuments.forEach((d) => this.onOpenedOrSavedDocument(d));
    }

    private getDocumentLines(document: TextDocument): (string | undefined)[] {
        const array = Array<string>(Math.min(document.lineCount, MAX_DOCUMENT_LINES)).fill('');
        return array
            .map((_a: string, i: number) => {
                const line = document.lineAt(i);
                if (line && !line.isEmptyOrWhitespace) {
                    return line.text;
                }
                return undefined;
            })
            .filter((f: string | undefined) => f);
    }

    private onOpenedOrSavedDocument(document: TextDocument) {
        // Make sure this is a Python file.
        if (path.extname(document.fileName) === '.py') {
            this.scheduleDocument(document);
        }
    }

    private scheduleDocument(document: TextDocument) {
        this.scheduleCheck(document.fileName, this.checkDocument.bind(this, document));
    }

    private scheduleCheck(file: string, check: () => void) {
        // If already scheduled, cancel.
        const currentTimeout = this.pendingChecks.get(file);
        if (currentTimeout) {
            // tslint:disable-next-line: no-any
            clearTimeout(currentTimeout as any);
            this.pendingChecks.delete(file);
        }

        // Now schedule a new one.
        if (testExecution) {
            // During a test, check right away. It needs to be synchronous.
            check();
        } else {
            // Wait five seconds to make sure we don't already have this document pending.
            this.pendingChecks.set(file, setTimeout(check, 5000));
        }
    }

    @captureTelemetry(EventName.HASHED_PACKAGE_PERF)
    private checkDocument(document: TextDocument) {
        this.pendingChecks.delete(document.fileName);
        const lines = this.getDocumentLines(document);
        this.lookForImports(lines);
    }

    private sendTelemetry(packageName: string) {
        // No need to send duplicate telemetry or waste CPU cycles on an unneeded hash.
        if (this.sentMatches.has(packageName)) {
            return;
        }
        this.sentMatches.add(packageName);
        // Hash the package name so that we will never accidentally see a
        // user's private package name.
        const hash = this.hashFn().update(packageName).digest('hex');
        sendTelemetryEvent(EventName.HASHED_PACKAGE_NAME, undefined, { hashedName: hash });
    }

    private lookForImports(lines: (string | undefined)[]) {
        try {
            for (const s of lines) {
                const match = s ? ImportRegEx.exec(s) : null;
                if (match !== null && match.groups !== undefined) {
                    if (match.groups.fromImport !== undefined) {
                        // `from pkg ...`
                        this.sendTelemetry(match.groups.fromImport);
                    } else if (match.groups.importImport !== undefined) {
                        // `import pkg1, pkg2, ...`
                        const packageNames = match.groups.importImport
                            .split(',')
                            .map((rawPackageName) => rawPackageName.trim());
                        // Can't pass in `this.sendTelemetry` directly as that rebinds `this`.
                        packageNames.forEach((p) => this.sendTelemetry(p));
                    }
                }
            }
        } catch {
            // Don't care about failures since this is just telemetry.
            noop();
        }
    }
}
