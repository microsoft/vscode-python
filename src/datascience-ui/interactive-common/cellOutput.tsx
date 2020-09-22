// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import ansiRegex from 'ansi-regex';
import * as fastDeepEqual from 'fast-deep-equal';
import * as React from 'react';
import '../../client/common/extensions';
import { Identifiers } from '../../client/datascience/constants';
import { CellState } from '../../client/datascience/types';
import { ClassType } from '../../client/ioc/types';
import { WidgetManager } from '../ipywidgets';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { ICellViewModel } from './mainState';
import { fixMarkdown } from './markdownManipulation';
import { getRichestMimetype, getTransform, isIPyWidgetOutput, isMimeTypeSupported } from './transforms';

// tslint:disable-next-line: no-var-requires no-require-imports
const ansiToHtml = require('ansi-to-html');

// tslint:disable-next-line: no-require-imports no-var-requires
const cloneDeep = require('lodash/cloneDeep');
import { Widget } from '@phosphor/widgets';
import { noop } from '../../client/common/utils/misc';
import { WIDGET_MIMETYPE } from '../../client/datascience/ipywidgets/constants';
import { concatMultilineString } from '../common';
import { TrimmedOutputMessage } from './trimmedOutputLink';

interface ICellOutputProps {
    cellVM: ICellViewModel;
    baseTheme: string;
    maxTextSize?: number;
    enableScroll?: boolean;
    hideOutput?: boolean;
    themeMatplotlibPlots?: boolean;
    expandImage(imageHtml: string): void;
    widgetFailed(ex: Error): void;
    openSettings(settings?: string): void;
}

interface ICellOutputData {
    mimeType: string;
    data: nbformat.MultilineString | JSONObject;
    mimeBundle: nbformat.IMimeBundle;
    renderWithScrollbars: boolean;
    isText: boolean;
    isError: boolean;
}

