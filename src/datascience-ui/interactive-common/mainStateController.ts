// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fastDeepEqual from 'fast-deep-equal';
import { min } from 'lodash';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as uuid from 'uuid/v4';

import { createDeferred, Deferred } from '../../client/common/utils/async';
import { CellMatcher } from '../../client/datascience/cellMatcher';
import { concatMultilineString, generateMarkdownFromCodeLines } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages, IGetCssResponse } from '../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../client/datascience/monacoMessages';
import {
    CellState,
    ICell,
    IDataScienceExtraSettings,
    IInteractiveWindowInfo,
    IJupyterVariable,
    IJupyterVariablesResponse
} from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { getSettings, updateSettings } from '../react-common/settingsReactSide';
import { detectBaseTheme } from '../react-common/themeDetector';
import { InputHistory } from './inputHistory';
import { IntellisenseProvider } from './intellisenseProvider';
import { createCellVM, createEditableCellVM, extractInputText, generateTestState, ICellViewModel, IMainState } from './mainState';
import { initializeTokenizer, registerMonacoLanguage } from './tokenizer';

export interface IMainStateControllerProps {
    hasEdit: boolean;
    skipDefault: boolean;
    testMode: boolean;
    expectingDark: boolean;
    defaultEditable: boolean;
    enableGather: boolean;
    setState(state: {}, callback: () => void): void;
    activate(): void;
    scrollToCell(id: string): void;
}

// tslint:disable-next-line: max-func-body-length
export class MainStateController implements IMessageHandler {
    private stackLimit = 10;
    private state: IMainState;
    private postOffice: PostOffice = new PostOffice();
    private intellisenseProvider: IntellisenseProvider;
    private onigasmPromise: Deferred<ArrayBuffer> | undefined;
    private tmlangugePromise: Deferred<string> | undefined;
    private suspendUpdateCount: number = 0;
    private monacoIdToCellId: Map<string, string> = new Map<string, string>();
    private cellIdToMonacoId: Map<string, string> = new Map<string, string>();

    // tslint:disable-next-line:max-func-body-length
    constructor(private props: IMainStateControllerProps) {
        this.state = {
            editorOptions: this.computeEditorOptions(),
            cellVMs: [],
            busy: true,
            undoStack: [],
            redoStack: [],
            submittedText: false,
            history: new InputHistory(),
            currentExecutionCount: 0,
            variables: [],
            pendingVariableCount: 0,
            debugging: false,
            knownDark: false,
            variablesVisible: false,
            editCellVM: this.props.hasEdit ? createEditableCellVM(1) : undefined,
            enableGather: this.props.enableGather,
            isAtBottom: true
        };

        // Add test state if necessary
        if (!this.props.skipDefault) {
            this.state = generateTestState(this.inputBlockToggled, '', this.props.defaultEditable);
        }

        // Setup the completion provider for monaco. We only need one
        this.intellisenseProvider = new IntellisenseProvider(this.postOffice, this.getCellId);

        // Setup the tokenizer for monaco if running inside of vscode
        if (this.props.skipDefault) {
            if (this.props.testMode) {
                // Running a test, skip the tokenizer. We want the UI to display synchronously
                this.state = { tokenizerLoaded: true, ...this.state };

                // However we still need to register python as a language
                registerMonacoLanguage();
            } else {
                initializeTokenizer(this.loadOnigasm, this.loadTmlanguage, this.tokenizerLoaded).ignoreErrors();
            }
        }

        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the interactive window code we have started.
        this.postOffice.sendMessage<IInteractiveWindowMapping, 'started'>(InteractiveWindowMessages.Started);

        // Get our monaco theme and css if not running a test, because these make everything async too
        if (!this.props.testMode) {
            this.postOffice.sendUnsafeMessage(CssMessages.GetCssRequest, { isDark: this.props.expectingDark });
            this.postOffice.sendUnsafeMessage(CssMessages.GetMonacoThemeRequest, { isDark: this.props.expectingDark });
        }
    }

    public dispose() {
        // Remove ourselves as a handler for the post office
        this.postOffice.removeHandler(this);

        // Get rid of our completion provider
        this.intellisenseProvider.dispose();

        // Get rid of our post office
        this.postOffice.dispose();
    }

    public requiresUpdate(prevState: IMainState, nextState: IMainState): boolean {
        // Compare all keys
        return !fastDeepEqual(prevState, nextState);
    }

