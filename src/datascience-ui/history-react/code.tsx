// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { getLocString } from '../react-common/locReactSide';
import { MonacoEditor } from '../react-common/monacoEditor';
import { InputHistory } from './inputHistory';

import './code.css';

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
    outermostParentClass: string;
    editorOptions: monacoEditor.editor.IEditorOptions;
    onSubmit(code: string): void;
    onCreated(code: string, modelId: string): void;
    onChange(changes: monacoEditor.editor.IModelContentChange[], modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
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
    private subscriptions: monacoEditor.IDisposable[] = [];
    private lastCleanVersionId: number = 0;

    constructor(prop: ICodeProps) {
        super(prop);
        this.state = {focused: false, cursorLeft: 0, cursorTop: 0, cursorBottom: 0, charUnderCursor: '', allowWatermark: true, editor: undefined, model: null};
    }

    public componentWillUnmount = () => {
        this.subscriptions.forEach(d => d.dispose());
    }

    public componentDidUpdate = () => {
        if (this.props.autoFocus && this.state.editor && !this.props.readOnly) {
            this.state.editor.focus();
        }
    }

    public render() {
        const readOnly = this.props.readOnly;
        const waterMarkClass = this.props.showWatermark && this.state.allowWatermark && !readOnly ? 'code-watermark' : 'hide';
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
            autoClosingBrackets: this.props.testMode ? 'never' : 'languageDefined',
            autoClosingQuotes: this.props.testMode ? 'never' : 'languageDefined',
            renderIndentGuides: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            folding: false,
            readOnly: readOnly,
            lineDecorationsWidth: 0,
            contextmenu: false,
            ...this.props.editorOptions
        };

        return (
            <div className={classes}>
                <MonacoEditor
                    testMode={this.props.testMode}
                    value={this.props.code}
                    outermostParentClass={this.props.outermostParentClass}
                    theme={this.props.monacoTheme ? this.props.monacoTheme : 'vs'}
                    language='python'
                    editorMounted={this.editorDidMount}
                    options={options}
                    openLink={this.props.openLink}
                />
                <div className={waterMarkClass}>{this.getWatermarkString()}</div>
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

    private getWatermarkString = () : string => {
        return getLocString('DataScience.inputWatermark', 'Shift-enter to run');
    }

    private editorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        // Update our state
        const model = editor.getModel();
        this.setState({ editor, model: editor.getModel() });

        // Listen for model changes
        this.subscriptions.push(editor.onDidChangeModelContent(this.modelChanged));

        // List for key up/down events.
        this.subscriptions.push(editor.onKeyDown(this.onKeyDown));
        this.subscriptions.push(editor.onKeyUp(this.onKeyUp));

        // Indicate we're ready
        this.props.onCreated(this.props.code, model!.id);
    }

    private modelChanged = (e: monacoEditor.editor.IModelContentChangedEvent) => {
        if (this.state.model) {
            this.props.onChange(e.changes, this.state.model.id);
        }
        if (!this.props.readOnly) {
            this.setState({allowWatermark: false});
        }
    }

    private onKeyDown = (e: monacoEditor.IKeyboardEvent) => {
        if (e.shiftKey && e.keyCode === monacoEditor.KeyCode.Enter && this.state.model && this.state.editor) {
            // Shift enter was hit
            e.stopPropagation();
            e.preventDefault();
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
            e.preventDefault();
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

            // Clear our current contents since we submitted
            this.state.model!.setValue('');

            // Send to jupyter
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
