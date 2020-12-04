import { inject, injectable } from 'inversify';
import { noop } from 'lodash';
import * as path from 'path';
import { Event, EventEmitter, TextDocument, TextEditor, window } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { ITensorBoardImportTracker } from './types';

// While it is uncommon for users to `import tensorboard`, TensorBoard is frequently
// included as a submodule of other packages, e.g. torch.utils.tensorboard.
// This is a modified version of the regex from src/client/telemetry/importTracker.ts
// in order to match on imported submodules as well, since the original regex only
// matches the 'main' module.
const ImportRegEx = /^\s*from (?<fromImport>\w+(?:\.\w+)*) import (?<fromImportTarget>\w+(?:, \w+)*)(?: as \w+)?|import (?<importImport>\w+(?:, \w+)*)(?: as \w+)?$/;
const MAX_DOCUMENT_LINES = 1000;

// Capture isTestExecution on module load so that a test can turn it off and still
// have this value set.
const testExecution = isTestExecution();

@injectable()
export class TensorBoardImportTracker implements ITensorBoardImportTracker, IExtensionSingleActivationService {
    private pendingChecks = new Map<string, NodeJS.Timer | number>();
    private _onDidImportTensorBoard = new EventEmitter<void>();

    constructor(@inject(IDocumentManager) private documentManager: IDocumentManager) {
        this.documentManager.onDidChangeActiveTextEditor((e) => this.onChangedActiveTextEditor(e));
    }

    // Fires when the active text editor contains a tensorboard import.
    public get onDidImportTensorBoard(): Event<void> {
        return this._onDidImportTensorBoard.event;
    }

    public dispose() {
        this.pendingChecks.clear();
    }

    public async activate(): Promise<void> {
        // Process active text editor with a timeout delay
        this.onChangedActiveTextEditor(window.activeTextEditor);
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

    private onChangedActiveTextEditor(editor: TextEditor | undefined) {
        if (!editor || !editor.document) {
            return;
        }
        const document = editor.document;
        if (
            (path.extname(document.fileName) === '.ipynb' && document.languageId === 'python') ||
            path.extname(document.fileName) === '.py'
        ) {
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

    private checkDocument(document: TextDocument) {
        this.pendingChecks.delete(document.fileName);
        const lines = this.getDocumentLines(document);
        this.lookForImports(lines);
    }

    private lookForImports(lines: (string | undefined)[]) {
        try {
            for (const s of lines) {
                const matches = s ? ImportRegEx.exec(s) : null;
                if (matches === null || matches.groups === undefined) {
                    return;
                }
                let componentsToCheck: string[] = [];
                if (matches.groups.fromImport && matches.groups.fromImportTarget) {
                    // from x.y.z import u, v, w
                    componentsToCheck = matches.groups.fromImport
                        .split('.')
                        .concat(matches.groups.fromImportTarget.split(','));
                } else if (matches.groups.importImport) {
                    // import package1, package2, ...
                    componentsToCheck = matches.groups.importImport.split(',');
                }
                for (const component of componentsToCheck) {
                    if (component && component.trim() === 'tensorboard') {
                        this._onDidImportTensorBoard.fire();
                        return;
                    }
                }
            }
        } catch {
            // Don't care about failures.
            noop();
        }
    }
}
