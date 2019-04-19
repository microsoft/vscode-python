
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// Got this from here: https://gist.github.com/abersnaze/efac6927e17187550d4f5d795334ccae
// Used to solve editor issues with monaco editor
// Doesn't work for editing though as it keeps resizing
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
// tslint:disable-next-line: import-name
import MonacoEditor, { EditorDidMount, MonacoEditorProps } from 'react-monaco-editor';

const LINE_HEIGHT = 18;
const DEFAULT_STATE = {
    editor: undefined as unknown as monacoEditor.editor.ICodeEditor,
    prevLineCount: -1
};

export class InlineMonacoEditor extends React.Component<MonacoEditorProps, typeof DEFAULT_STATE> {
    constructor(props: MonacoEditorProps) {
        super(props);
        this.state = DEFAULT_STATE;
    }

    public componentWillUnmount() {
        if (window) {
            window.removeEventListener('resize', this.setEditorHeight);
        }
    }

    public render() {
        const { options = {}, editorDidMount } = this.props;

        // override a word wrapping, disable and hide the scroll bars
        const optionsOverride: monacoEditor.editor.IEditorConstructionOptions = {
            ...options,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden'
            }
        };

        return (
            <MonacoEditor
                {...this.props}
                editorDidMount={this.editorDidMount(editorDidMount)}
                options={optionsOverride} />
        );
    }

    private editorDidMount(prevEditorDidMount: EditorDidMount | undefined): EditorDidMount {
        return (editor, monaco) => {
            // chain an pre-existing editorDidMount handler
            if (prevEditorDidMount) {
                prevEditorDidMount(editor, monaco);
            }

            // put the edit in the state for the handler.
            this.setState({ editor });

            // do the initial set of the height (wait a bit)
            setTimeout(this.setEditorHeight, 0);

            // adjust height when the window resizes
            if (window) {
                window.addEventListener('resize', this.setEditorHeight);
            }

            // on each edit recompute height (wait a bit)
            editor.onDidChangeModelDecorations(() => {
                setTimeout(this.setEditorHeight, 0);
            });
        };
    }

    private setEditorHeight = () => {
        const { editor, prevLineCount } = this.state;
        if (!editor) { return; }
        const editorDomNode = editor.getDomNode();
        if (!editorDomNode) { return; }
        const container = editorDomNode.getElementsByClassName('view-lines')[0] as HTMLElement;
        const containerHeight = container.offsetHeight;
        const lineHeight = container.firstChild
            ? (container.firstChild as HTMLElement).offsetHeight
            : LINE_HEIGHT;

        if (!containerHeight) {
            // dom hasn't finished settling down. wait a bit more.
            setTimeout(this.setEditorHeight, 0);
        } else {
            const currLineCount = container.childElementCount;
            if (currLineCount !== prevLineCount) {
                // Only resize when we get a new line size
                const nextHeight = (prevLineCount > currLineCount)
                    // if line count is shrinking monaco tends to leave the extra
                    // space at the end, compute the height from the line count
                    ? currLineCount * lineHeight
                    // otherwise use the height of the container div as the height
                    // of the editor node
                    : containerHeight;

                // set the height and redo layout
                editorDomNode.style.height = `${nextHeight}px`;
                editor.layout();
                this.setState({ prevLineCount: currLineCount });
            }
        }
    }
}
