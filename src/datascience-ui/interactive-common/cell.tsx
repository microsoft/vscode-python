// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import ansiRegex from 'ansi-regex';
import ansiToHtml from 'ansi-to-html';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import '../../client/common/extensions';
import { concatMultilineString } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { CellState, ICell } from '../../client/datascience/types';
import { noop } from '../../test/core';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { Code } from './code';
import { CollapseButton } from './collapseButton';
import { ExecutionCount } from './executionCount';
import { InformationMessages } from './informationMessages';
import { InputHistory } from './inputHistory';
import { displayOrder, richestMimetype, transforms } from './transforms';

// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { IKeyboardEvent } from '../react-common/event';
import { Markdown } from './markdown';

interface ICellProps {
    role?: string;
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    history: InputHistory | undefined;
    showWatermark: boolean;
    monacoTheme: string | undefined;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    editExecutionCount: string;
    editorMeasureClassName?: string;
    allowCollapse: boolean;
    selectedCell?: string;
    focusedCell?: string;
    allowsMarkdownEditing?: boolean;
    hideOutput?: boolean;
    showLineNumbers?: boolean;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
    expandImage(imageHtml: string): void;
    keyDown?(cellId: string, e: IKeyboardEvent): void;
    onClick?(cellId: string): void;
    onDoubleClick?(cellId: string): void;
    focused?(cellId: string): void;
    unfocused?(cellId: string): void;
    renderCellToolbar(cellId: string): JSX.Element[] | null;
}

export interface ICellViewModel {
    cell: ICell;
    inputBlockShow: boolean;
    inputBlockOpen: boolean;
    inputBlockText: string;
    inputBlockCollapseNeeded: boolean;
    editable: boolean;
    directInput?: boolean;
    showLineNumbers?: boolean;
    hideOutput?: boolean;
    useQuickEdit?: boolean;
    inputBlockToggled(id: string): void;
}

interface ICellState {
    showingMarkdownEditor: boolean;
}

interface ICellOutput {
    mimeType: string;
    data: nbformat.MultilineString | JSONObject;
    renderWithScrollbars: boolean;
    isText: boolean;
    isError: boolean;
    extraButton: JSX.Element | null; // Extra button for plot viewing is stored here
    doubleClick(): void; // Double click handler for plot viewing is stored here
}
// tslint:disable: react-this-binding-issue
export class Cell extends React.Component<ICellProps, ICellState> {
    private codeRef: React.RefObject<Code> = React.createRef<Code>();
    private markdownRef: React.RefObject<Markdown> = React.createRef<Markdown>();
    private cellWrapperRef : React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(prop: ICellProps) {
        super(prop);
        this.state = { showingMarkdownEditor: false };
    }

