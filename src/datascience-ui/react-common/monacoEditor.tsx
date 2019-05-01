
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import './monacoEditor.css';

const LINE_HEIGHT = 18;

export interface IMonacoEditorProps {
    language: string;
    value: string;
    theme?: string;
    options: monacoEditor.editor.IEditorConstructionOptions;
    editorMounted(editor: monacoEditor.editor.IStandaloneCodeEditor): void;
}

interface IMonacoEditorState {
    editor?:  monacoEditor.editor.IStandaloneCodeEditor;
    model: monacoEditor.editor.ITextModel | null;
}

// Need this to prevent wiping of the current value on a componentUpdate. react-monaco-editor has that problem.

export class MonacoEditor extends React.Component<IMonacoEditorProps, IMonacoEditorState> {
    private containerRef: React.RefObject<HTMLDivElement>;
    private measureWidthRef: React.RefObject<HTMLDivElement>;
    private resizeTimer?: number;
    private subscriptions: monacoEditor.IDisposable[] = [];
    constructor(props: IMonacoEditorProps) {
        super(props);
        this.state = { editor: undefined, model: null };
        this.containerRef = React.createRef<HTMLDivElement>();
        this.measureWidthRef = React.createRef<HTMLDivElement>();
    }

    public componentDidMount = () => {
        if (window) {
            window.addEventListener('resize', this.windowResized);
        }
        if (this.containerRef.current) {
            // Create the editor
            const editor = monacoEditor.editor.create(this.containerRef.current,
                {
                    value: this.props.value,
                    language: this.props.language,
                    ...this.props.options
                });

            // Save the editor and the model in our state.
            this.setState({ editor, model: editor.getModel() });
            if (this.props.theme) {
                monacoEditor.editor.setTheme(this.props.theme);
            }

            // do the initial set of the height (wait a bit)
            this.windowResized();

            // on each edit recompute height (wait a bit)
            this.subscriptions.push(editor.onDidChangeModelDecorations(() => {
                this.windowResized();
            }));

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
                        contextMenuElement.style.top = `${Math.max(0, Math.floor(posY))}px`;
                        contextMenuElement.style.left = `${Math.max(0, Math.floor(posX))}px`;
                    }
                }
            }));

            // Tell our parent the editor is ready to use
            this.props.editorMounted(editor);
        }
    }

    public componentWillUnmount = () => {
        if (this.resizeTimer) {
            window.clearTimeout(this.resizeTimer);
        }

        if (window) {
            window.removeEventListener('resize', this.windowResized);
        }

        if (this.state.editor) {
            this.state.editor.dispose();
        }
        this.subscriptions.forEach(d => d.dispose());
    }

    public componentDidUpdate(prevProps: IMonacoEditorProps) {
        if (this.state.editor) {
            if (prevProps.language !== this.props.language && this.state.model) {
                monacoEditor.editor.setModelLanguage(this.state.model, this.props.language);
            }
            if (prevProps.theme !== this.props.theme && this.props.theme) {
                monacoEditor.editor.setTheme(this.props.theme);
            }
            if (prevProps.options !== this.props.options) {
                this.state.editor.updateOptions(this.props.options);
            }
            if (prevProps.value !== this.props.value && this.state.model) {
                this.state.model.setValue(this.props.value);
            }
        }
        this.updateEditorSize();
    }

    public render() {
        return (
            <div className='monaco-editor-outer-container'>
                <div className='monaco-editor-container' ref={this.containerRef}/>
                <div className='measure-width-div' ref={this.measureWidthRef}/>
            </div>
        );
    }

    private windowResized = () => {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(this.updateEditorSize, 0);
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

}
