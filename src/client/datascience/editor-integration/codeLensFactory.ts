// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Event, EventEmitter, Range, TextDocument, Uri } from 'vscode';

import { traceWarning } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { generateCellRangesFromDocument } from '../cellFactory';
import { CodeLensCommands, Commands } from '../constants';
import { InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import {
    ICell,
    ICellHashLogger,
    ICellHashProvider,
    ICodeLensFactory,
    IFileHashes,
    IInteractiveWindowListener,
    INotebook,
    INotebookExecutionLogger,
    INotebookProvider
} from '../types';

@injectable()
export class CodeLensFactory implements ICodeLensFactory, IInteractiveWindowListener {
    private updateEvent: EventEmitter<void> = new EventEmitter<void>();
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private cellExecutionCounts: Map<string, string> = new Map<string, string>();
    private hashProvider: ICellHashProvider | undefined;

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {}

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
            case InteractiveWindowMessages.NotebookExecutionActivated:
                this.initCellHashProvider(<string>payload).ignoreErrors();
                break;

            case InteractiveWindowMessages.FinishCell:
                const cell = payload as ICell;
                if (cell && cell.data && cell.data.execution_count) {
                    this.cellExecutionCounts.set(cell.id, cell.data.execution_count.toString());
                }
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
        const ranges = generateCellRangesFromDocument(
            document,
            this.configService.getSettings(document.uri).datascience
        );
        const commands = this.enumerateCommands(document.uri);
        const hashes = this.configService.getSettings(document.uri).datascience.addGotoCodeLenses
            ? this.hashProvider
                ? this.hashProvider.getHashes()
                : []
            : [];
        const codeLenses: CodeLens[] = [];
        let firstCell = true;

        ranges.forEach((range) => {
            commands.forEach((c) => {
                const codeLens = this.createCodeLens(document, range, c, firstCell);
                if (codeLens) {
                    codeLenses.push(codeLens);
                }
            });
            this.addExecutionCount(codeLenses, document, range.range, hashes);
            firstCell = false;
        });

        return codeLenses;
    }

    private async initCellHashProvider(notebookUri: string) {
        const nbUri: Uri = Uri.parse(notebookUri);
        if (!nbUri) {
            return;
        }

        // First get the active server
        const nb = await this.notebookProvider.getOrCreateNotebook({ identity: nbUri, getOnly: true });

        // If we have an executing notebook, get its cell hash provider service.
        if (nb) {
            this.hashProvider = this.getCellHashProvider(nb);
            if (this.hashProvider) {
                this.hashProvider.updated(this.hashesUpdated.bind(this));
            }
        }
    }
    private getCellHashProvider(nb: INotebook): ICellHashProvider | undefined {
        const cellHashLogger = <ICellHashLogger>(
            nb.getLoggers().find((logger: INotebookExecutionLogger) => (<ICellHashLogger>logger).getCellHashProvider)
        );

        if (cellHashLogger) {
            return cellHashLogger.getCellHashProvider();
        }
    }

    private enumerateCommands(resource: Resource): string[] {
        let fullCommandList: string[];
        // Add our non-debug commands
        const commands = this.configService.getSettings(resource).datascience.codeLenses;
        if (commands) {
            fullCommandList = commands.split(',').map((s) => s.trim());
        } else {
            fullCommandList = CodeLensCommands.DefaultDesignLenses;
        }

        // Add our debug commands
        const debugCommands = this.configService.getSettings(resource).datascience.debugCodeLenses;
        if (debugCommands) {
            fullCommandList = fullCommandList.concat(debugCommands.split(',').map((s) => s.trim()));
        } else {
            fullCommandList = fullCommandList.concat(CodeLensCommands.DefaultDebuggingLenses);
        }

        return fullCommandList;
    }

    // tslint:disable-next-line: max-func-body-length
    private createCodeLens(
        document: TextDocument,
        cellRange: { range: Range; cell_type: string },
        commandName: string,
        isFirst: boolean
    ): CodeLens | undefined {
        // We only support specific commands
        // Be careful here. These arguments will be serialized during liveshare sessions
        // and so shouldn't reference local objects.
        const { range, cell_type } = cellRange;
        switch (commandName) {
            case Commands.RunCurrentCellAndAddBelow:
                return this.generateCodeLens(
                    range,
                    Commands.RunCurrentCellAndAddBelow,
                    localize.DataScience.runCurrentCellAndAddBelow()
                );
            case Commands.AddCellBelow:
                return this.generateCodeLens(
                    range,
                    Commands.AddCellBelow,
                    localize.DataScience.addCellBelowCommandTitle(),
                    [document.fileName, range.start.line]
                );
            case Commands.DebugCurrentCellPalette:
                return this.generateCodeLens(
                    range,
                    Commands.DebugCurrentCellPalette,
                    localize.DataScience.debugCellCommandTitle()
                );

            case Commands.DebugCell:
                // If it's not a code cell (e.g. markdown), don't add the "Debug cell" action.
                if (cell_type !== 'code') {
                    break;
                }
                return this.generateCodeLens(range, Commands.DebugCell, localize.DataScience.debugCellCommandTitle(), [
                    document.fileName,
                    range.start.line,
                    range.start.character,
                    range.end.line,
                    range.end.character
                ]);

            case Commands.DebugStepOver:
                // Only code cells get debug actions
                if (cell_type !== 'code') {
                    break;
                }
                return this.generateCodeLens(
                    range,
                    Commands.DebugStepOver,
                    localize.DataScience.debugStepOverCommandTitle()
                );

            case Commands.DebugContinue:
                // Only code cells get debug actions
                if (cell_type !== 'code') {
                    break;
                }
                return this.generateCodeLens(
                    range,
                    Commands.DebugContinue,
                    localize.DataScience.debugContinueCommandTitle()
                );

            case Commands.DebugStop:
                // Only code cells get debug actions
                if (cell_type !== 'code') {
                    break;
                }
                return this.generateCodeLens(range, Commands.DebugStop, localize.DataScience.debugStopCommandTitle());

            case Commands.RunCurrentCell:
            case Commands.RunCell:
                return this.generateCodeLens(range, Commands.RunCell, localize.DataScience.runCellLensCommandTitle(), [
                    document.fileName,
                    range.start.line,
                    range.start.character,
                    range.end.line,
                    range.end.character
                ]);

            case Commands.RunAllCells:
                return this.generateCodeLens(
                    range,
                    Commands.RunAllCells,
                    localize.DataScience.runAllCellsLensCommandTitle(),
                    [document.fileName, range.start.line, range.start.character]
                );

            case Commands.RunAllCellsAbovePalette:
            case Commands.RunAllCellsAbove:
                if (!isFirst) {
                    return this.generateCodeLens(
                        range,
                        Commands.RunAllCellsAbove,
                        localize.DataScience.runAllCellsAboveLensCommandTitle(),
                        [document.fileName, range.start.line, range.start.character]
                    );
                } else {
                    return this.generateCodeLens(
                        range,
                        Commands.RunCellAndAllBelow,
                        localize.DataScience.runCellAndAllBelowLensCommandTitle(),
                        [document.fileName, range.start.line, range.start.character]
                    );
                }
                break;
            case Commands.RunCellAndAllBelowPalette:
            case Commands.RunCellAndAllBelow:
                return this.generateCodeLens(
                    range,
                    Commands.RunCellAndAllBelow,
                    localize.DataScience.runCellAndAllBelowLensCommandTitle(),
                    [document.fileName, range.start.line, range.start.character]
                );

            default:
                traceWarning(`Invalid command for code lens ${commandName}`);
                break;
        }

        return undefined;
    }

    private addExecutionCount(codeLens: CodeLens[], document: TextDocument, range: Range, hashes: IFileHashes[]) {
        const list = hashes.find((h) => this.fileSystem.arePathsSame(h.file, document.fileName));
        if (list) {
            // Match just the start of the range. Should be - 2 (1 for 1 based numbers and 1 for skipping the comment at the top)
            const rangeMatches = list.hashes.filter((h) => h.line - 2 === range.start.line);
            if (rangeMatches && rangeMatches.length) {
                const rangeMatch = rangeMatches[rangeMatches.length - 1];
                if (this.cellExecutionCounts.has(rangeMatch.id)) {
                    codeLens.push(
                        this.generateCodeLens(
                            range,
                            Commands.ScrollToCell,
                            localize.DataScience.scrollToCellTitleFormatMessage().format(
                                this.cellExecutionCounts.get(rangeMatch.id)!
                            ),
                            [document.fileName, rangeMatch.id]
                        )
                    );
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