    private static getAnsiToHtmlOptions() : { fg: string; bg: string; colors: string [] } {
        // Here's the default colors for ansiToHtml. We need to use the
        // colors from our current theme.
        // const colors = {
        //     0: '#000',
        //     1: '#A00',
        //     2: '#0A0',
        //     3: '#A50',
        //     4: '#00A',
        //     5: '#A0A',
        //     6: '#0AA',
        //     7: '#AAA',
        //     8: '#555',
        //     9: '#F55',
        //     10: '#5F5',
        //     11: '#FF5',
        //     12: '#55F',
        //     13: '#F5F',
        //     14: '#5FF',
        //     15: '#FFF'
        // };
        return {
            fg: 'var(--vscode-terminal-foreground)',
            bg: 'var(--vscode-terminal-background)',
            colors: [
                'var(--vscode-terminal-ansiBlack)',         // 0
                'var(--vscode-terminal-ansiBrightRed)',     // 1
                'var(--vscode-terminal-ansiGreen)',         // 2
                'var(--vscode-terminal-ansiYellow)',        // 3
                'var(--vscode-terminal-ansiBrightBlue)',    // 4
                'var(--vscode-terminal-ansiMagenta)',       // 5
                'var(--vscode-terminal-ansiCyan)',          // 6
                'var(--vscode-terminal-ansiBrightBlack)',   // 7
                'var(--vscode-terminal-ansiWhite)',         // 8
                'var(--vscode-terminal-ansiRed)',           // 9
                'var(--vscode-terminal-ansiBrightGreen)',   // 10
                'var(--vscode-terminal-ansiBrightYellow)',  // 11
                'var(--vscode-terminal-ansiBlue)',          // 12
                'var(--vscode-terminal-ansiBrightMagenta)', // 13
                'var(--vscode-terminal-ansiBrightCyan)',    // 14
                'var(--vscode-terminal-ansiBrightWhite)'    // 15
            ]
        };
    }
    public render() {
        if (this.props.cellVM.cell.data.cell_type === 'messages') {
            return <InformationMessages messages={this.props.cellVM.cell.data.messages} type={this.props.cellVM.cell.type}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    public componentDidUpdate(prevProps: ICellProps) {
        if (this.props.selectedCell === this.props.cellVM.cell.id && prevProps.selectedCell !== this.props.selectedCell) {
            this.giveFocus(this.props.focusedCell === this.props.cellVM.cell.id);
        }
    }

    public giveFocus(giveCodeFocus: boolean) {
        // Start out with ourselves
        if (this.cellWrapperRef && this.cellWrapperRef.current) {
            this.cellWrapperRef.current.focus();
        }
        // Then attempt to move into the object
        if (giveCodeFocus) {
            // This depends upon what type of cell we are.
            if (this.props.cellVM.cell.data.cell_type === 'code') {
                if (this.codeRef.current) {
                    this.codeRef.current.giveFocus();
                }
            } else if (this.props.allowsMarkdownEditing) {
                if (this.markdownRef.current) {
                    this.markdownRef.current.giveFocus();
                }
                this.setState({showingMarkdownEditor: true});
            }
        }
    }

    // Public for testing
    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }

    private toggleInputBlock = () => {
        const cellId: string = this.getCell().id;
        this.props.cellVM.inputBlockToggled(cellId);
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    }

    private isMarkdownCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'markdown';
    }

    private hasOutput = () => {
        return this.getCell().state === CellState.finished || this.getCell().state === CellState.error || this.getCell().state === CellState.executing;
    }

    private getCodeCell = () => {
        return this.props.cellVM.cell.data as nbformat.ICodeCell;
    }

    private getMarkdownCell = () => {
        return this.props.cellVM.cell.data as nbformat.IMarkdownCell;
    }

    private renderNormalCell() {
        const results: JSX.Element[] = this.renderResults();
        const allowsPlainInput = getSettings().showCellInputCode || this.props.cellVM.directInput || this.props.cellVM.editable;
        const shouldRender = allowsPlainInput || (results && results.length > 0);
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';
        let cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        if (this.props.selectedCell === this.props.cellVM.cell.id && this.props.focusedCell !== this.props.cellVM.cell.id) {
            cellWrapperClass += ' cell-wrapper-selected';
        }
        if (this.props.focusedCell === this.props.cellVM.cell.id) {
            cellWrapperClass += ' cell-wrapper-focused';
        }

        // Only render if we are allowed to.
        if (shouldRender) {
            return (
                <div className={cellWrapperClass} role={this.props.role} ref={this.cellWrapperRef} tabIndex={0} onKeyDown={this.onCellKeyDown} onClick={this.onMouseClick} onDoubleClick={this.onMouseDoubleClick}>
                    <div className={cellOuterClass}>
                        {this.renderControls()}
                        <div className='content-div'>
                            <div className='cell-result-container'>
                                {this.renderInputs()}
                                {this.renderResultsDiv(results)}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Shouldn't be rendered because not allowing empty input and not a direct input cell
        return null;
    }

    private onMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive a click, propagate upwards. Might change our state
        if (this.props.onClick) {
            ev.stopPropagation();
            this.props.onClick(this.props.cellVM.cell.id);
        }
    }

    private onMouseDoubleClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive double click, propagate upwards. Might change our state
        if (this.props.onDoubleClick) {
            ev.stopPropagation();
            this.props.onDoubleClick(this.props.cellVM.cell.id);
        }
    }

    private shouldRenderCodeEditor = () : boolean => {
        return (this.isCodeCell() && (this.props.cellVM.inputBlockShow || this.props.cellVM.editable));
    }

    private shouldRenderMarkdownEditor = () : boolean => {
        return (this.isMarkdownCell() && (this.state.showingMarkdownEditor || this.props.cellVM.cell.id === Identifiers.EditCellId));
    }

