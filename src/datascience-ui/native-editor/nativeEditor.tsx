// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './nativeEditor.less';

import * as React from 'react';

import { concatMultilineString } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { CellState, ICell } from '../../client/datascience/types';
import { ICellViewModel } from '../interactive-common/cell';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { IMainState } from '../interactive-common/mainState';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { Button } from '../react-common/button';
import { IKeyboardEvent } from '../react-common/event';
import { Flyout } from '../react-common/flyout';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { NativeEditorStateController } from './nativeEditorStateController';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

interface INativeEditorProps {
    skipDefault: boolean;
    testMode?: boolean;
    codeTheme: string;
    baseTheme: string;
}

export class NativeEditor extends React.Component<INativeEditorProps, IMainState> {
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private contentPanelScrollRef: React.RefObject<HTMLElement> = React.createRef<HTMLElement>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private stateController: NativeEditorStateController;
    private initialCellDivs: (HTMLDivElement | null)[] = [];
    private debounceUpdateVisibleCells = debounce(this.updateVisibleCells.bind(this), 100);
    private pressedDOnce = false;

    constructor(props: INativeEditorProps) {
        super(props);

        // Create our state controller. It manages updating our state.
        this.stateController = new NativeEditorStateController({
            skipDefault: this.props.skipDefault,
            testMode: this.props.testMode ? true : false,
            expectingDark: this.props.baseTheme !== 'vscode-light',
            setState: this.setState.bind(this),
            activate: this.activated.bind(this),
            scrollToCell: this.scrollToCell.bind(this),
            defaultEditable: true,
            hasEdit: true,
            enableGather: false
        });

        // Default our state.
        this.state = this.stateController.getState();
    }

    public componentDidMount() {
        window.addEventListener('keydown', this.mainKeyDown);
    }

    public componentWillUnmount() {
        window.removeEventListener('keydown', this.mainKeyDown);
        // Dispose of our state controller so it stops listening
        this.stateController.dispose();
    }