    // tslint:disable-next-line:no-any cyclomatic-complexity max-func-body-length
    public handleMessage(msg: string, payload?: any) {
        switch (msg) {
            case InteractiveWindowMessages.StartCell:
                this.startCell(payload);
                return true;

            case InteractiveWindowMessages.FinishCell:
                this.finishCell(payload);
                return true;

            case InteractiveWindowMessages.UpdateCell:
                this.updateCell(payload);
                return true;

            case InteractiveWindowMessages.GetAllCells:
                this.getAllCells();
                return true;

            case InteractiveWindowMessages.ExpandAll:
                this.expandAllSilent();
                return true;

            case InteractiveWindowMessages.CollapseAll:
                this.collapseAllSilent();
                return true;

            case InteractiveWindowMessages.DeleteAllCells:
                this.clearAllSilent();
                return true;

            case InteractiveWindowMessages.Redo:
                this.redo();
                return true;

            case InteractiveWindowMessages.Undo:
                this.undo();
                return true;

            case InteractiveWindowMessages.StartProgress:
                if (!this.props.testMode) {
                    this.setState({ busy: true });
                }
                break;

            case InteractiveWindowMessages.StopProgress:
                if (!this.props.testMode) {
                    this.setState({ busy: false });
                }
                break;

            case InteractiveWindowMessages.UpdateSettings:
                this.updateSettings(payload);
                break;

            case InteractiveWindowMessages.Activate:
                this.props.activate();
                break;

            case InteractiveWindowMessages.GetVariablesResponse:
                this.getVariablesResponse(payload);
                break;

            case InteractiveWindowMessages.GetVariableValueResponse:
                this.getVariableValueResponse(payload);
                break;

            case InteractiveWindowMessages.LoadOnigasmAssemblyResponse:
                this.handleOnigasmResponse(payload);
                break;

            case InteractiveWindowMessages.LoadTmLanguageResponse:
                this.handleTmLanguageResponse(payload);
                break;

            case InteractiveWindowMessages.RestartKernel:
                // Go through all vms that are currently executing and mark them as finished
                this.handleRestarted();
                break;

            case InteractiveWindowMessages.StartDebugging:
                this.setState({ debugging: true });
                break;

            case InteractiveWindowMessages.StopDebugging:
                this.setState({ debugging: false });
                break;

            case InteractiveWindowMessages.LoadAllCells:
                this.handleLoadAllCells(payload);
                break;

            case CssMessages.GetCssResponse:
                this.handleCssResponse(payload);
                break;

            case CssMessages.GetMonacoThemeResponse:
                this.handleMonacoThemeResponse(payload);
                break;

            case InteractiveWindowMessages.ScrollToCell:
                if (payload.id) {
                    this.props.scrollToCell(payload.id);
                }
                break;

            default:
                break;
        }

        return false;
    }

    public stopBusy = () => {
        if (this.state.busy) {
            this.setState({ busy: false });
        }
    }

    public redo = () => {
        // Pop one off of our redo stack and update our undo
        const cells = this.state.redoStack[this.state.redoStack.length - 1];
        const redoStack = this.state.redoStack.slice(0, this.state.redoStack.length - 1);
        const undoStack = this.pushStack(this.state.undoStack, this.state.cellVMs);
        this.sendMessage(InteractiveWindowMessages.Redo);
        this.setState({
            cellVMs: cells,
            undoStack: undoStack,
            redoStack: redoStack,
            skipNextScroll: true
        });
    }

    public undo = () => {
        // Pop one off of our undo stack and update our redo
        const cells = this.state.undoStack[this.state.undoStack.length - 1];
        const undoStack = this.state.undoStack.slice(0, this.state.undoStack.length - 1);
        const redoStack = this.pushStack(this.state.redoStack, this.state.cellVMs);
        this.sendMessage(InteractiveWindowMessages.Undo);
        this.setState({
            cellVMs: cells,
            undoStack: undoStack,
            redoStack: redoStack,
            skipNextScroll: true
        });
    }

    public deleteCell = (cellId: string) => {
        const cellVM = this.state.cellVMs.find(c => c.cell.id === cellId);
        if (cellVM) {
            this.sendMessage(InteractiveWindowMessages.DeleteCell);
            this.sendMessage(InteractiveWindowMessages.RemoveCell, { id: cellVM.cell.id });

            // Update our state
            this.setState({
                cellVMs: this.state.cellVMs.filter(c => c.cell.id !== cellId),
                undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                skipNextScroll: true
            });
        }
    }

    public collapseAll = () => {
        this.sendMessage(InteractiveWindowMessages.CollapseAll);
        this.collapseAllSilent();
    }

    public expandAll = () => {
        this.sendMessage(InteractiveWindowMessages.ExpandAll);
        this.expandAllSilent();
    }

    public clearAll = () => {
        this.sendMessage(InteractiveWindowMessages.DeleteAllCells);
        this.clearAllSilent();
    }

    public updateCellSource = (cellId: string) => {
        const models = monacoEditor.editor.getModels();
        const cvm = this.findCell(cellId);
        if (cvm) {
            const modelId = this.getMonacoId(cvm.cell.id);
            if (modelId) {
                const model = models.find(m => m.id === modelId);
                if (model) {
                    cvm.cell.data.source = cvm.inputBlockText = model.getValue().replace(/\r/g, '');
                }
            }
        }
    }

