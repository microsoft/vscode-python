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
import { IConfigurationService, IDataScienceSettings, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { ICodeExecutionHelper } from '../../terminals/types';
import { CellMatcher } from '../cellMatcher';
import { Commands, Identifiers, Telemetry } from '../constants';
import { ICodeLensFactory, ICodeWatcher, IDataScienceErrorHandler, IInteractiveWindowProvider } from '../types';

@injectable()
export class CodeWatcher implements ICodeWatcher {
    private static sentExecuteCellTelemetry: boolean = false;
    private document?: TextDocument;
    private version: number = -1;
    private fileName: string = '';
    private codeLenses: CodeLens[] = [];
    private cachedSettings: IDataScienceSettings | undefined;
    private codeLensUpdatedEvent: EventEmitter<void> = new EventEmitter<void>();

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
        this.codeLensFactory.updateRequired(this.onCodeLensFactoryUpdated.bind(this));
    }

    public get codeLensUpdated(): Event<void> {
        return this.codeLensUpdatedEvent.event;
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
