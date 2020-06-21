// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import {
    CodeLens,
    Event,
    EventEmitter,
    Position,
    Range,
    Selection,
    TextDocument,
    TextEditor,
    TextEditorRevealType
} from 'vscode';

import { IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDataScienceSettings, IDisposable, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { ICodeExecutionHelper } from '../../terminals/types';
import { CellMatcher } from '../cellMatcher';
import { Commands, Identifiers, Telemetry } from '../constants';
import {
    ICellRange,
    ICodeLensFactory,
    ICodeWatcher,
    IDataScienceErrorHandler,
    IInteractiveWindowProvider
} from '../types';

function getIndex(index: number, length: number): number {
    // return index within the length range with negative indexing
    if (length <= 0) {
        throw new RangeError(`Length must be > 0 not ${length}`);
    }
    // negative index count back from length
    if (index < 0) {
        index += length;
    }
    // bounded index
    if (index < 0) {
        return 0;
    } else if (index >= length) {
        return length - 1;
    } else {
        return index;
    }
}

@injectable()
export class CodeWatcher implements ICodeWatcher {
    public get codeLensUpdated(): Event<void> {
        return this.codeLensUpdatedEvent.event;
    }
    private static sentExecuteCellTelemetry: boolean = false;
    private document?: TextDocument;
    private version: number = -1;
    private fileName: string = '';
    private codeLenses: CodeLens[] = [];
    private cachedSettings: IDataScienceSettings | undefined;
    private codeLensUpdatedEvent: EventEmitter<void> = new EventEmitter<void>();
    private updateRequiredDisposable: IDisposable | undefined;
    private closeDocumentDisposable: IDisposable | undefined;

    constructor(
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(ICodeExecutionHelper) private executionHelper: ICodeExecutionHelper,
        @inject(IDataScienceErrorHandler) protected dataScienceErrorHandler: IDataScienceErrorHandler,
        @inject(ICodeLensFactory) private codeLensFactory: ICodeLensFactory
    ) {}

    public setDocument(document: TextDocument) {
        this.document = document;

        // Cache these, we don't want to pull an old version if the document is updated
        this.fileName = document.fileName;
        this.version = document.version;

        // Get document cells here. Make a copy of our settings.
        this.cachedSettings = JSON.parse(JSON.stringify(this.configService.getSettings(document.uri).datascience));

        // Use the factory to generate our new code lenses.
        this.codeLenses = this.codeLensFactory.createCodeLenses(document);

        // Listen for changes
        this.updateRequiredDisposable = this.codeLensFactory.updateRequired(this.onCodeLensFactoryUpdated.bind(this));

        // Make sure to stop listening for changes when this document closes.
        this.closeDocumentDisposable = this.documentManager.onDidCloseTextDocument(this.onDocumentClosed.bind(this));
    }

    public getFileName() {
        return this.fileName;
    }

    public getVersion() {
        return this.version;
    }

    public getCachedSettings(): IDataScienceSettings | undefined {
        return this.cachedSettings;
    }

    public getCodeLenses() {
        return this.codeLenses;
    }

    @captureTelemetry(Telemetry.DebugCurrentCell)
    public async debugCurrentCell() {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return Promise.resolve();
        }

        // Run the cell that matches the current cursor position.
        return this.runMatchingCell(this.documentManager.activeTextEditor.selection, false, true);
    }

    @captureTelemetry(Telemetry.RunAllCells)
    public async runAllCells() {
        const runCellCommands = this.codeLenses.filter(
            (c) =>
                c.command &&
                c.command.command === Commands.RunCell &&
                c.command.arguments &&
                c.command.arguments.length >= 5
        );
        let leftCount = runCellCommands.length;

        // Run all of our code lenses, they should always be ordered in the file so we can just
        // run them one by one
        for (const lens of runCellCommands) {
            // Make sure that we have the correct command (RunCell) lenses
            let range: Range = new Range(
                lens.command!.arguments![1],
                lens.command!.arguments![2],
                lens.command!.arguments![3],
                lens.command!.arguments![4]
            );
            if (this.document) {
                // Special case, if this is the first, expand our range to always include the top.
                if (leftCount === runCellCommands.length) {
                    range = new Range(new Position(0, 0), range.end);
                }

                const code = this.document.getText(range);
                leftCount -= 1;

                // Note: We do a get or create active before all addCode commands to make sure that we either have a history up already
                // or if we do not we need to start it up as these commands are all expected to start a new history if needed
                const success = await this.addCode(code, this.getFileName(), range.start.line);
                if (!success) {
                    await this.addErrorMessage(leftCount);
                    break;
                }
            }
        }

        // If there are no codelenses, just run all of the code as a single cell
        if (runCellCommands.length === 0) {
            return this.runFileInteractiveInternal(false);
        }
    }

    @captureTelemetry(Telemetry.RunFileInteractive)
    public async runFileInteractive() {
        return this.runFileInteractiveInternal(false);
    }

    @captureTelemetry(Telemetry.DebugFileInteractive)
    public async debugFileInteractive() {
        return this.runFileInteractiveInternal(true);
    }

    // Run all cells up to the cell containing this start line and character
    @captureTelemetry(Telemetry.RunAllCellsAbove)
    public async runAllCellsAbove(stopLine: number, stopCharacter: number) {
        const runCellCommands = this.codeLenses.filter((c) => c.command && c.command.command === Commands.RunCell);
        let leftCount = runCellCommands.findIndex(
            (c) => c.range.start.line >= stopLine && c.range.start.character >= stopCharacter
        );
        if (leftCount < 0) {
            leftCount = runCellCommands.length;
        }
        const startCount = leftCount;

        // Run our code lenses up to this point, lenses are created in order on document load
        // so we can rely on them being in linear order for this
        for (const lens of runCellCommands) {
            // Make sure we are dealing with run cell based code lenses in case more types are added later
            if (leftCount > 0 && this.document) {
                let range: Range = new Range(lens.range.start, lens.range.end);

                // If this is the first, make sure it extends to the top
                if (leftCount === startCount) {
                    range = new Range(new Position(0, 0), range.end);
                }

                // We have a cell and we are not past or at the stop point
                leftCount -= 1;
                const code = this.document.getText(range);
                const success = await this.addCode(code, this.getFileName(), lens.range.start.line);
                if (!success) {
                    await this.addErrorMessage(leftCount);
                    break;
                }
            } else {
                // If we get a cell past or at the stop point stop
                break;
            }
        }
    }

    @captureTelemetry(Telemetry.RunCellAndAllBelow)
    public async runCellAndAllBelow(startLine: number, startCharacter: number) {
        const runCellCommands = this.codeLenses.filter((c) => c.command && c.command.command === Commands.RunCell);
        const index = runCellCommands.findIndex(
            (c) => c.range.start.line >= startLine && c.range.start.character >= startCharacter
        );
        let leftCount = index > 0 ? runCellCommands.length - index : runCellCommands.length;

        // Run our code lenses from this point to the end, lenses are created in order on document load
        // so we can rely on them being in linear order for this
        for (let pos = index; pos >= 0 && pos < runCellCommands.length; pos += 1) {
            if (leftCount > 0 && this.document) {
                const lens = runCellCommands[pos];
                // We have a cell and we are not past or at the stop point
                leftCount -= 1;
                const code = this.document.getText(lens.range);
                const success = await this.addCode(code, this.getFileName(), lens.range.start.line);
                if (!success) {
                    await this.addErrorMessage(leftCount);
                    break;
                }
            }
        }
    }

    @captureTelemetry(Telemetry.RunSelectionOrLine)
    public async runSelectionOrLine(activeEditor: TextEditor | undefined) {
        if (
            this.document &&
            activeEditor &&
            this.fileSystem.arePathsSame(activeEditor.document.fileName, this.document.fileName)
        ) {
            // Get just the text of the selection or the current line if none
            const codeToExecute = await this.executionHelper.getSelectedTextToExecute(activeEditor);
            if (!codeToExecute) {
                return;
            }
            const normalizedCode = await this.executionHelper.normalizeLines(codeToExecute!);
            if (!normalizedCode || normalizedCode.trim().length === 0) {
                return;
            }
            await this.addCode(normalizedCode, this.getFileName(), activeEditor.selection.start.line, activeEditor);
        }
    }

    @captureTelemetry(Telemetry.RunToLine)
    public async runToLine(targetLine: number) {
        if (this.document && targetLine > 0) {
            const previousLine = this.document.lineAt(targetLine - 1);
            const code = this.document.getText(
                new Range(0, 0, previousLine.range.end.line, previousLine.range.end.character)
            );

            if (code && code.trim().length) {
                await this.addCode(code, this.getFileName(), 0);
            }
        }
    }

    @captureTelemetry(Telemetry.RunFromLine)
    public async runFromLine(targetLine: number) {
        if (this.document && targetLine < this.document.lineCount) {
            const lastLine = this.document.lineAt(this.document.lineCount - 1);
            const code = this.document.getText(
                new Range(targetLine, 0, lastLine.range.end.line, lastLine.range.end.character)
            );

            if (code && code.trim().length) {
                await this.addCode(code, this.getFileName(), targetLine);
            }
        }
    }

    @captureTelemetry(Telemetry.RunCell)
    public runCell(range: Range): Promise<void> {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return Promise.resolve();
        }

        // Run the cell clicked. Advance if the cursor is inside this cell and we're allowed to
        const advance =
            range.contains(this.documentManager.activeTextEditor.selection.start) &&
            this.configService.getSettings(this.documentManager.activeTextEditor.document.uri).datascience
                .enableAutoMoveToNextCell;
        return this.runMatchingCell(range, advance);
    }

    @captureTelemetry(Telemetry.DebugCurrentCell)
    public debugCell(range: Range): Promise<void> {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return Promise.resolve();
        }

        // Debug the cell clicked.
        return this.runMatchingCell(range, false, true);
    }

    @captureTelemetry(Telemetry.RunCurrentCell)
    public runCurrentCell(): Promise<void> {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return Promise.resolve();
        }

        // Run the cell that matches the current cursor position.
        return this.runMatchingCell(this.documentManager.activeTextEditor.selection, false);
    }

    @captureTelemetry(Telemetry.RunCurrentCellAndAdvance)
    public async runCurrentCellAndAdvance() {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return;
        }

        // Run the cell that matches the current cursor position. Always advance
        return this.runMatchingCell(this.documentManager.activeTextEditor.selection, true);
    }

    public async addEmptyCellToBottom(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        const cellDelineator = this.getDefaultCellMarker(editor?.document.uri);
        if (editor) {
            editor.edit((editBuilder) => {
                editBuilder.insert(new Position(editor.document.lineCount, 0), `\n\n${cellDelineator}\n`);
            });

            const newPosition = new Position(editor.document.lineCount + 3, 0); // +3 to account for the added spaces and to position after the new mark
            return this.advanceToRange(new Range(newPosition, newPosition));
        }
    }

    public async runCurrentCellAndAddBelow(): Promise<void> {
        if (!this.documentManager.activeTextEditor || !this.documentManager.activeTextEditor.document) {
            return Promise.resolve();
        }

        const editor = this.documentManager.activeTextEditor;
        const cellMatcher = new CellMatcher();
        let index = 0;
        const cellDelineator = this.getDefaultCellMarker(editor.document.uri);

        if (editor) {
            editor.edit((editBuilder) => {
                let lastCell = true;

                for (let i = editor.selection.end.line + 1; i < editor.document.lineCount; i += 1) {
                    if (cellMatcher.isCell(editor.document.lineAt(i).text)) {
                        lastCell = false;
                        index = i;
                        editBuilder.insert(new Position(i, 0), `${cellDelineator}\n\n`);
                        break;
                    }
                }

                if (lastCell) {
                    index = editor.document.lineCount;
                    editBuilder.insert(new Position(editor.document.lineCount, 0), `\n${cellDelineator}\n`);
                }
            });
        }

        // Run the cell that matches the current cursor position, and then advance to the new cell
        const newPosition = new Position(index + 1, 0);
        return this.runMatchingCell(editor.selection, false).then(() =>
            this.advanceToRange(new Range(newPosition, newPosition))
        );
    }

    public async insertCellBelowPosition(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        if (editor && editor.selection.end) {
            return this.insertCell(editor, editor.selection.end.line + 1);
        }
    }

    public async insertCellBelow(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        if (editor && editor.selection) {
            const cell = this.getCellFromPosition(editor.selection.end);
            if (cell) {
                return this.insertCell(editor, cell.range.end.line + 1);
            } else {
                return this.insertCell(editor, editor.selection.end.line + 1);
            }
        }
    }

    public async insertCellAbove(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        if (editor && editor.selection) {
            const cell = this.getCellFromPosition(editor.selection.start);
            if (cell) {
                return this.insertCell(editor, cell.range.start.line);
            } else {
                return this.insertCell(editor, editor.selection.start.line);
            }
        }
    }

    public async deleteCells(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        if (!editor || !editor.selection) {
            return Promise.resolve();
        }

        const firstLastCells = this.getStartEndCells(editor.selection);
        if (!firstLastCells) {
            return Promise.resolve();
        }
        const startCell = firstLastCells[0];
        const endCell = firstLastCells[1];

        // Start of the document should start at position 0, 0 and end one line ahead.
        let startLineNumber = 0;
        let startCharacterNumber = 0;
        let endLineNumber = endCell.range.end.line + 1;
        let endCharacterNumber = 0;
        // Anywhere else in the document should start at the end of line before the
        // cell and end at the last character of the cell.
        if (startCell.range.start.line > 0) {
            startLineNumber = startCell.range.start.line - 1;
            startCharacterNumber = editor.document.lineAt(startLineNumber).range.end.character;
            endLineNumber = endCell.range.end.line;
            endCharacterNumber = endCell.range.end.character;
        }
        const cellExtendedRange = new Range(
            new Position(startLineNumber, startCharacterNumber),
            new Position(endLineNumber, endCharacterNumber)
        );
        return editor
            .edit((editBuilder) => {
                editBuilder.replace(cellExtendedRange, '');
                this.codeLensUpdatedEvent.fire();
            })
            .then(() => {
                return Promise.resolve();
            });
    }

    public async selectCell(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        if (editor && editor.selection) {
            const startEndCells = this.getStartEndCells(editor.selection);
            if (startEndCells) {
                const startCell = startEndCells[0];
                const endCell = startEndCells[1];
                if (editor.selection.anchor.isBeforeOrEqual(editor.selection.active)) {
                    editor.selection = new Selection(startCell.range.start, endCell.range.end);
                } else {
                    editor.selection = new Selection(endCell.range.end, startCell.range.start);
                }
            }
        }
    }

    public async selectCellContents(): Promise<void> {
        const editor = this.documentManager.activeTextEditor;
        if (!editor || !editor.selection) {
            return Promise.resolve();
        }
        const startEndCellIndex = this.getStartEndCellIndex(editor.selection);
        if (!startEndCellIndex) {
            return Promise.resolve();
        }
        const startCellIndex = startEndCellIndex[0];
        const endCellIndex = startEndCellIndex[1];
        const isAnchorLessEqualActive = editor.selection.anchor.isBeforeOrEqual(editor.selection.active);

        const cells = this.codeLensFactory.cells;
        const selections: Selection[] = [];
        for (let i = startCellIndex; i <= endCellIndex; i += 1) {
            const cell = cells[i];
            let anchorLine = cell.range.start.line + 1;
            let achorCharacter = 0;
            let activeLine = cell.range.end.line;
            let activeCharacter = cell.range.end.character;
            // if cell is only one line long, select the end of that line
            if (cell.range.start.line === cell.range.end.line) {
                anchorLine = cell.range.start.line;
                achorCharacter = editor.document.lineAt(anchorLine).range.end.character;
                activeLine = anchorLine;
                activeCharacter = achorCharacter;
            }
            if (isAnchorLessEqualActive) {
                selections.push(new Selection(anchorLine, achorCharacter, activeLine, activeCharacter));
            } else {
                selections.push(new Selection(activeLine, activeCharacter, anchorLine, achorCharacter));
            }
        }
        editor.selections = selections;
    }

    public async extendSelectionByCellAbove(): Promise<void> {
        // This behaves similarly to excel "Extend Selection by One Cell Above".
        // The direction of the selection matters (i.e. where the active cursor)
        // position is. First, it ensures that complete cells are selection.
        // If so, then if active cursor is in cells below it contracts the
        // selection range. If the active cursor is above, it expands the
        // selection range.
        const editor = this.documentManager.activeTextEditor;
        if (!editor || !editor.selection) {
            return Promise.resolve();
        }
        const currentSelection = editor.selection;
        const startEndCellIndex = this.getStartEndCellIndex(editor.selection);
        if (!startEndCellIndex) {
            return Promise.resolve();
        }

        const isAnchorLessThanActive = editor.selection.anchor.isBefore(editor.selection.active);

        const cells = this.codeLensFactory.cells;
        const startCellIndex = startEndCellIndex[0];
        const endCellIndex = startEndCellIndex[1];
        const startCell = cells[startCellIndex];
        const endCell = cells[endCellIndex];

        if (
            !startCell.range.start.isEqual(currentSelection.start) ||
            !endCell.range.end.isEqual(currentSelection.end)
        ) {
            // full cell range not selected, first select a full cell range.
            let selection: Selection;
            if (isAnchorLessThanActive) {
                if (startCellIndex < endCellIndex) {
                    // active at end of cell before endCell
                    selection = new Selection(startCell.range.start, cells[endCellIndex - 1].range.end);
                } else {
                    // active at end of startCell
                    selection = new Selection(startCell.range.end, startCell.range.start);
                }
            } else {
                // active at start of start cell.
                selection = new Selection(endCell.range.end, startCell.range.start);
            }
            editor.selection = selection;
        } else {
            // full cell range is selected now decide if expanding or contracting?
            if (isAnchorLessThanActive && startCellIndex < endCellIndex) {
                // anchor is above active, contract selection by cell below.
                const newEndCell = cells[endCellIndex - 1];
                editor.selection = new Selection(startCell.range.start, newEndCell.range.end);
            } else {
                // anchor is below active, expand selection by cell above.
                if (startCellIndex > 0) {
                    const aboveCell = cells[startCellIndex - 1];
                    editor.selection = new Selection(endCell.range.end, aboveCell.range.start);
                }
            }
        }
    }

    private getStartEndCells(selection: Selection): ICellRange[] | undefined {
        const startEndCellIndex = this.getStartEndCellIndex(selection);
        if (startEndCellIndex) {
            const startCell = this.getCellFromIndex(startEndCellIndex[0]);
            const endCell = this.getCellFromIndex(startEndCellIndex[1]);
            return [startCell, endCell];
        }
    }

    private getStartEndCellIndex(selection: Selection): number[] | undefined {
        let startCellIndex = this.getCellIndex(selection.start);
        let endCellIndex = startCellIndex;
        // handle if the selection is the same line, hence same cell
        if (selection.start.line !== selection.end.line) {
            endCellIndex = this.getCellIndex(selection.end);
        }
        // handle when selection is above the top most cell
        if (startCellIndex === -1) {
            if (endCellIndex === -1) {
                return undefined;
            } else {
                // selected a range above the first cell.
                startCellIndex = 0;
                const startCell = this.getCellFromIndex(0);
                if (selection.start.line > startCell.range.start.line) {
                    throw RangeError(
                        `Should not be able to pick a range with an end in a cell and start after a cell. ${selection.start.line} > ${startCell.range.end.line}`
                    );
                }
            }
        }
        if (startCellIndex >= 0 && endCellIndex >= 0) {
            return [startCellIndex, endCellIndex];
        }
    }

    private async insertCell(editor: TextEditor, line: number): Promise<void> {
        // insertCell
        //
        // Inserts a cell at current line defined as two new lines and then
        // moves cursor to within the cell.
        // ```
        // # %%
        //
        // ```
        //
        const cellDelineator = this.getDefaultCellMarker(editor.document.uri);
        let newCell = `${cellDelineator}\n\n`;
        if (line >= editor.document.lineCount) {
            newCell = `\n${cellDelineator}\n`;
        }

        const cellStartPosition = new Position(line, 0);
        const newCursorPosition = new Position(line + 1, 0);

        editor.edit((editBuilder) => {
            editBuilder.insert(cellStartPosition, newCell);
            this.codeLensUpdatedEvent.fire();
        });

        editor.selection = new Selection(newCursorPosition, newCursorPosition);
    }

    private getDefaultCellMarker(resource: Resource): string {
        return (
            this.configService.getSettings(resource).datascience.defaultCellMarker || Identifiers.DefaultCodeCellMarker
        );
    }

    private onCodeLensFactoryUpdated(): void {
        // Update our code lenses.
        if (this.document) {
            this.codeLenses = this.codeLensFactory.createCodeLenses(this.document);
        }
        this.codeLensUpdatedEvent.fire();
    }

    private onDocumentClosed(doc: TextDocument): void {
        if (this.document && this.fileSystem.arePathsSame(doc.fileName, this.document.fileName)) {
            this.codeLensUpdatedEvent.dispose();
            this.closeDocumentDisposable?.dispose(); // NOSONAR
            this.updateRequiredDisposable?.dispose(); // NOSONAR
        }
    }

    private async addCode(
        code: string,
        file: string,
        line: number,
        editor?: TextEditor,
        debug?: boolean
    ): Promise<boolean> {
        let result = false;
        try {
            const stopWatch = new StopWatch();
            const activeInteractiveWindow = await this.interactiveWindowProvider.getOrCreateActive();
            if (debug) {
                result = await activeInteractiveWindow.debugCode(code, file, line, editor);
            } else {
                result = await activeInteractiveWindow.addCode(code, file, line, editor);
            }
            this.sendPerceivedCellExecute(stopWatch);
        } catch (err) {
            await this.dataScienceErrorHandler.handleError(err);
        }

        return result;
    }

    private async addErrorMessage(leftCount: number): Promise<void> {
        // Only show an error message if any left
        if (leftCount > 0) {
            const message = localize.DataScience.cellStopOnErrorFormatMessage().format(leftCount.toString());
            try {
                const activeInteractiveWindow = await this.interactiveWindowProvider.getOrCreateActive();
                return activeInteractiveWindow.addMessage(message);
            } catch (err) {
                await this.dataScienceErrorHandler.handleError(err);
            }
        }
    }

    private sendPerceivedCellExecute(runningStopWatch?: StopWatch) {
        if (runningStopWatch) {
            if (!CodeWatcher.sentExecuteCellTelemetry) {
                CodeWatcher.sentExecuteCellTelemetry = true;
                sendTelemetryEvent(Telemetry.ExecuteCellPerceivedCold, runningStopWatch.elapsedTime);
            } else {
                sendTelemetryEvent(Telemetry.ExecuteCellPerceivedWarm, runningStopWatch.elapsedTime);
            }
        }
    }

    private async runMatchingCell(range: Range, advance?: boolean, debug?: boolean) {
        const currentRunCellLens = this.getCurrentCellLens(range.start);
        const nextRunCellLens = this.getNextCellLens(range.start);

        if (currentRunCellLens) {
            // Move the next cell if allowed.
            if (advance) {
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

            // Run the cell after moving the selection
            if (this.document) {
                // Use that to get our code.
                const code = this.document.getText(currentRunCellLens.range);
                await this.addCode(
                    code,
                    this.getFileName(),
                    currentRunCellLens.range.start.line,
                    this.documentManager.activeTextEditor,
                    debug
                );
            }
        }
    }

    private getCellIndex(position: Position): number {
        return this.codeLensFactory.cells.findIndex((cell) => position && cell.range.contains(position));
    }

    private getCellFromIndex(index: number): ICellRange {
        const cells = this.codeLensFactory.cells;
        const indexBounded = getIndex(index, cells.length);
        return cells[indexBounded];
    }

    private getCellFromPosition(position?: Position): ICellRange | undefined {
        if (!position) {
            const editor = this.documentManager.activeTextEditor;
            if (editor && editor.selection) {
                position = editor.selection.start;
            }
        }
        if (position) {
            const index = this.getCellIndex(position);
            if (index >= 0) {
                return this.codeLensFactory.cells[index];
            }
        }
    }

    private getCurrentCellLens(pos: Position): CodeLens | undefined {
        return this.codeLenses.find(
            (l) => l.range.contains(pos) && l.command !== undefined && l.command.command === Commands.RunCell
        );
    }

    private getNextCellLens(pos: Position): CodeLens | undefined {
        const currentIndex = this.codeLenses.findIndex(
            (l) => l.range.contains(pos) && l.command !== undefined && l.command.command === Commands.RunCell
        );
        if (currentIndex >= 0) {
            return this.codeLenses.find(
                (l: CodeLens, i: number) =>
                    l.command !== undefined && l.command.command === Commands.RunCell && i > currentIndex
            );
        }
        return undefined;
    }

    private async runFileInteractiveInternal(debug: boolean) {
        if (this.document) {
            const code = this.document.getText();
            await this.addCode(code, this.getFileName(), 0, undefined, debug);
        }
    }

    // User has picked run and advance on the last cell of a document
    // Create a new cell at the bottom and put their selection there, ready to type
    private createNewCell(currentRange: Range): Range {
        const editor = this.documentManager.activeTextEditor;
        const newPosition = new Position(currentRange.end.line + 3, 0); // +3 to account for the added spaces and to position after the new mark

        if (editor) {
            editor.edit((editBuilder) => {
                editBuilder.insert(
                    new Position(currentRange.end.line + 1, 0),
                    `\n\n${this.getDefaultCellMarker(editor.document.uri)}\n`
                );
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