    public save = () => {
        // We have to take the current value of each cell to make sure we have the correct text.
        this.state.cellVMs.forEach(c => this.updateCellSource(c.cell.id));

        // Then send the save with the new state.
        this.sendMessage(InteractiveWindowMessages.SaveAll, { cells: this.getNonEditCellVMs().map(cvm => cvm.cell) });
    }

    public showPlot = (imageHtml: string) => {
        this.sendMessage(InteractiveWindowMessages.ShowPlot, imageHtml);
    }

    public showDataViewer = (targetVariable: string, numberOfColumns: number) => {
        this.sendMessage(InteractiveWindowMessages.ShowDataViewer, { variableName: targetVariable, columnSize: numberOfColumns });
    }

    public openLink = (uri: monacoEditor.Uri) => {
        this.sendMessage(InteractiveWindowMessages.OpenLink, uri.toString());
    }

    public canCollapseAll = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    public canExpandAll = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    public canExport = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    public canRedo = () => {
        return this.state.redoStack.length > 0;
    }

    public canUndo = () => {
        return this.state.undoStack.length > 0;
    }

    public canClearAllOutputs = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    public clearAllOutputs = () => {
        const newList = this.state.cellVMs.map(cellVM => {
            const newVM = cloneDeep(cellVM);
            newVM.cell.data.outputs = [];
            return newVM;
        });
        this.setState({
            cellVMs: newList
        });
    }

    public gotoCellCode = (cellId: string) => {
        // Find our cell
        const cellVM = this.state.cellVMs.find(c => c.cell.id === cellId);

        // Send a message to the other side to jump to a particular cell
        if (cellVM) {
            this.sendMessage(InteractiveWindowMessages.GotoCodeCell, { file: cellVM.cell.file, line: cellVM.cell.line });
        }
    }

    public copyCellCode = (cellId: string) => {
        // Find our cell. This is also supported on the edit cell
        let cellVM = this.state.cellVMs.find(c => c.cell.id === cellId);
        if (!cellVM && this.state.editCellVM && cellId === this.state.editCellVM.cell.id) {
            cellVM = this.state.editCellVM;
        }

        // Send a message to the other side to jump to a particular cell
        if (cellVM) {
            this.sendMessage(InteractiveWindowMessages.CopyCodeCell, { source: extractInputText(cellVM.cell, getSettings()) });
        }
    }

    public gatherCell = (cellVM: ICellViewModel | undefined) => {
        if (cellVM) {
            this.sendMessage(InteractiveWindowMessages.GatherCode, cellVM.cell);
        }
    }

    public restartKernel = () => {
        // Send a message to the other side to restart the kernel
        this.sendMessage(InteractiveWindowMessages.RestartKernel);
    }

    public interruptKernel = () => {
        // Send a message to the other side to restart the kernel
        this.sendMessage(InteractiveWindowMessages.Interrupt);
    }

    public export = () => {
        // Send a message to the other side to export our current list
        const cellContents: ICell[] = this.state.cellVMs.map((cellVM: ICellViewModel, _index: number) => { return cellVM.cell; });
        this.sendMessage(InteractiveWindowMessages.Export, cellContents);
    }

    // When the variable explorer wants to refresh state (say if it was expanded)
    public refreshVariables = (newExecutionCount?: number) => {
        this.sendMessage(InteractiveWindowMessages.GetVariablesRequest, newExecutionCount === undefined ? this.state.currentExecutionCount : newExecutionCount);
    }

    public toggleVariableExplorer = () => {
        this.sendMessage(InteractiveWindowMessages.VariableExplorerToggle, !this.state.variablesVisible);
        this.setState({ variablesVisible: !this.state.variablesVisible });
        if (!this.state.variablesVisible) {
            this.refreshVariables();
        }
    }

    public codeChange = (changes: monacoEditor.editor.IModelContentChange[], id: string, modelId: string) => {
        // If the model id doesn't match, skip sending this edit. This happens
        // when a cell is reused after deleting another
        const expectedCellId = this.monacoIdToCellId.get(modelId);
        if (expectedCellId !== id) {
            // A cell has been reused. Update our mapping
            this.monacoIdToCellId.set(modelId, id);
            this.cellIdToMonacoId.set(id, modelId);
        } else {
            // Just a normal edit. Pass this onto the completion provider running in the extension
            this.sendMessage(InteractiveWindowMessages.EditCell, { changes, id });
        }
    }

    public readOnlyCodeCreated = (_text: string, file: string, id: string, monacoId: string) => {
        const cell = this.state.cellVMs.find(c => c.cell.id === id);
        if (cell) {
            // Pass this onto the completion provider running in the extension
            this.sendMessage(InteractiveWindowMessages.AddCell, {
                fullText: extractInputText(cell.cell, getSettings()),
                currentText: cell.inputBlockText,
                file,
                id
            });
        }

        // Save in our map of monaco id to cell id
        this.monacoIdToCellId.set(monacoId, id);
        this.cellIdToMonacoId.set(id, monacoId);
    }

