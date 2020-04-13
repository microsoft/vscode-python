// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as React from 'react';
import { connect } from 'react-redux';
import { Identifiers } from '../../client/datascience/constants';
import { buildSettingsCss } from '../interactive-common/buildSettingsCss';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { handleLinkClick } from '../interactive-common/handlers';
import { KernelSelection } from '../interactive-common/kernelSelection';
import { ICellViewModel } from '../interactive-common/mainState';
import { IMainWithVariables, IStore } from '../interactive-common/redux/store';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { InteractiveCellComponent } from './interactiveCell';
import './interactivePanel.less';
import { actionCreators } from './redux/actions';

export type IInteractivePanelProps = IMainWithVariables & typeof actionCreators;

function mapStateToProps(state: IStore): IMainWithVariables {
    return { ...state.main, variableState: state.variables };
}

export class InteractivePanel extends React.Component<IInteractivePanelProps> {
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private renderCount: number = 0;
    private internalScrollCount: number = 0;

    constructor(props: IInteractivePanelProps) {
        super(props);
    }

    public componentDidMount() {
        document.addEventListener('click', this.linkClick, true);
        this.props.editorLoaded();
    }

    public componentWillUnmount() {
        document.removeEventListener('click', this.linkClick);
        this.props.editorUnmounted();
    }

    public render() {
        const dynamicFont: React.CSSProperties = {
            fontSize: this.props.font.size,
            fontFamily: this.props.font.family
        };

        const progressBar = (this.props.busy || !this.props.loaded) && !this.props.testMode ? <Progress /> : undefined;

        // If in test mode, update our count. Use this to determine how many renders a normal update takes.
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        return (
            <div id="main-panel" ref={this.mainPanelRef} role="Main" style={dynamicFont}>
                <div className="styleSetter">
                    <style>{`${this.props.rootCss ? this.props.rootCss : ''}
${buildSettingsCss(this.props.settings)}`}</style>
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
                <main id="main-panel-content" onScroll={this.handleScroll}>
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
                <section
                    id="main-panel-footer"
                    onClick={this.footerPanelClick}
                    aria-label={getLocString('DataScience.editSection', 'Input new cells here')}
                >
                    {this.renderFooterPanel(this.props.baseTheme)}
                </section>
            </div>
        );
    }

    // Make the entire footer focus our input, instead of having to click directly on the monaco editor
    private footerPanelClick = (_event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        this.props.focusInput();
    };