    private getRenderableInputCode = () : string => {
        return this.props.cellVM.inputBlockText;
    }

    private renderControls = () => {
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const collapseVisible = (this.props.allowCollapse && this.props.cellVM.inputBlockCollapseNeeded && this.props.cellVM.inputBlockShow && !this.props.cellVM.editable && this.isCodeCell());
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '-';
        const isEditOnlyCell = this.props.cellVM.cell.id === Identifiers.EditCellId;

        return (
            <div className='controls-div'>
                <ExecutionCount isBusy={busy} count={isEditOnlyCell ? this.props.editExecutionCount : executionCount} visible={this.isCodeCell()} />
                <CollapseButton theme={this.props.baseTheme}
                    visible={collapseVisible}
                    open={this.props.cellVM.inputBlockOpen}
                    onClick={this.toggleInputBlock}
                    tooltip={getLocString('DataScience.collapseInputTooltip', 'Collapse input block')} />
                {this.props.renderCellToolbar(this.props.cellVM.cell.id)}
            </div>
        );
    }

    private renderInputs = () => {
        if (this.isCodeCell()) {
            return this.renderCodeInputs();
        } else {
            return this.renderMarkdownInputs();
        }
    }

    private renderCodeInputs = () => {
        if (this.shouldRenderCodeEditor()) {
            return (
                <div className='cell-input'>
                    <Code
                        editorOptions={this.props.editorOptions}
                        history={this.props.history}
                        autoFocus={this.props.autoFocus}
                        code={this.getRenderableInputCode()}
                        codeTheme={this.props.codeTheme}
                        testMode={this.props.testMode ? true : false}
                        readOnly={!this.props.cellVM.editable}
                        showWatermark={this.props.showWatermark}
                        ref={this.codeRef}
                        onChange={this.onCodeChange}
                        onCreated={this.onCodeCreated}
                        outermostParentClass='cell-wrapper'
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        editorMeasureClassName={this.props.editorMeasureClassName}
                        focused={this.onCodeFocused}
                        unfocused={this.onCodeUnfocused}
                        keyDown={this.onKeyDown}
                        showLineNumbers={this.props.showLineNumbers}
                        useQuickEdit={this.props.cellVM.useQuickEdit}
                        />
                </div>
            );
        }

        return null;
    }

    private renderMarkdownInputs = () => {
        if (this.shouldRenderMarkdownEditor()) {
            const source = concatMultilineString(this.getMarkdownCell().source);
            return (
                <div className='cell-input'>
                    <Markdown
                        editorOptions={this.props.editorOptions}
                        autoFocus={true}
                        markdown={source}
                        codeTheme={this.props.codeTheme}
                        testMode={this.props.testMode ? true : false}
                        onChange={this.onCodeChange}
                        onCreated={this.onCodeCreated}
                        outermostParentClass='cell-wrapper'
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        editorMeasureClassName={this.props.editorMeasureClassName}
                        focused={this.onMarkdownFocused}
                        unfocused={this.onMarkdownUnfocused}
                        keyDown={this.onKeyDown}
                        ref={this.markdownRef}
                        useQuickEdit={this.props.cellVM.useQuickEdit}
                        />
                </div>
            );
        }

        return null;
    }

    private onKeyDown = (e: IKeyboardEvent) => {
        if (this.props.keyDown) {
            this.props.keyDown(this.props.cellVM.cell.id, e);
        }
    }

    private onCodeFocused = () => {
        if (this.props.focused) {
            this.props.focused(this.props.cellVM.cell.id);
        }
    }

    private onCodeUnfocused = () => {
        if (this.props.unfocused) {
            this.props.unfocused(this.props.cellVM.cell.id);
        }
    }

    private onMarkdownFocused = () => {
        if (this.props.focused) {
            this.props.focused(this.props.cellVM.cell.id);
        }
    }

    private onMarkdownUnfocused = () => {
        if (this.props.unfocused) {
            this.props.unfocused(this.props.cellVM.cell.id);
        }

        // Indicate not showing the editor anymore. The equivalent of this
        // is not when we receive focus but when we GIVE focus to the markdown editor
        // otherwise we wouldn't be able to display it.
        this.setState({showingMarkdownEditor: false});
    }