    public editableCodeCreated = (_text: string, _file: string, id: string, monacoId: string) => {
        // Save in our map of monaco id to cell id
        this.monacoIdToCellId.set(monacoId, id);
        this.cellIdToMonacoId.set(id, monacoId);
    }

    public codeLostFocus = (cellId: string) => {
        this.onCodeLostFocus(cellId);
        if (this.state.focusedCell === cellId) {
            // Only unfocus if we haven't switched somewhere else yet
            this.setState({ focusedCell: undefined });
        }
    }

    public codeGotFocus = (cellId: string | undefined) => {
        this.setState({ selectedCell: cellId, focusedCell: cellId });
    }

    public selectCell = (cellId: string, focusedCell?: string) => {
        this.setState({ selectedCell: cellId, focusedCell });
    }

    public changeCellType = (cellId: string, newType: 'code' | 'markdown') => {
        const index = this.state.cellVMs.findIndex(c => c.cell.id === cellId);
        if (index >= 0 && this.state.cellVMs[index].cell.data.cell_type !== newType) {
            const newVM = cloneDeep(this.state.cellVMs[index]);
            newVM.cell.data.cell_type = newType;
            const cellVMs = [...this.state.cellVMs];
            cellVMs.splice(index, 1, newVM);
            this.setState({ cellVMs });
        }
    }

    public submitInput = (code: string, inputCell: ICellViewModel) => {
        // noop if the submitted code is just a cell marker
        const matcher = new CellMatcher(getSettings());
        if (matcher.stripFirstMarker(code).length === 0) {
            return;
        }

        // This should be from our last entry. Switch this entry to read only, and add a new item to our list
        if (inputCell && inputCell.cell.id === Identifiers.EditCellId) {
            let newCell = cloneDeep(inputCell);

            // Change this editable cell to not editable.
            newCell.cell.state = CellState.executing;
            newCell.cell.data.source = code;

            // Change type to markdown if necessary
            const split = code.splitLines({ trim: false });
            const firstLine = split[0];
            if (matcher.isMarkdown(firstLine)) {
                newCell.cell.data.cell_type = 'markdown';
                newCell.cell.data.source = generateMarkdownFromCodeLines(split);
                newCell.cell.state = CellState.finished;
            } else if (newCell.cell.data.cell_type === 'markdown') {
                newCell.cell.state = CellState.finished;
            }

            // Clear the input cell as it's the edit cell
            const monacoId = this.getMonacoId(Identifiers.EditCellId);
            const editor = monacoEditor.editor.getModels().find(m => m.id === monacoId);
            if (editor) {
                editor.setValue('');
            }

            // Update input controls (always show expanded since we just edited it.)
            newCell = createCellVM(newCell.cell, getSettings(), this.inputBlockToggled, this.props.defaultEditable);
            const collapseInputs = getSettings().collapseCellInputCodeByDefault;
            newCell = this.alterCellVM(newCell, true, !collapseInputs);
            newCell.useQuickEdit = false;

            // Generate a new id if necessary (as the edit cell always has the same one)
            if (newCell.cell.id === Identifiers.EditCellId) {
                newCell.cell.id = uuid();
            }

            // Indicate this is direct input so that we don't hide it if the user has
            // hide all inputs turned on.
            newCell.directInput = true;

            // Stick in a new cell at the bottom that's editable and update our state
            // so that the last cell becomes busy
            this.setState({
                cellVMs: [...this.state.cellVMs, newCell],
                undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                redoStack: this.state.redoStack,
                skipNextScroll: false,
                submittedText: true
            });

            // Send a message to execute this code if necessary.
            if (newCell.cell.state !== CellState.finished) {
                this.sendMessage(InteractiveWindowMessages.SubmitNewCell, { code, id: newCell.cell.id });
            }
        } else if (inputCell.cell.data.cell_type === 'code') {
            // Update our input cell to be in progress again
            inputCell.cell.state = CellState.executing;

            // Clear our outputs
            inputCell.cell.data.outputs = [];

            // Update our state to display the new status
            this.setState({
                cellVMs: [...this.state.cellVMs]
            });

            // Send a message to rexecute this code
            this.sendMessage(InteractiveWindowMessages.ReExecuteCell, { code, id: inputCell.cell.id });
        } else if (inputCell.cell.data.cell_type === 'markdown') {
            // Change the input on the cell
            inputCell.cell.data.source = code;
            inputCell.inputBlockText = code;

            // Update our state to display the new status
            this.setState({
                cellVMs: [...this.state.cellVMs]
            });
        }
    }

