// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './interactivePanel.less';

import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { Identifiers } from '../../client/datascience/constants';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { ICellViewModel, IMainState } from '../interactive-common/mainState';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { IKeyboardEvent } from '../react-common/event';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { getSettings } from '../react-common/settingsReactSide';
import { InteractiveCell } from './interactiveCell';
import { InteractivePanelStateController } from './interactivePanelStateController';

interface IInteractivePanelProps {
    skipDefault: boolean;
    testMode?: boolean;
    codeTheme: string;
    baseTheme: string;
}

export class InteractivePanel extends React.Component<IInteractivePanelProps, IMainState> {
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private editCellRef: React.RefObject<InteractiveCell> = React.createRef<InteractiveCell>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private cellRefs: Map<string, React.RefObject<InteractiveCell>> = new Map<string, React.RefObject<InteractiveCell>>();
    private renderCount: number = 0;
    private internalScrollCount: number = 0;

    constructor(props: IInteractivePanelProps) {
        super(props);
    }

    public shouldComponentUpdate(_nextProps: IInteractivePanelProps, nextState: IMainState): boolean {
        return this.stateController.requiresUpdate(this.state, nextState);
    }

    public componentWillUnmount() {
        // Dispose of our state controller so it stops listening
        this.stateController.dispose();
    }