    private onCodeChange = (changes: monacoEditor.editor.IModelContentChange[], modelId: string) => {
        this.props.onCodeChange(changes, this.props.cellVM.cell.id, modelId);
    }

    private onCodeCreated = (code: string, modelId: string) => {
        this.props.onCodeCreated(code, this.props.cellVM.cell.file, this.props.cellVM.cell.id, modelId);
    }

    private renderResultsDiv = (results: JSX.Element[]) => {

        // Only render results if not an edit cell
        if (this.props.cellVM.cell.id !== Identifiers.EditCellId) {
            const outputClassNames = this.isCodeCell() ?
                `cell-output cell-output-${this.props.baseTheme}` :
                '';

            // Then combine them inside a div
            return <div className={outputClassNames}>{results}</div>;
        }
        return null;
    }

    private renderResults = (): JSX.Element[] => {
        // Results depend upon the type of cell
        if (this.isCodeCell()) {
            return this.renderCodeOutputs();
        } else if (!this.state.showingMarkdownEditor && this.props.cellVM.cell.id !== Identifiers.EditCellId) {
            return this.renderMarkdownOutputs();
        } else {
            return [];
        }
    }

    private renderCodeOutputs = () => {
        if (this.isCodeCell() && this.hasOutput() && this.getCodeCell().outputs && !this.props.hideOutput) {
            // Render the outputs
            return this.renderOutputs(this.getCodeCell().outputs);
        }

        return [];
    }

    private renderMarkdownOutputs = () => {
        const markdown = this.getMarkdownCell();
        // React-markdown expects that the source is a string
        const source = concatMultilineString(markdown.source);
        const Transform = transforms['text/markdown'];

        return [<Transform key={0} data={source} />];
    }

