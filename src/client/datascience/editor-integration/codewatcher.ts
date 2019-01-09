// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Position, Range, Selection, TextDocument, TextEditorRevealType } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { ILogger } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { captureTelemetry } from '../../telemetry';
import { generateCellRanges } from '../cellFactory';
import { Commands, Telemetry } from '../constants';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import { ICodeWatcher, IHistoryProvider } from '../types';

@injectable()
export class CodeWatcher implements ICodeWatcher {
    private document?: TextDocument;
    private version: number = -1;
    private fileName: string = '';
    private codeLenses: CodeLens[] = [];

    constructor(@inject(IApplicationShell) private applicationShell: IApplicationShell,
                @inject(ILogger) private logger: ILogger,
                @inject(IHistoryProvider) private historyProvider : IHistoryProvider,
                @inject(IDocumentManager) private documentManager : IDocumentManager) {}

    public addFile(document: TextDocument) {
        this.document = document;

        // Cache these, we don't want to pull an old version if the document is updated
        this.fileName = document.fileName;
        this.version = document.version;

        // Get document cells here
        const cells = generateCellRanges(document);

        this.codeLenses = [];
        cells.forEach(cell => {
            const cmd: Command = {
                arguments: [this, cell.range],
                title: localize.DataScience.runCellLensCommandTitle(),
                command: Commands.RunCell
            };
            this.codeLenses.push(new CodeLens(cell.range, cmd));
            const runAllCmd: Command = {
                arguments: [this],
                title: localize.DataScience.runAllCellsLensCommandTitle(),
                command: Commands.RunAllCells
            };
            this.codeLenses.push(new CodeLens(cell.range, runAllCmd));
        });
    }

    public getFileName() {
        return this.fileName;
    }

    public getVersion() {
        return this.version;
    }

    public getCodeLenses() {
        return this.codeLenses;
    }

    @captureTelemetry(Telemetry.RunAllCells)
    public async runAllCells() {
        const activeHistory = this.historyProvider.getOrCreateActive();

        // Run all of our code lenses, they should always be ordered in the file so we can just
        // run them one by one
        for (const lens of this.codeLenses) {
            // Make sure that we have the correct command (RunCell) lenses
            if (lens.command && lens.command.command === Commands.RunCell && lens.command.arguments && lens.command.arguments.length >= 2) {
                const range: Range = lens.command.arguments[1];
                if (this.document && range) {
                    const code = this.document.getText(range);
                    await activeHistory.addCode(code, this.getFileName(), range.start.line);
                }
            }
        }

        // If there are no codelenses, just run all of the code as a single cell
        if (this.codeLenses.length === 0) {
            if (this.document) {
                const code = this.document.getText();
                await activeHistory.addCode(code, this.getFileName(), 0);
            }
        }
    }

    @captureTelemetry(Telemetry.RunCell)
    public async runCell(range: Range) {
        const activeHistory = this.historyProvider.getOrCreateActive();
        if (this.document) {
            const code = this.document.getText(range);

            try {
                await activeHistory.addCode(code, this.getFileName(), range.start.line, this.documentManager.activeTextEditor);
            } catch (err) {
                this.handleError(err);
            }

        }
    }

    @captureTelemetry(Telemetry.RunCurrentCell)
    public async runCurrentCell() {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return;
        }

        for (const lens of this.codeLenses) {
            // Check to see which RunCell lens range overlaps the current selection start
            if (lens.range.contains(this.documentManager.activeTextEditor.selection.start) && lens.command && lens.command.command === Commands.RunCell) {
                await this.runCell(lens.range);
                break;
            }
        }
    }

    @captureTelemetry(Telemetry.RunCurrentCellAndAdvance)
    public async runCurrentCellAndAdvance() {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return;
        }

        let currentRunCellLens: CodeLens | undefined;
        let nextRunCellLens: CodeLens | undefined;

        for (const lens of this.codeLenses) {
            // If we have already found the current code lens, then the next run cell code lens will give us the next cell
            if (currentRunCellLens && lens.command && lens.command.command === Commands.RunCell) {
                nextRunCellLens = lens;
                break;
            }

            // Check to see which RunCell lens range overlaps the current selection start
            if (lens.range.contains(this.documentManager.activeTextEditor.selection.start) && lens.command && lens.command.command === Commands.RunCell) {
                currentRunCellLens = lens;
            }
        }

        if (currentRunCellLens) {
            // Either use the next cell that we found, or add a new one into the document
            let nextRange: Range;
            if (!nextRunCellLens) {
                nextRange = this.createNewCell(currentRunCellLens.range);
            } else {
                nextRange = nextRunCellLens.range;
            }

            if (nextRange) {
                this.advanceToRange(nextRange);
            }

            // Run the cell after moving the selection
            await this.runCell(currentRunCellLens.range);
        }
    }

    // tslint:disable-next-line:no-any
    private handleError = (err : any) => {
        if (err instanceof JupyterInstallError) {
            const jupyterError = err as JupyterInstallError;

            // This is a special error that shows a link to open for more help
            this.applicationShell.showErrorMessage(jupyterError.message, jupyterError.actionTitle).then(v => {
                // User clicked on the link, open it.
                if (v === jupyterError.actionTitle) {
                    this.applicationShell.openUrl(jupyterError.action);
                }
            });
        } else if (err.message) {
            this.applicationShell.showErrorMessage(err.message);
        } else {
            this.applicationShell.showErrorMessage(err.toString());
        }
        this.logger.logError(err);
    }

    // User has picked run and advance on the last cell of a document
    // Create a new cell at the bottom and put their selection there, ready to type
    private createNewCell(currentRange: Range): Range {
        const editor = this.documentManager.activeTextEditor;
        const newPosition = new Position(currentRange.end.line + 3, 0); // +3 to account for the added spaces and to position after the new mark

        if (editor) {
            editor.edit((editBuilder) => {
                editBuilder.insert(new Position(currentRange.end.line + 1, 0), '\n\n#%%\n');
            });
        }

        return new Range(newPosition, newPosition);
    }

    // Advance the cursor to the selected range
    private advanceToRange(targetRange: Range) {
        const editor = this.documentManager.activeTextEditor;
        const newSelection = new Selection(targetRange.start, targetRange.start);
        if (editor) {
            editor.selection = newSelection;
            editor.revealRange(targetRange, TextEditorRevealType.Default);
        }
    }
}
