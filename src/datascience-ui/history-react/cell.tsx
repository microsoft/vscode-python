// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';
import './cell.css';

import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import ansiToHtml from 'ansi-to-html';
import * as React from 'react';
// tslint:disable-next-line:match-default-export-name import-name
import JSONTree from 'react-json-tree';

import { concatMultilineString, formatStreamText } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { CellState, ICell } from '../../client/datascience/types';
import { noop } from '../../test/core';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { CellButton } from './cellButton';
import { Code } from './code';
import { CollapseButton } from './collapseButton';
import { CommandPrompt } from './commandPrompt';
import { ExecutionCount } from './executionCount';
import { Image, ImageName } from './image';
import { InputHistory } from './inputHistory';
import { MenuBar } from './menuBar';
import { SysInfo } from './sysInfo';
import { displayOrder, richestMimetype, transforms } from './transforms';

interface ICellProps {
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    history: InputHistory | undefined;
    showWatermark: boolean;
    gotoCode(): void;
    delete(): void;
    submitNewCode(code: string): void;
}

export interface ICellViewModel {
    cell: ICell;
    inputBlockShow: boolean;
    inputBlockOpen: boolean;
    inputBlockText: string;
    inputBlockCollapseNeeded: boolean;
    editable: boolean;
    directInput?: boolean;
    inputBlockToggled(id: string): void;
}

export class Cell extends React.Component<ICellProps> {
    private code: Code | undefined;

    constructor(prop: ICellProps) {
        super(prop);
        this.state = {focused: this.props.autoFocus};
    }

