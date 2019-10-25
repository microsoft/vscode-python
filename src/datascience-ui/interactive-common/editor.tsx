// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { IKeyboardEvent } from '../react-common/event';
import { MonacoEditor } from '../react-common/monacoEditor';
import { InputHistory } from './inputHistory';
import { IFont } from './mainState';

// tslint:disable-next-line: import-name
export interface IEditorProps {
    content : string;
    autoFocus?: boolean;
    codeTheme: string;
    readOnly: boolean;
    testMode: boolean;
    monacoTheme: string | undefined;
    outermostParentClass: string;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    history: InputHistory | undefined;
    editorMeasureClassName?: string;
    language: string;
    showLineNumbers?: boolean;
    useQuickEdit?: boolean;
    font: IFont;
    onCreated(code: string, modelId: string): void;
    onChange(changes: monacoEditor.editor.IModelContentChange[], model: monacoEditor.editor.ITextModel): void;
    openLink(uri: monacoEditor.Uri): void;
    keyDown?(e: IKeyboardEvent): void;
    focused?(): void;
    unfocused?(): void;
}

interface IEditorState {
    editor: monacoEditor.editor.IStandaloneCodeEditor | undefined;
    model: monacoEditor.editor.ITextModel | null;
    visibleLineCount: number;
    forceMonaco: boolean;
}

export class Editor extends React.Component<IEditorProps, IEditorState> {
    private subscriptions: monacoEditor.IDisposable[] = [];
    private lastCleanVersionId: number = 0;
    private monacoRef: React.RefObject<MonacoEditor> = React.createRef<MonacoEditor>();

    constructor(prop: IEditorProps) {
        super(prop);
        this.state = {editor: undefined, model: null, visibleLineCount: 0, forceMonaco: false};
    }

    public componentWillUnmount = () => {
        this.subscriptions.forEach(d => d.dispose());
    }

    public render() {
        const classes = this.props.readOnly ? 'editor-area' : 'editor-area editor-area-editable';
        const renderEditor = this.state.forceMonaco || this.props.useQuickEdit === undefined || this.props.useQuickEdit === false ? this.renderMonacoEditor : this.renderQuickEditor;
        return (
            <div className = {classes}>
                    {renderEditor()}
            </div>
        );
    }

    public giveFocus() {
        const readOnly = this.props.readOnly;
        if (this.state.editor && !readOnly) {
            this.state.editor.focus();
        }
    }

    private renderQuickEditor = (): JSX.Element => {
        const readOnly = this.props.readOnly;
        return (
            <textarea
                className='plain-editor'
                readOnly={readOnly}
                value={this.props.content}
                rows={this.props.content.split('\n').length}
                onChange={this.onAreaChange}
                onMouseEnter={this.onAreaEnter}
            />
        );
    }

    private renderMonacoEditor = (): JSX.Element => {
        const readOnly = this.props.readOnly;
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
            lineNumbers: this.props.showLineNumbers ? 'on' : 'off',
            renderLineHighlight: 'none',
            highlightActiveIndentGuide: false,
            renderIndentGuides: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            folding: false,
            readOnly: readOnly,
            occurrencesHighlight: false,
            selectionHighlight: false,
            lineDecorationsWidth: 0,
            contextmenu: false,
            matchBrackets: false,
            fontSize: this.props.font.size,
            fontFamily: this.props.font.family,
            ...this.props.editorOptions
        };

