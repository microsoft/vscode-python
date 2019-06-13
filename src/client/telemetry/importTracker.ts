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
import { EventName } from './constants';
import { IImportTracker } from './types';

/*
Python has a fairly rich import statement. Originally the matching regexp was kept simple for
performance worries, but it led to false-positives due to matching things like docstrings with
phrases along the lines of "from the thing" or "import the thing". To minimize false-positives the
regexp does its best to validate the structure of the import line. This leads to us supporting:

- `from pkg import _`
- `from pkg import _, _`
- `from pkg import _ as _`
- `import pkg`
- `import pkg, pkg`
- `import pkg as _`

We can rely on the fact that the use of the `from` and `import` keywords from the start of a line are
only usable for imports in valid code (`from` can also be used when raising an exception, but `raise`
would be the first keyword on a line in that instance). We also get to rely on the fact that we only
care about the top-level package, keeping the regex extremely greedy. This should lead to the regex
failing fast and having low performance overhead.

We can also ignore multi-line/parenthesized imports for simplicity since we don't' need 100% accuracy,
just enough to be able to tell what packages user's rely on to make sure we are covering our bases
in terms of support. This allows us to anchor the start and end of the regexp and not try to handle the
parentheses case which adds a lot more optional parts to the regexp.
*/
//const ImportRegEx = /^\s*(from\s+(?<fromImport>\w+)(?:\.\w+)*\s+import\s+(?:\(\s*)?(?:\w+(?:\s*,\s*)?)+(?:\)|\s+as\s+\w+)?|import\s+(?<importImport>(\w+(?:\s*,\s*)?)+)(?:\s+as\s+\w+)?)(?:\s*#.*)?$/;
const ImportRegEx = /^\s*(from\s+(?<fromImport>\w+)(?:\.\w+)*\s+import\s+\w+(?:\s+as\s+\w+|(?:\s*,\s*\w+)+(?:\s*,)?)?|import\s+(?<importImport>(?:\w+(?:\s*,\s*)?)+)(?:\s+as\s+\w+)?)\s*(#.*)?$/;
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
        @inject(IDocumentManager) private documentManager: IDocumentManager
    ) {
        this.documentManager.onDidOpenTextDocument((t) => this.onOpenedOrSavedDocument(t));
        this.documentManager.onDidSaveTextDocument((t) => this.onOpenedOrSavedDocument(t));
    }

    public async activate(): Promise<void> {
        // Act like all of our open documents just opened; our timeout will make sure this is delayed.
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
        // Make sure this is a Python file.
        if (path.extname(document.fileName) === '.py') {
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
        sendTelemetryEvent(EventName.HASHED_PACKAGE_NAME, undefined, {hashedName: hash});
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
                        const packageNames = match.groups.importImport.split(',').map(rawPackageName => rawPackageName.trim());
                        // Can't pass in `this.sendTelemetry` directly as that rebinds `this`.
                        packageNames.forEach(p => this.sendTelemetry(p));
                    }
                }
            }
        } catch {
            // Don't care about failures since this is just telemetry.
            noop();
        }
    }
}
