// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './nativeEditor.less';

import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { OSType } from '../../client/common/utils/platform';
import { NativeCommandType, IInteractiveWindowMapping, InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { CursorPos, ICellViewModel, IMainState } from '../interactive-common/mainState';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { getOSType } from '../react-common/constants';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { getSettings } from '../react-common/settingsReactSide';
import { AddCellLine } from './addCellLine';
import { NativeCell } from './nativeCell';
import { actionCreators } from './redux/actions';
import { connect } from 'react-redux';
import { concatMultilineStringInput } from '../../client/datascience/common';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

type INativeEditorProps = IMainState & typeof actionCreators;

function mapStateToProps(state: IMainState): IMainState {
    return state;
}
class NativeEditor extends React.Component<INativeEditorProps> {
    private renderCount: number = 0;
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private contentPanelScrollRef: React.RefObject<HTMLElement> = React.createRef<HTMLElement>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private debounceUpdateVisibleCells = debounce(this.updateVisibleCells.bind(this), 100);
    private cellRefs: Map<string, React.RefObject<NativeCell>> = new Map<string, React.RefObject<NativeCell>>();
    private cellContainerRefs: Map<string, React.RefObject<HTMLDivElement>> = new Map<string, React.RefObject<HTMLDivElement>>();
    private initialVisibilityUpdate: boolean = false;

    constructor(props: INativeEditorProps) {
        super(props);
    }

    public componentDidMount() {
        window.addEventListener('keydown', this.mainKeyDown);
        window.addEventListener('resize', () => this.forceUpdate(), true);
    }

    public componentWillUnmount() {
        window.removeEventListener('keydown', this.mainKeyDown);
        window.removeEventListener('resize', () => this.forceUpdate());
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
        const addCellLine = this.props.cellVMs.length === 0 ? null :
            <AddCellLine includePlus={true} className='add-cell-line-top' click={this.props.insertAboveFirst} baseTheme={this.props.baseTheme}/>;

        return (
            <div id='main-panel' ref={this.mainPanelRef} role='Main' style={dynamicFont}>
                <div className='styleSetter'>
                    <style>
                        {this.props.rootCss}
                    </style>
                </div>
                <header id='main-panel-toolbar'>
                    {this.renderToolbarPanel()}
                    {progressBar}
                </header>
                <section id='main-panel-variable' aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}>
                    {this.renderVariablePanel(this.props.baseTheme)}
                </section>
                <main id='main-panel-content' onScroll={this.onContentScroll} ref={this.contentPanelScrollRef}>
                    {addCellLine}
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
            </div>
        );
    }

    // tslint:disable: react-this-binding-issue
    private renderToolbarPanel() {
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
        }
        const toggleVariableExplorer = () => {
            this.props.toggleVariableExplorer();
            this.props.sendCommand(NativeCommandType.ToggleVariableExplorer, 'mouse');
        };
        const variableExplorerTooltip = this.props.variablesVisible ?
            getLocString('DataScience.collapseVariableExplorerTooltip', 'Hide variables active in jupyter kernel') :
            getLocString('DataScience.expandVariableExplorerTooltip', 'Show variables active in jupyter kernel');

        return (
            <div id='toolbar-panel'>
                <div className='toolbar-menu-bar'>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.restartKernel} className='native-button' tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Restart} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.interruptKernel} className='native-button' tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Interrupt} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={addCell} className='native-button' tooltip={getLocString('DataScience.addNewCell', 'Insert cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runAll} className='native-button' tooltip={getLocString('DataScience.runAll', 'Run All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAll} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.clearAllOutputs} disabled={!this.props.cellVMs.length} className='native-button' tooltip={getLocString('DataScience.clearAllOutput', 'Clear All Output')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ClearAllOutput} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={toggleVariableExplorer} className='native-button' tooltip={variableExplorerTooltip}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.VariableExplorer} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={save} disabled={!this.props.dirty} className='native-button' tooltip={getLocString('DataScience.save', 'Save File')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.export} disabled={!this.props.cellVMs.length} className='save-button' tooltip={getLocString('DataScience.exportAsPythonFileTooltip', 'Save As Python File')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ExportToPython} />
                    </ImageButton>
                </div>
                <div className='toolbar-divider'/>
            </div>
        );
    }

    private renderVariablePanel(baseTheme: string) {
        if (this.props.variablesVisible) {
            const variableProps = this.getVariableProps(baseTheme);
            return <VariablePanel {...variableProps} />;
        }

        return null;
    }

    private renderContentPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.props.tokenizerLoaded && !this.props.testMode) {
            return null;
        }

        // Otherwise render our cells.
        const contentProps = this.getContentProps(baseTheme);
        return <ContentPanel {...contentProps} ref={this.contentPanelRef}/>;
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
            scrollToBottom: this.scrollDiv
        };
    }
    private getVariableProps = (baseTheme: string): IVariablePanelProps => {
       return {
        variables: this.props.variables,
        pendingVariableCount: this.props.pendingVariableCount,
        debugging: this.props.debugging,
        busy: this.props.busy,
        showDataExplorer: this.props.showDataViewer,
        skipDefault: this.props.skipDefault,
        testMode: this.props.testMode,
        closeVariableExplorer: this.props.toggleVariableExplorer,
        baseTheme: baseTheme
       };
    }

    private onContentScroll = (_event: React.UIEvent<HTMLDivElement>) => {
        if (this.contentPanelScrollRef.current) {
            this.debounceUpdateVisibleCells();
        }
    }

    private updateVisibleCells()  {
        if (this.contentPanelScrollRef.current && this.cellContainerRefs.size !== 0) {
            const visibleTop = this.contentPanelScrollRef.current.offsetTop + this.contentPanelScrollRef.current.scrollTop;
            const visibleBottom = visibleTop + this.contentPanelScrollRef.current.clientHeight;
            const cellVMs = [...this.props.cellVMs];

            // Go through the cell divs and find the ones that are suddenly visible
            let makeChange = false;
            for (let i = 0; i < cellVMs.length; i += 1) {
                const cellVM = cellVMs[i];
                if (cellVM.useQuickEdit && this.cellRefs.has(cellVM.cell.id)) {
                    const ref = this.cellContainerRefs.get(cellVM.cell.id);
                    if (ref && ref.current) {
                        const top = ref.current.offsetTop;
                        const bottom = top + ref.current.offsetHeight;
                        if (top > visibleBottom) {
                            break;
                        } else if (bottom < visibleTop) {
                            continue;
                        } else {
                            cellVMs[i] = {...cellVM, useQuickEdit: false };
                            makeChange = true;
                        }
                    }
                }
            }

            // update our state so that newly visible items appear
            if (makeChange) {
                this.setState({cellVMs});
            }
        }
    }

    private mainKeyDown = (event: KeyboardEvent) => {
        // Handler for key down presses in the main panel
        switch (event.key) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: How to have this work for when the keyboard shortcuts are changed?
            case 's': {
                if (event.ctrlKey || (event.metaKey && getOSType() === OSType.OSX)) {
                    // This is save, save our cells
                    this.props.save();
                    this.props.sendCommand(NativeCommandType.Save, 'keyboard');
                }
                break;
            }
            default:
                break;
        }
    }

    // private copyToClipboard = (cellId: string) => {
    //     const cell = this.stateController.findCell(cellId);
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
        const cellRef : React.RefObject<NativeCell> = React.createRef<NativeCell>();
        const containerRef = React.createRef<HTMLDivElement>();
        this.cellRefs.set(cellVM.cell.id, cellRef);
        this.cellContainerRefs.set(cellVM.cell.id, containerRef);
        const addNewCell = () => {
            this.props.insertBelow(cellVM.cell.id);
            this.props.sendCommand(NativeCommandType.AddToEnd, 'mouse');
        };
        const lastLine = index === this.props.cellVMs.length - 1 ?
            <AddCellLine
                includePlus={true}
                baseTheme={this.props.baseTheme}
                className='add-cell-line-cell'
                click={addNewCell} /> : null;

        // Special case, see if our initial load is finally complete.
        if (this.props.loadTotal && this.cellRefs.size >= this.props.loadTotal && !this.initialVisibilityUpdate) {
            // We are finally at the point where we have rendered all visible cells. Try fixing up their visible state
            this.initialVisibilityUpdate = true;
            this.debounceUpdateVisibleCells();
        }
        return (
            <div key={cellVM.cell.id} id={cellVM.cell.id} ref={containerRef}>
                <ErrorBoundary>
                    <NativeCell
                        ref={cellRef}
                        role='listitem'
                        maxTextSize={getSettings().maxOutputSize}
                        autoFocus={false}
                        testMode={this.props.testMode}
                        cellVM={cellVM}
                        baseTheme={this.props.baseTheme}
                        codeTheme={this.props.codeTheme}
                        monacoTheme={this.props.monacoTheme}
                        focusCell={this.props.focusCell}
                        selectCell={this.props.selectCell}
                        lastCell={lastLine !== null}
                        font={this.props.font}
                    />
                </ErrorBoundary>
                {lastLine}
            </div>);
    }

    private scrollDiv = (_div: HTMLDivElement) => {
        // Doing nothing for now. This should be implemented once redux refactor is done.
    }
}

// Main export, return a redux connected editor
export function getConnectedNativeEditor() {
    return connect(
        mapStateToProps,
        actionCreators
    )(NativeEditor);
}
