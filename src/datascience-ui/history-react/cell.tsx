// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import ansiToHtml from 'ansi-to-html';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
// tslint:disable-next-line:match-default-export-name import-name
import JSONTree from 'react-json-tree';

import '../../client/common/extensions';
import { concatMultilineString, formatStreamText } from '../../client/datascience/common';
import { Identifiers, RegExpValues } from '../../client/datascience/constants';
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
import { MenuBar } from './menuBar';
import { displayOrder, richestMimetype, transforms } from './transforms';

import './cell.css';

interface ICellProps {
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    history: InputHistory | undefined;
    showWatermark: boolean;
    errorBackgroundColor: string;
    monacoTheme: string | undefined;
    editorOptions: monacoEditor.editor.IEditorOptions;
    editExecutionCount: number;
    gotoCode(): void;
    delete(): void;
    submitNewCode(code: string): void;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
    expandImage(imageHtml: string): void;
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
        if (this.props.cellVM.cell.data.cell_type === 'messages') {
            return <InformationMessages messages={this.props.cellVM.cell.data.messages} type={this.props.cellVM.cell.type}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    public giveFocus() {
        if (this.code) {
            this.code.giveFocus();
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
        let cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        if (this.props.cellVM.cell.type === 'preview') {
            cellWrapperClass += ' cell-wrapper-preview';
        }

        // Only render if we are allowed to.
        if (shouldRender) {
            return (
                <div className={cellWrapperClass} role='row' onClick={this.onMouseClick}>
                    <MenuBar baseTheme={this.props.baseTheme}>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.delete} tooltip={this.getDeleteString()} hidden={this.props.cellVM.editable}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Cancel} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.gotoCode} tooltip={this.getGoToCodeString()} hidden={hasNoSource}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.GoToSourceCode} />
                        </ImageButton>
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
            this.props.cellVM.cell.data.execution_count.toString() : '-';

        // Only code cells have controls. Markdown should be empty
        if (this.isCodeCell()) {

            return this.props.cellVM.editable ?
                (
                    <div className='controls-div'>
                        <ExecutionCount isBusy={busy} count={this.props.editExecutionCount.toString()} visible={this.isCodeCell()} />
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
            const backgroundColor = this.props.cellVM.cell.type === 'preview' ?
                'var(--override-peek-background, var(--vscode-peekViewEditor-background))'
                : undefined;

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
                        onSubmit={this.props.submitNewCode}
                        ref={this.updateCodeRef}
                        onChange={this.onCodeChange}
                        onCreated={this.onCodeCreated}
                        outermostParentClass='cell-wrapper'
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        forceBackgroundColor={backgroundColor}
                        />
                </div>
            );
        } else {
            return null;
        }
    }

    private onCodeChange = (changes: monacoEditor.editor.IModelContentChange[], modelId: string) => {
        this.props.onCodeChange(changes, this.props.cellVM.cell.id, modelId);
    }

    private onCodeCreated = (code: string, modelId: string) => {
        this.props.onCodeCreated(code, this.props.cellVM.cell.file, this.props.cellVM.cell.id, modelId);
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

        return [<Transform key={0} data={source}/>];
    }

