// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { IKeyboardEvent } from '../react-common/event';
import { MonacoEditor } from '../react-common/monacoEditor';
import { InputHistory } from './inputHistory';
import { CursorPos, IFont } from './mainState';

// tslint:disable-next-line: import-name
export interface IEditorProps {
    content: string;
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
    hasFocus: boolean;
    cursorPos: CursorPos;
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
    forceMonaco: boolean;
}

export class Editor extends React.Component<IEditorProps, IEditorState> {
    private subscriptions: monacoEditor.IDisposable[] = [];
    private lastCleanVersionId: number = 0;
    private monacoRef: React.RefObject<MonacoEditor> = React.createRef<MonacoEditor>();

    constructor(prop: IEditorProps) {
        super(prop);
        this.state = { editor: undefined, model: null, forceMonaco: false };
    }

    public componentWillUnmount = () => {
        this.subscriptions.forEach(d => d.dispose());
    };

    public componentDidUpdate(prevProps: IEditorProps, prevState: IEditorState) {
        if (this.props.hasFocus && (!prevProps.hasFocus || !prevState.editor)) {
            this.giveFocus(this.props.cursorPos);
        }
    }

    public render() {
        const classes = this.props.readOnly ? 'editor-area' : 'editor-area editor-area-editable';
        const renderEditor =
            this.state.forceMonaco || this.props.useQuickEdit === undefined || this.props.useQuickEdit === false ? this.renderMonacoEditor : this.renderQuickEditor;
        return <div className={classes}>{renderEditor()}</div>;
    }

    public giveFocus(cursorPos: CursorPos) {
        const readOnly = this.props.readOnly;
        if (this.state.editor && !readOnly) {
            this.state.editor.focus();
        }
        if (this.state.editor && cursorPos !== CursorPos.Current) {
            const current = this.state.editor.getPosition();
            const lineNumber = cursorPos === CursorPos.Top ? 1 : this.state.editor.getModel()!.getLineCount();
            const column = current && current.lineNumber === lineNumber ? current.column : 1;
            this.state.editor.setPosition({ lineNumber, column });
        }
    }

    public getContents(): string {
        if (this.state.model) {
            return this.state.model.getValue().replace(/\r/g, '');
        }
        return '';
    }

    private renderQuickEditor = (): JSX.Element => {
        const readOnly = this.props.readOnly;
        return (
            <textarea
                className="plain-editor"
                readOnly={readOnly}
                value={this.props.content}
                rows={this.props.content.split('\n').length}
                onChange={this.onAreaChange}
                onMouseEnter={this.onAreaEnter}
            />
        );
    };

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
            />
        );
    };

    private onAreaChange = (_event: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Force switch to monaco
        this.setState({ forceMonaco: true });
    };

    private onAreaEnter = (_event: React.MouseEvent<HTMLTextAreaElement, MouseEvent>) => {
        // Force switch to monaco
        this.setState({ forceMonaco: true });
    };

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
    };

    private modelChanged = (e: monacoEditor.editor.IModelContentChangedEvent) => {
        if (this.state.model) {
            this.props.onChange(e.changes, this.state.model);
        }
    };

    // tslint:disable-next-line: cyclomatic-complexity
    private onKeyDown = (e: monacoEditor.IKeyboardEvent) => {
        if (this.state.editor && this.state.model && this.monacoRef && this.monacoRef.current) {
            const cursor = this.state.editor.getPosition();
            const currentLine = this.monacoRef.current.getCurrentVisibleLine();
            const visibleLineCount = this.monacoRef.current.getVisibleLineCount();
            const isSuggesting = this.monacoRef.current.isSuggesting();
            const isFirstLine = currentLine === 0;
            const isLastLine = currentLine === visibleLineCount - 1;
            const isDirty = this.state.model!.getVersionId() > this.lastCleanVersionId;

            // See if we need to use the history or not
            if (cursor && this.props.history && e.code === 'ArrowUp' && isFirstLine && !isSuggesting) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeUp(currentValue);
                if (newValue !== currentValue) {
                    this.state.model.setValue(newValue);
                    this.lastCleanVersionId = this.state.model.getVersionId();
                    this.state.editor.setPosition({ lineNumber: 1, column: 1 });
                    e.stopPropagation();
                }
            } else if (cursor && this.props.history && e.code === 'ArrowDown' && isLastLine && !isSuggesting) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeDown(currentValue);
                if (newValue !== currentValue) {
                    this.state.model.setValue(newValue);
                    this.lastCleanVersionId = this.state.model.getVersionId();
                    const lastLine = this.state.model.getLineCount();
                    this.state.editor.setPosition({ lineNumber: lastLine, column: this.state.model.getLineLength(lastLine) + 1 });
                    e.stopPropagation();
                }
            } else if (this.props.keyDown) {
                // Forward up the chain
                this.props.keyDown({
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
                        contents: this.getContents(),
                        clear: this.clear
                    },
                    stopPropagation: () => e.stopPropagation(),
                    preventDefault: () => e.preventDefault()
                });
            }
        }
    };

    private onKeyUp = (e: monacoEditor.IKeyboardEvent) => {
        if (e.shiftKey && e.keyCode === monacoEditor.KeyCode.Enter) {
            // Shift enter was hit
            e.stopPropagation();
            e.preventDefault();
        }
    };

    private clear = () => {
        if (this.state.editor) {
            this.state.editor.setValue('');
        }
    };
}