    public render() {
        const dynamicFont: React.CSSProperties = {
            fontSize: this.state.font.size,
            fontFamily: this.state.font.family
        };

        // Update the state controller with our new state
        this.stateController.renderUpdate(this.state);
        const progressBar = this.state.busy && !this.props.testMode ? <Progress /> : undefined;

        // If in test mode, update our count. Use this to determine how many renders a normal update takes.
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        return (
            <div id='main-panel' ref={this.mainPanelRef} role='Main' style={dynamicFont}>
                <div className='styleSetter'>
                    <style>
                        {this.state.rootCss}
                    </style>
                </div>
                <header id='main-panel-toolbar'>
                    {this.renderToolbarPanel()}
                    {progressBar}
                </header>
                <section id='main-panel-variable' aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}>
                    {this.renderVariablePanel(this.state.baseTheme)}
                </section>
                <main id='main-panel-content' onScroll={this.handleScroll}>
                    {this.renderContentPanel(this.state.baseTheme)}
                </main>
                <section id='main-panel-footer' aria-label={getLocString('DataScience.editSection', 'Input new cells here')}>
                    {this.renderFooterPanel(this.state.baseTheme)}
                </section>
            </div>
        );
    }

    private activated = () => {
        // Make sure the input cell gets focus
        if (getSettings && getSettings().allowInput) {
            // Delay this so that we make sure the outer frame has focus first.
            setTimeout(() => {
                // First we have to give ourselves focus (so that focus actually ends up in the code cell)
                if (this.mainPanelRef && this.mainPanelRef.current) {
                    this.mainPanelRef.current.focus({preventScroll: true});
                }

                if (this.editCellRef && this.editCellRef.current) {
                    this.editCellRef.current.giveFocus(true);
                }
            }, 100);
        }
    }

    private scrollToCell(id: string) {
        const ref = this.cellRefs.get(id);
        if (ref && ref.current) {
            ref.current.scrollAndFlash();
        }
    }

    private renderToolbarPanel() {
        const variableExplorerTooltip = this.state.variablesVisible ?
            getLocString('DataScience.collapseVariableExplorerTooltip', 'Hide variables active in jupyter kernel') :
            getLocString('DataScience.expandVariableExplorerTooltip', 'Show variables active in jupyter kernel');

        return (
            <div id='toolbar-panel'>
                <div className='toolbar-menu-bar'>
                    <div className='toolbar-menu-bar-child'>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.clearAll} tooltip={getLocString('DataScience.clearAll', 'Remove all cells')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Cancel} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.redo} disabled={!this.stateController.canRedo()} tooltip={getLocString('DataScience.redo', 'Redo')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Redo} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.undo} disabled={!this.stateController.canUndo()} tooltip={getLocString('DataScience.undo', 'Undo')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Undo} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.interruptKernel} tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Interrupt} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.restartKernel} tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Restart} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.toggleVariableExplorer} tooltip={variableExplorerTooltip}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.VariableExplorer} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.export} disabled={!this.stateController.canExport()} tooltip={getLocString('DataScience.export', 'Export as Jupyter notebook')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.SaveAs} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.expandAll} disabled={!this.stateController.canExpandAll()} tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.ExpandAll} />
                        </ImageButton>
                        <ImageButton baseTheme={this.state.baseTheme} onClick={this.stateController.collapseAll} disabled={!this.stateController.canCollapseAll()} tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}>
                            <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.CollapseAll} />
                        </ImageButton>
                    </div>
                </div>
            </div>
        );
    }

    private renderVariablePanel(baseTheme: string) {
        if (this.state.variablesVisible) {
            const variableProps = this.getVariableProps(baseTheme);
            return <VariablePanel {...variableProps} />;
        }

        return null;
    }

    private renderContentPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.state.tokenizerLoaded && !this.props.testMode) {
            return null;
        }

        // Otherwise render our cells.
        const contentProps = this.getContentProps(baseTheme);
        return <ContentPanel {...contentProps} ref={this.contentPanelRef} />;
    }

    private renderFooterPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.state.tokenizerLoaded || !this.state.editCellVM) {
            return null;
        }

        const maxOutputSize = getSettings().maxOutputSize;
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        const executionCount = this.getInputExecutionCount();
        const editPanelClass = getSettings().colorizeInputBox ? 'edit-panel-colorized' : 'edit-panel';

        return (
            <div className={editPanelClass}>
                <ErrorBoundary>
                    <InteractiveCell
                        editorOptions={this.state.editorOptions}
                        history={this.state.history}
                        maxTextSize={maxTextSize}
                        autoFocus={document.hasFocus()}
                        testMode={this.props.testMode}
                        cellVM={this.state.editCellVM}
                        baseTheme={baseTheme}
                        codeTheme={this.props.codeTheme}
                        showWatermark={true}
                        editExecutionCount={executionCount.toString()}
                        onCodeCreated={this.stateController.editableCodeCreated}
                        onCodeChange={this.stateController.codeChange}
                        monacoTheme={this.state.monacoTheme}
                        openLink={this.stateController.openLink}
                        expandImage={noop}
                        ref={this.editCellRef}
                        onClick={this.clickEditCell}
                        keyDown={this.editCellKeyDown}
                        renderCellToolbar={this.renderEditCellToolbar}
                        font={this.state.font}
                    />
                </ErrorBoundary>
            </div>
        );
    }

    private getInputExecutionCount = () : number => {
        return this.state.currentExecutionCount + 1;
    }

    private getContentProps = (baseTheme: string): IContentPanelProps => {
        return {
            baseTheme: baseTheme,
            cellVMs: this.state.cellVMs,
            history: this.state.history,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.state.submittedText,
            skipNextScroll: this.state.skipNextScroll ? true : false,
            editable: false,
            newCellVM: undefined,
            renderCell: this.renderCell,
            scrollToBottom: this.scrollDiv
        };
    }
    private getVariableProps = (baseTheme: string): IVariablePanelProps => {
       return {
        variables: this.state.variables,
        pendingVariableCount: this.state.pendingVariableCount,
        debugging: this.state.debugging,
        busy: this.state.busy,
        showDataExplorer: this.stateController.showDataViewer,
        skipDefault: this.props.skipDefault,
        testMode: this.props.testMode,
        closeVariableExplorer: this.stateController.toggleVariableExplorer,
        baseTheme: baseTheme
       };
    }

    private clickEditCell = () => {
        if (this.editCellRef && this.editCellRef.current) {
            this.editCellRef.current.giveFocus(true);
        }
    }

    private renderCell = (cellVM: ICellViewModel, _index: number, containerRef?: React.RefObject<HTMLDivElement>): JSX.Element | null => {
        const cellRef = React.createRef<InteractiveCell>();
        this.cellRefs.set(cellVM.cell.id, cellRef);
        return (
            <div key={cellVM.cell.id} id={cellVM.cell.id} ref={containerRef}>
                <ErrorBoundary>
                    <InteractiveCell
                        ref={cellRef}
                        role='listitem'
                        editorOptions={this.state.editorOptions}
                        history={undefined}
                        maxTextSize={getSettings().maxOutputSize}
                        autoFocus={false}
                        testMode={this.props.testMode}
                        cellVM={cellVM}
                        baseTheme={this.state.baseTheme}
                        codeTheme={this.props.codeTheme}
                        showWatermark={cellVM.cell.id === Identifiers.EditCellId}
                        editExecutionCount={this.getInputExecutionCount().toString()}
                        onCodeChange={this.stateController.codeChange}
                        onCodeCreated={this.stateController.readOnlyCodeCreated}
                        monacoTheme={this.state.monacoTheme}
                        openLink={this.stateController.openLink}
                        expandImage={this.stateController.showPlot}
                        renderCellToolbar={this.renderCellToolbar}
                        font={this.state.font}
                    />
                </ErrorBoundary>
            </div>);
    }

    private renderCellToolbar = (cellId: string) => {
        const gotoCode = () => this.stateController.gotoCellCode(cellId);
        const deleteCode = () => this.stateController.deleteCell(cellId);
        const copyCode = () => this.stateController.copyCellCode(cellId);
        const cell = this.stateController.findCell(cellId);
        const gatherCode = () => this.stateController.gatherCell(cell);
        const hasNoSource = !cell || !cell.cell.file || cell.cell.file === Identifiers.EmptyFileName;

        return (
            [
                <div className='cell-toolbar' key={0}>
                    <ImageButton baseTheme={this.state.baseTheme} onClick={gatherCode} hidden={!this.state.enableGather} tooltip={getLocString('DataScience.gatherCodeTooltip', 'Gather code')} >
                        <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.GatherCode} />
                    </ImageButton>
                    <ImageButton baseTheme={this.state.baseTheme} onClick={gotoCode} tooltip={getLocString('DataScience.gotoCodeButtonTooltip', 'Go to code')} hidden={hasNoSource}>
                        <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.GoToSourceCode} />
                    </ImageButton>
                    <ImageButton baseTheme={this.state.baseTheme} onClick={copyCode} tooltip={getLocString('DataScience.copyBackToSourceButtonTooltip', 'Paste code into file')} hidden={!hasNoSource}>
                        <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Copy} />
                    </ImageButton>
                    <ImageButton baseTheme={this.state.baseTheme} onClick={deleteCode} tooltip={getLocString('DataScience.deleteButtonTooltip', 'Remove Cell')}>
                        <Image baseTheme={this.state.baseTheme} class='image-button-image' image={ImageName.Cancel} />
                    </ImageButton>
                </div>
            ]
        );
    }

    private renderEditCellToolbar = (_cellId: string) => {
        return null;
    }

    // This handles the scrolling. Its called from the props of contentPanel.
    // We only scroll when the state indicates we are at the bottom of the interactive window,
    // otherwise it sometimes scrolls when the user wasn't at the bottom.
    private scrollDiv = (div: HTMLDivElement) => {
        if (this.state.isAtBottom) {
            this.internalScrollCount += 1;
            // Force auto here as smooth scrolling can be canceled by updates to the window
            // from elsewhere (and keeping track of these would make this hard to maintain)
            div.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
        }
    }

    private handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (this.internalScrollCount > 0) {
            this.internalScrollCount -= 1;
        } else {
            const currentHeight = e.currentTarget.scrollHeight - e.currentTarget.scrollTop;
            const isAtBottom = currentHeight < e.currentTarget.clientHeight + 2 && currentHeight > e.currentTarget.clientHeight - 2;
            this.setState({
                isAtBottom
            });
        }
    }

}
