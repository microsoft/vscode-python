// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Event, EventEmitter, Range, TextDocument } from 'vscode';

import { traceWarning } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { generateCellRanges } from '../cellFactory';
import { Commands } from '../constants';
import { InteractiveWindowMessages } from '../interactive-window/interactiveWindowTypes';
import { ICell, ICellHashProvider, ICodeLensFactory, IFileHashes, IInteractiveWindowListener } from '../types';

@injectable()
export class CodeLensFactory implements ICodeLensFactory, IInteractiveWindowListener {
    private updateEvent: EventEmitter<void> = new EventEmitter<void>();
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    private visibleCells: ICell[] = [];

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICellHashProvider) private hashProvider: ICellHashProvider
    ) {
        hashProvider.updated(this.hashesUpdated.bind(this));
    }

    public dispose(): void {
        noop();
    }

    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any) {
        switch (message) {
            case InteractiveWindowMessages.SendInfo:
                this.visibleCells = payload.visibleCells;
                this.updateEvent.fire();
                break;

            default:
                break;
        }
    }

    public hashesUpdated(): void {
        this.updateEvent.fire();
    }

    public get updateRequired(): Event<void> {
        return this.updateEvent.event;
    }

    public createCodeLenses(document: TextDocument): CodeLens[] {
        const ranges = generateCellRanges(document, this.configService.getSettings().datascience);
        const commands = this.enumerateCommands();
        const hashes = this.configService.getSettings().datascience.addGotoCodeLenses ? this.hashProvider.getHashes() : [];
        const codeLenses: CodeLens[] = [];
        let firstCell = true;

        ranges.forEach(range => {
            commands.forEach(c => {
                const codeLens = this.createCodeLens(document, range, c, firstCell);
                if (codeLens) {
                    codeLenses.push(codeLens);
                }
            });
            this.addExecutionCount(codeLenses, document, range.range, hashes, this.visibleCells);
            firstCell = false;
        });

        return codeLenses;
    }

    private enumerateCommands(): string[] {
        const commands = this.configService.getSettings().datascience.codeLenses;
        if (commands) {
            return commands.split(',').map(s => s.trim());
        }
        return [Commands.RunCurrentCell, Commands.RunAllCellsAbove, Commands.DebugCell];
    }

    private createCodeLens(document: TextDocument, cellRange: { range: Range; cell_type: string }, commandName: string, isFirst: boolean): CodeLens | undefined {
        // We only support specific commands
        // Be careful here. These arguments will be serialized during liveshare sessions
        // and so shouldn't reference local objects.
        const { range, cell_type } = cellRange;
        switch (commandName) {
            case Commands.RunCurrentCellAndAddBelow:
                return this.generateCodeLens(
                    range,
                    Commands.RunCurrentCellAndAddBelow,
                    localize.DataScience.runCurrentCellAndAddBelow());
            case Commands.AddCellBelow:
                return this.generateCodeLens(
                    range,
                    Commands.AddCellBelow,
                    localize.DataScience.addCellBelowCommandTitle(),
                    [document.fileName, range.start.line]);
            case Commands.DebugCurrentCellPalette:
                return this.generateCodeLens(
                    range,
                    Commands.DebugCurrentCellPalette,
                    localize.DataScience.debugCellCommandTitle());

            case Commands.DebugCell:
                // If it's not a code cell (e.g. markdown), don't add the "Debug cell" action.
                if (cell_type !== 'code') { break; }
                return this.generateCodeLens(
                    range,
                    Commands.DebugCell,
                    localize.DataScience.debugCellCommandTitle(),
                    [document.fileName, range.start.line, range.start.character, range.end.line, range.end.character]);

            case Commands.RunCurrentCell:
            case Commands.RunCell:
                return this.generateCodeLens(
                    range,
                    Commands.RunCell,
                    localize.DataScience.runCellLensCommandTitle(),
                    [document.fileName, range.start.line, range.start.character, range.end.line, range.end.character]);

            case Commands.RunAllCells:
                return this.generateCodeLens(
                    range,
                    Commands.RunAllCells,
                    localize.DataScience.runAllCellsLensCommandTitle(),
                    [document.fileName, range.start.line, range.start.character]);

            case Commands.RunAllCellsAbovePalette:
            case Commands.RunAllCellsAbove:
                if (!isFirst) {
                    return this.generateCodeLens(
                        range,
                        Commands.RunAllCellsAbove,
                        localize.DataScience.runAllCellsAboveLensCommandTitle(),
                        [document.fileName, range.start.line, range.start.character]);
                } else {
                    return this.generateCodeLens(
                        range,
                        Commands.RunCellAndAllBelow,
                        localize.DataScience.runCellAndAllBelowLensCommandTitle(),
                        [document.fileName, range.start.line, range.start.character]);
                }
                break;
            case Commands.RunCellAndAllBelowPalette:
            case Commands.RunCellAndAllBelow:
                return this.generateCodeLens(
                    range,
                    Commands.RunCellAndAllBelow,
                    localize.DataScience.runCellAndAllBelowLensCommandTitle(),
                    [document.fileName, range.start.line, range.start.character]);

            default:
                traceWarning(`Invalid command for code lens ${commandName}`);
                break;
        }

        return undefined;
    }

    private addExecutionCount(codeLens: CodeLens[], document: TextDocument, range: Range, hashes: IFileHashes[], visibleCells: ICell[]) {
        const list = hashes.find(h => h.file === document.fileName);
        if (list) {
            // Match just the start of the range. Should be - 2 (1 for 1 based numbers and 1 for skipping the comment at the top)
            const rangeMatches = list.hashes.filter(h => h.line - 2 === range.start.line);
            if (rangeMatches && rangeMatches.length) {
                const rangeMatch = rangeMatches[rangeMatches.length - 1];
                const cellMatch = visibleCells.find(c => c.data.execution_count === rangeMatch.executionCount && c.id === rangeMatch.id);
                if (cellMatch) {
                    codeLens.push(this.generateCodeLens(
                        range,
                        Commands.ScrollToCell,
                        localize.DataScience.scrollToCellTitleFormatMessage().format(rangeMatch.executionCount.toString()),
                        [document.fileName, rangeMatch.id]));
                }
            }
        }
    }

    // tslint:disable-next-line: no-any
    private generateCodeLens(range: Range, commandName: string, title: string, args?: any[]): CodeLens {
        return new CodeLens(range, this.generateCommand(commandName, title, args));
    }

    // tslint:disable-next-line: no-any
    private generateCommand(commandName: string, title: string, args?: any[]): Command {
        return {
            arguments: args,
            title,
            command: commandName
        };
    }
}
