// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { connect } from 'react-redux';
import { OSType } from '../../client/common/utils/platform';
import { NativeKeyboardCommandTelemetry, NativeMouseCommandTelemetry } from '../../client/datascience/constants';
import { buildSettingsCss } from '../interactive-common/buildSettingsCss';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { handleLinkClick } from '../interactive-common/handlers';
import {
    activeDebugState,
    DebugState,
    getSelectedAndFocusedInfo,
    ICellViewModel,
    IMainState
} from '../interactive-common/mainState';
import { IMainWithVariables, IStore } from '../interactive-common/redux/store';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { getOSType } from '../react-common/constants';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { AddCellLine } from './addCellLine';
import { getConnectedNativeCell } from './nativeCell';
import './nativeEditor.less';
import { actionCreators } from './redux/actions';
import { ToolbarComponent } from './toolbar';

type INativeEditorProps = IMainWithVariables & typeof actionCreators;

function mapStateToProps(state: IStore): IMainWithVariables {
    return { ...state.main, variableState: state.variables };
}

const ConnectedNativeCell = getConnectedNativeCell();

export class NativeEditor extends React.Component<INativeEditorProps> {
    private renderCount: number = 0;
    private waitingForLoadRender = true;
    private mainPanelToolbarRef: React.RefObject<HTMLDivElement> = React.createRef();

    constructor(props: INativeEditorProps) {
        super(props);
        this.insertAboveFirst = this.insertAboveFirst.bind(this);
    }

    public componentDidMount() {
        this.props.editorLoaded();
        window.addEventListener('keydown', this.mainKeyDown);
        window.addEventListener('resize', () => this.forceUpdate(), true);
        document.addEventListener('click', this.linkClick, true);
    }

    public componentWillUnmount() {
        window.removeEventListener('keydown', this.mainKeyDown);
        window.removeEventListener('resize', () => this.forceUpdate());
        document.removeEventListener('click', this.linkClick);
        this.props.editorUnmounted();
    }

    public componentDidUpdate(prevProps: IMainState) {
        if (this.props.loaded && !prevProps.loaded && this.waitingForLoadRender) {
            this.waitingForLoadRender = false;
            // After this render is complete (see this SO)
            // https://stackoverflow.com/questions/26556436/react-after-render-code,
            // indicate we are done loading. We want to wait for the render
            // so we get accurate timing on first launch.
            setTimeout(() => {
                window.requestAnimationFrame(() => {
                    this.props.loadedAllCells();
                });
            });
        }
    }

