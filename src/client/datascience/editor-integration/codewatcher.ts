// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CodeLens, Command, Position, Range, Selection, TextDocument, TextEditorRevealType, window} from 'vscode';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { Commands, EditorContexts, RegExpValues } from '../constants';
import { ICodeWatcher, IHistoryProvider } from '../types';

export interface ICell {
    range: Range;
    title: string;
}

export class CodeWatcher implements ICodeWatcher {
    private document?: TextDocument;
    private version: number = -1;
    private fileName: string = '';
    private codeLenses: CodeLens[] = [];
    private historyProvider: IHistoryProvider;
    private commandManager: ICommandManager;
    private applicationShell: IApplicationShell;

    constructor(serviceContainer: IServiceContainer, document: TextDocument) {
        this.historyProvider = serviceContainer.get<IHistoryProvider>(IHistoryProvider);
        this.commandManager = serviceContainer.get<ICommandManager>(ICommandManager);
        this.applicationShell = serviceContainer.get<IApplicationShell>(IApplicationShell);

        this.document = document;

        // Cache these, we don't want to pull an old version if the document is updated
        this.fileName = document.fileName;
        this.version = document.version;

        // Get document cells here
        const cells = this.getCells(document);

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

    public async runAllCells() {
        const activeHistory = await this.historyProvider.getOrCreateHistory();

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
    }

    public async runCell(range: Range) {
        const activeHistory = await this.historyProvider.getOrCreateHistory();
        if (this.document) {
            const code = this.document.getText(range);

            try {
                await activeHistory.addCode(code, this.getFileName(), range.start.line, window.activeTextEditor);
            } catch (err) {
                this.applicationShell.showErrorMessage(err);
            }

        }
    }

    public async runCurrentCell() {
        if (!window.activeTextEditor || !window.activeTextEditor.document) {
            return;
        }

        for (const lens of this.codeLenses) {
            // Check to see which RunCell lens range overlaps the current selection start
            if (lens.range.contains(window.activeTextEditor.selection.start) && lens.command && lens.command.command === Commands.RunCell) {
                await this.runCell(lens.range);
                break;
            }
        }
    }

    public async runCurrentCellAndAdvance() {
        if (!window.activeTextEditor || !window.activeTextEditor.document) {
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
            if (lens.range.contains(window.activeTextEditor.selection.start) && lens.command && lens.command.command === Commands.RunCell) {
                currentRunCellLens = lens;
            }
        }

        if (currentRunCellLens) {
            await this.runCell(currentRunCellLens.range);

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
        }
    }

    // User has picked run and advance on the last cell of a document
    // Create a new cell at the bottom and put their selection there, ready to type
    private createNewCell(currentRange: Range): Range {
        const editor = window.activeTextEditor;
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
        const editor = window.activeTextEditor;
        const newSelection = new Selection(targetRange.start, targetRange.start);
        if (editor) {
            editor.selection = newSelection;
            editor.revealRange(targetRange, TextEditorRevealType.Default);
        }
    }

    // Implmentation of getCells here based on Don's Jupyter extension work
    private getCells(document: TextDocument): ICell[] {
        const cellIdentifier: RegExp = RegExpValues.PythonCellMarker;
        const editorContext = new ContextKey(EditorContexts.HasCodeCells, this.commandManager);

        const cells: ICell[] = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            const line = document.lineAt(index);
            // clear regex cache
            cellIdentifier.lastIndex = -1;
            if (cellIdentifier.test(line.text)) {
                const results = cellIdentifier.exec(line.text);
                if (cells.length > 0) {
                    const previousCell = cells[cells.length - 1];
                    previousCell.range = new Range(previousCell.range.start, document.lineAt(index - 1).range.end);
                }

                if (results !== null) {
                    cells.push({
                        range: line.range,
                        title: results.length > 1 ? results[2].trim() : ''
                    });
                }
            }
        }

        if (cells.length >= 1) {
            const line = document.lineAt(document.lineCount - 1);
            const previousCell = cells[cells.length - 1];
            previousCell.range = new Range(previousCell.range.start, line.range.end);
        }

        // Inform the editor context that we have cells, fire and forget is ok on the promise here
        // as we don't care to wait for this context to be set and we can't do anything if it fails
        editorContext.set(cells.length > 0).catch();
        return cells;
    }
}