        return (
            <MonacoEditor
                measureWidthClassName={this.props.editorMeasureClassName}
                testMode={this.props.testMode}
                value={this.props.content}
                outermostParentClass={this.props.outermostParentClass}
                theme={this.props.monacoTheme ? this.props.monacoTheme : 'vs'}
                language={this.props.language}
                editorMounted={this.editorDidMount}
                options={options}
                openLink={this.props.openLink}
                ref={this.monacoRef}
                lineCountChanged={this.visibleCountChanged}
            />
        );
    }

    private onAreaChange = (_event: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Force switch to monaco
        this.setState({forceMonaco: true});
    }

    private onAreaEnter = (_event: React.MouseEvent<HTMLTextAreaElement, MouseEvent>) => {
        // Force switch to monaco
        this.setState({forceMonaco: true});
    }

    private visibleCountChanged = (newCount: number) => {
        this.setState({visibleLineCount: newCount});
    }

    private editorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        // Update our state
        const model = editor.getModel();
        this.setState({ editor, model: editor.getModel() });

        // Listen for model changes
        this.subscriptions.push(editor.onDidChangeModelContent(this.modelChanged));

        // List for key up/down events if not read only
        if (!this.props.readOnly) {
            this.subscriptions.push(editor.onKeyDown(this.onKeyDown));
            this.subscriptions.push(editor.onKeyUp(this.onKeyUp));
        }

        // Indicate we're ready
        this.props.onCreated(this.props.content, model!.id);

        // Track focus changes
        this.subscriptions.push(editor.onDidFocusEditorWidget(this.props.focused ? this.props.focused : noop));
        this.subscriptions.push(editor.onDidBlurEditorWidget(this.props.unfocused ? this.props.unfocused : noop));

        // Give focus if necessary
        if (this.props.autoFocus) {
            setTimeout(() => editor.focus(), 1);
        }
    }

    private modelChanged = (e: monacoEditor.editor.IModelContentChangedEvent) => {
        if (this.state.model) {
            this.props.onChange(e.changes, this.state.model);
        }
    }

    // tslint:disable-next-line: cyclomatic-complexity
    private onKeyDown = (e: monacoEditor.IKeyboardEvent) => {
        if (this.state.editor && this.state.model && this.monacoRef && this.monacoRef.current) {
            const cursor = this.state.editor.getPosition();
            const editorDomNode = this.state.editor.getDomNode();
            let currentLine = -1;

            // This gets the cell/monaco editor line where the cursor is located. With it we can include wrapped lines
            // when the isFirstLine and the isLastLine settings are created.
            if (cursor && editorDomNode) {
                // Get the cursor's position on the cell/monaco editor.
                const currentPosition = this.state.model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: cursor.lineNumber, endColumn: cursor.column }).length;

                if (currentPosition === 0) {
                    currentLine = 0;
                } else {
                    // Get the lines as they are being displayed, including wrapped ones.
                    const container = editorDomNode.getElementsByClassName('view-lines')[0] as HTMLElement;

                    if (container) {
                        let charCounter = 0;
                        let index = 0;

                        // Go through each line, and compare if a character counter is bigger or equal than the cursor position.
                        // If it is, we found the current line.
                        while (index < container.childNodes.length) {
                            if (charCounter < currentPosition && container.childNodes[index].textContent) {
                                charCounter += container.childNodes[index].textContent!.length;
                                index += 1;
                            } else {
                                break;
                            }
                        }

                        currentLine = index - 1;
                    }
                }
            }

            const isSuggesting = this.monacoRef.current.isSuggesting();
            const isFirstLine = currentLine === 0;
            const isLastLine = currentLine === this.state.visibleLineCount - 1;
            const isDirty = this.state.model!.getVersionId() > this.lastCleanVersionId;

            // See if we need to use the history or not
            if (cursor && this.props.history && e.code === 'ArrowUp' && isFirstLine && !isSuggesting) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeUp(currentValue);
                if (newValue !== currentValue) {
                    this.state.model.setValue(newValue);
                    this.lastCleanVersionId = this.state.model.getVersionId();
                    this.state.editor.setPosition({lineNumber: 1, column: 1});
                    e.stopPropagation();
                }
            } else if (cursor && this.props.history && e.code === 'ArrowDown' && isLastLine && !isSuggesting) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeDown(currentValue);
                if (newValue !== currentValue) {
                    this.state.model.setValue(newValue);
                    this.lastCleanVersionId = this.state.model.getVersionId();
                    const lastLine = this.state.model.getLineCount();
                    this.state.editor.setPosition({lineNumber: lastLine, column: this.state.model.getLineLength(lastLine) + 1});
                    e.stopPropagation();
                }
            } else if (this.props.keyDown) {
                // Forward up the chain
                this.props.keyDown(
                    {
                        code: e.code,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        ctrlKey: e.ctrlKey,
                        target: e.target,
                        metaKey: e.metaKey,
                        editorInfo: {
                            isFirstLine,
                            isLastLine,
                            isDirty,
                            isSuggesting,
                            contents: this.getContents()
                        },
                        stopPropagation: () => e.stopPropagation(),
                        preventDefault: () => e.preventDefault()
                    });
            }
        }
    }

    private onKeyUp = (e: monacoEditor.IKeyboardEvent) => {
        if (e.shiftKey && e.keyCode === monacoEditor.KeyCode.Enter) {
            // Shift enter was hit
            e.stopPropagation();
            e.preventDefault();
        }
    }

    private getContents() : string {
        if (this.state.model) {
            return this.state.model.getValue().replace(/\r/g, '');
        }
        return '';
    }
}
