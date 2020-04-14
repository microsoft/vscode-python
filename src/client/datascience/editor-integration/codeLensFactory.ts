// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CodeLens, Command, Event, EventEmitter, Range, TextDocument, Uri } from 'vscode';

import { IDocumentManager } from '../../common/application/types';
import { traceWarning } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { generateCellRangesFromDocument, ICellRange } from '../cellFactory';
import { CodeLensCommands, Commands, Identifiers } from '../constants';
import {
    INotebookIdentity,
    InteractiveWindowMessages,
    SysInfoReason
} from '../interactive-common/interactiveWindowTypes';
import {
    ICell,
    ICellHashProvider,
    ICodeLensFactory,
    IFileHashes,
    IInteractiveWindowListener,
    INotebook,
    INotebookProvider
} from '../types';

type CodeLensCacheData = {
    cachedDocumentVersion: number | undefined;
    cachedExecutionCount: number | undefined;
    documentLenses: CodeLens[];
    cellRanges: ICellRange[];
    gotoCellLens: CodeLens[];
};

/**
 * This class is a singleton that generates code lenses for any document the user opens. It listens
 * to cells being execute so it can add 'goto' lenses on cells that have already been run.
 */
@injectable()
export class CodeLensFactory implements ICodeLensFactory, IInteractiveWindowListener {
    private updateEvent: EventEmitter<void> = new EventEmitter<void>();
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private cellExecutionCounts = new Map<string, string>();
    private documentExecutionCounts = new Map<string, number>();
    private hashProvider: ICellHashProvider | undefined;
    private interactiveIdentity: Uri | undefined; // Once we have more than one interactive window, this logic won't work anymore
    private codeLensCache = new Map<string, CodeLensCacheData>();

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDocumentManager) private documentManager: IDocumentManager
    ) {
        this.documentManager.onDidCloseTextDocument(this.onClosedDocument.bind(this));
        this.configService.getSettings(undefined).onDidChange(this.onChangedSettings.bind(this));
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
            case InteractiveWindowMessages.NotebookIdentity:
                this.setIdentity(payload);
                break;

            case InteractiveWindowMessages.NotebookClose:
                if (payload.resource.toString() === this.interactiveIdentity?.toString()) {
                    this.interactiveIdentity = undefined;
                    this.hashProvider = undefined;
                    this.documentExecutionCounts.clear();

                    // Clear out any goto cell code lenses.
                    this.updateEvent.fire();
                }
                break;
            case InteractiveWindowMessages.NotebookExecutionActivated:
                this.initCellHashProvider();
                break;

            case InteractiveWindowMessages.AddedSysInfo:
                if (payload && payload.type) {
                    const reason = payload.type as SysInfoReason;
                    if (reason !== SysInfoReason.Interrupt) {
                        this.documentExecutionCounts.clear();
                        // Clear out any goto cell code lenses.
                        this.updateEvent.fire();
                    }
                }
                break;

            case InteractiveWindowMessages.FinishCell:
                const cell = payload as ICell;
                if (cell && cell.data && cell.data.execution_count) {
                    if (cell.file && cell.file !== Identifiers.EmptyFileName) {
                        this.cellExecutionCounts.set(cell.id, cell.data.execution_count.toString());
                        this.documentExecutionCounts.set(
                            cell.file.toLocaleLowerCase(),
                            parseInt(cell.data.execution_count.toString(), 10)
                        );
                        this.updateEvent.fire();
                    }
                }
                break;

            default:
                break;
        }
    }

    public get updateRequired(): Event<void> {
        return this.updateEvent.event;
    }

    public createCodeLenses(document: TextDocument): CodeLens[] {
        // See if we have a cached version of the code lenses for this document
        const key = document.fileName.toLocaleLowerCase();
        let cache = this.codeLensCache.get(key);
        let needUpdate = false;

        // If we don't have one, generate one
        if (!cache) {
            cache = {
                cachedDocumentVersion: undefined,
                cachedExecutionCount: undefined,
                documentLenses: [],
                cellRanges: [],
                gotoCellLens: []
            };
            needUpdate = true;
            this.codeLensCache.set(key, cache);
        }

        // If the document version doesn't match, our cell ranges are out of date
        if (cache.cachedDocumentVersion !== document.version) {
            cache.cellRanges = generateCellRangesFromDocument(
                document,
                this.configService.getSettings(document.uri).datascience
            );

            // Because we have all new ranges, we need to recompute ALL of our code lenses.
            cache.documentLenses = [];
            cache.gotoCellLens = [];
            cache.cachedDocumentVersion = document.version;
            needUpdate = true;
        }

        // If the document execution count doesn't match, then our goto cell lens is out of date
        if (cache.cachedExecutionCount !== this.documentExecutionCounts.get(key)) {
            cache.gotoCellLens = [];
            cache.cachedExecutionCount = this.documentExecutionCounts.get(key);
            needUpdate = true;
        }

        // Generate our code lenses if necessary
        if (cache.documentLenses.length === 0 && needUpdate && cache.cellRanges.length) {
            // Enumerate the possible commands for the document based code lenses
            const commands = needUpdate ? this.enumerateCommands(document.uri) : [];

            // Then iterate over all of the cell ranges and generate code lenses for each possible
            // commands
            let firstCell = true;
            cache.cellRanges.forEach((r) => {
                commands.forEach((c) => {
                    const codeLens = this.createCodeLens(document, r, c, firstCell);
                    if (codeLens) {
                        cache?.documentLenses.push(codeLens); // NOSONAR
                    }
                });
                firstCell = false;
            });
        }

        // Generate the goto cell lenses if necessary
        if (
            needUpdate &&
            cache.gotoCellLens.length === 0 &&
            this.hashProvider &&
            cache.cellRanges.length &&
            this.configService.getSettings(document.uri).datascience.addGotoCodeLenses
        ) {
            const hashes = this.hashProvider.getHashes();
            cache.cellRanges.forEach((r) => {
                const codeLens = this.createExecutionLens(document, r.range, hashes);
                if (codeLens) {
                    cache?.gotoCellLens.push(codeLens); // NOSONAR
                }
            });
        }

        return [...cache.documentLenses, ...cache.gotoCellLens];
    }

    private setIdentity(identity: INotebookIdentity) {
        if (identity.type === 'interactive') {
            this.interactiveIdentity = identity.resource;
        }
    }

    private initCellHashProvider() {
        // Try getting our notebook. This should fail if
        // the user hasn't opened the interactive window yet.
        this.getInteractiveWindowNotebook()
            .then((nb) => {
                if (nb) {
                    // From the notebook, find the logger that is the cell hash provider
                    // tslint:disable-next-line: no-any
                    this.hashProvider = (nb.getLoggers().find((l) => (l as any).getHashes) as any) as ICellHashProvider;
                }
            })
            .ignoreErrors();
    }

    private async getInteractiveWindowNotebook(): Promise<INotebook | undefined> {
        return this.interactiveIdentity
            ? this.notebookProvider.getOrCreateNotebook({ identity: this.interactiveIdentity, getOnly: true })
            : undefined;
    }

    private onClosedDocument(doc: TextDocument) {
        this.codeLensCache.delete(doc.fileName.toLocaleLowerCase());

        // Don't delete the document execution count, we need to keep track
        // of it past the closing of a doc if the notebook or interactive window is still open.
    }

    private onChangedSettings() {
        // When config settings change, refresh our code lenses.
        this.codeLensCache.clear();

        // Force an update so that code lenses are recomputed now and not during execution.
        this.updateEvent.fire();
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

    private createExecutionLens(document: TextDocument, range: Range, hashes: IFileHashes[]) {
        const list = hashes.find((h) => this.fileSystem.arePathsSame(h.file, document.fileName));
        if (list) {
            // Match just the start of the range. Should be - 2 (1 for 1 based numbers and 1 for skipping the comment at the top)
            const rangeMatches = list.hashes.filter((h) => h.line - 2 === range.start.line);
            if (rangeMatches && rangeMatches.length) {
                const rangeMatch = rangeMatches[rangeMatches.length - 1];
                if (this.cellExecutionCounts.has(rangeMatch.id)) {
                    return this.generateCodeLens(
                        range,
                        Commands.ScrollToCell,
                        localize.DataScience.scrollToCellTitleFormatMessage().format(
                            this.cellExecutionCounts.get(rangeMatch.id)!
                        ),
                        [document.fileName, rangeMatch.id]
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