    private renderWithTransform = (mimetype: string, output : nbformat.IOutput, index : number, renderWithScrollbars: boolean, forceLightTheme: boolean, isText: boolean) => {

        // If we found a mimetype, use the transform
        if (mimetype) {

            // Get the matching React.Component for that mimetype
            const Transform = transforms[mimetype];

            if (typeof mimetype !== 'string') {
                return <div key={index}>{this.getUnknownMimeTypeFormatString().format(mimetype)}</div>;
            }

            try {
                // Massage our data to make sure it displays well
                if (output.data) {
                    let extraButton = null;
                    const mimeBundle = output.data as nbformat.IMimeBundle;
                    let data: nbformat.MultilineString | JSONObject = mimeBundle[mimetype];
                    switch (mimetype) {
                        case 'text/plain':
                            // Data needs to be contiguous for us to display it.
                            data = concatMultilineString(data as nbformat.MultilineString);
                            renderWithScrollbars = true;
                            isText = true;
                            break;

                        case 'image/svg+xml':
                            // Jupyter adds a universal selector style that messes
                            // up all of our other styles. Remove it.
                            const html = concatMultilineString(data as nbformat.MultilineString);
                            data = html.replace(RegExpValues.StyleTagRegex, '');

                            // Also change the width to 100% so it scales correctly. We need to save the
                            // width/height for the plot window though
                            let sizeTag = '';
                            const widthMatch = RegExpValues.SvgWidthRegex.exec(data);
                            const heightMatch = RegExpValues.SvgHeightRegex.exec(data);
                            if (widthMatch && heightMatch && widthMatch.length > 2 && heightMatch.length > 2) {
                                // SvgHeightRegex and SvgWidthRegex match both the <svg.* and the width entry, so
                                // pick the second group
                                const width = widthMatch[2];
                                const height = heightMatch[2];
                                sizeTag = Identifiers.SvgSizeTag.format(width, height);
                            }
                            data = data.replace(RegExpValues.SvgWidthRegex, `$1100%" tag="${sizeTag}"`);

                            // Also add an extra button to open this image.
                            // Note: This affects the plotOpenClick. We have to skip the svg on this extraButton there
                            extraButton = (
                                <div className='plot-open-button'>
                                    <ImageButton baseTheme={this.props.baseTheme} tooltip={getLocString('DataScience.plotOpen', 'Expand image')} onClick={this.plotOpenClick}>
                                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.OpenInNewWindow} />
                                    </ImageButton>
                                </div>
                            );
                            break;

                        default:
                            break;
                    }

                    // Create a default set of properties
                    const style: React.CSSProperties = {
                    };

                    // Create a scrollbar style if necessary
                    if (renderWithScrollbars && this.props.maxTextSize) {
                        style.overflowX = 'auto';
                        style.overflowY = 'auto';
                        style.maxHeight = `${this.props.maxTextSize}px`;
                    }

                    // Change the background if necessary
                    if (forceLightTheme) {
                        style.backgroundColor = this.props.errorBackgroundColor;
                        style.color = this.invertColor(this.props.errorBackgroundColor);
                    }

                    const className = isText ? 'cell-output-text' : 'cell-output-html';

                    return (
                        <div id='stylewrapper' role='group' onDoubleClick={this.doubleClick} onClick={this.click} className={className} key={index} style={style}>
                            {extraButton}
                            <Transform data={data} />
                        </div>
                    );
                }
            } catch (ex) {
                window.console.log('Error in rendering');
                window.console.log(ex);
                return <div></div>;
            }
        }

        return <div></div>;
    }

    private doubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // Extract the svg image from whatever was clicked
        // tslint:disable-next-line: no-any
        const svgChild = event.target as any;
        if (svgChild && svgChild.ownerSVGElement) {
            const svg = svgChild.ownerSVGElement as SVGElement;
            this.props.expandImage(svg.outerHTML);
        }
    }

    private plotOpenClick = (event?: React.MouseEvent<HTMLButtonElement>) => {
        const divChild = event && event.currentTarget;
        if (divChild && divChild.parentElement && divChild.parentElement.parentElement) {
            const svgs = divChild.parentElement.parentElement.getElementsByTagName('svg');
            if (svgs && svgs.length > 1) { // First svg should be the button itself. See the code above where we bind to this function.
                this.props.expandImage(svgs[1].outerHTML);
            }
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

    private convertToLinearRgb(color: number) : number {
        let c = color / 255;
        if (c <= 0.03928) {
            c = c / 12.92;
        } else {
            c = Math.pow((c + 0.055) / 1.055, 2.4);
        }
        return c;
    }

    private invertColor(color: string) {
        if (color.indexOf('#') === 0) {
            color = color.slice(1);
        }
        // convert 3-digit hex to 6-digits.
        if (color.length === 3) {
            color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
        }
        if (color.length === 6) {
            // http://stackoverflow.com/a/3943023/112731
            const r = this.convertToLinearRgb(parseInt(color.slice(0, 2), 16));
            const g = this.convertToLinearRgb(parseInt(color.slice(2, 4), 16));
            const b = this.convertToLinearRgb(parseInt(color.slice(4, 6), 16));

            const L = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);

            return (L > 0.179)
                ? '#000000'
                : '#FFFFFF';
        } else {
            return color;
        }
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
        let forceLightTheme = false;
        let isText = false;

        // Stream and error output need to be converted
        if (copy.output_type === 'stream') {
            addScrollbars = true;
            isText = true;

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
            forceLightTheme = true;
            isText = true;
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
            return this.renderWithTransform(mimetype, copy, index, addScrollbars, forceLightTheme, isText);
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
}