    public render() {
        // Update the state controller with our new state
        this.stateController.renderUpdate(this.state);

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
                <main id='main-panel-content' onScroll={this.onContentScroll} ref={this.contentPanelScrollRef}>
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
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
            }, 100);
        }
    }

    private scrollToCell(id: string) {
        if (this.contentPanelRef && this.contentPanelRef.current) {
            this.contentPanelRef.current.scrollToCell(id);
        }
    }

    // tslint:disable: react-this-binding-issue
    private renderToolbarPanel() {
        const addCell = () => this.stateController.addNewCell();
        const runAll = () => this.stateController.runAll();

        return (
            <div id='toolbar-panel'>
                <div className='toolbar-menu-bar'>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.restartKernel} className='native-button' tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Restart} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.interruptKernel} className='native-button' tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Interrupt} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={addCell} className='native-button' tooltip={getLocString('DataScience.addNewCell', 'Insert cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runAll} className='native-button' tooltip={getLocString('DataScience.runAll', 'Run All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAll} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.save} disabled={!this.state.dirty} className='native-button' tooltip={getLocString('DataScience.save', 'Save File')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs} />
                    </ImageButton>
                    <Button onClick={this.stateController.export} disabled={!this.stateController.canExport()} className='save-button' tooltip={getLocString('DataScience.exportAsPythonFileTooltip', 'Save As Python File')}>
                        <span>{getLocString('DataScience.exportAsPythonFileTitle', 'Save As Python File')}</span>
                    </Button>
                </div>
                <div className='toolbar-divider'/>
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
        return <ContentPanel {...contentProps} ref={this.contentPanelRef}/>;
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
            editable: true,
            editorMeasureClassName: 'measure-editor-div',
            keyDownCell: this.keyDownCell,
            selectedCell: this.state.selectedCell,
            focusedCell: this.state.focusedCell,
            clickCell: this.clickCell,
            doubleClickCell: this.doubleClickCell,
            focusCell: this.stateController.codeGotFocus,
            unfocusCell: this.stateController.codeLostFocus,
            allowsMarkdownEditing: true,
            renderCellToolbar: this.renderCellToolbar,
            onRenderCompleted: this.onContentFirstRender,
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

    private getNonMessageCells(): ICell[] {
        return this.state.cellVMs.map(cvm => cvm.cell).filter(c => c.data.cell_type !== 'messages');
    }

    private onContentFirstRender = (cells: (HTMLDivElement | null)[]) => {
        this.stateController.setState({busy: false});

        if (this.initialCellDivs.length === 0) {
            this.initialCellDivs = cells;
            this.debounceUpdateVisibleCells();
        }
    }

    private onContentScroll = (_event: React.UIEvent<HTMLDivElement>) => {
        if (this.contentPanelScrollRef.current) {
            this.debounceUpdateVisibleCells();
        }
    }

    private updateVisibleCells()  {
        if (this.contentPanelScrollRef.current && this.initialCellDivs.length !== 0) {
            const visibleTop = this.contentPanelScrollRef.current.offsetTop + this.contentPanelScrollRef.current.scrollTop;
            const visibleBottom = visibleTop + this.contentPanelScrollRef.current.clientHeight;
            const cellVMs = this.state.cellVMs;

            // Go through the cell divs and find the ones that are suddenly visible
            for (let index = 0; index < this.initialCellDivs.length; index += 1) {
                if (index < cellVMs.length && cellVMs[index].useQuickEdit) {
                    const div = this.initialCellDivs[index];
                    if (div) {
                        const top = div.offsetTop;
                        const bottom = top + div.offsetHeight;
                        if (top > visibleBottom) {
                            break;
                        } else if (bottom < visibleTop) {
                            continue;
                        } else {
                            cellVMs[index].useQuickEdit = false;
                        }
                    }
                }
            }

            // update our state so that newly visible items appear
            this.setState({cellVMs});
        }
    }

    private findCellViewModel(cellId: string): ICellViewModel | undefined {
        let result = this.state.cellVMs.find(c => c.cell.id === cellId);
        if (!result) {
            result = cellId === Identifiers.EditCellId ? this.state.editCellVM : undefined;
        }
        return result;
    }

    private mainKeyDown = (event: KeyboardEvent) => {
        // Handler for key down presses in the main panel
        switch (event.key) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: How to have this work for when the keyboard shortcuts are changed?
            case 's':
                if (event.ctrlKey) {
                    // This is save, save our cells
                    this.stateController.save();
                }
                break;

            default:
                break;
        }
    }

    // tslint:disable-next-line: cyclomatic-complexity max-func-body-length
    private keyDownCell = async (cellId: string, e: IKeyboardEvent) => {
        switch (e.code) {
            case 'ArrowUp':
                this.pressedDOnce = false;
                if (this.state.focusedCell === cellId && e.editorInfo && e.editorInfo.isFirstLine && !e.editorInfo.isSuggesting) {
                    this.arrowUpFromCell(cellId, e);
                } else if (!this.state.focusedCell) {
                    this.arrowUpFromCell(cellId, e);
                }
                break;
            case 'ArrowDown':
                this.pressedDOnce = false;
                if (this.state.focusedCell === cellId && e.editorInfo && e.editorInfo.isLastLine && !e.editorInfo.isSuggesting) {
                    this.arrowDownFromCell(cellId, e);
                } else if (!this.state.focusedCell) {
                    this.arrowDownFromCell(cellId, e);
                }
                break;
            case 'Escape':
                this.pressedDOnce = false;
                if (this.state.focusedCell && e.editorInfo && !e.editorInfo.isSuggesting) {
                    this.escapeCell(this.state.focusedCell, e);
                }
                break;
            case 'y':
                this.pressedDOnce = false;
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.changeCellType(this.state.selectedCell, 'code');
                }
                break;
            case 'm':
                this.pressedDOnce = false;
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.changeCellType(this.state.selectedCell, 'markdown');
                }
                break;
            case 'l':
                this.pressedDOnce = false;
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.toggleLineNumbers(this.state.selectedCell);
                }
                break;
            case 'o':
                this.pressedDOnce = false;
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.toggleOutput(this.state.selectedCell);
                }
                break;
            case 'Enter':
                this.pressedDOnce = false;
                if (e.shiftKey) {
                    this.submitCell(cellId, e, true);
                } else if (e.ctrlKey) {
                    this.submitCell(cellId, e, false);
                } else if (e.altKey) {
                    this.submitCell(cellId, e, false);
                    this.stateController.insertBelow(cellId, true);
                } else {
                    this.enterCell(cellId, e);
                }
                break;
            case 'd':
                if (this.pressedDOnce) {
                    this.stateController.deleteCell(cellId);
                    this.pressedDOnce = false;
                } else {
                    this.pressedDOnce = true;
                }
                break;
            case 'a':
                this.pressedDOnce = false;
                if (this.state.focusedCell === cellId && e.editorInfo && e.editorInfo.isLastLine && !e.editorInfo.isSuggesting) {
                    this.stateController.insertAbove(cellId, true);
                } else if (!this.state.focusedCell) {
                    this.stateController.insertAbove(cellId, true);
                }
                break;
            case 'b':
                this.pressedDOnce = false;
                if (this.state.focusedCell === cellId && e.editorInfo && e.editorInfo.isLastLine && !e.editorInfo.isSuggesting) {
                    this.stateController.insertBelow(cellId, true);
                } else if (!this.state.focusedCell) {
                    this.stateController.insertBelow(cellId, true);
                }
                break;
            case 'j':
                this.pressedDOnce = false;
                if (this.state.focusedCell === cellId && e.editorInfo && e.editorInfo.isFirstLine && !e.editorInfo.isSuggesting) {
                    this.arrowUpFromCell(cellId, e);
                } else if (!this.state.focusedCell) {
                    this.arrowUpFromCell(cellId, e);
                }
                break;
            case 'k':
                this.pressedDOnce = false;
                if (this.state.focusedCell === cellId && e.editorInfo && e.editorInfo.isFirstLine && !e.editorInfo.isSuggesting) {
                    this.arrowDownFromCell(cellId, e);
                } else if (!this.state.focusedCell) {
                    this.arrowDownFromCell(cellId, e);
                }
                break;
            default:
                this.pressedDOnce = false;
                break;
        }
    }

    private enterCell = (cellId: string, e: IKeyboardEvent) => {
        // If focused, then ignore this call. It should go to the focused cell instead.
        if (!this.state.focusedCell && !e.editorInfo && this.contentPanelRef && this.contentPanelRef.current) {
            e.stopPropagation();
            e.preventDefault();

            // Figure out which cell this is
            const cellvm = this.stateController.findCell(cellId);
            if (cellvm && this.state.selectedCell === cellId) {
                this.contentPanelRef.current.focusCell(cellId, true);
            }
        }
    }

    private submitCell = (cellId: string, e: IKeyboardEvent, moveToNextCell: boolean) => {
        let content: string | undefined ;
        const cellVM = this.findCellViewModel(cellId);

        // If inside editor, submit this code
        if (e.editorInfo && e.editorInfo.contents) {
            // Prevent shift+enter from turning into a enter
            e.stopPropagation();
            e.preventDefault();
            content = e.editorInfo.contents;
        } else if (cellVM) {
            // Outside editor, just use the cell
            content = concatMultilineString(cellVM.cell.data.source);
        }

        // Send to jupyter
        if (cellVM && content) {
            this.stateController.submitInput(content, cellVM);
        }

        // If this is not the edit cell, move to our next cell
        if (cellId !== Identifiers.EditCellId && moveToNextCell) {
            const nextCell = this.getNextCellId(cellId);
            if (nextCell) {
                this.stateController.selectCell(nextCell, undefined);
            }
        }
    }

    private getNextCellId(cellId: string): string | undefined {
        const cells = this.getNonMessageCells();

        // Find the next cell to move to
        const index = cells.findIndex(c => c.id === cellId);
        let nextCellId: string | undefined;
        if (index >= 0) {
            if (index < cells.length - 1) {
                nextCellId = cells[index + 1].id;
            } else if (this.state.editCellVM) {
                nextCellId = this.state.editCellVM.cell.id;
            }
        }

        return nextCellId;
    }

    private arrowUpFromCell = (cellId: string, e: IKeyboardEvent) => {
        const cells = this.getNonMessageCells();

        // Find the next cell index
        let index = cells.findIndex(c => c.id === cellId) - 1;

        // Might also be the edit cell
        if (this.state.editCellVM && cellId === this.state.editCellVM.cell.id) {
            index = cells.length - 1;
        }

        if (index >= 0 && this.contentPanelRef.current) {
            e.stopPropagation();
            const prevCellId = cells[index].id;
            const wasFocused = this.state.focusedCell;
            this.stateController.selectCell(prevCellId, wasFocused ? prevCellId : undefined);
            this.contentPanelRef.current.focusCell(prevCellId, wasFocused ? true : false);
        }
    }

    private arrowDownFromCell = (cellId: string, e: IKeyboardEvent) => {
        const nextCellId = this.getNextCellId(cellId);

        if (nextCellId && this.contentPanelRef.current) {
            e.stopPropagation();
            const wasFocused = this.state.focusedCell;
            this.stateController.selectCell(nextCellId, wasFocused ? nextCellId : undefined);
            this.contentPanelRef.current.focusCell(nextCellId, wasFocused ? true : false);
        }
    }

    private clickCell = (cellId: string) => {
        this.pressedDOnce = false;
        const focusedCell = cellId === this.state.focusedCell ? cellId : undefined;
        this.stateController.selectCell(cellId, focusedCell);
    }

    private doubleClickCell = (cellId: string) => {
        if (this.contentPanelRef.current) {
            this.contentPanelRef.current.focusCell(cellId, true);
        }
    }

    private escapeCell = (cellId: string, e: IKeyboardEvent) => {
        // Unfocus the current cell by giving focus to the cell itself
        if (this.contentPanelRef && this.contentPanelRef.current) {
            e.stopPropagation();
            this.contentPanelRef.current.focusCell(cellId, false);
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
    //     const editedCells = this.state.cellVMs;
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

    private moveCellUp = (cellId?: string) => {
        if (this.contentPanelRef.current && cellId) {
            const wasFocused = this.state.focusedCell;
            this.stateController.moveCellUp(cellId);
            setTimeout(() => this.contentPanelRef.current!.focusCell(cellId, wasFocused ? true : false), 1);
        }
    }

    private moveCellDown = (cellId?: string) => {
        if (this.contentPanelRef.current && cellId) {
            const wasFocused = this.state.focusedCell;
            this.stateController.moveCellDown(cellId);
            setTimeout(() => this.contentPanelRef.current!.focusCell(cellId, wasFocused ? true : false), 1);
        }
    }

    private renderNormalCellToolbar(cellId: string): JSX.Element[] | null {
        const cell = this.state.cellVMs.find(cvm => cvm.cell.id === cellId);
        if (cell) {
            const deleteCell = () => this.stateController.deleteCell(cellId);
            const runCell = () => {
                this.stateController.updateCellSource(cellId);
                this.stateController.submitInput(concatMultilineString(cell.cell.data.source), cell);
                if (this.contentPanelRef.current) {
                    this.contentPanelRef.current.focusCell(cellId, false);
                }
            };
            const moveUp = () => this.moveCellUp(cellId);
            const moveDown = () => this.moveCellDown(cellId);
            const canMoveUp = this.stateController.canMoveUp(cellId);
            const canMoveDown = this.stateController.canMoveDown(cellId);
            const runAbove = () => this.stateController.runAbove(cellId);
            const runBelow = () => this.stateController.runBelow(cellId);
            const canRunAbove = this.stateController.canRunAbove(cellId);
            const canRunBelow = this.stateController.canRunBelow(cellId);
            const insertAbove = () => this.stateController.insertAbove(cellId);
            const insertBelow = () => this.stateController.insertBelow(cellId);
            const runCellHidden = cell.cell.state !== CellState.finished;
            const flyoutClass = cell.cell.id === this.state.focusedCell ? 'native-editor-cellflyout native-editor-cellflyout-focused'
                : 'native-editor-cellflyout native-editor-cellflyout-selected';
            const switchTooltip = cell.cell.data.cell_type === 'code' ? getLocString('DataScience.switchToMarkdown', 'Change to markdown') :
                getLocString('DataScience.switchToCode', 'Change to code');
            const switchImage = cell.cell.data.cell_type === 'code' ? ImageName.SwitchToMarkdown : ImageName.SwitchToCode;
            const switchCell = cell.cell.data.cell_type === 'code' ? () => this.stateController.changeCellType(cellId, 'markdown') :
                () => this.stateController.changeCellType(cellId, 'code');
            const outerPortion =
                <div className='native-editor-celltoolbar-outer' key={0}>
                    <Flyout buttonClassName='native-editor-flyout-button' buttonContent={<span className='flyout-button-content'>...</span>} flyoutContainerName={flyoutClass}>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={moveUp} disabled={!canMoveUp} tooltip={getLocString('DataScience.moveCellUp', 'Move cell up')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Up} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={moveDown} disabled={!canMoveDown} tooltip={getLocString('DataScience.moveCellDown', 'Move cell down')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Down} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={runAbove} disabled={!canRunAbove} tooltip={getLocString('DataScience.runAbove', 'Run cells above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={runBelow} disabled={!canRunBelow} tooltip={getLocString('DataScience.runBelow', 'Run cell and below')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunBelow} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={insertAbove} tooltip={getLocString('DataScience.insertAbove', 'Insert cell above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={insertBelow} disabled={!canMoveDown} tooltip={getLocString('DataScience.insertBelow', 'Insert cell below')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={switchCell} tooltip={switchTooltip}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={switchImage} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={deleteCell} tooltip={getLocString('DataScience.deleteCell', 'Delete cell')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Delete} />
                        </ImageButton>
                    </Flyout>
                </div>;

            const innerPortion =
                <div className='native-editor-celltoolbar-inner' key={1}>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runCell} hidden={runCellHidden} tooltip={getLocString('DataScience.runCell', 'Run cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Run} />
                    </ImageButton>
                </div>;

            if (cell.cell.data.cell_type === 'code') {
                return [innerPortion, outerPortion];
            }

            return [outerPortion];
        }

        return null;
    }

    private renderEditCellToolbar() {
        const cell = this.state.editCellVM;
        if (cell) {
            const runCell = () => {
                this.stateController.submitInput(concatMultilineString(cell.cell.data.source), cell);
            };
            const runAbove = () => this.stateController.runAbove(Identifiers.EditCellId);
            const canRunAbove = this.stateController.canRunAbove(Identifiers.EditCellId);
            const insertAbove = () => this.stateController.insertAbove(Identifiers.EditCellId);
            const flyoutClass = cell.cell.id === this.state.focusedCell ? 'native-editor-cellflyout native-editor-cellflyout-focused'
                : 'native-editor-cellflyout native-editor-cellflyout-selected';
            const switchTooltip = cell.cell.data.cell_type === 'code' ? getLocString('DataScience.switchToMarkdown', 'Change to markdown') :
                getLocString('DataScience.switchToCode', 'Change to code');
            const switchImage = cell.cell.data.cell_type === 'code' ? ImageName.SwitchToMarkdown : ImageName.SwitchToCode;
            const switchCell = cell.cell.data.cell_type === 'code' ? () => this.stateController.changeCellType(Identifiers.EditCellId, 'markdown') :
                () => this.stateController.changeCellType(Identifiers.EditCellId, 'code');
            const outerPortion =
                <div className='native-editor-celltoolbar-outer' key={0}>
                    <Flyout buttonClassName='native-editor-flyout-button' buttonContent={<span>...</span>} flyoutContainerName={flyoutClass}>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={runAbove} disabled={!canRunAbove} tooltip={getLocString('DataScience.runAbove', 'Run cells above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={insertAbove} tooltip={getLocString('DataScience.insertAbove', 'Insert cell above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={switchCell} tooltip={switchTooltip}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={switchImage} />
                        </ImageButton>
                    </Flyout>
                </div>;

            const innerPortion =
                <div className='native-editor-celltoolbar-inner' key={1}>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runCell} hidden={false} tooltip={getLocString('DataScience.runCell', 'Run cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Run} />
                    </ImageButton>
                </div>;

            if (cell.cell.data.cell_type === 'code') {
                return [innerPortion, outerPortion];
            }

            return [outerPortion];
        }

        return null;
    }

    private renderCellToolbar = (cellId: string): JSX.Element[] | null => {
        if (cellId !== Identifiers.EditCellId) {
            return this.renderNormalCellToolbar(cellId);
        } else {
            return this.renderEditCellToolbar();
        }
    }

    private scrollDiv = (div: HTMLDivElement) => {
        if (this.state.newCell) {
            const newCell = this.state.newCell;
            this.stateController.setState({newCell: undefined});
            // Bounce this so state has time to update.
            setTimeout(() => {
                div.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
                this.contentPanelRef.current!.focusCell(newCell, true);
            }, 10);
        }
    }

}
