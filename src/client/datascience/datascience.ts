// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONObject } from '@phosphor/coreutils';
import { inject, injectable, multiInject, named, optional } from 'inversify';
import { URL } from 'url';
import * as vscode from 'vscode';
import { ICommandManager, IDebugService, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PYTHON_ALLFILES, PYTHON_LANGUAGE } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import '../common/extensions';
import {
    BANNER_NAME_DS_SURVEY,
    GLOBAL_MEMENTO,
    IConfigurationService,
    IDisposable,
    IDisposableRegistry,
    IExtensionContext,
    IMemento,
    IPythonExtensionBanner
} from '../common/types';
import { debounceAsync, swallowExceptions } from '../common/utils/decorators';
import * as localize from '../common/utils/localize';
import { IMultiStepInput, IMultiStepInputFactory, InputStep, IQuickPickParameters } from '../common/utils/multiStepInput';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { hasCells } from './cellFactory';
import { getSavedUriList } from './common';
import { Commands, EditorContexts, Settings, Telemetry } from './constants';
import { KernelSelector, KernelSpecInterpreter } from './jupyter/kernels/kernelSelector';
import { LiveKernelModel } from './jupyter/kernels/types';
import {
    ICodeWatcher,
    IConnection,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IJupyterKernelSpec,
    IJupyterSessionManagerFactory,
    INotebookEditorProvider
} from './types';

interface ISelectUriQuickPickItem extends vscode.QuickPickItem {
    newChoice: boolean;
}

