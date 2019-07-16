// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Range, TextDocument } from 'vscode';

import { traceWarning } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { generateCellRanges } from '../cellFactory';
import { Commands } from '../constants';
import { ICodeLensFactory } from '../types';

@injectable()
export class CodeLensFactory implements ICodeLensFactory {

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {
    }

    public createCodeLenses(document: TextDocument): CodeLens[] {
        const ranges = generateCellRanges(document, this.configService.getSettings().datascience);
        const commands = this.enumerateCommands();
        const codeLenses: CodeLens[] = [];
        let firstCell = true;

        ranges.forEach(range => {
            commands.forEach(c => {
                const codeLens = this.createCodeLens(document, range.range, c, firstCell);
                if (codeLens) {
                    codeLenses.push(codeLens);
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

    private createCodeLens(document: TextDocument, range: Range, commandName: string, isFirst: boolean): CodeLens | undefined {
        // We only support specific commands
        // Be careful here. These arguments will be serialized during liveshare sessions
        // and so shouldn't reference local objects.
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
