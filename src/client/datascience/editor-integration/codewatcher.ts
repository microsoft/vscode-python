// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Position, Range, Selection, TextDocument, TextEditor, TextEditorRevealType } from 'vscode';

import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDataScienceSettings, ILogger } from '../../common/types';
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
    private cachedSettings: IDataScienceSettings | undefined;

    constructor(@inject(IApplicationShell) private applicationShell: IApplicationShell,
                @inject(ILogger) private logger: ILogger,
                @inject(IHistoryProvider) private historyProvider : IHistoryProvider,
                @inject(IFileSystem) private fileSystem: IFileSystem,
                @inject(IConfigurationService) private configService: IConfigurationService,
                @inject(IDocumentManager) private documentManager : IDocumentManager) {}

    public setDocument(document: TextDocument) {
        this.document = document;

        // Cache these, we don't want to pull an old version if the document is updated
        this.fileName = document.fileName;
        this.version = document.version;

        // Get document cells here. Make a copy of our settings.
        this.cachedSettings = JSON.parse(JSON.stringify(this.configService.getSettings().datascience));
        const cells = generateCellRanges(document, this.cachedSettings);

        this.codeLenses = [];
        let firstCell = true;
        // Be careful here. These arguments will be serialized during liveshare sessions
        // and so shouldn't reference local objects.
        cells.forEach(cell => {
            const cmd: Command = {
                arguments: [document.fileName, cell.range.start.line, cell.range.start.character, cell.range.end.line, cell.range.end.character],
                title: localize.DataScience.runCellLensCommandTitle(),
                command: Commands.RunCell
            };
            this.codeLenses.push(new CodeLens(cell.range, cmd));
            const runAllAboveCmd: Command = {
                arguments: [document.fileName, cell.range.start.line, cell.range.start.character],
                title: localize.DataScience.runAllCellsAboveLensCommandTitle(),
                command: Commands.RunAllCellsAbove
            };
            // The first cell should not have a run all above command
            if (firstCell) {
                firstCell = false;
            } else {
                this.codeLenses.push(new CodeLens(cell.range, runAllAboveCmd));
            }
            const runCellAndBelowCmd: Command = {
                arguments: [document.fileName, cell.range.start.line, cell.range.start.character],
                title: localize.DataScience.runCellAndAllBelowLensCommandTitle(),
                command: Commands.RunCellAndAllBelow
            };
            this.codeLenses.push(new CodeLens(cell.range, runCellAndBelowCmd));
        });
    }

    public getFileName() {
        return this.fileName;
    }

    public getVersion() {
        return this.version;
    }

    public getCachedSettings() : IDataScienceSettings | undefined {
        return this.cachedSettings;
    }

    public getCodeLenses() {
        return this.codeLenses;
    }

    @captureTelemetry(Telemetry.RunAllCells)
    public async runAllCells() {
        // Run all of our code lenses, they should always be ordered in the file so we can just
        // run them one by one
        for (const lens of this.codeLenses) {
            // Make sure that we have the correct command (RunCell) lenses
            if (lens.command && lens.command.command === Commands.RunCell && lens.command.arguments && lens.command.arguments.length >= 5) {
                const range: Range = new Range(lens.command.arguments[1], lens.command.arguments[2], lens.command.arguments[3], lens.command.arguments[4]);
                if (this.document && range) {
                    const code = this.document.getText(range);

                    // Note: We do a get or create active before all addCode commands to make sure that we either have a history up already
                    // or if we do not we need to start it up as these commands are all expected to start a new history if needed
                    const activeHistory = await this.historyProvider.getOrCreateActive();
                    await activeHistory.addCode(code, this.getFileName(), range.start.line);
                }
            }
        }

        // If there are no codelenses, just run all of the code as a single cell
        if (this.codeLenses.length === 0) {
            return this.runFileInteractiveInternal();
        }
    }

    @captureTelemetry(Telemetry.RunFileInteractive)
    public async runFileInteractive() {
        return this.runFileInteractiveInternal();
    }

    // Run all cells up to the cell containing this start line and character
    @captureTelemetry(Telemetry.RunAllCellsAbove)
    public async runAllCellsAbove(stopLine: number, stopCharacter: number) {
        // Run our code lenses up to this point, lenses are created in order on document load
        // so we can rely on them being in linear order for this
        for (const lens of this.codeLenses) {
            const pastStop = (lens.range.start.line >= stopLine && lens.range.start.character >= stopCharacter);
            // Make sure we are dealing with run cell based code lenses in case more types are added later
            if (lens.command && lens.command.command === Commands.RunCell) {
                if (!pastStop && this.document) {
                    // We have a cell and we are not past or at the stop point
                    const code = this.document.getText(lens.range);
                    const activeHistory = await this.historyProvider.getOrCreateActive();
                    await activeHistory.addCode(code, this.getFileName(), lens.range.start.line);
                } else {
                    // If we get a cell past or at the stop point stop
                    break;
                }
            }
        }
    }

    @captureTelemetry(Telemetry.RunAllCellsAbove)
    public async runCellAndAllBelow(startLine: number, startCharacter: number) {
        // Run our code lenses from this point to the end, lenses are created in order on document load
        // so we can rely on them being in linear order for this
        for (const lens of this.codeLenses) {
            const pastStart = (lens.range.start.line >= startLine && lens.range.start.character >= startCharacter);
            // Make sure we are dealing with run cell based code lenses in case more types are added later
            if (lens.command && lens.command.command === Commands.RunCell) {
                if (pastStart && this.document) {
                    // We have a cell and we are not past or at the stop point
                    const code = this.document.getText(lens.range);
                    const activeHistory = await this.historyProvider.getOrCreateActive();
                    await activeHistory.addCode(code, this.getFileName(), lens.range.start.line);
                }
            }
        }
    }

    @captureTelemetry(Telemetry.RunSelectionOrLine)
    public async runSelectionOrLine(activeEditor : TextEditor | undefined) {
        if (this.document && activeEditor &&
            this.fileSystem.arePathsSame(activeEditor.document.fileName, this.document.fileName)) {

            // Get just the text of the selection or the current line if none
            let code: string;
            if (activeEditor.selection.start.line === activeEditor.selection.end.line &&
                activeEditor.selection.start.character === activeEditor.selection.end.character) {
                const line = this.document.lineAt(activeEditor.selection.start.line);
                code = line.text;
            } else {
                code = this.document.getText(new Range(activeEditor.selection.start, activeEditor.selection.end));
            }

            if (code && code.trim().length) {
                const activeHistory = await this.historyProvider.getOrCreateActive();
                await activeHistory.addCode(code, this.getFileName(), activeEditor.selection.start.line, activeEditor);
            }
        }
    }

    @captureTelemetry(Telemetry.RunToLine)
    public async runToLine(targetLine: number) {
        if (this.document && targetLine > 0) {
            const previousLine = this.document.lineAt(targetLine - 1);
            const code = this.document.getText(new Range(0, 0, previousLine.range.end.line, previousLine.range.end.character));

            if (code && code.trim().length) {
                const activeHistory = await this.historyProvider.getOrCreateActive();
                await activeHistory.addCode(code, this.getFileName(), 0);
            }
        }
    }

    @captureTelemetry(Telemetry.RunFromLine)
    public async runFromLine(targetLine: number) {
        if (this.document && targetLine < this.document.lineCount) {
            const lastLine = this.document.lineAt(this.document.lineCount - 1);
            const code = this.document.getText(new Range(targetLine, 0, lastLine.range.end.line, lastLine.range.end.character));

            if (code && code.trim().length) {
                const activeHistory = await this.historyProvider.getOrCreateActive();
                await activeHistory.addCode(code, this.getFileName(), targetLine);
            }
        }
    }

    @captureTelemetry(Telemetry.RunCell)
    public async runCell(range: Range) {
        if (this.document) {
            // Use that to get our code.
            const code = this.document.getText(range);

            try {
                const activeHistory = await this.historyProvider.getOrCreateActive();
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

    private async runFileInteractiveInternal() {
        if (this.document) {
            const code = this.document.getText();
            const activeHistory = await this.historyProvider.getOrCreateActive();
            await activeHistory.addCode(code, this.getFileName(), 0);
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
