// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { IKeyboardEvent } from '../react-common/event';
import { MonacoEditor } from '../react-common/monacoEditor';
import { IMonacoModelContentChangeEvent } from '../react-common/monacoHelpers';
import { InputHistory } from './inputHistory';
import { CursorPos, IFont } from './mainState';

// tslint:disable-next-line: import-name
export interface IEditorProps {
    content: string;
    version: number;
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
    cursorPos: CursorPos | monacoEditor.IPosition;
    disableUndoStack: boolean;
    onCreated(code: string, modelId: string): void;
    onChange(e: IMonacoModelContentChangeEvent): void;
    openLink(uri: monacoEditor.Uri): void;
    keyDown?(e: IKeyboardEvent): void;
    focused?(): void;
    unfocused?(): void;
}

export class Editor extends React.Component<IEditorProps> {
    private subscriptions: monacoEditor.IDisposable[] = [];
    private lastCleanVersionId: number = 0;
    private monacoRef: React.RefObject<MonacoEditor> = React.createRef<MonacoEditor>();

    constructor(prop: IEditorProps) {
        super(prop);
    }

    public componentWillUnmount = () => {
        this.subscriptions.forEach((d) => d.dispose());
    };

    public render() {
        const classes = this.props.readOnly ? 'editor-area' : 'editor-area editor-area-editable';
        const renderEditor = this.renderMonacoEditor;
        return <div className={classes}>{renderEditor()}</div>;
    }

    public giveFocus(cursorPos: CursorPos | monacoEditor.IPosition) {
        if (this.monacoRef.current) {
            this.monacoRef.current.giveFocus(cursorPos);
        }
    }

    public getContents(): string {
        if (this.monacoRef.current) {
            return this.monacoRef.current.getContents();
        }
        return '';
    }

    private renderMonacoEditor = (): JSX.Element => {
        const readOnly = this.props.readOnly;
        const options: monacoEditor.editor.IEditorConstructionOptions = {
            minimap: {
                enabled: false,
            },
            glyphMargin: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
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
            ...this.props.editorOptions,
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
                modelChanged={this.props.onChange}
                options={options}
                version={this.props.version}
                openLink={this.props.openLink}
                ref={this.monacoRef}
                hasFocus={this.props.hasFocus}
                cursorPos={this.props.cursorPos}
            />
        );
    };

    private editorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
        const model = editor.getModel();

        // Disable undo/redo on the model if asked
        // tslint:disable: no-any
        if (this.props.disableUndoStack && (model as any).undo && (model as any).redo) {
            (model as any).undo = noop;
            (model as any).redo = noop;
        }

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

    // tslint:disable-next-line: cyclomatic-complexity
    private onKeyDown = (e: monacoEditor.IKeyboardEvent) => {
        if (this.monacoRef.current) {
            const cursor = this.monacoRef.current.getPosition();
            const currentLine = this.monacoRef.current.getCurrentVisibleLine();
            const visibleLineCount = this.monacoRef.current.getVisibleLineCount();
            const isSuggesting = this.monacoRef.current.isSuggesting();
            const isFirstLine = currentLine === 0;
            const isLastLine = currentLine === visibleLineCount - 1;
            const isDirty = this.monacoRef.current.getVersionId() > this.lastCleanVersionId;

            // See if we need to use the history or not
            if (cursor && this.props.history && e.code === 'ArrowUp' && isFirstLine && !isSuggesting) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeUp(currentValue);
                if (newValue !== currentValue) {
                    this.monacoRef.current.setValue(newValue, CursorPos.Top);
                    this.lastCleanVersionId = this.monacoRef.current.getVersionId();
                    e.stopPropagation();
                }
            } else if (cursor && this.props.history && e.code === 'ArrowDown' && isLastLine && !isSuggesting) {
                const currentValue = this.getContents();
                const newValue = this.props.history.completeDown(currentValue);
                if (newValue !== currentValue) {
                    this.monacoRef.current.setValue(newValue, CursorPos.Bottom);
                    this.lastCleanVersionId = this.monacoRef.current.getVersionId();
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
                        clear: this.clear,
                    },
                    stopPropagation: () => e.stopPropagation(),
                    preventDefault: () => e.preventDefault(),
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
        if (this.monacoRef.current) {
            this.monacoRef.current.setValue('', CursorPos.Top);
        }
    };
}