interface ICellOutput {
    output: ICellOutputData;
    extraButton: JSX.Element | null; // Extra button for plot viewing is stored here
    outputSpanClassName?: string; // Wrap this output in a span with the following className, undefined to not wrap
    doubleClick(): void; // Double click handler for plot viewing is stored here
}
// tslint:disable: react-this-binding-issue
export class CellOutput extends React.Component<ICellOutputProps> {
    // tslint:disable-next-line: no-any
    private static get ansiToHtmlClass(): ClassType<any> {
        if (!CellOutput.ansiToHtmlClass_ctor) {
            // ansiToHtml is different between the tests running and webpack. figure out which one
            if (ansiToHtml instanceof Function) {
                CellOutput.ansiToHtmlClass_ctor = ansiToHtml;
            } else {
                CellOutput.ansiToHtmlClass_ctor = ansiToHtml.default;
            }
        }
        return CellOutput.ansiToHtmlClass_ctor!;
    }
    // tslint:disable-next-line: no-any
    private static ansiToHtmlClass_ctor: ClassType<any> | undefined;
    private ipyWidgetRef: React.RefObject<HTMLDivElement>;
    private renderedViews = new Map<string, Promise<Widget | undefined>>();
    private widgetManager: WidgetManager | undefined;
    // tslint:disable-next-line: no-any
    constructor(prop: ICellOutputProps) {
        super(prop);
        this.ipyWidgetRef = React.createRef<HTMLDivElement>();
    }
    private static getAnsiToHtmlOptions(): { fg: string; bg: string; colors: string[] } {
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
                'var(--vscode-terminal-ansiBlack)', // 0
                'var(--vscode-terminal-ansiBrightRed)', // 1
                'var(--vscode-terminal-ansiGreen)', // 2
                'var(--vscode-terminal-ansiYellow)', // 3
                'var(--vscode-terminal-ansiBrightBlue)', // 4
                'var(--vscode-terminal-ansiMagenta)', // 5
                'var(--vscode-terminal-ansiCyan)', // 6
                'var(--vscode-terminal-ansiBrightBlack)', // 7
                'var(--vscode-terminal-ansiWhite)', // 8
                'var(--vscode-terminal-ansiRed)', // 9
                'var(--vscode-terminal-ansiBrightGreen)', // 10
                'var(--vscode-terminal-ansiBrightYellow)', // 11
                'var(--vscode-terminal-ansiBlue)', // 12
                'var(--vscode-terminal-ansiBrightMagenta)', // 13
                'var(--vscode-terminal-ansiBrightCyan)', // 14
                'var(--vscode-terminal-ansiBrightWhite)' // 15
            ]
        };
    }
    public render() {
        // Only render results if not an edit cell
        if (this.props.cellVM.cell.id !== Identifiers.EditCellId) {
            const outputClassNames = this.isCodeCell()
                ? `cell-output cell-output-${this.props.baseTheme}`
                : 'markdown-cell-output-container';

            // Then combine them inside a div. IPyWidget ref has to be separate so we don't end up
            // with a div in the way. If we try setting all div's background colors, we break
            // some widgets
            return (
                <div className={outputClassNames}>
                    {this.renderResults()}
                    <div className="cell-output-ipywidget-background" ref={this.ipyWidgetRef}></div>
                </div>
            );
        }
        return null;
    }
    public componentWillUnmount() {
        this.destroyIPyWidgets();
    }
    public componentDidMount() {
        if (!this.isCodeCell() || !this.hasOutput() || !this.getCodeCell().outputs || this.props.hideOutput) {
            return;
        }
    }
    // tslint:disable-next-line: max-func-body-length
    public componentDidUpdate(prevProps: ICellOutputProps) {
        if (!this.isCodeCell() || !this.hasOutput() || !this.getCodeCell().outputs || this.props.hideOutput) {
            return;
        }
        if (fastDeepEqual(this.props, prevProps)) {
            return;
        }
        // Check if outupt has changed.
        if (
            prevProps.cellVM.cell.data.cell_type === 'code' &&
            prevProps.cellVM.cell.state === this.getCell()!.state &&
            prevProps.hideOutput === this.props.hideOutput &&
            fastDeepEqual(this.props.cellVM.cell.data, prevProps.cellVM.cell.data)
        ) {
            return;
        }
    }

    public shouldComponentUpdate(
        nextProps: Readonly<ICellOutputProps>,
        _nextState: Readonly<ICellOutputProps>,
        // tslint:disable-next-line: no-any
        _nextContext: any
    ): boolean {
        if (nextProps === this.props) {
            return false;
        }
        if (nextProps.baseTheme !== this.props.baseTheme) {
            return true;
        }
        if (nextProps.maxTextSize !== this.props.maxTextSize) {
            return true;
        }
        if (nextProps.themeMatplotlibPlots !== this.props.themeMatplotlibPlots) {
            return true;
        }
        // If they are the same, then nothing has changed.
        // Note, we're using redux, hence we'll never have the same reference object with different property values.
        if (nextProps.cellVM === this.props.cellVM) {
            return false;
        }
        if (nextProps.cellVM.cell.data.cell_type !== this.props.cellVM.cell.data.cell_type) {
            return true;
        }
        if (nextProps.cellVM.cell.state !== this.props.cellVM.cell.state) {
            return true;
        }
        if (nextProps.cellVM.cell.data.outputs !== this.props.cellVM.cell.data.outputs) {
            return true;
        }
        if (nextProps.cellVM.uiSideError !== this.props.cellVM.uiSideError) {
            return true;
        }
        if (
            !this.isCodeCell() &&
            nextProps.cellVM.cell.id !== Identifiers.EditCellId &&
            nextProps.cellVM.cell.data.source !== this.props.cellVM.cell.data.source
        ) {
            return true;
        }

        return false;
    }
    // Public for testing
    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }
    private destroyIPyWidgets() {
        this.renderedViews.forEach((viewPromise) => {
            viewPromise.then((v) => v?.dispose()).ignoreErrors();
        });
        this.renderedViews.clear();
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    };

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    };

    private hasOutput = () => {
        return (
            this.getCell().state === CellState.finished ||
            this.getCell().state === CellState.error ||
            this.getCell().state === CellState.executing
        );
    };

    private getCodeCell = () => {
        return this.props.cellVM.cell.data as nbformat.ICodeCell;
    };

    private getMarkdownCell = () => {
        return this.props.cellVM.cell.data as nbformat.IMarkdownCell;
    };

    private renderResults = (): JSX.Element[] => {
        // Results depend upon the type of cell
        if (this.isCodeCell()) {
            return (
                this.renderCodeOutputs()
                    .filter((item) => !!item)
                    // tslint:disable-next-line: no-any
                    .map((item) => (item as any) as JSX.Element)
            );
        } else if (this.props.cellVM.cell.id !== Identifiers.EditCellId) {
            return this.renderMarkdownOutputs();
        } else {
            return [];
        }
    };

    private renderCodeOutputs = () => {
        // return [];
        if (this.isCodeCell() && this.hasOutput() && this.getCodeCell().outputs && !this.props.hideOutput) {
            const trim = this.props.cellVM.cell.data.metadata.tags ? this.props.cellVM.cell.data.metadata.tags[0] : '';
            // Render the outputs
            const outputs = this.renderOutputs(this.getCodeCell().outputs, trim);

            // Render any UI side errors
            // tslint:disable: react-no-dangerous-html
            if (this.props.cellVM.uiSideError) {
                outputs.push(
                    <div key={'uiError'} className="cell-output-uiSideError">
                        <div dangerouslySetInnerHTML={{ __html: this.props.cellVM.uiSideError }} />
                    </div>
                );
            }

            return outputs;
        }
        return [];
    };

    private renderMarkdownOutputs = () => {
        const markdown = this.getMarkdownCell();
        // React-markdown expects that the source is a string
        const source = fixMarkdown(concatMultilineString(markdown.source));
        const Transform = getTransform('text/markdown');
        const MarkdownClassName = 'markdown-cell-output';

        return [
            <div key={0} className={MarkdownClassName}>
                <Transform key={0} data={source} />
            </div>
        ];
    };

    private computeOutputData(output: nbformat.IOutput): ICellOutputData {
        let isText = false;
        let isError = false;
        let mimeType = 'text/plain';
        let input = output.data;
        let renderWithScrollbars = false;

        // Special case for json. Just turn into a string
        if (input && input.hasOwnProperty('application/json')) {
            input = JSON.stringify(output.data);
            renderWithScrollbars = true;
            isText = true;
        } else if (output.output_type === 'execute_result' && input && input.hasOwnProperty('text/plain')) {
            // Plain text should actually be shown as html so that escaped HTML shows up correctly
            mimeType = 'text/html';
            isText = true;
            isError = false;
            renderWithScrollbars = true;
            // tslint:disable-next-line: no-any
            const text = (input as any)['text/plain'];
            input = {
                'text/html': text // XML tags should have already been escaped.
            };
        } else if (output.output_type === 'stream') {
            mimeType = 'text/html';
            isText = true;
            isError = false;
            renderWithScrollbars = true;
            // Sonar is wrong, TS won't compile without this AS
            const stream = output as nbformat.IStream; // NOSONAR
            const concatted = concatMultilineString(stream.text);
            input = {
                'text/html': concatted // XML tags should have already been escaped.
            };

            // Output may have ascii colorization chars in it.
            try {
                if (ansiRegex().test(concatted)) {
                    const converter = new CellOutput.ansiToHtmlClass(CellOutput.getAnsiToHtmlOptions());
                    const html = converter.toHtml(concatted);
                    input = {
                        'text/html': html
                    };
                }
            } catch {
                noop();
            }
        } else if (output.output_type === 'error') {
            mimeType = 'text/html';
            isText = true;
            isError = true;
            renderWithScrollbars = true;
            // Sonar is wrong, TS won't compile without this AS
            const error = output as nbformat.IError; // NOSONAR
            try {
                const converter = new CellOutput.ansiToHtmlClass(CellOutput.getAnsiToHtmlOptions());
                const trace = error.traceback.length ? converter.toHtml(error.traceback.join('\n')) : error.evalue;
                input = {
                    'text/html': trace
                };
            } catch {
                // This can fail during unit tests, just use the raw data
                input = {
                    'text/html': error.evalue
                };
            }
        } else if (input) {
            // Compute the mime type
            mimeType = getRichestMimetype(input);
            isText = mimeType === 'text/plain';
        }

        // Then parse the mime type
        const mimeBundle = input as nbformat.IMimeBundle; // NOSONAR
        let data: nbformat.MultilineString | JSONObject = mimeBundle[mimeType];

        // For un-executed output we might get text or svg output as multiline string arrays
        // we want to concat those so we don't display a bunch of weird commas as we expect
        // Single strings in our output
        if (Array.isArray(data)) {
            data = concatMultilineString(data as nbformat.MultilineString, true);
        }

        // Fixup latex to make sure it has the requisite $$ around it
        if (mimeType === 'text/latex') {
            data = fixMarkdown(concatMultilineString(data as nbformat.MultilineString, true), true);
        }

        return {
            isText,
            isError,
            renderWithScrollbars,
            data: data,
            mimeType,
            mimeBundle
        };
    }

    private transformOutput(output: nbformat.IOutput): ICellOutput {
        // First make a copy of the outputs.
        const copy = cloneDeep(output);

        // Then compute the data
        const data = this.computeOutputData(copy);
        let extraButton: JSX.Element | null = null;

        // Then parse the mime type
        try {
            // Text based mimeTypes don't get a white background
            if (/^text\//.test(data.mimeType)) {
                return {
                    output: data,
                    extraButton,
                    doubleClick: noop
                };
            } else if (data.mimeType === 'image/svg+xml' || data.mimeType === 'image/png') {
                // If we have a png or svg enable the plot viewer button
                // There should be two mime bundles. Well if enablePlotViewer is turned on. See if we have both
                const svg = data.mimeBundle['image/svg+xml'];
                const png = data.mimeBundle['image/png'];
                const buttonTheme = this.props.themeMatplotlibPlots ? this.props.baseTheme : 'vscode-light';
                let doubleClick: () => void = noop;
                if (svg && png) {
                    // Save the svg in the extra button.
                    const openClick = () => {
                        this.props.expandImage(svg.toString());
                    };
                    extraButton = (
                        <div className="plot-open-button">
                            <ImageButton
                                baseTheme={buttonTheme}
                                tooltip={getLocString('DataScience.plotOpen', 'Expand image')}
                                onClick={openClick}
                            >
                                <Image baseTheme={buttonTheme} class="image-button-image" image={ImageName.OpenPlot} />
                            </ImageButton>
                        </div>
                    );

                    // Switch the data to the png
                    data.data = png;
                    data.mimeType = 'image/png';

                    // Switch double click to do the same thing as the extra button
                    doubleClick = openClick;
                }

                // return the image
                // If not theming plots then wrap in a span
                return {
                    output: data,
                    extraButton,
                    doubleClick,
                    outputSpanClassName: this.props.themeMatplotlibPlots ? undefined : 'cell-output-plot-background'
                };
            } else {
                // For anything else just return it with a white plot background. This lets stuff like vega look good in
                // dark mode
                return {
                    output: data,
                    extraButton,
                    doubleClick: noop,
                    outputSpanClassName: this.props.themeMatplotlibPlots ? undefined : 'cell-output-plot-background'
                };
            }
        } catch (e) {
            return {
                output: {
                    data: e.toString(),
                    isText: true,
                    isError: false,
                    renderWithScrollbars: false,
                    mimeType: 'text/plain',
                    mimeBundle: {}
                },
                extraButton: null,
                doubleClick: noop
            };
        }
    }

    // tslint:disable-next-line: max-func-body-length
    private renderOutputs(outputs: nbformat.IOutput[], trim: string): JSX.Element[] {
        return [this.renderOutput(outputs, trim)];
    }

    private renderOutput = (outputs: nbformat.IOutput[], trim: string): JSX.Element => {
        const buffer: JSX.Element[] = [];
        const transformedList = outputs.map(this.transformOutput.bind(this));

        transformedList.forEach((transformed, index) => {
            const mimeType = transformed.output.mimeType;
            if (isIPyWidgetOutput(transformed.output.mimeBundle)) {
                // Create a view for this output if not already there.
                this.renderWidget(transformed.output);
            } else if (mimeType && isMimeTypeSupported(mimeType)) {
                // If that worked, use the transform
                // Get the matching React.Component for that mimetype
                const Transform = getTransform(mimeType);

                let className = transformed.output.isText ? 'cell-output-text' : 'cell-output-html';
                className = transformed.output.isError ? `${className} cell-output-error` : className;

                // If we are not theming plots then wrap them in a white span
                if (transformed.outputSpanClassName) {
                    buffer.push(
                        <div role="group" key={index} onDoubleClick={transformed.doubleClick} className={className}>
                            <span className={transformed.outputSpanClassName}>
                                {transformed.extraButton}
                                <Transform data={transformed.output.data} />
                            </span>
                        </div>
                    );
                } else {
                    if (trim === 'outputPrepend') {
                        buffer.push(
                            <div role="group" key={index} onDoubleClick={transformed.doubleClick} className={className}>
                                {transformed.extraButton}
                                <TrimmedOutputMessage openSettings={this.props.openSettings} />
                                <Transform data={transformed.output.data} />
                            </div>
                        );
                    } else {
                        buffer.push(
                            <div role="group" key={index} onDoubleClick={transformed.doubleClick} className={className}>
                                {transformed.extraButton}
                                <Transform data={transformed.output.data} />
                            </div>
                        );
                    }
                }
            } else if (
                !mimeType ||
                mimeType.startsWith('application/scrapbook.scrap.') ||
                mimeType.startsWith('application/aml')
            ) {
                // Silently skip rendering of these mime types, render an empty div so the user sees the cell was executed.
                buffer.push(<div key={index}></div>);
            } else {
                const str: string = this.getUnknownMimeTypeFormatString().format(mimeType);
                buffer.push(<div key={index}>{str}</div>);
            }
        });

        // Create a default set of properties
        const style: React.CSSProperties = {};

        // Create a scrollbar style if necessary
        if (transformedList.some((transformed) => transformed.output.renderWithScrollbars) && this.props.enableScroll) {
            style.overflowY = 'auto';
            style.maxHeight = `${this.props.maxTextSize}px`;
        }

        return (
            <div key={0} style={style}>
                {buffer}
            </div>
        );
    };

    private renderWidget(widgetOutput: ICellOutputData) {
        // Create a view for this widget if we haven't already
        // tslint:disable-next-line: no-any
        const widgetData: any = widgetOutput.mimeBundle[WIDGET_MIMETYPE];
        if (widgetData.model_id) {
            if (!this.renderedViews.has(widgetData.model_id)) {
                this.renderedViews.set(widgetData.model_id, this.createWidgetView(widgetData));
            }
        }
    }

    private async getWidgetManager() {
        if (!this.widgetManager) {
            const wm: WidgetManager | undefined = await new Promise((resolve) =>
                WidgetManager.instance.subscribe(resolve)
            );
            this.widgetManager = wm;
            if (wm) {
                const oldDispose = wm.dispose.bind(wm);
                wm.dispose = () => {
                    this.renderedViews.clear();
                    this.widgetManager = undefined;
                    return oldDispose();
                };
            }
        }
        return this.widgetManager;
    }

    private async createWidgetView(widgetData: nbformat.IMimeBundle & { model_id: string; version_major: number }) {
        const wm = await this.getWidgetManager();
        const element = this.ipyWidgetRef.current!;
        try {
            return await wm?.renderWidget(widgetData, element);
        } catch (ex) {
            this.props.widgetFailed(ex);
        }
    }
}