    public findCell(cellId?: string): ICellViewModel | undefined {
        const nonEdit = this.state.cellVMs.find(cvm => cvm.cell.id === cellId);
        if (!nonEdit && cellId === Identifiers.EditCellId) {
            return this.state.editCellVM;
        }
        return nonEdit;
    }

    public getMonacoId(cellId: string): string | undefined {
        return this.cellIdToMonacoId.get(cellId);
    }

    public toggleLineNumbers = (cellId: string) => {
        const index = this.state.cellVMs.findIndex(c => c.cell.id === cellId);
        if (index >= 0) {
            const newVMs = [...this.state.cellVMs];
            newVMs[index] = cloneDeep(newVMs[index]);
            newVMs[index].showLineNumbers = !newVMs[index].showLineNumbers;
            this.setState({ cellVMs: newVMs });
        }
    }

    public toggleOutput = (cellId: string) => {
        const index = this.state.cellVMs.findIndex(c => c.cell.id === cellId);
        if (index >= 0) {
            const newVMs = [...this.state.cellVMs];
            newVMs[index] = cloneDeep(newVMs[index]);
            newVMs[index].hideOutput = !newVMs[index].hideOutput;
            this.setState({ cellVMs: newVMs });
        }
    }

    public setState(newState: {}, callback?: () => void) {
        if (this.suspendUpdateCount > 0) {
            // Just save our new state
            this.state = { ...this.state, ...newState };
            if (callback) {
                callback();
            }
        } else {
            // Send a UI update
            this.props.setState(newState, () => {
                this.state = { ...this.state, ...newState };
                if (callback) {
                    callback();
                }
            });
        }
    }

    public renderUpdate(newState: {}) {
        // This method should be called during the render stage of anything
        // using this state Controller. That's because after shouldComponentUpdate
        // render is next and at this point the state has been set.
        // See https://reactjs.org/docs/react-component.html
        // Otherwise we set the state in the callback during setState and this can be
        // too late for any render code to use the stateController.
        this.state = { ...this.state, ...newState };

        // If the new state includes any cellVM changes, send an update to the other side
        if ('cellVMs' in newState) {
            this.sendInfo();
        }
    }

    public getState(): IMainState {
        return this.state;
    }

    // Adjust the visibility or collapsed state of a cell
    protected alterCellVM(cellVM: ICellViewModel, visible: boolean, expanded: boolean): ICellViewModel {
        if (cellVM.cell.data.cell_type === 'code') {
            // If we are already in the correct state, return back our initial cell vm
            if (cellVM.inputBlockShow === visible && cellVM.inputBlockOpen === expanded) {
                return cellVM;
            }

            const newCellVM = { ...cellVM };
            if (cellVM.inputBlockShow !== visible) {
                if (visible) {
                    // Show the cell, the rest of the function will add on correct collapse state
                    newCellVM.inputBlockShow = true;
                } else {
                    // Hide this cell
                    newCellVM.inputBlockShow = false;
                }
            }

            // No elseif as we want newly visible cells to pick up the correct expand / collapse state
            if (cellVM.inputBlockOpen !== expanded && cellVM.inputBlockCollapseNeeded && cellVM.inputBlockShow) {
                if (expanded) {
                    // Expand the cell
                    const newText = extractInputText(cellVM.cell, getSettings());

                    newCellVM.inputBlockOpen = true;
                    newCellVM.inputBlockText = newText;
                } else {
                    // Collapse the cell
                    let newText = extractInputText(cellVM.cell, getSettings());
                    if (newText.length > 0) {
                        newText = newText.split('\n', 1)[0];
                        newText = newText.slice(0, 255); // Slice to limit length, slicing past length is fine
                        newText = newText.concat('...');
                    }

                    newCellVM.inputBlockOpen = false;
                    newCellVM.inputBlockText = newText;
                }
            }

            return newCellVM;
        }

        return cellVM;
    }

    protected onCodeLostFocus(_cellId: string) {
        // Default is do nothing.
    }

    protected getCellId = (monacoId: string): string => {
        const result = this.monacoIdToCellId.get(monacoId);
        if (result) {
            return result;
        }

        // Just assume it's the edit cell if not found.
        return Identifiers.EditCellId;
    }

    protected addCell(cell: ICell) {
        this.insertCell(cell);
    }

    protected insertCell(cell: ICell, position?: number, isMonaco?: boolean): ICellViewModel | undefined {
        if (cell) {
            const showInputs = getSettings().showCellInputCode;
            const collapseInputs = getSettings().collapseCellInputCodeByDefault;
            let cellVM: ICellViewModel = createCellVM(cell, getSettings(), this.inputBlockToggled, this.props.defaultEditable);

            // Set initial cell visibility and collapse
            cellVM = this.alterCellVM(cellVM, showInputs, !collapseInputs);

            if (cellVM) {
                if (isMonaco) {
                    cellVM.useQuickEdit = false;
                }

                const newList = [...this.state.cellVMs];
                // Make sure to use the same array so our entire state doesn't update
                if (position !== undefined && position >= 0) {
                    newList.splice(position, 0, cellVM);
                } else {
                    newList.push(cellVM);
                }
                this.setState({
                    cellVMs: newList,
                    undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                    redoStack: this.state.redoStack,
                    skipNextScroll: false
                });

                return cellVM;
            }
        }
    }

