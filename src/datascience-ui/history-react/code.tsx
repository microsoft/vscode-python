// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
// tslint:disable-next-line: import-name
import MonacoEditor from 'react-monaco-editor';

import { InputHistory } from './inputHistory';

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
    monacoTheme: string | undefined;
    onSubmit(code: string): void;
    onChangeLineCount(lineCount: number) : void;
    onChange(changes: monacoEditor.editor.IModelContentChange[]): void;
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
    private lastCleanVersionId: number = 0;

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
        if (this.props.autoFocus && this.state.editor && !this.props.readOnly) {
            this.state.editor.focus();
        }
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
            autoIndent: true,
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
                    theme={this.props.monacoTheme ? this.props.monacoTheme : 'vs'}
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
        this.subscriptions.push(editor.onKeyDown(this.onKeyDown));
        this.subscriptions.push(editor.onKeyUp(this.onKeyUp));

        // Setup our context menu to show up outside. Autocomplete doesn't have this problem so it just works
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
        if (!this.props.readOnly) {
            this.props.onChange(e.changes);
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

    private onKeyDown = (e: monacoEditor.IKeyboardEvent) => {
        if (e.shiftKey && e.keyCode === monacoEditor.KeyCode.Enter && this.state.model && this.state.editor) {
            // Shift enter was hit
            e.stopPropagation();
            window.setTimeout(this.submitContent, 0);
        } else if (e.keyCode === monacoEditor.KeyCode.UpArrow) {
            this.arrowUp(e);
        } else if (e.keyCode === monacoEditor.KeyCode.DownArrow) {
            this.arrowDown(e);
        }
    }

    private onKeyUp = (e: monacoEditor.IKeyboardEvent) => {
        if (e.shiftKey && e.keyCode === monacoEditor.KeyCode.Enter) {
            // Shift enter was hit
            e.stopPropagation();
        }
    }

    private submitContent = () => {
        let content = this.getContents();
        if (content) {
            // Remove empty lines off the end
            let endPos = content.length - 1;
            while (endPos >= 0 && content[endPos] === '\n') {
                endPos -= 1;
            }
            content = content.slice(0, endPos + 1);

            // Send to the input history too if necessary
            if (this.props.history) {
                this.props.history.add(content, this.state.model!.getVersionId() > this.lastCleanVersionId);
            }

            this.props.onSubmit(content);
        }
    }

    private getContents() : string {
        if (this.state.model) {
            return this.state.model.getValue().replace(/\r/g, '');
        }
        return '';
    }

    private arrowUp(e: monacoEditor.IKeyboardEvent) {
        if (this.state.editor && this.state.model) {
            const cursor = this.state.editor.getPosition();
            if (cursor && cursor.lineNumber === 1 && this.props.history) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeUp(currentValue);
                if (newValue !== currentValue) {
                    this.state.model.setValue(newValue);
                    this.lastCleanVersionId = this.state.model.getVersionId();
                    this.state.editor.setPosition({lineNumber: 1, column: 1});
                    e.stopPropagation();
                }
            }
        }
    }

    private arrowDown(e: monacoEditor.IKeyboardEvent) {
        if (this.state.editor && this.state.model) {
            const cursor = this.state.editor.getPosition();
            if (cursor && cursor.lineNumber === this.state.model.getLineCount() && this.props.history) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeDown(currentValue);
                if (newValue !== currentValue) {
                    this.state.model.setValue(newValue);
                    this.lastCleanVersionId = this.state.model.getVersionId();
                    const lastLine = this.state.model.getLineCount();
                    this.state.editor.setPosition({lineNumber: lastLine, column: this.state.model.getLineLength(lastLine) + 1});
                    e.stopPropagation();
                }
            }
        }
    }

}
