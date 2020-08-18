// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject, named, optional } from 'inversify';
import { CodeLens, ConfigurationTarget, env, Range, Uri } from 'vscode';
import { ICommandNameArgumentTypeMapping } from '../../common/application/commands';
import { IApplicationShell, ICommandManager, IDebugService, IDocumentManager } from '../../common/application/types';
import { Commands as coreCommands } from '../../common/constants';

import { IStartPage } from '../../common/startPage/types';
import { IConfigurationService, IDisposable, IOutputChannel } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Commands, JUPYTER_OUTPUT_CHANNEL, Telemetry } from '../constants';
import {
    ICodeWatcher,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IDataScienceFileSystem,
    INotebookEditorProvider
} from '../types';
import { JupyterCommandLineSelectorCommand } from './commandLineSelector';
import { ExportCommands } from './exportCommands';
import { NotebookCommands } from './notebookCommands';
import { JupyterServerSelectorCommand } from './serverSelector';

@injectable()
export class CommandRegistry implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDataScienceCodeLensProvider) private dataScienceCodeLensProvider: IDataScienceCodeLensProvider,
        @multiInject(IDataScienceCommandListener)
        @optional()
        private commandListeners: IDataScienceCommandListener[] | undefined,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(JupyterServerSelectorCommand) private readonly serverSelectedCommand: JupyterServerSelectorCommand,
        @inject(NotebookCommands) private readonly notebookCommands: NotebookCommands,
        @inject(JupyterCommandLineSelectorCommand)
        private readonly commandLineCommand: JupyterCommandLineSelectorCommand,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IOutputChannel) @named(JUPYTER_OUTPUT_CHANNEL) private jupyterOutput: IOutputChannel,
        @inject(IStartPage) private startPage: IStartPage,
        @inject(ExportCommands) private readonly exportCommand: ExportCommands,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem
    ) {
        this.disposables.push(this.serverSelectedCommand);
        this.disposables.push(this.notebookCommands);
    }
    public register() {
        this.commandLineCommand.register();
        this.serverSelectedCommand.register();
        this.notebookCommands.register();
        this.exportCommand.register();
        this.registerCommand(Commands.RunAllCells, this.runAllCells);
        this.registerCommand(Commands.RunCell, this.runCell);
        this.registerCommand(Commands.RunCurrentCell, this.runCurrentCell);
        this.registerCommand(Commands.RunCurrentCellAdvance, this.runCurrentCellAndAdvance);
        this.registerCommand(Commands.ExecSelectionInInteractiveWindow, this.runSelectionOrLine);
        this.registerCommand(Commands.RunAllCellsAbove, this.runAllCellsAbove);
        this.registerCommand(Commands.RunCellAndAllBelow, this.runCellAndAllBelow);
        this.registerCommand(Commands.InsertCellBelowPosition, this.insertCellBelowPosition);
        this.registerCommand(Commands.InsertCellBelow, this.insertCellBelow);
        this.registerCommand(Commands.InsertCellAbove, this.insertCellAbove);
        this.registerCommand(Commands.DeleteCells, this.deleteCells);
        this.registerCommand(Commands.SelectCell, this.selectCell);
        this.registerCommand(Commands.SelectCellContents, this.selectCellContents);
        this.registerCommand(Commands.ExtendSelectionByCellAbove, this.extendSelectionByCellAbove);
        this.registerCommand(Commands.ExtendSelectionByCellBelow, this.extendSelectionByCellBelow);
        this.registerCommand(Commands.MoveCellsUp, this.moveCellsUp);
        this.registerCommand(Commands.MoveCellsDown, this.moveCellsDown);
        this.registerCommand(Commands.ChangeCellToMarkdown, this.changeCellToMarkdown);
        this.registerCommand(Commands.ChangeCellToCode, this.changeCellToCode);
        this.registerCommand(Commands.GotoNextCellInFile, this.gotoNextCellInFile);
        this.registerCommand(Commands.GotoPrevCellInFile, this.gotoPrevCellInFile);
        this.registerCommand(Commands.RunAllCellsAbovePalette, this.runAllCellsAboveFromCursor);
        this.registerCommand(Commands.RunCellAndAllBelowPalette, this.runCellAndAllBelowFromCursor);
        this.registerCommand(Commands.RunToLine, this.runToLine);
        this.registerCommand(Commands.RunFromLine, this.runFromLine);
        this.registerCommand(Commands.RunFileInInteractiveWindows, this.runFileInteractive);
        this.registerCommand(Commands.DebugFileInInteractiveWindows, this.debugFileInteractive);
        this.registerCommand(Commands.AddCellBelow, this.addCellBelow);
        this.registerCommand(Commands.RunCurrentCellAndAddBelow, this.runCurrentCellAndAddBelow);
        this.registerCommand(Commands.DebugCell, this.debugCell);
        this.registerCommand(Commands.DebugStepOver, this.debugStepOver);
        this.registerCommand(Commands.DebugContinue, this.debugContinue);
        this.registerCommand(Commands.DebugStop, this.debugStop);
        this.registerCommand(Commands.DebugCurrentCellPalette, this.debugCurrentCellFromCursor);
        this.registerCommand(Commands.CreateNewNotebook, this.createNewNotebook);
        this.registerCommand(Commands.ViewJupyterOutput, this.viewJupyterOutput);
        this.registerCommand(Commands.GatherQuality, this.reportGatherQuality);
        this.registerCommand(Commands.LatestExtension, this.openPythonExtensionPage);
        this.registerCommand(
            Commands.EnableLoadingWidgetsFrom3rdPartySource,
            this.enableLoadingWidgetScriptsFromThirdParty
        );
        this.registerCommand(coreCommands.OpenStartPage, this.openStartPage);
        if (this.commandListeners) {
            this.commandListeners.forEach((listener: IDataScienceCommandListener) => {
                listener.register(this.commandManager);
            });
        }
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    private registerCommand<
        E extends keyof ICommandNameArgumentTypeMapping,
        U extends ICommandNameArgumentTypeMapping[E]
        // tslint:disable-next-line: no-any
    >(command: E, callback: (...args: U) => any) {
        const disposable = this.commandManager.registerCommand(command, callback, this);
        this.disposables.push(disposable);
    }

    private getCodeWatcher(file: Uri | undefined): ICodeWatcher | undefined {
        if (file) {
            const possibleDocuments = this.documentManager.textDocuments.filter((d) =>
                this.fs.arePathsSame(d.uri, file)
            );
            if (possibleDocuments && possibleDocuments.length === 1) {
                return this.dataScienceCodeLensProvider.getCodeWatcher(possibleDocuments[0]);
            } else if (possibleDocuments && possibleDocuments.length > 1) {
                throw new Error(DataScience.documentMismatch().format(file.fsPath));
            }
        }

        return undefined;
    }

    private enableLoadingWidgetScriptsFromThirdParty(): void {
        if (this.configService.getSettings(undefined).datascience.widgetScriptSources.length > 0) {
            return;
        }
        // Update the setting and once updated, notify user to restart kernel.
        this.configService
            .updateSetting(
                'dataScience.widgetScriptSources',
                ['jsdelivr.com', 'unpkg.com'],
                undefined,
                ConfigurationTarget.Global
            )
            .then(() => {
                // Let user know they'll need to restart the kernel.
                this.appShell
                    .showInformationMessage(DataScience.loadThirdPartyWidgetScriptsPostEnabled())
                    .then(noop, noop);
            })
            .catch(noop);
    }

    private async runAllCells(file: Uri | undefined): Promise<void> {
        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.runAllCells();
        } else {
            return;
        }
    }

    private async runFileInteractive(file: Uri): Promise<void> {
        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.runFileInteractive();
        } else {
            return;
        }
    }

    private async debugFileInteractive(file: Uri): Promise<void> {
        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.debugFileInteractive();
        } else {
            return;
        }
    }

    // Note: see codewatcher.ts where the runcell command args are attached. The reason we don't have any
    // objects for parameters is because they can't be recreated when passing them through the LiveShare API
    private async runCell(
        file: Uri,
        startLine: number,
        startChar: number,
        endLine: number,
        endChar: number
    ): Promise<void> {
        const codeWatcher = this.getCodeWatcher(file);
        if (codeWatcher) {
            return codeWatcher.runCell(new Range(startLine, startChar, endLine, endChar));
        }
    }

    private async runAllCellsAbove(file: Uri, stopLine: number, stopCharacter: number): Promise<void> {
        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.runAllCellsAbove(stopLine, stopCharacter);
            }
        }
    }

    private async runCellAndAllBelow(file: Uri | undefined, startLine: number, startCharacter: number): Promise<void> {
        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.runCellAndAllBelow(startLine, startCharacter);
            }
        }
    }

    private async runToLine(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        const textEditor = this.documentManager.activeTextEditor;

        if (activeCodeWatcher && textEditor && textEditor.selection) {
            return activeCodeWatcher.runToLine(textEditor.selection.start.line);
        }
    }

    private async runFromLine(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        const textEditor = this.documentManager.activeTextEditor;

        if (activeCodeWatcher && textEditor && textEditor.selection) {
            return activeCodeWatcher.runFromLine(textEditor.selection.start.line);
        }
    }

    private async runCurrentCell(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCell();
        } else {
            return;
        }
    }

    private async runCurrentCellAndAdvance(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCellAndAdvance();
        } else {
            return;
        }
    }

    private async runSelectionOrLine(): Promise<void> {
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runSelectionOrLine(this.documentManager.activeTextEditor);
        } else {
            return;
        }
    }

    private async debugCell(
        file: Uri,
        startLine: number,
        startChar: number,
        endLine: number,
        endChar: number
    ): Promise<void> {
        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.debugCell(new Range(startLine, startChar, endLine, endChar));
            }
        }
    }

    @captureTelemetry(Telemetry.DebugStepOver)
    private async debugStepOver(): Promise<void> {
        // Make sure that we are in debug mode
        if (this.debugService.activeDebugSession) {
            this.commandManager.executeCommand('workbench.action.debug.stepOver');
        }
    }

    @captureTelemetry(Telemetry.DebugStop)
    private async debugStop(): Promise<void> {
        // Make sure that we are in debug mode
        if (this.debugService.activeDebugSession) {
            this.commandManager.executeCommand('workbench.action.debug.stop');
        }
    }

    @captureTelemetry(Telemetry.DebugContinue)
    private async debugContinue(): Promise<void> {
        // Make sure that we are in debug mode
        if (this.debugService.activeDebugSession) {
            this.commandManager.executeCommand('workbench.action.debug.continue');
        }
    }

    @captureTelemetry(Telemetry.AddCellBelow)
    private async addCellBelow(): Promise<void> {
        await this.getCurrentCodeWatcher()?.addEmptyCellToBottom();
    }

    private async runCurrentCellAndAddBelow(): Promise<void> {
        this.getCurrentCodeWatcher()?.runCurrentCellAndAddBelow();
    }

    private async insertCellBelowPosition(): Promise<void> {
        this.getCurrentCodeWatcher()?.insertCellBelowPosition();
    }

    private async insertCellBelow(): Promise<void> {
        this.getCurrentCodeWatcher()?.insertCellBelow();
    }

    private async insertCellAbove(): Promise<void> {
        this.getCurrentCodeWatcher()?.insertCellAbove();
    }

    private async deleteCells(): Promise<void> {
        this.getCurrentCodeWatcher()?.deleteCells();
    }

    private async selectCell(): Promise<void> {
        this.getCurrentCodeWatcher()?.selectCell();
    }

    private async selectCellContents(): Promise<void> {
        this.getCurrentCodeWatcher()?.selectCellContents();
    }

    private async extendSelectionByCellAbove(): Promise<void> {
        this.getCurrentCodeWatcher()?.extendSelectionByCellAbove();
    }

    private async extendSelectionByCellBelow(): Promise<void> {
        this.getCurrentCodeWatcher()?.extendSelectionByCellBelow();
    }

    private async moveCellsUp(): Promise<void> {
        this.getCurrentCodeWatcher()?.moveCellsUp();
    }

    private async moveCellsDown(): Promise<void> {
        this.getCurrentCodeWatcher()?.moveCellsDown();
    }

    private async changeCellToMarkdown(): Promise<void> {
        this.getCurrentCodeWatcher()?.changeCellToMarkdown();
    }

    private async changeCellToCode(): Promise<void> {
        this.getCurrentCodeWatcher()?.changeCellToCode();
    }

    private async gotoNextCellInFile(): Promise<void> {
        this.getCurrentCodeWatcher()?.gotoNextCell();
    }

    private async gotoPrevCellInFile(): Promise<void> {
        this.getCurrentCodeWatcher()?.gotoPreviousCell();
    }

    private async runAllCellsAboveFromCursor(): Promise<void> {
        const currentCodeLens = this.getCurrentCodeLens();
        if (currentCodeLens) {
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.runAllCellsAbove(
                    currentCodeLens.range.start.line,
                    currentCodeLens.range.start.character
                );
            }
        } else {
            return;
        }
    }

    private async runCellAndAllBelowFromCursor(): Promise<void> {
        const currentCodeLens = this.getCurrentCodeLens();
        if (currentCodeLens) {
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.runCellAndAllBelow(
                    currentCodeLens.range.start.line,
                    currentCodeLens.range.start.character
                );
            }
        } else {
            return;
        }
    }

    private async debugCurrentCellFromCursor(): Promise<void> {
        const currentCodeLens = this.getCurrentCodeLens();
        if (currentCodeLens) {
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.debugCurrentCell();
            }
        } else {
            return;
        }
    }

    private async createNewNotebook(): Promise<void> {
        await this.notebookEditorProvider.createNew();
    }

    private async openStartPage(): Promise<void> {
        sendTelemetryEvent(Telemetry.StartPageOpenedFromCommandPalette);
        return this.startPage.open();
    }

    private viewJupyterOutput() {
        this.jupyterOutput.show(true);
    }

    private getCurrentCodeLens(): CodeLens | undefined {
        const activeEditor = this.documentManager.activeTextEditor;
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeEditor && activeCodeWatcher) {
            // Find the cell that matches
            return activeCodeWatcher.getCodeLenses().find((c: CodeLens) => {
                if (
                    c.range.end.line >= activeEditor.selection.anchor.line &&
                    c.range.start.line <= activeEditor.selection.anchor.line
                ) {
                    return true;
                }
                return false;
            });
        }
    }
    // Get our matching code watcher for the active document
    private getCurrentCodeWatcher(): ICodeWatcher | undefined {
        const activeEditor = this.documentManager.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return undefined;
        }

        // Ask our code lens provider to find the matching code watcher for the current document
        return this.dataScienceCodeLensProvider.getCodeWatcher(activeEditor.document);
    }

    private reportGatherQuality(val: string) {
        sendTelemetryEvent(Telemetry.GatherQualityReport, undefined, { result: val[0] === 'no' ? 'no' : 'yes' });
        env.openExternal(Uri.parse(`https://aka.ms/gatherfeedback?succeed=${val[0]}`));
    }

    private openPythonExtensionPage() {
        env.openExternal(Uri.parse(`https://marketplace.visualstudio.com/items?itemName=ms-python.python`));
    }
}