@injectable()
export class DataScience implements IDataScience {
    public isDisposed: boolean = false;
    private readonly dataScienceSurveyBanner: IPythonExtensionBanner;
    private changeHandler: IDisposable | undefined;
    private startTime: number = Date.now();
    private localLabel = `$(zap) ${localize.DataScience.jupyterSelectURILocalLabel()}`;
    private newLabel = `$(server) ${localize.DataScience.jupyterSelectURINewLabel()}`;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IExtensionContext) private extensionContext: IExtensionContext,
        @inject(IDataScienceCodeLensProvider) private dataScienceCodeLensProvider: IDataScienceCodeLensProvider,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @multiInject(IDataScienceCommandListener) @optional() private commandListeners: IDataScienceCommandListener[] | undefined,
        @inject(INotebookEditorProvider) private notebookProvider: INotebookEditorProvider,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: vscode.Memento,
        @inject(IJupyterSessionManagerFactory) private jupyterSessionManagerFactory: IJupyterSessionManagerFactory,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(KernelSelector) private kernelSelector: KernelSelector
    ) {
        this.dataScienceSurveyBanner = this.serviceContainer.get<IPythonExtensionBanner>(IPythonExtensionBanner, BANNER_NAME_DS_SURVEY);
    }

    public get activationStartTime(): number {
        return this.startTime;
    }

    public async activate(): Promise<void> {
        this.registerCommands();

        this.extensionContext.subscriptions.push(vscode.languages.registerCodeLensProvider(PYTHON_ALLFILES, this.dataScienceCodeLensProvider));

        // Set our initial settings and sign up for changes
        this.onSettingsChanged();
        this.changeHandler = this.configuration.getSettings().onDidChange(this.onSettingsChanged.bind(this));
        this.disposableRegistry.push(this);

        // Listen for active editor changes so we can detect have code cells or not
        this.disposableRegistry.push(this.documentManager.onDidChangeActiveTextEditor(() => this.onChangedActiveTextEditor()));
        this.onChangedActiveTextEditor();

        // Send telemetry for all of our settings
        this.sendSettingsTelemetry().ignoreErrors();
    }

    public async dispose() {
        if (this.changeHandler) {
            this.changeHandler.dispose();
            this.changeHandler = undefined;
        }
    }

    public async runFileInteractive(file: string): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.runFileInteractive();
        } else {
            return Promise.resolve();
        }
    }

    public async debugFileInteractive(file: string): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.debugFileInteractive();
        } else {
            return Promise.resolve();
        }
    }

    public async runAllCells(file: string): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        let codeWatcher = this.getCodeWatcher(file);
        if (!codeWatcher) {
            codeWatcher = this.getCurrentCodeWatcher();
        }
        if (codeWatcher) {
            return codeWatcher.runAllCells();
        } else {
            return Promise.resolve();
        }
    }

    // Note: see codewatcher.ts where the runcell command args are attached. The reason we don't have any
    // objects for parameters is because they can't be recreated when passing them through the LiveShare API
    public async runCell(file: string, startLine: number, startChar: number, endLine: number, endChar: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();
        const codeWatcher = this.getCodeWatcher(file);
        if (codeWatcher) {
            return codeWatcher.runCell(new vscode.Range(startLine, startChar, endLine, endChar));
        }
    }

    public async runAllCellsAbove(file: string, stopLine: number, stopCharacter: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.runAllCellsAbove(stopLine, stopCharacter);
            }
        }
    }

    public async runCellAndAllBelow(file: string, startLine: number, startCharacter: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.runCellAndAllBelow(startLine, startCharacter);
            }
        }
    }

    public async runToLine(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        const textEditor = this.documentManager.activeTextEditor;

        if (activeCodeWatcher && textEditor && textEditor.selection) {
            return activeCodeWatcher.runToLine(textEditor.selection.start.line);
        }
    }

    public async runFromLine(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        const textEditor = this.documentManager.activeTextEditor;

        if (activeCodeWatcher && textEditor && textEditor.selection) {
            return activeCodeWatcher.runFromLine(textEditor.selection.start.line);
        }
    }

    public async runCurrentCell(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCell();
        } else {
            return Promise.resolve();
        }
    }

    public async runCurrentCellAndAdvance(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCellAndAdvance();
        } else {
            return Promise.resolve();
        }
    }

    // tslint:disable-next-line:no-any
    public async runSelectionOrLine(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runSelectionOrLine(this.documentManager.activeTextEditor);
        } else {
            return Promise.resolve();
        }
    }

    @captureTelemetry(Telemetry.SelectJupyterURI)
    public selectJupyterURI(): Promise<void> {
        const multiStep = this.multiStepFactory.create<{}>();
        return multiStep.run(this.startSelectingURI.bind(this), {});
    }

    @captureTelemetry(Telemetry.SelectLocalJupyterKernel)
    public async selectLocalJupyterKernel(currentKernel?: IJupyterKernelSpec | LiveKernelModel): Promise<KernelSpecInterpreter> {
        return this.kernelSelector.selectLocalKernel(undefined, undefined, currentKernel);
    }

    @captureTelemetry(Telemetry.SelectRemoteJupyuterKernel)
    public async selectRemoteJupyterKernel(connInfo: IConnection, currentKernel?: IJupyterKernelSpec | LiveKernelModel): Promise<KernelSpecInterpreter> {
        const session = await this.jupyterSessionManagerFactory.create(connInfo);
        return this.kernelSelector.selectRemoteKernel(session, undefined, currentKernel);
    }

    public async debugCell(file: string, startLine: number, startChar: number, endLine: number, endChar: number): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        if (file) {
            const codeWatcher = this.getCodeWatcher(file);

            if (codeWatcher) {
                return codeWatcher.debugCell(new vscode.Range(startLine, startChar, endLine, endChar));
            }
        }
    }

    @captureTelemetry(Telemetry.DebugStepOver)
    public async debugStepOver(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        // Make sure that we are in debug mode
        if (this.debugService.activeDebugSession) {
            this.commandManager.executeCommand('workbench.action.debug.stepOver');
        }
    }

    @captureTelemetry(Telemetry.DebugStop)
    public async debugStop(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        // Make sure that we are in debug mode
        if (this.debugService.activeDebugSession) {
            this.commandManager.executeCommand('workbench.action.debug.stop');
        }
    }

    @captureTelemetry(Telemetry.DebugContinue)
    public async debugContinue(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        // Make sure that we are in debug mode
        if (this.debugService.activeDebugSession) {
            this.commandManager.executeCommand('workbench.action.debug.continue');
        }
    }
    private validateSelectJupyterURI = async (inputText: string): Promise<string | undefined> => {
        try {
            // tslint:disable-next-line:no-unused-expression
            new URL(inputText);

            // Double check http
            if (!inputText.toLowerCase().includes('http')) {
                throw new Error('Has to be http');
            }
        } catch {
            return localize.DataScience.jupyterSelectURIInvalidURI();
        }
    }

    private async startSelectingURI(input: IMultiStepInput<{}>, _state: {}): Promise<InputStep<{}> | void> {
        // First step, show a quick pick to choose either the remote or the local.
        // newChoice element will be set if the user picked 'enter a new server'
        const item = await input.showQuickPick<ISelectUriQuickPickItem, IQuickPickParameters<ISelectUriQuickPickItem>>({
            placeholder: localize.DataScience.jupyterSelectURIQuickPickPlaceholder(),
            items: await this.getUriPickList(),
            title: localize.DataScience.jupyterSelectURIQuickPickTitle()
        });
        if (item.label === this.localLabel) {
            await this.setJupyterURIToLocal();
        } else if (!item.newChoice) {
            await this.setJupyterURIToRemote(item.label);
        } else {
            return this.selectRemoteURI.bind(this);
        }
    }

    private async selectRemoteURI(input: IMultiStepInput<{}>, _state: {}): Promise<InputStep<{}> | void> {
        // Ask the user to enter a URI to connect to.
        const uri = await input.showInputBox({
            title: localize.DataScience.jupyterSelectURIPrompt(),
            value: 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe',
            validate: this.validateSelectJupyterURI,
            prompt: ''
        });

        if (uri) {
            await this.setJupyterURIToRemote(uri);
        }
    }

    @captureTelemetry(Telemetry.SetJupyterURIToLocal)
    private async setJupyterURIToLocal(): Promise<void> {
        await this.configuration.updateSetting('dataScience.jupyterServerURI', Settings.JupyterServerLocalLaunch, undefined, vscode.ConfigurationTarget.Workspace);
    }

    @captureTelemetry(Telemetry.SetJupyterURIToUserSpecified)
    private async setJupyterURIToRemote(userURI: string): Promise<void> {
        await this.configuration.updateSetting('dataScience.jupyterServerURI', userURI, undefined, vscode.ConfigurationTarget.Workspace);
    }

    @captureTelemetry(Telemetry.AddCellBelow)
    private async addCellBelow(): Promise<void> {
        const activeEditor = this.documentManager.activeTextEditor;
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeEditor && activeCodeWatcher) {
            return activeCodeWatcher.addEmptyCellToBottom();
        }
    }

    private async getUriPickList(): Promise<ISelectUriQuickPickItem[]> {
        // Always have 'local' and 'add new'
        const items: ISelectUriQuickPickItem[] = [];
        items.push({ label: this.localLabel, detail: localize.DataScience.jupyterSelectURILocalDetail(), newChoice: false });
        items.push({ label: this.newLabel, detail: localize.DataScience.jupyterSelectURINewDetail(), newChoice: true });

        // Get our list of recent server connections and display that as well
        const savedURIList = getSavedUriList(this.globalState);
        savedURIList.forEach(uriItem => {
            const uriDate = new Date(uriItem.time);
            items.push({ label: uriItem.uri, detail: localize.DataScience.jupyterSelectURIMRUDetail().format(uriDate.toLocaleString()), newChoice: false });
        });

        return items;
    }

    private async runCurrentCellAndAddBelow(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeCodeWatcher) {
            return activeCodeWatcher.runCurrentCellAndAddBelow();
        } else {
            return Promise.resolve();
        }
    }

    private getCurrentCodeLens(): vscode.CodeLens | undefined {
        const activeEditor = this.documentManager.activeTextEditor;
        const activeCodeWatcher = this.getCurrentCodeWatcher();
        if (activeEditor && activeCodeWatcher) {
            // Find the cell that matches
            return activeCodeWatcher.getCodeLenses().find((c: vscode.CodeLens) => {
                if (c.range.end.line >= activeEditor.selection.anchor.line && c.range.start.line <= activeEditor.selection.anchor.line) {
                    return true;
                }
                return false;
            });
        }
    }

    private async runAllCellsAboveFromCursor(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const currentCodeLens = this.getCurrentCodeLens();
        if (currentCodeLens) {
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.runAllCellsAbove(currentCodeLens.range.start.line, currentCodeLens.range.start.character);
            }
        } else {
            return Promise.resolve();
        }
    }

    private async runCellAndAllBelowFromCursor(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const currentCodeLens = this.getCurrentCodeLens();
        if (currentCodeLens) {
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.runCellAndAllBelow(currentCodeLens.range.start.line, currentCodeLens.range.start.character);
            }
        } else {
            return Promise.resolve();
        }
    }

    private async debugCurrentCellFromCursor(): Promise<void> {
        this.dataScienceSurveyBanner.showBanner().ignoreErrors();

        const currentCodeLens = this.getCurrentCodeLens();
        if (currentCodeLens) {
            const activeCodeWatcher = this.getCurrentCodeWatcher();
            if (activeCodeWatcher) {
                return activeCodeWatcher.debugCurrentCell();
            }
        } else {
            return Promise.resolve();
        }
    }

    private onSettingsChanged = () => {
        const settings = this.configuration.getSettings();
        const enabled = settings.datascience.enabled;
        let editorContext = new ContextKey(EditorContexts.DataScienceEnabled, this.commandManager);
        editorContext.set(enabled).catch();
        const ownsSelection = settings.datascience.sendSelectionToInteractiveWindow;
        editorContext = new ContextKey(EditorContexts.OwnsSelection, this.commandManager);
        editorContext.set(ownsSelection && enabled).catch();
    }

    private getCodeWatcher(file: string): ICodeWatcher | undefined {
        const possibleDocuments = this.documentManager.textDocuments.filter(d => d.fileName === file);
        if (possibleDocuments && possibleDocuments.length === 1) {
            return this.dataScienceCodeLensProvider.getCodeWatcher(possibleDocuments[0]);
        } else if (possibleDocuments && possibleDocuments.length > 1) {
            throw new Error(localize.DataScience.documentMismatch().format(file));
        }

        return undefined;
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

    private registerCommands(): void {
        let disposable = this.commandManager.registerCommand(Commands.RunAllCells, this.runAllCells, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCell, this.runCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCurrentCell, this.runCurrentCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCurrentCellAdvance, this.runCurrentCellAndAdvance, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.ExecSelectionInInteractiveWindow, this.runSelectionOrLine, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.SelectJupyterURI, this.selectJupyterURI, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunAllCellsAbove, this.runAllCellsAbove, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCellAndAllBelow, this.runCellAndAllBelow, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunAllCellsAbovePalette, this.runAllCellsAboveFromCursor, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCellAndAllBelowPalette, this.runCellAndAllBelowFromCursor, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunToLine, this.runToLine, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunFromLine, this.runFromLine, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunFileInInteractiveWindows, this.runFileInteractive, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.DebugFileInInteractiveWindows, this.debugFileInteractive, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.AddCellBelow, this.addCellBelow, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.RunCurrentCellAndAddBelow, this.runCurrentCellAndAddBelow, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.DebugCell, this.debugCell, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.DebugStepOver, this.debugStepOver, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.DebugContinue, this.debugContinue, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.DebugStop, this.debugStop, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.DebugCurrentCellPalette, this.debugCurrentCellFromCursor, this);
        this.disposableRegistry.push(disposable);
        disposable = this.commandManager.registerCommand(Commands.CreateNewNotebook, this.createNewNotebook, this);
        this.disposableRegistry.push(disposable);
        if (this.commandListeners) {
            this.commandListeners.forEach((listener: IDataScienceCommandListener) => {
                listener.register(this.commandManager);
            });
        }
    }

    private onChangedActiveTextEditor() {
        // Setup the editor context for the cells
        const editorContext = new ContextKey(EditorContexts.HasCodeCells, this.commandManager);
        const activeEditor = this.documentManager.activeTextEditor;

        if (activeEditor && activeEditor.document.languageId === PYTHON_LANGUAGE) {
            // Inform the editor context that we have cells, fire and forget is ok on the promise here
            // as we don't care to wait for this context to be set and we can't do anything if it fails
            editorContext.set(hasCells(activeEditor.document, this.configuration.getSettings().datascience)).catch();
        } else {
            editorContext.set(false).catch();
        }
    }

    @debounceAsync(1)
    @swallowExceptions('Sending DataScience Settings Telemetry failed')
    private async sendSettingsTelemetry(): Promise<void> {
        // Get our current settings. This is what we want to send.
        // tslint:disable-next-line:no-any
        const settings = this.configuration.getSettings().datascience as any;

        // Translate all of the 'string' based settings into known values or not.
        const pythonConfig = this.workspace.getConfiguration('python');
        if (pythonConfig) {
            const keys = Object.keys(settings);
            const resultSettings: JSONObject = {};
            for (const k of keys) {
                const currentValue = settings[k];
                if (typeof currentValue === 'string') {
                    const inspectResult = pythonConfig.inspect<string>(`dataScience.${k}`);
                    if (inspectResult && inspectResult.defaultValue !== currentValue) {
                        resultSettings[k] = 'non-default';
                    } else {
                        resultSettings[k] = 'default';
                    }
                } else {
                    resultSettings[k] = currentValue;
                }
            }
            sendTelemetryEvent(Telemetry.DataScienceSettings, 0, resultSettings);
        }
    }

    private async createNewNotebook(): Promise<void> {
        await this.notebookProvider.createNew();
    }
}
