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
import { noop } from '../../test/core';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { displayOrder, richestMimetype, transforms } from './transforms';

export interface ICellOutputProps {
    output: nbformat.IOutput;
    maxTextSize?: number;
    baseTheme: string;
    openLink(uri: monacoEditor.Uri): void;
    expandImage(imageHtml: string): void;
}

function getAnsiToHtmlOptions() : { fg: string; bg: string; colors: string [] } {
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

export class CellOutput extends React.Component<ICellOutputProps> {
    public render() {
        const { output } = this.props;
        if (!output) {
            return <div />;
        }

        // Make a copy of our data so we don't modify our cell
        const copy = { ...output };

        // Special case for json
        if (copy.data && copy.data.hasOwnProperty('application/json')) {
            return <JSONTree data={copy.data} />;
        }

        // Only for text and error ouptut do we add scrollbars
        let addScrollbars = false;
        let isText = false;
        let isError = false;

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
                'text/html': `<xmp>${formatted}</xmp>`
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
            isText = true;
            isError = true;
            const error = copy as nbformat.IError;
            try {
                const converter = new ansiToHtml(getAnsiToHtmlOptions());
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
            return this.renderWithTransform(mimetype, copy, addScrollbars, isText, isError);
        }

        if (copy.data) {
            const keys = Object.keys(copy.data);
            mimetype = keys.length > 0 ? keys[0] : 'unknown';
        } else {
            mimetype = 'unknown';
        }
        const str: string = this.getUnknownMimeTypeFormatString().format(mimetype);
        return <div>{str}</div>;
    }

    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }

    private renderWithTransform = (mimetype: string, output: nbformat.IOutput, renderWithScrollbars: boolean, isText: boolean, isError: boolean) => {

        // If we found a mimetype, use the transform
        if (mimetype) {

            // Get the matching React.Component for that mimetype
            const Transform = transforms[mimetype];

            if (typeof mimetype !== 'string') {
                return <div>{this.getUnknownMimeTypeFormatString().format(mimetype)}</div>;
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

                    let className = isText ? 'cell-output-text' : 'cell-output-html';
                    className = isError ? `${className} cell-output-error` : className;

                    return (
                        <div role='group' onDoubleClick={this.doubleClick} onClick={this.click} className={className} style={style}>
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

}
