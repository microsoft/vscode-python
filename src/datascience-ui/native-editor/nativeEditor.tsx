// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { connect } from 'react-redux';
import { OSType } from '../../client/common/utils/platform';
import { NativeCommandType } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { concatMultilineStringInput } from '../common';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { handleLinkClick } from '../interactive-common/handlers';
import { KernelSelection } from '../interactive-common/kernelSelection';
import { ICellViewModel, IMainState } from '../interactive-common/mainState';
import { IMainWithVariables, IStore } from '../interactive-common/redux/store';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { getOSType } from '../react-common/constants';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { AddCellLine } from './addCellLine';
import { getConnectedNativeCell } from './nativeCell';
import './nativeEditor.less';
import { actionCreators } from './redux/actions';

type INativeEditorProps = IMainWithVariables & typeof actionCreators;

function mapStateToProps(state: IStore): IMainWithVariables {
    return { ...state.main, variableState: state.variables };
}

const ConnectedNativeCell = getConnectedNativeCell();

export class NativeEditor extends React.Component<INativeEditorProps> {
    private renderCount: number = 0;
    private waitingForLoadRender = true;

    constructor(props: INativeEditorProps) {
        super(props);
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
        const progressBar = this.props.busy && !this.props.testMode ? <Progress /> : undefined;
        const addCellLine =
            this.props.cellVMs.length === 0 ? null : (
                <AddCellLine
                    includePlus={true}
                    className="add-cell-line-top"
                    click={this.props.insertAboveFirst}
                    baseTheme={this.props.baseTheme}
                />
            );

        return (
            <div id="main-panel" role="Main" style={dynamicFont}>
                <div className="styleSetter">
                    <style>{this.props.rootCss}</style>
                </div>
                <header id="main-panel-toolbar">
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

    // tslint:disable: react-this-binding-issue
    // tslint:disable-next-line: max-func-body-length
    private renderToolbarPanel() {
        const selectedIndex = this.props.cellVMs.findIndex(c => c.cell.id === this.props.selectedCellId);

        const addCell = () => {
            this.props.addCell();
            this.props.sendCommand(NativeCommandType.AddToEnd, 'mouse');
        };
        const runAll = () => {
            // Run all cells currently available.
            this.props.executeAllCells();
            this.props.sendCommand(NativeCommandType.RunAll, 'mouse');
        };
        const save = () => {
            this.props.save();
            this.props.sendCommand(NativeCommandType.Save, 'mouse');
        };
        const toggleVariableExplorer = () => {
            this.props.toggleVariableExplorer();
            this.props.sendCommand(NativeCommandType.ToggleVariableExplorer, 'mouse');
        };
        const variableExplorerTooltip = this.props.variableState.visible
            ? getLocString('DataScience.collapseVariableExplorerTooltip', 'Hide variables active in jupyter kernel')
            : getLocString('DataScience.expandVariableExplorerTooltip', 'Show variables active in jupyter kernel');
        const runAbove = () => {
            if (this.props.selectedCellId) {
                this.props.executeAbove(this.props.selectedCellId);
                this.props.sendCommand(NativeCommandType.RunAbove, 'mouse');
            }
        };
        const runBelow = () => {
            if (this.props.selectedCellId) {
                // tslint:disable-next-line: no-suspicious-comment
                // TODO: Is the source going to be up to date during run below?
                this.props.executeCellAndBelow(
                    this.props.selectedCellId,
                    concatMultilineStringInput(this.props.cellVMs[selectedIndex].cell.data.source)
                );
                this.props.sendCommand(NativeCommandType.RunBelow, 'mouse');
            }
        };
        const selectKernel = () => {
            this.props.selectKernel();
            this.props.sendCommand(NativeCommandType.SelectKernel, 'mouse');
        };
        const selectServer = () => {
            this.props.selectServer();
            this.props.sendCommand(NativeCommandType.SelectServer, 'mouse');
        };
        const canRunAbove = selectedIndex > 0;
        const canRunBelow = selectedIndex < this.props.cellVMs.length - 1 && this.props.selectedCellId;

        return (
            <div id="toolbar-panel">
                <div className="toolbar-menu-bar">
                    <div className="toolbar-menu-bar-child">
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={runAll}
                            disabled={this.props.busy}
                            className="native-button"
                            tooltip={getLocString('DataScience.runAll', 'Run All Cells')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.RunAll}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={runAbove}
                            disabled={!canRunAbove || this.props.busy}
                            className="native-button"
                            tooltip={getLocString('DataScience.runAbove', 'Run cells above')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.RunAbove}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={runBelow}
                            disabled={!canRunBelow || this.props.busy}
                            className="native-button"
                            tooltip={getLocString('DataScience.runBelow', 'Run cell and below')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.RunBelow}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.restartKernel}
                            disabled={this.props.busy}
                            className="native-button"
                            tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.Restart}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.interruptKernel}
                            disabled={this.props.busy}
                            className="native-button"
                            tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.Interrupt}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={addCell}
                            className="native-button"
                            tooltip={getLocString('DataScience.addNewCell', 'Insert cell')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.InsertBelow}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.clearAllOutputs}
                            disabled={!this.props.cellVMs.length}
                            className="native-button"
                            tooltip={getLocString('DataScience.clearAllOutput', 'Clear All Output')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.ClearAllOutput}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={toggleVariableExplorer}
                            className="native-button"
                            tooltip={variableExplorerTooltip}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.VariableExplorer}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={save}
                            disabled={!this.props.dirty}
                            className="native-button"
                            tooltip={getLocString('DataScience.save', 'Save File')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.SaveAs}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.export}
                            disabled={!this.props.cellVMs.length || this.props.busy}
                            className="native-button"
                            tooltip={getLocString('DataScience.exportAsPythonFileTooltip', 'Save As Python File')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.ExportToPython}
                            />
                        </ImageButton>
                    </div>
                    <KernelSelection
                        baseTheme={this.props.baseTheme}
                        font={this.props.font}
                        kernel={this.props.kernel}
                        selectServer={selectServer}
                        selectKernel={selectKernel}
                    />
                </div>
                <div className="toolbar-divider" />
            </div>
        );
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
        return {
            variables: this.props.variableState.variables,
            debugging: this.props.debugging,
            busy: this.props.busy,
            showDataExplorer: this.props.showDataViewer,
            skipDefault: this.props.skipDefault,
            testMode: this.props.testMode,
            closeVariableExplorer: this.props.toggleVariableExplorer,
            baseTheme: baseTheme,
            pageIn: this.pageInVariableData,
            fontSize: this.props.font.size,
            executionCount: this.props.currentExecutionCount
        };
    };

    private pageInVariableData = (startIndex: number, pageSize: number) => {
        this.props.getVariableData(this.props.currentExecutionCount, startIndex, pageSize);
    };

    private mainKeyDown = (event: KeyboardEvent) => {
        // Handler for key down presses in the main panel
        switch (event.key) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: How to have this work for when the keyboard shortcuts are changed?
            case 's': {
                if ((event.ctrlKey && getOSType() !== OSType.OSX) || (event.metaKey && getOSType() === OSType.OSX)) {
                    // This is save, save our cells
                    this.props.save();
                    this.props.sendCommand(NativeCommandType.Save, 'keyboard');
                }
                break;
            }
            case 'z':
            case 'Z':
                if (this.props.focusedCellId === undefined) {
                    if (event.shiftKey && !event.ctrlKey && !event.altKey) {
                        event.stopPropagation();
                        this.props.redo();
                        this.props.sendCommand(NativeCommandType.Redo, 'keyboard');
                    } else if (!event.shiftKey && !event.altKey && !event.ctrlKey) {
                        event.stopPropagation();
                        this.props.undo();
                        this.props.sendCommand(NativeCommandType.Undo, 'keyboard');
                    }
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
            this.props.insertBelow(cellVM.cell.id);
            this.props.sendCommand(NativeCommandType.AddToEnd, 'mouse');
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

        return (
            <div key={cellVM.cell.id} id={cellVM.cell.id}>
                <ErrorBoundary>
                    <ConnectedNativeCell
                        role="listitem"
                        maxTextSize={this.props.settings.maxOutputSize}
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