    // tslint:disable-next-line: max-func-body-length
    private transformOutput(output: nbformat.IOutput): ICellOutput {
        // First make a copy of the outputs.
        const copy = cloneDeep(output);

        let isText = false;
        let isError = false;
        let mimeType = 'text/plain';
        let renderWithScrollbars = false;
        let extraButton: JSX.Element | null = null;

        // Special case for json. Just turn into a string
        if (copy.data && copy.data.hasOwnProperty('application/json')) {
            copy.data = JSON.stringify(copy.data);
            renderWithScrollbars = true;
            isText = true;
        } else if (copy.output_type === 'stream') {
            // Stream output needs to be wrapped in xmp so it
            // show literally. Otherwise < chars start a new html element.
            mimeType = 'text/html';
            isText = true;
            isError = false;
            renderWithScrollbars = true;
            const stream = copy as nbformat.IStream;
            const formatted = concatMultilineString(stream.text);
            copy.data = {
                'text/html': formatted.includes('<') ? `<xmp>${formatted}</xmp>` : `<div>${formatted}</div>`
            };

            // Output may have goofy ascii colorization chars in it. Try
            // colorizing if we don't have html that needs <xmp> around it (ex. <type ='string'>)
            try {
                if (ansiRegex().test(formatted)) {
                    const converter = new ansiToHtml(Cell.getAnsiToHtmlOptions());
                    const html = converter.toHtml(formatted);
                    copy.data = {
                        'text/html': html
                    };
                }
            } catch {
                noop();
            }
        } else if (copy.output_type === 'error') {
            mimeType = 'text/html';
            isText = true;
            isError = true;
            renderWithScrollbars = true;
            const error = copy as nbformat.IError;
            try {
                const converter = new ansiToHtml(Cell.getAnsiToHtmlOptions());
                const trace = converter.toHtml(error.traceback.join('\n'));
                copy.data = {
                    'text/html': trace
                };
            } catch {
                // This can fail during unit tests, just use the raw data
                copy.data = {
                    'text/html': error.evalue
                };
            }
        } else if (copy.data) {
            // Compute the mime type
            mimeType = richestMimetype(copy.data, displayOrder, transforms);
        }

        // Then parse the mime type
        try {
            const mimeBundle = copy.data as nbformat.IMimeBundle;
            let data: nbformat.MultilineString | JSONObject = mimeBundle[mimeType];

            switch (mimeType) {
                case 'text/plain':
                    return {
                        mimeType,
                        data: concatMultilineString(data as nbformat.MultilineString),
                        isText,
                        isError,
                        renderWithScrollbars,
                        extraButton,
                        doubleClick: noop
                    };

                case 'image/svg+xml':
                case 'image/png':
                    // There should be two mime bundles. Well if enablePlotViewer is turned on. See if we have both
                    const svg = mimeBundle['image/svg+xml'];
                    const png = mimeBundle['image/png'];
                    let doubleClick: () => void = noop;
                    if (svg && png) {
                        // Save the svg in the extra button.
                        const openClick = () => {
                            this.props.expandImage(svg.toString());
                        };
                        extraButton = (
                            <div className='plot-open-button'>
                                <ImageButton baseTheme={this.props.baseTheme} tooltip={getLocString('DataScience.plotOpen', 'Expand image')} onClick={openClick}>
                                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.OpenInNewWindow} />
                                </ImageButton>
                            </div>
                        );

                        // Switch the data to the png
                        data = png;
                        mimeType = 'image/png';

                        // Switch double click to do the same thing as the extra button
                        doubleClick = openClick;
                    }

                    // return the image
                    return {
                        mimeType,
                        data,
                        isText,
                        isError,
                        renderWithScrollbars,
                        extraButton,
                        doubleClick
                    };

                default:
                    return {
                        mimeType,
                        data,
                        isText,
                        isError,
                        renderWithScrollbars,
                        extraButton,
                        doubleClick: noop
                    };
            }
        } catch (e) {
            return {
                data: e.toString(),
                isText: true,
                isError: false,
                extraButton: null,
                renderWithScrollbars: false,
                mimeType: 'text/plain',
                doubleClick: noop
            };
        }
    }

    private click = (event: React.MouseEvent<HTMLDivElement>) => {
        // If this is an anchor element, forward the click as Jupyter does.
        let anchor = event.target as HTMLAnchorElement;
        if (anchor && anchor.href) {
            // Href may be redirected to an inner anchor
            if (anchor.href.startsWith('vscode')) {
                const inner = anchor.getElementsByTagName('a');
                if (inner && inner.length > 0) {
                    anchor = inner[0];
                }
            }
            if (anchor && anchor.href && !anchor.href.startsWith('vscode')) {
                this.props.openLink(monacoEditor.Uri.parse(anchor.href));
            }
        }
    }

    private onCellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Handle keydown events for the entire cell
        if (this.props.keyDown && event.key !== 'Tab') {
            this.props.keyDown(
                this.props.cellVM.cell.id,
                {
                    code: event.key,
                    shiftKey: event.shiftKey,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                    altKey: event.altKey,
                    target: event.target as HTMLDivElement,
                    stopPropagation: () => event.stopPropagation(),
                    preventDefault: () => event.preventDefault()
                });
        }
    }

    // tslint:disable-next-line: max-func-body-length
    private renderOutputs(outputs: nbformat.IOutput[]): JSX.Element[] {
        return outputs.map(this.renderOutput);
    }

    private renderOutput = (output: nbformat.IOutput, index: number): JSX.Element => {
        const transformed = this.transformOutput(output);
        let mimetype = transformed.mimeType;

        // If that worked, use the transform
        if (mimetype) {
            // Get the matching React.Component for that mimetype
            const Transform = transforms[mimetype];

            // Create a default set of properties
            const style: React.CSSProperties = {
            };

            // Create a scrollbar style if necessary
            if (transformed.renderWithScrollbars && this.props.maxTextSize) {
                style.overflowX = 'auto';
                style.overflowY = 'auto';
                style.maxHeight = `${this.props.maxTextSize}px`;
            }

            let className = transformed.isText ? 'cell-output-text' : 'cell-output-html';
            className = transformed.isError ? `${className} cell-output-error` : className;

            return (
                <div role='group' key={index} onDoubleClick={transformed.doubleClick} onClick={this.click} className={className} style={style}>
                    {transformed.extraButton}
                    <Transform data={transformed.data} />
                </div>
            );
        }

        if (output.data) {
            const keys = Object.keys(output.data);
            mimetype = keys.length > 0 ? keys[0] : 'unknown';
        } else {
            mimetype = 'unknown';
        }
        const str: string = this.getUnknownMimeTypeFormatString().format(mimetype);
        return <div key={index}>{str}</div>;
    }
}