    // tslint:disable-next-line: max-func-body-length
    private renderToolbarPanel() {
        const variableExplorerTooltip = this.props.variableState.visible
            ? getLocString('DataScience.collapseVariableExplorerTooltip', 'Hide variables active in jupyter kernel')
            : getLocString('DataScience.expandVariableExplorerTooltip', 'Show variables active in jupyter kernel');

        return (
            <div id="toolbar-panel">
                <div className="toolbar-menu-bar">
                    <div className="toolbar-menu-bar-child">
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.deleteAllCells}
                            tooltip={getLocString('DataScience.clearAll', 'Remove all cells')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.Cancel}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.redo}
                            disabled={this.props.redoStack.length === 0}
                            tooltip={getLocString('DataScience.redo', 'Redo')}
                        >
                            <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Redo} />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.undo}
                            disabled={this.props.undoStack.length === 0}
                            tooltip={getLocString('DataScience.undo', 'Undo')}
                        >
                            <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Undo} />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.interruptKernel}
                            disabled={this.props.busy}
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
                            onClick={this.props.restartKernel}
                            disabled={this.props.busy}
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
                            onClick={this.props.toggleVariableExplorer}
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
                            onClick={this.props.export}
                            disabled={this.props.cellVMs.length === 0 || this.props.busy}
                            tooltip={getLocString('DataScience.export', 'Export as Jupyter notebook')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.SaveAs}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.expandAll}
                            disabled={this.props.cellVMs.length === 0}
                            tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.ExpandAll}
                            />
                        </ImageButton>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.collapseAll}
                            disabled={this.props.cellVMs.length === 0}
                            tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.CollapseAll}
                            />
                        </ImageButton>
                    </div>
                    <KernelSelection
                        baseTheme={this.props.baseTheme}
                        font={this.props.font}
                        kernel={this.props.kernel}
                        selectServer={this.props.selectServer}
                        selectKernel={this.props.selectKernel}
                    />
                </div>
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
        return <ContentPanel {...contentProps} ref={this.contentPanelRef} />;
    }

    private renderFooterPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (
            !this.props.monacoReady ||
            !this.props.editCellVM ||
            !this.props.settings ||
            !this.props.editorOptions ||
            !this.props.settings.allowInput
        ) {
            return null;
        }

        const maxOutputSize = this.props.settings.maxOutputSize;
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        const executionCount = this.getInputExecutionCount();
        const editPanelClass = this.props.settings.colorizeInputBox ? 'edit-panel-colorized' : 'edit-panel';

        return (
            <div className={editPanelClass}>
                <ErrorBoundary>
                    <InteractiveCellComponent
                        role="form"
                        editorOptions={this.props.editorOptions}
                        maxTextSize={maxTextSize}
                        autoFocus={document.hasFocus()}
                        testMode={this.props.testMode}
                        cellVM={this.props.editCellVM}
                        baseTheme={baseTheme}
                        codeTheme={this.props.codeTheme}
                        showWatermark={true}
                        editExecutionCount={executionCount.toString()}
                        monacoTheme={this.props.monacoTheme}
                        font={this.props.font}
                        settings={this.props.settings}
                        focusPending={this.props.focusPending}
                    />
                </ErrorBoundary>
            </div>
        );
    }

    private getInputExecutionCount = (): number => {
        return this.props.currentExecutionCount + 1;
    };

    private getContentProps = (baseTheme: string): IContentPanelProps => {
        return {
            baseTheme: baseTheme,
            cellVMs: this.props.cellVMs,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.props.submittedText,
            settings: this.props.settings,
            skipNextScroll: this.props.skipNextScroll ? true : false,
            editable: false,
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

    private renderCell = (
        cellVM: ICellViewModel,
        _index: number,
        containerRef?: React.RefObject<HTMLDivElement>
    ): JSX.Element | null => {
        if (this.props.settings && this.props.editorOptions) {
            return (
                <div key={cellVM.cell.id} id={cellVM.cell.id} ref={containerRef}>
                    <ErrorBoundary>
                        <InteractiveCellComponent
                            role="listitem"
                            editorOptions={this.props.editorOptions}
                            maxTextSize={this.props.settings.maxOutputSize}
                            autoFocus={false}
                            testMode={this.props.testMode}
                            cellVM={cellVM}
                            baseTheme={this.props.baseTheme}
                            codeTheme={this.props.codeTheme}
                            showWatermark={cellVM.cell.id === Identifiers.EditCellId}
                            editExecutionCount={this.getInputExecutionCount().toString()}
                            monacoTheme={this.props.monacoTheme}
                            font={this.props.font}
                            settings={this.props.settings}
                            focusPending={this.props.focusPending}
                        />
                    </ErrorBoundary>
                </div>
            );
        } else {
            return null;
        }
    };

    // This handles the scrolling. Its called from the props of contentPanel.
    // We only scroll when the state indicates we are at the bottom of the interactive window,
    // otherwise it sometimes scrolls when the user wasn't at the bottom.
    private scrollDiv = (div: HTMLDivElement) => {
        if (this.props.isAtBottom) {
            this.internalScrollCount += 1;
            // Force auto here as smooth scrolling can be canceled by updates to the window
            // from elsewhere (and keeping track of these would make this hard to maintain)
            if (div && div.scrollIntoView) {
                div.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            }
        }
    };

    private handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (this.internalScrollCount > 0) {
            this.internalScrollCount -= 1;
        } else if (this.contentPanelRef.current) {
            const isAtBottom = this.contentPanelRef.current.computeIsAtBottom(e.currentTarget);
            this.props.scroll(isAtBottom);
        }
    };

    private linkClick = (ev: MouseEvent) => {
        handleLinkClick(ev, this.props.linkClick);
    };
}

// Main export, return a redux connected editor
export function getConnectedInteractiveEditor() {
    return connect(mapStateToProps, actionCreators)(InteractivePanel);
}
