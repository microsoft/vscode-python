// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Event, EventEmitter, Range, TextDocument } from 'vscode';

import { traceWarning } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { generateCellRanges } from '../cellFactory';
import { Commands } from '../constants';
import { ICellHashProvider, ICodeLensFactory, IFileHashes } from '../types';

@injectable()
export class CodeLensFactory implements ICodeLensFactory {
    private updateEvent: EventEmitter<void> = new EventEmitter<void>();

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICellHashProvider) private hashProvider: ICellHashProvider
    ) {
        hashProvider.updated(this.hashesUpdated.bind(this));
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
        const hashes = this.hashProvider.getHashes();
        const codeLenses: CodeLens[] = [];
        let firstCell = true;
        ranges.forEach(range => {
            let firstLensOfRange = true;
            commands.forEach(c => {
                const codeLens = this.createCodeLens(document, range.range, c, firstCell, firstLensOfRange, hashes);
                if (codeLens) {
                    codeLenses.push(codeLens);
                    firstLensOfRange = false;
                }
            });
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

    private createCodeLens(document: TextDocument, range: Range, commandName: string, isFirst: boolean, firstLensOfRange: boolean, hashes: IFileHashes[]): CodeLens | undefined {
        // Wrap the title in a format string if this is the first lens and we have an execution count for the range
        const formatString = this.computeTitleFormat(document, range, firstLensOfRange, hashes);

        // We only support specific commands
        // Be careful here. These arguments will be serialized during liveshare sessions
        // and so shouldn't reference local objects.
        switch (commandName) {
            case Commands.AddCellBelow:
                return this.generateCodeLens(
                    range,
                    commandName,
                    formatString.format(localize.DataScience.addCellBelowCommandTitle()),
                    [document.fileName, range.start.line]);

            case Commands.DebugCurrentCellPalette:
                return this.generateCodeLens(
                    range,
                    Commands.DebugCurrentCellPalette,
                    formatString.format(localize.DataScience.debugCellCommandTitle()));

            case Commands.DebugCell:
                return this.generateCodeLens(
                    range,
                    Commands.DebugCell,
                    formatString.format(localize.DataScience.debugCellCommandTitle()),
                    [document.fileName, range.start.line, range.start.character, range.end.line, range.end.character]);

            case Commands.RunCurrentCell:
            case Commands.RunCell:
                return this.generateCodeLens(
                    range,
                    Commands.RunCell,
                    formatString.format(localize.DataScience.runCellLensCommandTitle()),
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
                        formatString.format(localize.DataScience.runAllCellsAboveLensCommandTitle()),
                        [document.fileName, range.start.line, range.start.character]);
                }
                break;

            case Commands.RunCellAndAllBelowPalette:
            case Commands.RunCellAndAllBelow:
                return this.generateCodeLens(
                    range,
                    Commands.RunCellAndAllBelow,
                    formatString.format(localize.DataScience.runCellAndAllBelowLensCommandTitle()),
                    [document.fileName, range.start.line, range.start.character]);
                break;

            default:
                traceWarning(`Invalid command for code lens ${commandName}`);
                break;
        }

        return undefined;
    }

    private computeTitleFormat(_document: TextDocument, _range: Range, _firstLensOfRange: boolean, _hashes: IFileHashes[]): string {
        // // Only add the execution count on the first code lens and when we have a hash already
        // // for this file.
        // const list = hashes.find(h => h.file === document.fileName);
        // if (list && firstLensOfRange) {
        //     // Match just the start of the range. Should be - 2 (1 for 1 based numbers and 1 for skipping the comment at the top)
        //     const rangeMatch = list.hashes.find(h => h.line - 2 === range.start.line);
        //     if (rangeMatch) {
        //         return `[${rangeMatch.executionCount}] {0}`;
        //     }
        // }

        // Normal case is to not add anything to the string.
        return '{0}';
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
