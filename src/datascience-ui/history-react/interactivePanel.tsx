// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './interactivePanel.less';

import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { Identifiers } from '../../client/datascience/constants';
import { Cell } from '../interactive-common/cell';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { IMainState } from '../interactive-common/mainState';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { IKeyboardEvent } from '../react-common/event';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { InteractivePanelStateController } from './interactivePanelStateController';

interface IInteractivePanelProps {
    skipDefault: boolean;
    testMode?: boolean;
    codeTheme: string;
    baseTheme: string;
}

export class InteractivePanel extends React.Component<IInteractivePanelProps, IMainState> {
    // Public for testing
    public stateController: InteractivePanelStateController;
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private editCellRef: React.RefObject<Cell> = React.createRef<Cell>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private renderCount: number = 0;
    private internalScrollCount: number = 0;

    constructor(props: IInteractivePanelProps) {
        super(props);

        // Create our state controller. It manages updating our state.
        this.stateController = new InteractivePanelStateController({
            skipDefault: this.props.skipDefault,
            testMode: this.props.testMode ? true : false,
            expectingDark: this.props.baseTheme !== 'vscode-light',
            setState: this.setState.bind(this),
            activate: this.activated.bind(this),
            scrollToCell: this.scrollToCell.bind(this),
            defaultEditable: false,
            hasEdit: getSettings && getSettings().allowInput,
            enableGather: (getSettings && getSettings().enableGather) ? true : false
        });

        // Default our state.
        this.state = this.stateController.getState();
    }

    public shouldComponentUpdate(_nextProps: IInteractivePanelProps, nextState: IMainState): boolean {
        return this.stateController.requiresUpdate(this.state, nextState);
    }

    public componentWillUnmount() {
        // Dispose of our state controller so it stops listening
        this.stateController.dispose();
    }

    public render() {
        // Update the state controller with our new state
        this.stateController.renderUpdate(this.state);

        // If in test mode, update our count. Use this to determine how many renders a normal update takes.
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        return (
            <div id='main-panel' ref={this.mainPanelRef} role='Main'>
                <div className='styleSetter'>
                    <style>
                        {this.state.rootCss}
                    </style>
                </div>
                <header id='main-panel-toolbar'>
                    {this.renderToolbarPanel()}
                </header>
                <section id='main-panel-variable' aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}>
                    {this.renderVariablePanel(this.props.baseTheme)}
                </section>
                <main id='main-panel-content' onScroll={this.handleScroll}>
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
                <section id='main-panel-footer' aria-label={getLocString('DataScience.editSection', 'Input new cells here')}>
                    {this.renderFooterPanel(this.props.baseTheme)}
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
        if (this.contentPanelRef && this.contentPanelRef.current) {
            this.contentPanelRef.current.scrollToCell(id);
        }
    }