    public render() {
        if (this.props.cellVM.cell.data.cell_type === 'sys_info') {
            return <SysInfo theme={this.props.baseTheme} connection={this.props.cellVM.cell.data.connection} path={this.props.cellVM.cell.data.path} message={this.props.cellVM.cell.data.message} version={this.props.cellVM.cell.data.version} notebook_version={this.props.cellVM.cell.data.notebook_version}/>;
        } else {
            return this.renderNormalCell();
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

    private getDeleteString = () => {
        return getLocString('DataScience.deleteButtonTooltip', 'Remove Cell');
    }

    private getGoToCodeString = () => {
        return getLocString('DataScience.gotoCodeButtonTooltip', 'Go to code');
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
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
        const hasNoSource = this.props.cellVM.cell.file === Identifiers.EmptyFileName;
        const results: JSX.Element[] = this.renderResults();
        const allowsPlainInput = getSettings().showCellInputCode || this.props.cellVM.directInput || this.props.cellVM.editable;
        const shouldRender = allowsPlainInput || (results && results.length > 0);
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';

        // Only render if we are allowed to.
        if (shouldRender) {
            return (
                <div className='cell-wrapper' role='row' onClick={this.onMouseClick}>
                    <MenuBar baseTheme={this.props.baseTheme}>
                        <CellButton baseTheme={this.props.baseTheme} onClick={this.props.delete} tooltip={this.getDeleteString()} hidden={this.props.cellVM.editable}>
                            <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Cancel} />
                        </CellButton>
                        <CellButton baseTheme={this.props.baseTheme} onClick={this.props.gotoCode} tooltip={this.getGoToCodeString()} hidden={hasNoSource}>
                            <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.GoToSourceCode} />
                        </CellButton>
                    </MenuBar>
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
        // When we receive a click, tell the code element.
        if (this.code) {
            this.code.onParentClick(ev);
        }
    }

    private showInputs = () : boolean => {
        return (this.isCodeCell() && (this.props.cellVM.inputBlockShow || this.props.cellVM.editable));
    }

    private getRenderableInputCode = () : string => {
        if (this.props.cellVM.editable) {
            return '';
        }

        return this.props.cellVM.inputBlockText;
    }

    private renderControls = () => {
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const collapseVisible = (this.props.cellVM.inputBlockCollapseNeeded && this.props.cellVM.inputBlockShow && !this.props.cellVM.editable);
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '0';

        // Only code cells have controls. Markdown should be empty
        if (this.isCodeCell()) {

            return this.props.cellVM.editable ?
                (
                    <div className='controls-div'>
                        <CommandPrompt />
                    </div>
                ) : (
                    <div className='controls-div'>
                        <ExecutionCount isBusy={busy} count={executionCount} visible={this.isCodeCell()} />
                        <CollapseButton theme={this.props.baseTheme}
                            visible={collapseVisible}
                            open={this.props.cellVM.inputBlockOpen}
                            onClick={this.toggleInputBlock}
                            tooltip={getLocString('DataScience.collapseInputTooltip', 'Collapse input block')} />
                    </div>
                );
        } else {
            return null;
        }
    }

    private updateCodeRef = (ref: Code) => {
        this.code = ref;
    }

    private renderInputs = () => {
        if (this.showInputs()) {
            return (
                <div className='cell-input'>
                    <Code
                        cursorType={this.getCursorType()}
                        history={this.props.history}
                        autoFocus={this.props.autoFocus}
                        code={this.getRenderableInputCode()}
                        codeTheme={this.props.codeTheme}
                        testMode={this.props.testMode ? true : false}
                        readOnly={!this.props.cellVM.editable}
                        showWatermark={this.props.showWatermark}
                        onSubmit={this.props.submitNewCode}
                        onChangeLineCount={this.onChangeLineCount}
                        ref={this.updateCodeRef}
                        />
                </div>
            );
        } else {
            return null;
        }
    }

    private getCursorType = () : string => {
        if (getSettings && getSettings().extraSettings) {
            return getSettings().extraSettings.terminalCursor;
        }

        return 'block';
    }

    private renderResultsDiv = (results: JSX.Element[]) => {

        // Only render results if the user can't edit. For now. Might allow editing of code later?
        if (!this.props.cellVM.editable) {
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
        return this.isCodeCell() ?
            this.renderCodeOutputs() :
            this.renderMarkdown(this.getMarkdownCell());
    }

    private renderCodeOutputs = () => {
        if (this.isCodeCell() && this.hasOutput()) {
            // Render the outputs
            return this.getCodeCell().outputs.map((output: nbformat.IOutput, index: number) => {
                return this.renderOutput(output, index);
            });
        }

        return [];
    }

    private renderMarkdown = (markdown : nbformat.IMarkdownCell) => {
        // React-markdown expects that the source is a string
        const source = concatMultilineString(markdown.source);
        const Transform = transforms['text/markdown'];

        return [<Transform data={source}/>];
    }

    private renderWithTransform = (mimetype: string, output : nbformat.IOutput, index : number, renderWithScrollbars: boolean) => {

        // If we found a mimetype, use the transform
        if (mimetype) {

            // Get the matching React.Component for that mimetype
            const Transform = transforms[mimetype];

            if (typeof mimetype !== 'string') {
                return <div key={index}>{this.getUnknownMimeTypeFormatString().format(mimetype)}</div>;
            }

            try {
                // Text/plain has to be massaged. It expects a continuous string
                if (output.data) {
                    const mimeBundle = output.data as nbformat.IMimeBundle;
                    let data: nbformat.MultilineString | JSONObject = mimeBundle[mimetype];
                    if (mimetype === 'text/plain') {
                        data = concatMultilineString(data as nbformat.MultilineString);
                        renderWithScrollbars = true;
                    }

                    // Create a scrollbar style if necessary
                    if (renderWithScrollbars && this.props.maxTextSize) {
                        const style: React.CSSProperties = {
                            maxHeight : `${this.props.maxTextSize}px`,
                            overflowY : 'auto',
                            overflowX : 'auto'
                        };

                        return <div id='stylewrapper' key={index} style={style}><Transform data={data} /></div>;
                    } else {
                        return <Transform key={index} data={data} />;
                    }

                }
            } catch (ex) {
                window.console.log('Error in rendering');
                window.console.log(ex);
                return <div></div>;
            }
        }

        return <div></div>;
    }

    private renderOutput = (output : nbformat.IOutput, index: number) => {
        // Borrowed this from Don's Jupyter extension

        // First make sure we have the mime data
        if (!output) {
          return <div key={index}/>;
        }

        // Make a copy of our data so we don't modify our cell
        const copy = {...output};

        // Special case for json
        if (copy.data && copy.data.hasOwnProperty('application/json')) {
          return <JSONTree key={index} data={copy.data} />;
        }

        // Only for text and error ouptut do we add scrollbars
        let addScrollbars = false;

        // Stream and error output need to be converted
        if (copy.output_type === 'stream') {
            addScrollbars = true;
            // Stream output needs to be wrapped in xmp so it
            // show literally. Otherwise < chars start a new html element.
            const stream = copy as nbformat.IStream;
            const multiline = concatMultilineString(stream.text);
            const formatted = formatStreamText(multiline);
            copy.data = {
                'text/html' : `<xmp>${formatted}</xmp>`
            };

            // Output may have goofy ascii colorization chars in it. Try
            // colorizing if we don't have html that needs <xmp> around it (ex. <type ='string'>)
            try {
                if (!formatted.includes('<')) {
                    const converter = new ansiToHtml();
                    const html = converter.toHtml(formatted);
                    copy.data = {
                        'text/html': html
                    };
                }
            } catch {
                noop();
            }

        } else if (copy.output_type === 'error') {
            addScrollbars = true;
            const error = copy as nbformat.IError;
            try {
                const converter = new ansiToHtml();
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
        }

        // Jupyter style MIME bundle

        // Find out which mimetype is the richest
        let mimetype: string = richestMimetype(copy.data, displayOrder, transforms);

        // If that worked, use the transform
        if (mimetype) {
            return this.renderWithTransform(mimetype, copy, index, addScrollbars);
        }

        if (copy.data) {
            const keys = Object.keys(copy.data);
            mimetype = keys.length > 0 ? keys[0] : 'unknown';
        } else {
            mimetype = 'unknown';
        }
        const str : string = this.getUnknownMimeTypeFormatString().format(mimetype);
        return <div key={index}>{str}</div>;
    }

    private onChangeLineCount = (lineCount: number) => {
        // Ignored for now. Might use this to update the . next to the code lines
    }
}
