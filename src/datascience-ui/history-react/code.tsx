// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
// tslint:disable-next-line: import-name
import MonacoEditor from 'react-monaco-editor';

import { IProvideCompletionItemsResponse } from '../../client/datascience/history/historyTypes';
import { InputHistory } from './inputHistory';

// This next line is necessary to get webpack to load the python language settings. Otherwise
// it will fail to do so dynamically at run time.
import '../../../node_modules/monaco-editor/esm/vs/basic-languages/python/python.js';
import './code.css';

const LINE_HEIGHT = 18;

export interface ICodeProps {
    autoFocus: boolean;
    code : string;
    codeTheme: string;
    testMode: boolean;
    readOnly: boolean;
    history: InputHistory | undefined;
    cursorType: string;
    showWatermark: boolean;
    onSubmit(code: string): void;
    onChangeLineCount(lineCount: number) : void;
    onChange(fromLine: number, fromCh: number, toLine: number, toCh: number, text: string, removed?: string): void;
    requestCompletionItems(line: number, ch: number, id: string) : Promise<IProvideCompletionItemsResponse>;

}

interface ICodeState {
    focused: boolean;
    cursorLeft: number;
    cursorTop: number;
    cursorBottom: number;
    charUnderCursor: string;
    allowWatermark: boolean;
    editor: monacoEditor.editor.IStandaloneCodeEditor | undefined;
    model: monacoEditor.editor.ITextModel | null;
}

export class Code extends React.Component<ICodeProps, ICodeState> {
    private containerRef: React.RefObject<HTMLDivElement>;
    private measureWidthRef: React.RefObject<HTMLDivElement>;
    private resizeTimer?: number;
    private subscriptions: monacoEditor.IDisposable[] = [];

    constructor(prop: ICodeProps) {
        super(prop);
        this.state = {focused: false, cursorLeft: 0, cursorTop: 0, cursorBottom: 0, charUnderCursor: '', allowWatermark: true, editor: undefined, model: null};
        this.containerRef = React.createRef<HTMLDivElement>();
        this.measureWidthRef = React.createRef<HTMLDivElement>();
    }

    public componentDidMount = () => {
        if (window) {
            window.addEventListener('resize', this.windowResized);
        }
        this.updateEditorSize();
    }

    public componentWillUnmount = () => {
        if (this.resizeTimer) {
            window.clearTimeout(this.resizeTimer);
        }

        if (window) {
            window.removeEventListener('resize', this.windowResized);
        }

        this.subscriptions.forEach(d => d.dispose());
    }

    public componentDidUpdate = () => {
        this.updateEditorSize();
    }

    public render() {
        const readOnly = this.props.readOnly;
        const classes = readOnly ? 'code-area' : 'code-area code-area-editable';
        const options: monacoEditor.editor.IEditorConstructionOptions = {
            minimap: {
                enabled: false
            },
            glyphMargin: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden'
            },
            lineNumbers: 'off',
            renderLineHighlight: 'none',
            highlightActiveIndentGuide: false,
            renderIndentGuides: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            folding: false,
            readOnly: readOnly,
            lineDecorationsWidth: 0
        };

        return (
            <div className={classes} ref={this.containerRef}>
                <MonacoEditor
                    value={this.props.code}
                    theme='vs'
                    language='python'
                    editorDidMount={this.editorDidMount}
                    options={options}
                />
                <div className={'measure-width-div'} ref={this.measureWidthRef}/>
            </div>
        );
    }

    public onParentClick(ev: React.MouseEvent<HTMLDivElement>) {
        const readOnly = this.props.testMode || this.props.readOnly;
        if (this.state.editor && !readOnly) {
            ev.stopPropagation();
            this.state.editor.focus();
        }
    }

    public giveFocus() {
        const readOnly = this.props.testMode || this.props.readOnly;
        if (this.state.editor && !readOnly) {
            this.state.editor.focus();
        }
    }

    private editorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        // Update our state
        this.setState({ editor, model: editor.getModel() });

        // Listen for model changes
        this.subscriptions.push(editor.onDidChangeModelContent(this.modelChanged));

        // do the initial set of the height (wait a bit)
        this.windowResized();

        // on each edit recompute height (wait a bit)
        this.subscriptions.push(editor.onDidChangeModelDecorations(() => {
            this.windowResized();
        }));

        this.subscriptions.push(editor.onCompositionStart(this.compositionStart));
        this.subscriptions.push(editor.onDidFocusEditorWidget(this.focusEditorWidget));

        // Setup our context menu to show up outside. Need this for autocomplete too
        this.subscriptions.push(editor.onContextMenu((e) => {
            if (this.state.editor) {
                const domNode = this.state.editor.getDomNode();
                const contextMenuElement = domNode ? domNode.querySelector('.monaco-menu-container') as HTMLElement : null;
                if (contextMenuElement) {
                  const posY = (e.event.posy + contextMenuElement.clientHeight) > window.outerHeight
                    ? e.event.posy - contextMenuElement.clientHeight
                    : e.event.posy;
                  const posX = (e.event.posx + contextMenuElement.clientWidth) > window.outerWidth
                    ? e.event.posx - contextMenuElement.clientWidth
                    : e.event.posx;
                  contextMenuElement.style.position = 'fixed';
                  contextMenuElement.style.top =  `${Math.max(0, Math.floor(posY))}px`;
                  contextMenuElement.style.left = `${Math.max(0, Math.floor(posX))}px`;
                }
            }
          }));
    }

    private modelChanged = (e: monacoEditor.editor.IModelContentChangedEvent) => {
        if (e.changes.length) {
            this.windowResized();
        }
    }

    private compositionStart = () => {
        window.console.log('comp start');
    }

    private focusEditorWidget = () => {
        window.console.log('editor widget focus');
    }

    private updateEditorSize = () => {
        if (this.measureWidthRef.current &&
            this.measureWidthRef.current.clientWidth &&
            this.containerRef.current &&
            this.state.editor &&
            this.state.model) {
            const editorDomNode = this.state.editor.getDomNode();
            if (!editorDomNode) { return; }
            const container = editorDomNode.getElementsByClassName('view-lines')[0] as HTMLElement;
            const lineHeight = container.firstChild
                ? (container.firstChild as HTMLElement).offsetHeight
                : LINE_HEIGHT;
            const currLineCount = this.state.model.getLineCount();
            const height = (currLineCount * lineHeight) + 3; // Fudge factor
            const width = this.measureWidthRef.current.clientWidth - this.containerRef.current.offsetLeft - 2;

            // For some reason this is flashing. Need to debug the editor code to see if
            // it draws more than once. Or if we can have React turn off DOM updates
            this.state.editor.layout({ width: width, height: height });
        }
    }

    private windowResized = () => {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(this.updateEditorSize, 0);
    }
}