    private renderToolbarPanel() {
        return (
            <div id='toolbar-panel'>
                <div className='toolbar-menu-bar'>
                    <div className='toolbar-menu-bar-child'>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.clearAll} tooltip={getLocString('DataScience.clearAll', 'Remove all cells')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Cancel} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.redo} disabled={!this.stateController.canRedo()} tooltip={getLocString('DataScience.redo', 'Redo')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Redo} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.undo} disabled={!this.stateController.canUndo()} tooltip={getLocString('DataScience.undo', 'Undo')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Undo} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.interruptKernel} tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Interrupt} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.restartKernel} tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Restart} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.export} disabled={!this.stateController.canExport()} tooltip={getLocString('DataScience.export', 'Export as Jupyter notebook')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.expandAll} disabled={!this.stateController.canExpandAll()} tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ExpandAll} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.collapseAll} disabled={!this.stateController.canCollapseAll()} tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.CollapseAll} />
                        </ImageButton>
                    </div>
                </div>
            </div>
        );
    }

    private renderVariablePanel(baseTheme: string) {
        const variableProps = this.getVariableProps(baseTheme);
        return <VariablePanel {...variableProps} />;
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
                    <Cell
                        editorOptions={this.state.editorOptions}
                        history={this.state.history}
                        maxTextSize={maxTextSize}
                        autoFocus={document.hasFocus()}
                        testMode={this.props.testMode}
                        cellVM={this.state.editCellVM}
                        baseTheme={baseTheme}
                        allowCollapse={false}
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
            editorOptions: this.state.editorOptions,
            baseTheme: baseTheme,
            cellVMs: this.state.cellVMs,
            history: this.state.history,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.state.submittedText,
            skipNextScroll: this.state.skipNextScroll ? true : false,
            monacoTheme: this.state.monacoTheme,
            onCodeCreated: this.stateController.readOnlyCodeCreated,
            onCodeChange: this.stateController.codeChange,
            openLink: this.stateController.openLink,
            expandImage: this.stateController.showPlot,
            editable: false,
            newCellVM: undefined,
            editExecutionCount: this.getInputExecutionCount().toString(),
            renderCellToolbar: this.renderCellToolbar,
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
        refreshVariables: this.stateController.refreshVariables,
        variableExplorerToggled: this.stateController.variableExplorerToggled,
        baseTheme: baseTheme
       };
    }

    private clickEditCell = () => {
        if (this.editCellRef && this.editCellRef.current) {
            this.editCellRef.current.giveFocus(true);
        }
    }

    private editCellKeyDown = (_cellId: string, e: IKeyboardEvent) => {
        if (e.code === 'Escape') {
            this.editCellEscape(e);
        } else if (e.code === 'Enter' && e.shiftKey) {
            this.editCellSubmit(e);
        }
    }

    private editCellSubmit(e: IKeyboardEvent) {
        if (e.editorInfo && e.editorInfo.contents && this.state.editCellVM) {
            // Prevent shift+enter from turning into a enter
            e.stopPropagation();
            e.preventDefault();

            // Remove empty lines off the end
            let endPos = e.editorInfo.contents.length - 1;
            while (endPos >= 0 && e.editorInfo.contents[endPos] === '\n') {
                endPos -= 1;
            }
            const content = e.editorInfo.contents.slice(0, endPos + 1);

            // Send to the input history too if necessary
            if (this.state.history) {
                this.state.history.add(content, e.editorInfo.isDirty);
            }

            // Send to jupyter
            this.stateController.submitInput(content, this.state.editCellVM);
        }
    }

    private editCellEscape = (e: IKeyboardEvent) => {
        const focusedElement = document.activeElement;
        if (focusedElement !== null && e.editorInfo && !e.editorInfo.isSuggesting) {
            const nextTabStop = this.findTabStop(1, focusedElement);
            if (nextTabStop) {
                nextTabStop.focus();
            }
        }
    }

    private findTabStop(direction: number, element: Element) : HTMLElement | undefined {
        if (element) {
            const allFocusable = document.querySelectorAll('input, button, select, textarea, a[href]');
            if (allFocusable) {
                const tabable = Array.prototype.filter.call(allFocusable, (i: HTMLElement) => i.tabIndex >= 0);
                const self = tabable.indexOf(element);
                return direction >= 0 ? tabable[self + 1] || tabable[0] : tabable[self - 1] || tabable[0];
            }
        }
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
                    <ImageButton baseTheme={this.props.baseTheme} onClick={gatherCode} hidden={!this.state.enableGather} tooltip={getLocString('DataScience.gatherCodeTooltip', 'Gather code')} >
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.GatherCode} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={gotoCode} tooltip={getLocString('DataScience.gotoCodeButtonTooltip', 'Go to code')} hidden={hasNoSource}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.GoToSourceCode} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={copyCode} tooltip={getLocString('DataScience.copyBackToSourceButtonTooltip', 'Paste code into file')} hidden={!hasNoSource}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Copy} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={deleteCode} tooltip={getLocString('DataScience.deleteButtonTooltip', 'Remove Cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Cancel} />
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