    protected suspendUpdates() {
        this.suspendUpdateCount += 1;
    }

    protected resumeUpdates() {
        if (this.suspendUpdateCount > 0) {
            this.suspendUpdateCount -= 1;
            if (this.suspendUpdateCount === 0) {
                this.setState(this.state); // This should cause an update
            }
        }

    }

    protected sendMessage = <M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]) => {
        this.postOffice.sendMessage<M, T>(type, payload);
    }

    protected pushStack = (stack: ICellViewModel[][], cells: ICellViewModel[]) => {
        // Get the undo stack up to the maximum length
        const slicedUndo = stack.slice(0, min([stack.length, this.stackLimit]));

        // make a copy of the cells so that further changes don't modify them.
        const copy = cloneDeep(cells);
        return [...slicedUndo, copy];
    }

    private computeEditorOptions(): monacoEditor.editor.IEditorOptions {
        const intellisenseOptions = getSettings().intellisenseOptions;
        const extraSettings = getSettings().extraSettings;
        if (intellisenseOptions && extraSettings) {
            return {
                quickSuggestions: {
                    other: intellisenseOptions.quickSuggestions.other,
                    comments: intellisenseOptions.quickSuggestions.comments,
                    strings: intellisenseOptions.quickSuggestions.strings
                },
                acceptSuggestionOnEnter: intellisenseOptions.acceptSuggestionOnEnter,
                quickSuggestionsDelay: intellisenseOptions.quickSuggestionsDelay,
                suggestOnTriggerCharacters: intellisenseOptions.suggestOnTriggerCharacters,
                tabCompletion: intellisenseOptions.tabCompletion,
                suggest: {
                    localityBonus: intellisenseOptions.suggestLocalityBonus
                },
                suggestSelection: intellisenseOptions.suggestSelection,
                wordBasedSuggestions: intellisenseOptions.wordBasedSuggestions,
                parameterHints: {
                    enabled: intellisenseOptions.parameterHintsEnabled
                },
                cursorStyle: extraSettings.editorCursor,
                cursorBlinking: extraSettings.editorCursorBlink
            };
        }

        return {};
    }

    // tslint:disable-next-line: no-any
    private handleLoadAllCells(payload: any) {
        if (payload && payload.cells) {
            // Turn off updates so we generate all of the cell vms without rendering.
            this.suspendUpdates();

            // Update all of the vms
            const cells = payload.cells as ICell[];
            cells.forEach(c => this.finishCell(c));

            // Set our state to not being busy anymore. Clear undo stack as this can't be undone.
            this.setState({ busy: false, loadTotal: payload.cells.length, undoStack: [] });

            // Turn updates back on and resend the state.
            this.resumeUpdates();
        }
    }

    private handleRestarted() {
        this.suspendUpdates();

        // When we restart, make sure to turn off all executing cells. They aren't executing anymore
        const executingCells = this.state.cellVMs
            .map((cvm, i) => { return { cvm, i }; })
            .filter(s => s.cvm.cell.state !== CellState.error && s.cvm.cell.state !== CellState.finished);

        if (executingCells && executingCells.length) {
            const newVMs = [...this.state.cellVMs];
            executingCells.forEach(s => {
                newVMs[s.i] = cloneDeep(s.cvm);
                newVMs[s.i].cell.state = CellState.finished;
            });
            this.setState({ cellVMs: newVMs });
        }
        this.setState({ currentExecutionCount: 0 });
        this.resumeUpdates();

        // Update our variables
        this.refreshVariables();
    }

    private darkChanged = (newDark: boolean) => {
        // update our base theme if allowed. Don't do this
        // during testing as it will mess up the expected render count.
        if (!this.props.testMode) {
            this.setState(
                {
                    forceDark: newDark
                }
            );
        }
    }

    private monacoThemeChanged = (theme: string) => {
        // update our base theme if allowed. Don't do this
        // during testing as it will mess up the expected render count.
        if (!this.props.testMode) {
            this.setState(
                {
                    monacoTheme: theme
                }
            );
        }
    }

    // tslint:disable-next-line:no-any
    private updateSettings = (payload?: any) => {
        if (payload) {
            const prevShowInputs = getSettings().showCellInputCode;
            updateSettings(payload as string);

            // If our settings change updated show inputs we need to fix up our cells
            const showInputs = getSettings().showCellInputCode;

            // Also save the editor options. Intellisense options may have changed.
            this.setState({
                editorOptions: this.computeEditorOptions()
            });

            // Update theme if necessary
            const newSettings = JSON.parse(payload as string);
            const dsSettings = newSettings as IDataScienceExtraSettings;
            if (dsSettings && dsSettings.extraSettings && dsSettings.extraSettings.theme !== this.state.theme) {
                // User changed the current theme. Rerender
                this.postOffice.sendUnsafeMessage(CssMessages.GetCssRequest, { isDark: this.computeKnownDark() });
                this.postOffice.sendUnsafeMessage(CssMessages.GetMonacoThemeRequest, { isDark: this.computeKnownDark() });
            }

            if (prevShowInputs !== showInputs) {
                this.toggleCellInputVisibility(showInputs, getSettings().collapseCellInputCodeByDefault);
            }
        }
    }

    private getAllCells = () => {
        // Send all of our cells back to the other side
        const cells = this.state.cellVMs.map((cellVM: ICellViewModel) => {
            return cellVM.cell;
        });

        this.sendMessage(InteractiveWindowMessages.ReturnAllCells, cells);
    }

    private getNonEditCellVMs(): ICellViewModel[] {
        return this.state.cellVMs;
    }

    private clearAllSilent = () => {
        // Update our state
        this.setState({
            cellVMs: [],
            undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true,
            busy: false // No more progress on delete all
        });
    }

    private inputBlockToggled = (id: string) => {
        // Create a shallow copy of the array, let not const as this is the shallow array copy that we will be changing
        const cellVMArray: ICellViewModel[] = [...this.state.cellVMs];
        const cellVMIndex = cellVMArray.findIndex((value: ICellViewModel) => {
            return value.cell.id === id;
        });

        if (cellVMIndex >= 0) {
            // Const here as this is the state object pulled off of our shallow array copy, we don't want to mutate it
            const targetCellVM = cellVMArray[cellVMIndex];

            // Mutate the shallow array copy
            cellVMArray[cellVMIndex] = this.alterCellVM(targetCellVM, true, !targetCellVM.inputBlockOpen);

            this.setState({
                skipNextScroll: true,
                cellVMs: cellVMArray
            });
        }
    }

    private toggleCellInputVisibility = (visible: boolean, collapse: boolean) => {
        this.alterAllCellVMs(visible, !collapse);
    }

    private collapseAllSilent = () => {
        if (getSettings().showCellInputCode) {
            this.alterAllCellVMs(true, false);
        }
    }

    private expandAllSilent = () => {
        if (getSettings().showCellInputCode) {
            this.alterAllCellVMs(true, true);
        }
    }

    private alterAllCellVMs = (visible: boolean, expanded: boolean) => {
        const newCells = this.state.cellVMs.map((value: ICellViewModel) => {
            return this.alterCellVM(value, visible, expanded);
        });

        this.setState({
            skipNextScroll: true,
            cellVMs: newCells
        });
    }

    private sendInfo = () => {
        const info: IInteractiveWindowInfo = {
            visibleCells: this.getNonEditCellVMs().map(cvm => cvm.cell),
            cellCount: this.getNonEditCellVMs().length,
            undoCount: this.state.undoStack.length,
            redoCount: this.state.redoStack.length
        };
        this.sendMessage(InteractiveWindowMessages.SendInfo, info);
    }

    private updateOrAdd = (cell: ICell, allowAdd?: boolean) => {
        const index = this.state.cellVMs.findIndex((c: ICellViewModel) => {
            return c.cell.id === cell.id &&
                c.cell.line === cell.line &&
                c.cell.file === cell.file;
        });
        if (index >= 0) {
            // This means the cell existed already so it was actual executed code.
            // Use its execution count to update our execution count.
            const newExecutionCount = cell.data.execution_count ?
                Math.max(this.state.currentExecutionCount, parseInt(cell.data.execution_count.toString(), 10)) :
                this.state.currentExecutionCount;
            if (newExecutionCount !== this.state.currentExecutionCount && this.state.variablesVisible) {
                // We also need to update our variable explorer when the execution count changes
                // Use the ref here to maintain var explorer independence
                this.refreshVariables(newExecutionCount);
            }

            // Have to make a copy of the cell VM array or
            // we won't actually update.
            const newVMs = [...this.state.cellVMs];
            newVMs[index] = cloneDeep(newVMs[index]);

            // Check to see if our code still matches for the cell (in liveshare it might be updated from the other side)
            if (concatMultilineString(newVMs[index].cell.data.source) !== concatMultilineString(cell.data.source)) {
                const newText = extractInputText(cell, getSettings());
                newVMs[index].inputBlockText = newText;
            }

            newVMs[index].cell = cell;

            this.setState({
                cellVMs: newVMs,
                currentExecutionCount: newExecutionCount
            });

        } else if (allowAdd) {
            // This is an entirely new cell (it may have started out as finished)
            this.addCell(cell);
        }
    }

    private isCellSupported(cell: ICell): boolean {
        return !this.props.testMode || cell.data.cell_type !== 'messages';
    }

    // tslint:disable-next-line:no-any
    private finishCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, true);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private startCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, true);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private updateCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, false);
            }
        }
    }

    // Find the display value for one specific variable
    private refreshVariable = (targetVar: IJupyterVariable) => {
        this.sendMessage(InteractiveWindowMessages.GetVariableValueRequest, targetVar);
    }

    // When we get a variable value back use the ref to pass to the variable explorer
    // tslint:disable-next-line:no-any
    private getVariableValueResponse = (payload?: any) => {
        if (payload) {
            const variable = payload as IJupyterVariable;

            // Only send the updated variable data if we are on the same execution count as when we requested it
            if (variable && variable.executionCount !== undefined && variable.executionCount === this.state.currentExecutionCount) {
                const stateVariable = this.state.variables.findIndex(v => v.name === variable.name);
                if (stateVariable >= 0) {
                    const newState = [...this.state.variables];
                    newState.splice(stateVariable, 1, variable);
                    this.setState({
                        variables: newState,
                        pendingVariableCount: Math.max(0, this.state.pendingVariableCount - 1)
                    });
                }
            }
        }
    }

    // When we get our new set of variables back use the ref to pass to the variable explorer
    // tslint:disable-next-line:no-any
    private getVariablesResponse = (payload?: any) => {
        if (payload) {
            const variablesResponse = payload as IJupyterVariablesResponse;

            // Check to see if we have moved to a new execution count only send our update if we are on the same count as the request
            if (variablesResponse.executionCount === this.state.currentExecutionCount) {
                this.setState({
                    variables: variablesResponse.variables,
                    pendingVariableCount: variablesResponse.variables.length
                });

                // Now put out a request for all of the sub values for the variables
                variablesResponse.variables.forEach(this.refreshVariable);
            }
        }
    }

    // tslint:disable-next-line: no-any
    private tokenizerLoaded = (_e?: any) => {
        this.setState({ tokenizerLoaded: true });
    }

    private loadOnigasm = (): Promise<ArrayBuffer> => {
        if (!this.onigasmPromise) {
            this.onigasmPromise = createDeferred<ArrayBuffer>();
            // Send our load onigasm request
            this.sendMessage(InteractiveWindowMessages.LoadOnigasmAssemblyRequest);
        }
        return this.onigasmPromise.promise;
    }

    private loadTmlanguage = (): Promise<string> => {
        if (!this.tmlangugePromise) {
            this.tmlangugePromise = createDeferred<string>();
            // Send our load onigasm request
            this.sendMessage(InteractiveWindowMessages.LoadTmLanguageRequest);
        }
        return this.tmlangugePromise.promise;
    }

    // tslint:disable-next-line: no-any
    private handleOnigasmResponse(payload: any) {
        if (payload && this.onigasmPromise) {
            const typedArray = new Uint8Array(payload.data);
            this.onigasmPromise.resolve(typedArray.buffer);
        } else if (this.onigasmPromise) {
            this.onigasmPromise.resolve(undefined);
        }
    }

    // tslint:disable-next-line: no-any
    private handleTmLanguageResponse(payload: any) {
        if (payload && this.tmlangugePromise) {
            this.tmlangugePromise.resolve(payload.toString());
        } else if (this.tmlangugePromise) {
            this.tmlangugePromise.resolve(undefined);
        }
    }

    // tslint:disable-next-line:no-any
    private handleCssResponse(payload?: any) {
        const response = payload as IGetCssResponse;
        if (response && response.css) {

            // Recompute our known dark value from the class name in the body
            // VS code should update this dynamically when the theme changes
            const computedKnownDark = this.computeKnownDark();

            // We also get this in our response, but computing is more reliable
            // than searching for it.

            if (this.state.knownDark !== computedKnownDark) {
                this.darkChanged(computedKnownDark);
            }

            this.setState({
                rootCss: response.css,
                theme: response.theme,
                knownDark: computedKnownDark
            });
        }
    }

    // tslint:disable-next-line: no-any
    private handleMonacoThemeResponse(payload?: any) {
        const response = payload as IGetMonacoThemeResponse;
        if (response && response.theme) {

            // Tell monaco we have a new theme. THis is like a state update for monaco
            monacoEditor.editor.defineTheme('interactiveWindow', response.theme);
            this.monacoThemeChanged('interactiveWindow');
        }
    }

    private computeKnownDark(): boolean {
        const ignore = getSettings && getSettings().ignoreVscodeTheme ? true : false;
        const baseTheme = ignore ? 'vscode-light' : detectBaseTheme();
        return baseTheme !== 'vscode-light';
    }
}