    public render() {
        const dynamicFont: React.CSSProperties = {
            fontSize: this.props.font.size,
            fontFamily: this.props.font.family
        };

        // If in test mode, update our count. Use this to determine how many renders a normal update takes.
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        // Update the state controller with our new state
        const progressBar = (this.props.busy || !this.props.loaded) && !this.props.testMode ? <Progress /> : undefined;
        const addCellLine =
            this.props.cellVMs.length === 0 ? null : (
                <AddCellLine
                    includePlus={true}
                    className="add-cell-line-top"
                    click={this.insertAboveFirst}
                    baseTheme={this.props.baseTheme}
                />
            );

        return (
            <div id="main-panel" role="Main" style={dynamicFont}>
                <div className="styleSetter">
                    <style>{`${this.props.rootCss ? this.props.rootCss : ''}
${buildSettingsCss(this.props.settings)}`}</style>
                </div>
                <header ref={this.mainPanelToolbarRef} id="main-panel-toolbar">
                    {this.renderToolbarPanel()}
                    {progressBar}
                </header>
                <section
                    id="main-panel-variable"
                    aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}
                >
                    {this.renderVariablePanel(this.props.baseTheme)}
                </section>
                <main id="main-panel-content">
                    {addCellLine}
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
            </div>
        );
    }

    private insertAboveFirst() {
        setTimeout(() => this.props.insertAboveFirst(), 1);
    }
    private renderToolbarPanel() {
        return <ToolbarComponent></ToolbarComponent>;
    }

    private renderVariablePanel(baseTheme: string) {
        if (this.props.variableState.visible) {
            const variableProps = this.getVariableProps(baseTheme);
            return <VariablePanel {...variableProps} />;
        }

        return null;
    }

    private renderContentPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.props.monacoReady && !this.props.testMode) {
            return null;
        }

        // Otherwise render our cells.
        const contentProps = this.getContentProps(baseTheme);
        return <ContentPanel {...contentProps} />;
    }

    private getContentProps = (baseTheme: string): IContentPanelProps => {
        return {
            baseTheme: baseTheme,
            cellVMs: this.props.cellVMs,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.props.submittedText,
            skipNextScroll: this.props.skipNextScroll ? true : false,
            editable: true,
            renderCell: this.renderCell,
            scrollToBottom: this.scrollDiv,
            scrollBeyondLastLine: this.props.settings
                ? this.props.settings.extraSettings.editor.scrollBeyondLastLine
                : false
        };
    };
    private getVariableProps = (baseTheme: string): IVariablePanelProps => {
        let toolbarHeight = 0;
        if (this.mainPanelToolbarRef.current) {
            toolbarHeight = this.mainPanelToolbarRef.current.offsetHeight;
        }
        return {
            variables: this.props.variableState.variables,
            containerHeight: this.props.variableState.containerHeight,
            gridHeight: this.props.variableState.gridHeight,
            debugging: this.props.debugging,
            busy: this.props.busy,
            showDataExplorer: this.props.showDataViewer,
            skipDefault: this.props.skipDefault,
            testMode: this.props.testMode,
            closeVariableExplorer: this.props.toggleVariableExplorer,
            setVariableExplorerHeight: this.props.setVariableExplorerHeight,
            baseTheme: baseTheme,
            pageIn: this.pageInVariableData,
            fontSize: this.props.font.size,
            executionCount: this.props.currentExecutionCount,
            offsetHeight: toolbarHeight,
            supportsDebugging:
                this.props.settings && this.props.settings.variableOptions
                    ? this.props.settings.variableOptions.enableDuringDebugger
                    : false
        };
    };

    private pageInVariableData = (startIndex: number, pageSize: number) => {
        this.props.getVariableData(this.props.currentExecutionCount, startIndex, pageSize);
    };

    // tslint:disable-next-line: cyclomatic-complexity
    private mainKeyDown = (event: KeyboardEvent) => {
        // Handler for key down presses in the main panel
        switch (event.key) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: How to have this work for when the keyboard shortcuts are changed?
            case 's': {
                if ((event.ctrlKey && getOSType() !== OSType.OSX) || (event.metaKey && getOSType() === OSType.OSX)) {
                    // This is save, save our cells
                    this.props.save();
                    this.props.sendCommand(NativeKeyboardCommandTelemetry.Save);
                }
                break;
            }
            case 'z':
            case 'Z':
                if (
                    !getSelectedAndFocusedInfo(this.props).focusedCellId &&
                    !this.props.settings?.extraSettings.useCustomEditorApi
                ) {
                    if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                        event.stopPropagation();
                        this.props.redo();
                        this.props.sendCommand(NativeKeyboardCommandTelemetry.Redo);
                    } else if (!event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
                        event.stopPropagation();
                        this.props.undo();
                        this.props.sendCommand(NativeKeyboardCommandTelemetry.Undo);
                    }
                }
                break;

            case 'F10':
                if (this.props.debugging) {
                    // Only allow step if debugging in break mode
                    const debuggingCell = this.props.cellVMs.find((cvm) => cvm.runningByLine === DebugState.Break);
                    if (debuggingCell) {
                        this.props.step(debuggingCell.cell.id);
                    }
                    event.stopPropagation();
                } else {
                    // Otherwise if not debugging, run by line the current focused cell
                    const focusedCell = getSelectedAndFocusedInfo(this.props).focusedCellId;
                    if (focusedCell) {
                        this.props.runByLine(focusedCell);
                    }
                }
                break;
            case 'F5':
                if (this.props.debugging) {
                    // Only allow continue if debugging in break mode
                    const debuggingCell = this.props.cellVMs.find((cvm) => cvm.runningByLine === DebugState.Break);
                    if (debuggingCell) {
                        this.props.continue(debuggingCell.cell.id);
                    }
                    event.stopPropagation();
                }
                break;
            default:
                break;
        }
    };

    // private copyToClipboard = (cellId: string) => {
    //     const cell = this.props.findCell(cellId);
    //     if (cell) {
    //         // Need to do this in this process so it copies to the user's clipboard and not
    //         // the remote clipboard where the extension is running
    //         const textArea = document.createElement('textarea');
    //         textArea.value = concatMultilineString(cell.cell.data.source);
    //         document.body.appendChild(textArea);
    //         textArea.select();
    //         document.execCommand('Copy');
    //         textArea.remove();
    //     }
    // }

    // private pasteFromClipboard = (cellId: string) => {
    //     const editedCells = this.props.cellVMs;
    //     const index = editedCells.findIndex(x => x.cell.id === cellId) + 1;

    //     if (index > -1) {
    //         const textArea = document.createElement('textarea');
    //         document.body.appendChild(textArea);
    //         textArea.select();
    //         document.execCommand('Paste');
    //         editedCells[index].cell.data.source = textArea.value.split(/\r?\n/);
    //         textArea.remove();
    //     }

    //     this.setState({
    //         cellVMs: editedCells
    //     });
    // }

    private renderCell = (cellVM: ICellViewModel, index: number): JSX.Element | null => {
        // Don't render until we have settings
        if (!this.props.settings || !this.props.editorOptions) {
            return null;
        }
        const addNewCell = () => {
            setTimeout(() => this.props.insertBelow(cellVM.cell.id), 1);
            this.props.sendCommand(NativeMouseCommandTelemetry.AddToEnd);
        };
        const firstLine = index === 0;
        const lastLine =
            index === this.props.cellVMs.length - 1 ? (
                <AddCellLine
                    includePlus={true}
                    baseTheme={this.props.baseTheme}
                    className="add-cell-line-cell"
                    click={addNewCell}
                />
            ) : null;

        const otherCellRunningByLine = this.props.cellVMs.find(
            (cvm) => activeDebugState(cvm.runningByLine) && cvm.cell.id !== cellVM.cell.id
        );
        const maxOutputSize = this.props.settings.maxOutputSize;
        const outputSizeLimit = 10000;
        const maxTextSize =
            maxOutputSize && maxOutputSize < outputSizeLimit && maxOutputSize > 0
                ? maxOutputSize
                : this.props.settings.enableScrollingForCellOutputs
                ? 400
                : undefined;

        return (
            <div key={cellVM.cell.id} id={cellVM.cell.id}>
                <ErrorBoundary>
                    <ConnectedNativeCell
                        role="listitem"
                        maxTextSize={maxTextSize}
                        enableScroll={this.props.settings.enableScrollingForCellOutputs}
                        testMode={this.props.testMode}
                        cellVM={cellVM}
                        baseTheme={this.props.baseTheme}
                        codeTheme={this.props.codeTheme}
                        monacoTheme={this.props.monacoTheme}
                        lastCell={lastLine !== null}
                        firstCell={firstLine}
                        font={this.props.font}
                        allowUndo={this.props.undoStack.length > 0}
                        editorOptions={this.props.editorOptions}
                        enableGather={this.props.settings.enableGather}
                        themeMatplotlibPlots={this.props.settings.themeMatplotlibPlots}
                        // Focus pending does not apply to native editor.
                        focusPending={0}
                        busy={this.props.busy}
                        useCustomEditorApi={this.props.settings?.extraSettings.useCustomEditorApi}
                        runningByLine={cellVM.runningByLine}
                        supportsRunByLine={
                            this.props.settings?.variableOptions?.enableDuringDebugger
                                ? otherCellRunningByLine === undefined
                                : false
                        }
                        language={this.props.kernel.language}
                    />
                </ErrorBoundary>
                {lastLine}
            </div>
        );
    };

    private scrollDiv = (_div: HTMLDivElement) => {
        // Doing nothing for now. This should be implemented once redux refactor is done.
    };

    private linkClick = (ev: MouseEvent) => {
        handleLinkClick(ev, this.props.linkClick);
    };
}

// Main export, return a redux connected editor
export function getConnectedNativeEditor() {
    return connect(mapStateToProps, actionCreators)(NativeEditor);
}
