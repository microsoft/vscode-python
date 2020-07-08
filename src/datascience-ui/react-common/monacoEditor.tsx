// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fastDeepEqual from 'fast-deep-equal';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
import { isTestExecution } from '../../client/common/constants';
import { IDisposable } from '../../client/common/types';
import { logMessage } from './logger';

// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const throttle = require('lodash/throttle') as typeof import('lodash/throttle');

import { noop } from '../../client/common/utils/misc';
import { CursorPos } from '../interactive-common/mainState';
import './codicon/codicon.css';
import './monacoEditor.css';
import { generateChangeEvent, IMonacoModelContentChangeEvent } from './monacoHelpers';

const LINE_HEIGHT = 18;

const HOVER_DISPOSABLE_EVENT_COUNT = 8;
const HOVER_DISPOSABLE_LEAVE_INDEX = 5;

enum WidgetCSSSelector {
    /**
     * CSS Selector for the parameters widget displayed by Monaco.
     */
    Parameters = '.parameter-hints-widget',
    /**
     * CSS Selector for the hover widget displayed by Monaco.
     */
    Hover = '.monaco-editor-hover'
}

export interface IMonacoEditorProps {
    language: string;
    value: string;
    theme?: string;
    outermostParentClass: string;
    options: monacoEditor.editor.IEditorConstructionOptions;
    testMode?: boolean;
    forceBackground?: string;
    measureWidthClassName?: string;
    version: number;
    hasFocus: boolean;
    cursorPos: CursorPos | monacoEditor.IPosition;
    modelChanged(e: IMonacoModelContentChangeEvent): void;
    editorMounted(editor: monacoEditor.editor.IStandaloneCodeEditor): void;
    openLink(uri: monacoEditor.Uri): void;
}

export interface IMonacoEditorState {
    editor?: monacoEditor.editor.IStandaloneCodeEditor;
    model: monacoEditor.editor.ITextModel | null;
    widgetsReparented: boolean; // Keeps track of when we reparent the hover widgets so they work inside something with overflow
}

// Need this to prevent wiping of the current value on a componentUpdate. react-monaco-editor has that problem.

export class MonacoEditor extends React.Component<IMonacoEditorProps, IMonacoEditorState> {
    private static lineHeight: number = 0;
    private containerRef: React.RefObject<HTMLDivElement>;
    private measureWidthRef: React.RefObject<HTMLDivElement>;
    private resizeTimer?: number;
    private leaveTimer?: number;
    private subscriptions: monacoEditor.IDisposable[] = [];
    private widgetParent: HTMLDivElement | undefined;
    private outermostParent: HTMLElement | null = null;
    private enteredHover: boolean = false;
    private lastOffsetLeft: number | undefined;
    private lastOffsetTop: number | undefined;
    private debouncedUpdateEditorSize: () => void | undefined;
    private styleObserver: MutationObserver | undefined;
    private watchingMargin: boolean = false;
    private throttledUpdateWidgetPosition = throttle(this.updateWidgetPosition.bind(this), 100);
    private throttledScrollCurrentPosition = throttle(this.tryToScrollToCurrentPosition.bind(this), 100);
    private monacoContainer: HTMLDivElement | undefined;
    private lineTops: { top: number; index: number }[] = [];
    private debouncedComputeLineTops = debounce(this.computeLineTops.bind(this), 100);
    private skipNotifications = false;
    private previousModelValue: string = '';
    /**
     * Reference to parameter widget (used by monaco to display parameter docs).
     */
    private parameterWidget?: Element;
    private keyHasBeenPressed = false;
    private visibleLineCount: number = -1;
    private attached: boolean = false; // Keeps track of when we reparent the editor out of the dummy dom node.
    private pendingLayoutScroll = false;
    private lastPasteCommandTime = 0;
    private lastPasteCommandText = '';

    constructor(props: IMonacoEditorProps) {
        super(props);
        this.state = {
            editor: undefined,
            model: null,
            widgetsReparented: false
        };
        this.containerRef = React.createRef<HTMLDivElement>();
        this.measureWidthRef = React.createRef<HTMLDivElement>();
        this.debouncedUpdateEditorSize = debounce(this.updateEditorSize.bind(this), 150);
        this.hideAllOtherHoverAndParameterWidgets = debounce(this.hideAllOtherHoverAndParameterWidgets.bind(this), 150);
    }

    // tslint:disable-next-line: max-func-body-length
    public componentDidMount = () => {
        if (window) {
            window.addEventListener('resize', this.windowResized);
        }
        if (this.containerRef.current) {
            // Compute our outermost parent
            let outerParent = this.containerRef.current.parentElement;
            while (outerParent && !outerParent.classList.contains(this.props.outermostParentClass)) {
                outerParent = outerParent.parentElement;
            }
            this.outermostParent = outerParent;
            if (this.outermostParent) {
                this.outermostParent.addEventListener('mouseleave', this.outermostParentLeave);
            }

            // Create a dummy DOM node to attach the editor to so that it skips layout.
            this.monacoContainer = document.createElement('div');
            this.monacoContainer.setAttribute('class', 'monaco-editor-container');

            // Create the editor
            const editor = monacoEditor.editor.create(this.monacoContainer, {
                value: this.props.value,
                language: this.props.language,
                ...this.props.options
            });

            // Listen for commands on the editor. This is to work around a problem
            // with double pasting
            // tslint:disable: no-any
            if ((editor as any)._commandService) {
                const commandService = (editor as any)._commandService as any;
                if (commandService._onWillExecuteCommand) {
                    this.subscriptions.push(
                        commandService._onWillExecuteCommand.event(this.onCommandWillExecute.bind(this))
                    );
                }
            }

            // Force the editor to behave like a unix editor as
            // all of our code is assuming that.
            const model = editor.getModel();
            if (model) {
                model.setEOL(monacoEditor.editor.EndOfLineSequence.LF);

                // Listen to model changes too.
                this.subscriptions.push(model?.onDidChangeContent(this.onModelChanged));
            }

            // When testing, eliminate the _assertNotDisposed call. It can break tests if autocomplete
            // is still open at the end of a test
            // tslint:disable-next-line: no-any
            if (isTestExecution() && model && (model as any)._assertNotDisposed) {
                // tslint:disable-next-line: no-any
                (model as any)._assertNotDisposed = noop;
            }

            // Listen for keydown events. We don't do auto scrolling until the user types something
            this.subscriptions.push(editor.onKeyDown((_e) => (this.keyHasBeenPressed = true)));

            // Register a link opener so when a user clicks on a link we can navigate to it.
            // tslint:disable-next-line: no-any
            const openerService = (editor.getContribution('editor.linkDetector') as any).openerService;
            if (openerService && openerService.open) {
                openerService.open = this.props.openLink;
            }

            // Save the editor and the model in our state.
            this.setState({ editor, model });
            if (this.props.hasFocus) {
                this.giveFocusToEditor(editor, this.props.cursorPos, this.props.options.readOnly);
            }
            if (this.props.theme) {
                monacoEditor.editor.setTheme(this.props.theme);
            }

            // do the initial set of the height (wait a bit)
            this.windowResized();

            // on each edit recompute height (wait a bit)
            if (model) {
                this.subscriptions.push(
                    model.onDidChangeContent(() => {
                        this.windowResized();
                        if (this.state.editor && this.state.editor.hasWidgetFocus()) {
                            this.hideAllOtherHoverAndParameterWidgets();
                        }
                    })
                );
            }

            // On layout recompute height
            this.subscriptions.push(
                editor.onDidLayoutChange(() => {
                    this.windowResized();
                    // Recompute visible line tops
                    this.debouncedComputeLineTops();

                    // A layout change may be because of a new line
                    this.throttledScrollCurrentPosition();
                })
            );

            // Setup our context menu to show up outside. Autocomplete doesn't have this problem so it just works
            this.subscriptions.push(
                editor.onContextMenu((e) => {
                    if (this.state.editor) {
                        const domNode = this.state.editor.getDomNode();
                        const contextMenuElement = domNode
                            ? (domNode.querySelector('.monaco-menu-container') as HTMLElement)
                            : null;
                        if (contextMenuElement) {
                            const posY =
                                e.event.posy + contextMenuElement.clientHeight > window.outerHeight
                                    ? e.event.posy - contextMenuElement.clientHeight
                                    : e.event.posy;
                            const posX =
                                e.event.posx + contextMenuElement.clientWidth > window.outerWidth
                                    ? e.event.posx - contextMenuElement.clientWidth
                                    : e.event.posx;
                            contextMenuElement.style.position = 'fixed';
                            contextMenuElement.style.top = `${Math.max(0, Math.floor(posY))}px`;
                            contextMenuElement.style.left = `${Math.max(0, Math.floor(posX))}px`;
                        }
                    }
                })
            );

            // When editor loses focus, hide parameter widgets (if any currently displayed).
            this.subscriptions.push(
                editor.onDidBlurEditorWidget(() => {
                    this.hideParameterWidget();
                })
            );

            // Track focus changes to make sure we update our widget parent and widget position
            this.subscriptions.push(
                editor.onDidFocusEditorWidget(() => {
                    this.throttledUpdateWidgetPosition();
                    this.updateWidgetParent(editor);
                    this.hideAllOtherHoverAndParameterWidgets();

                    // Also update our scroll position, but do that after focus is established.
                    // This is necessary so that markdown can switch to edit mode before we
                    // try to scroll to it.
                    setTimeout(() => this.throttledScrollCurrentPosition(), 0);
                })
            );

            // Track cursor changes and make sure line is on the screen
            this.subscriptions.push(
                editor.onDidChangeCursorPosition(() => {
                    this.throttledUpdateWidgetPosition();

                    // Do this after the cursor changes so the text has time to appear
                    setTimeout(() => this.throttledScrollCurrentPosition(), 0);
                })
            );

            // Update our margin to include the correct line number style
            this.updateMargin(editor);

            // If we're readonly, monaco is not putting the aria-readonly property on the textarea
            // We should do that
            if (this.props.options.readOnly) {
                this.setAriaReadOnly(editor);
            }

            // Eliminate the find action if possible
            // tslint:disable-next-line: no-any
            const editorAny = editor as any;
            if (editorAny._standaloneKeybindingService) {
                editorAny._standaloneKeybindingService.addDynamicKeybinding('-actions.find');
            }

            // Tell our parent the editor is ready to use
            this.props.editorMounted(editor);

            if (editor) {
                this.subscriptions.push(
                    editor.onMouseMove(() => {
                        this.hideAllOtherHoverAndParameterWidgets();
                    })
                );
            }
        }
    };

    public componentWillUnmount = () => {
        if (this.resizeTimer) {
            window.clearTimeout(this.resizeTimer);
        }

        if (window) {
            window.removeEventListener('resize', this.windowResized);
        }
        if (this.parameterWidget) {
            this.parameterWidget.removeEventListener('mouseleave', this.outermostParentLeave);
            this.parameterWidget = undefined;
        }
        if (this.outermostParent) {
            this.outermostParent.removeEventListener('mouseleave', this.outermostParentLeave);
            this.outermostParent = null;
        }
        if (this.widgetParent) {
            this.widgetParent.remove();
        }

        this.subscriptions.forEach((d) => d.dispose());
        if (this.state.editor) {
            this.state.editor.dispose();
        }

        if (this.styleObserver) {
            this.styleObserver.disconnect();
        }
    };

    // tslint:disable-next-line: cyclomatic-complexity
    public componentDidUpdate(prevProps: IMonacoEditorProps, prevState: IMonacoEditorState) {
        if (this.state.editor) {
            if (prevProps.language !== this.props.language && this.state.model) {
                monacoEditor.editor.setModelLanguage(this.state.model, this.props.language);
            }
            if (prevProps.theme !== this.props.theme && this.props.theme) {
                monacoEditor.editor.setTheme(this.props.theme);
            }
            if (!fastDeepEqual(prevProps.options, this.props.options)) {
                if (prevProps.options.lineNumbers !== this.props.options.lineNumbers) {
                    this.updateMargin(this.state.editor);
                }
                this.state.editor.updateOptions(this.props.options);
                MonacoEditor.lineHeight = 0; // Font size and family come from theoptions.
            }
            if (
                prevProps.value !== this.props.value &&
                this.state.model &&
                this.state.model.getValue() !== this.props.value
            ) {
                this.forceValue(this.props.value, this.props.cursorPos);
            } else if (
                prevProps.version !== this.props.version &&
                this.state.model &&
                this.state.model.getVersionId() < this.props.version
            ) {
                this.forceValue(this.props.value, this.props.cursorPos);
            }
        }

        if (this.visibleLineCount === -1) {
            this.updateEditorSize();
        } else {
            // Debounce the call. This can happen too fast
            this.debouncedUpdateEditorSize();
        }
        // If this is our first time setting the editor, we might need to dynanically modify the styles
        // that the editor generates for the background colors.
        if (!prevState.editor && this.state.editor && this.containerRef.current) {
            this.updateBackgroundStyle();
        }
        if (this.state.editor && !prevProps.hasFocus && this.props.hasFocus) {
            this.giveFocusToEditor(this.state.editor, this.props.cursorPos, this.props.options.readOnly);
        }

        // Reset key press tracking.
        this.keyHasBeenPressed = false;
    }
    public shouldComponentUpdate(
        nextProps: Readonly<IMonacoEditorProps>,
        nextState: Readonly<IMonacoEditorState>,
        // tslint:disable-next-line: no-any
        _nextContext: any
    ): boolean {
        if (!fastDeepEqual(nextProps, this.props)) {
            return true;
        }
        if (nextState === this.state) {
            return false;
        }
        if (nextState.model?.id !== this.state.model?.id) {
            return true;
        }
        return false;
    }
    public render() {
        const measureWidthClassName = this.props.measureWidthClassName
            ? this.props.measureWidthClassName
            : 'measure-width-div';
        return (
            <div className="monaco-editor-outer-container" ref={this.containerRef}>
                <div className={measureWidthClassName} ref={this.measureWidthRef} />
            </div>
        );
    }

    public isSuggesting(): boolean {
        // This should mean our widgetParent has some height
        if (this.widgetParent && this.widgetParent.firstChild && this.widgetParent.firstChild.childNodes.length >= 2) {
            const htmlFirstChild = this.widgetParent.firstChild as HTMLElement;
            const suggestWidget = htmlFirstChild.getElementsByClassName('suggest-widget')[0] as HTMLDivElement;
            const signatureHelpWidget = htmlFirstChild.getElementsByClassName(
                'parameter-hints-widget'
            )[0] as HTMLDivElement;
            return this.isElementVisible(suggestWidget) || this.isElementVisible(signatureHelpWidget);
        }
        return false;
    }

    public getCurrentVisibleLine(): number | undefined {
        return this.getCurrentVisibleLinePosOrIndex((pos, _i) => pos);
    }

    public getVisibleLineCount(): number {
        return this.getVisibleLines().length;
    }

    public giveFocus(cursorPos: CursorPos | monacoEditor.IPosition) {
        if (this.state.editor) {
            this.giveFocusToEditor(this.state.editor, cursorPos, this.props.options.readOnly);
        }
    }

    public getContents(): string {
        if (this.state.model) {
            // Make sure to remove any carriage returns as they're not expected
            // in an ipynb file (and would mess up updates from the file)
            return this.state.model.getValue().replace(/\r/g, '');
        }
        return '';
    }

    public getVersionId(): number {
        return this.state.model ? this.state.model.getVersionId() : 1;
    }

    public getPosition(): monacoEditor.Position | null {
        return this.state.editor!.getPosition();
    }

    public setValue(text: string, cursorPos: CursorPos) {
        if (this.state.model && this.state.editor && this.state.model.getValue() !== text) {
            this.forceValue(text, cursorPos, true);
        }
    }

    /**
     * Give focus to the specified editor and clear the property used to track whether to set focus to an editor or not.
     */
    private giveFocusToEditor(
        editor: monacoEditor.editor.IStandaloneCodeEditor,
        cursorPos: CursorPos | monacoEditor.IPosition,
        readonly?: boolean
    ) {
        if (!readonly) {
            editor.focus();
        }
        if (cursorPos !== CursorPos.Current) {
            const current = editor.getPosition();
            const lineNumber = cursorPos === CursorPos.Top ? 1 : editor.getModel()!.getLineCount();
            const column = current && current.lineNumber === lineNumber ? current.column : 1;
            editor.setPosition({ lineNumber, column });
            this.scrollToCurrentPosition();
        }
    }

    private closeSuggestWidget() {
        // tslint:disable-next-line: no-any
        const suggest = this.state.editor?.getContribution('editor.contrib.suggestController') as any;
        if (suggest && suggest._widget) {
            suggest._widget.getValue().hideWidget();
        }
    }

    private forceValue(text: string, cursorPos: CursorPos | monacoEditor.IPosition, allowNotifications?: boolean) {
        if (this.state.model && this.state.editor) {
            // Save current position. May need it to update after setting.
            const current = this.state.editor.getPosition();

            // Disable change notifications if forcing this value should not allow them
            this.skipNotifications = allowNotifications ? false : true;

            // Close any suggestions that are open
            this.closeSuggestWidget();

            // Change our text.
            this.previousModelValue = text;
            this.state.model.setValue(text);

            this.skipNotifications = false;

            // Compute new position
            if (typeof cursorPos !== 'object') {
                const lineNumber = cursorPos === CursorPos.Top ? 1 : this.state.editor.getModel()!.getLineCount();
                const column = current && current.lineNumber === lineNumber ? current.column : 1;
                this.state.editor.setPosition({ lineNumber, column });
            } else {
                this.state.editor.setPosition(cursorPos);
            }
        }
    }

    private onModelChanged = (e: monacoEditor.editor.IModelContentChangedEvent) => {
        // If not skipping notifications, send an event
        if (!this.skipNotifications && this.state.model && this.state.editor) {
            this.props.modelChanged(generateChangeEvent(e, this.state.model, this.previousModelValue));
            // Any changes from now onw will be considered previous.
            this.previousModelValue = this.getContents();
        }
    };

    private getCurrentVisibleLinePosOrIndex(pickResult: (pos: number, index: number) => number): number | undefined {
        // Convert the current cursor into a top and use that to find which visible
        // line it is in.
        if (this.state.editor) {
            const cursor = this.state.editor.getPosition();
            if (cursor) {
                const top = this.state.editor.getTopForPosition(cursor.lineNumber, cursor.column);
                const count = this.getVisibleLineCount();
                const lineTops = count === this.lineTops.length ? this.lineTops : this.computeLineTops();
                for (let i = 0; i < count; i += 1) {
                    if (top <= lineTops[i].top) {
                        return pickResult(i, lineTops[i].index);
                    }
                }
            }
        }
    }

    private getCurrentVisibleLineIndex(): number | undefined {
        return this.getCurrentVisibleLinePosOrIndex((_pos, i) => i);
    }

    private getVisibleLines(): HTMLDivElement[] {
        if (this.state.editor && this.state.model) {
            // This is going to use just the dom to compute the visible lines
            const editorDom = this.state.editor.getDomNode();
            if (editorDom) {
                return Array.from(editorDom.getElementsByClassName('view-line')) as HTMLDivElement[];
            }
        }
        return [];
    }

    private computeLineTops() {
        const lines = this.getVisibleLines();

        // Lines are not sorted by monaco, so we have to sort them by their top value
        this.lineTops = lines
            .map((l, i) => {
                const match = l.style.top ? /(.+)px/.exec(l.style.top) : null;
                return { top: match ? parseInt(match[0], 10) : Infinity, index: i };
            })
            .sort((a, b) => a.top - b.top);
        return this.lineTops;
    }

    private tryToScrollToCurrentPosition() {
        // Don't scroll if no key has been pressed
        if (!this.keyHasBeenPressed) {
            return;
        }
        this.scrollToCurrentPosition();
    }

    private scrollToCurrentPosition() {
        // Unfortunately during functional tests we hack the line count and the like.
        if (isTestExecution() || !this.props.hasFocus) {
            return;
        }
        // Scroll to the visible line that has our current line. Note: Visible lines are not sorted by monaco
        // so we have to retrieve the current line's index (not its visible position)
        const visibleLineDivs = this.getVisibleLines();
        const current = this.getCurrentVisibleLineIndex();
        if (current !== undefined && current >= 0 && visibleLineDivs[current].scrollIntoView) {
            visibleLineDivs[current].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    private isElementVisible(element: HTMLElement | undefined): boolean {
        if (element && element.clientHeight > 0) {
            // See if it has the visibility set on the style
            const visibility = element.style.visibility;
            return visibility ? visibility !== 'hidden' : true;
        }
        return false;
    }

    private onCommandWillExecute(ev: { commandId: string; args: any[] }) {
        if (ev.commandId === 'paste' && ev.args.length > 0 && ev.args[0].text) {
            // See if same as last paste and within 100ms. This is the error condition.
            const diff = Date.now() - this.lastPasteCommandTime;
            if (diff < 100 && ev.args[0].text && ev.args[0].text === this.lastPasteCommandText) {
                ev.args[0].text = ''; // Turn into an empty paste to null the operation.
            }
            this.lastPasteCommandText = ev.args[0].text;
            this.lastPasteCommandTime = Date.now();
        }
    }

    private setAriaReadOnly(editor: monacoEditor.editor.IStandaloneCodeEditor) {
        const editorDomNode = editor.getDomNode();
        if (editorDomNode) {
            const textArea = editorDomNode.getElementsByTagName('textarea');
            if (textArea && textArea.length > 0) {
                const item = textArea.item(0);
                if (item) {
                    item.setAttribute('aria-readonly', 'true');
                }
            }
        }
    }

    private windowResized = () => {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(this.updateEditorSize.bind(this), 0);
    };

    private startUpdateWidgetPosition = () => {
        this.throttledUpdateWidgetPosition();
    };

    private updateBackgroundStyle = () => {
        if (this.state.editor && this.containerRef.current) {
            let nodes = this.containerRef.current.getElementsByClassName('monaco-editor-background');
            if (nodes && nodes.length > 0) {
                const backgroundNode = nodes[0] as HTMLDivElement;
                if (backgroundNode && backgroundNode.style) {
                    backgroundNode.style.backgroundColor = 'transparent';
                }
            }
            nodes = this.containerRef.current.getElementsByClassName('monaco-editor');
            if (nodes && nodes.length > 0) {
                const editorNode = nodes[0] as HTMLDivElement;
                if (editorNode && editorNode.style) {
                    editorNode.style.backgroundColor = 'transparent';
                }
            }
        }
    };

    private updateWidgetPosition(width?: number) {
        if (this.state.editor && this.widgetParent) {
            // Position should be at the top of the editor.
            const editorDomNode = this.state.editor.getDomNode();
            if (editorDomNode) {
                const rect = editorDomNode.getBoundingClientRect();
                if (rect && (rect.left !== this.lastOffsetLeft || rect.top !== this.lastOffsetTop)) {
                    this.lastOffsetLeft = rect.left;
                    this.lastOffsetTop = rect.top;

                    this.widgetParent.setAttribute(
                        'style',
                        `position: absolute; left: ${rect.left}px; top: ${rect.top}px; width:${
                            width ? width : rect.width
                        }px`
                    );
                }
            }
        } else {
            // If widget parent isn't set yet, try again later
            this.updateWidgetParent(this.state.editor);
            this.throttledUpdateWidgetPosition(width);
        }
    }

    private computeLineHeight(): number {
        if (MonacoEditor.lineHeight <= 0 && this.state.editor) {
            const editorDomNode = this.state.editor.getDomNode();
            if (editorDomNode) {
                const container = editorDomNode.getElementsByClassName('view-lines')[0] as HTMLElement;
                if (container.firstChild && (container.firstChild as HTMLElement).style.height) {
                    const lineHeightPx = (container.firstChild as HTMLElement).style.height;
                    MonacoEditor.lineHeight = parseInt(lineHeightPx, 10);
                } else {
                    return LINE_HEIGHT;
                }
            }
        }
        return MonacoEditor.lineHeight;
    }

    private updateEditorSize() {
        if (
            this.measureWidthRef.current &&
            this.containerRef.current &&
            this.containerRef.current.parentElement &&
            this.containerRef.current.parentElement.parentElement &&
            this.state.editor &&
            this.state.model
        ) {
            const editorDomNode = this.state.editor.getDomNode();
            if (!editorDomNode) {
                return;
            }
            const grandParent = this.containerRef.current.parentElement.parentElement;
            const container = editorDomNode.getElementsByClassName('view-lines')[0] as HTMLElement;
            const currLineCount = Math.max(container.childElementCount, this.state.model.getLineCount());
            const lineHeight = this.computeLineHeight();
            const height = currLineCount * lineHeight + 3; // Fudge factor
            const width = this.measureWidthRef.current.clientWidth - grandParent.offsetLeft - 15; // Leave room for the scroll bar in regular cell table

            const layoutInfo = this.state.editor.getLayoutInfo();
            if (layoutInfo.height !== height || layoutInfo.width !== width || currLineCount !== this.visibleLineCount) {
                // Make sure to attach to a real dom node.
                if (!this.attached && this.state.editor && this.monacoContainer) {
                    this.containerRef.current.appendChild(this.monacoContainer);
                    this.monacoContainer.addEventListener('mousemove', this.onContainerMove);
                }
                this.visibleLineCount = currLineCount;
                this.attached = true;
                this.state.editor.layout({ width, height });

                // Once layout completes, scroll to the current position again. It may have disappeared
                if (!this.pendingLayoutScroll) {
                    this.pendingLayoutScroll = true;
                    setTimeout(() => {
                        this.scrollToCurrentPosition();
                        this.pendingLayoutScroll = false;
                    }, 0);
                }
            }
        }
    }

    private onContainerMove = () => {
        if (!this.widgetParent && !this.state.widgetsReparented && this.monacoContainer) {
            // Only need to do this once, but update the widget parents and move them.
            this.updateWidgetParent(this.state.editor);
            this.startUpdateWidgetPosition();

            // Since only doing this once, remove the listener.
            this.monacoContainer.removeEventListener('mousemove', this.onContainerMove);
        }
    };

    private onHoverLeave = (e: MouseEvent) => {
        // If the hover is active, make sure to hide it.
        if (this.state.editor && this.widgetParent) {
            this.enteredHover = false;

            // Hide only if not still inside the same editor. Monaco will handle closing otherwise
            if (!this.coordsInsideEditor(e.clientX, e.clientY)) {
                // tslint:disable-next-line: no-any
                const hover = this.state.editor.getContribution('editor.contrib.hover') as any;
                if (hover._hideWidgets) {
                    hover._hideWidgets();
                }
            }
        }
    };

    private onHoverEnter = () => {
        if (this.state.editor && this.widgetParent) {
            // If we enter the hover, indicate it so we don't leave
            this.enteredHover = true;
        }
    };

    // tslint:disable-next-line: no-any
    private outermostParentLeave = (e: any) => {
        // Have to bounce this because the leave for the cell is the
        // enter for the hover
        if (this.leaveTimer) {
            clearTimeout(this.leaveTimer);
        }
        this.leaveTimer = window.setTimeout(() => this.outermostParentLeaveBounced(e), 0);
    };

    // tslint:disable-next-line: no-any
    private outermostParentLeaveBounced = (e: MouseEvent) => {
        if (this.state.editor && !this.enteredHover && !this.coordsInsideEditor(e.clientX, e.clientY)) {
            // If we haven't already entered hover, then act like it shuts down
            this.onHoverLeave(e);
            // Possible user is viewing the parameter hints, wait before user moves the mouse.
            // Waiting for 1s is too long to move the mouse and hide the hints (100ms seems like a good fit).
            setTimeout(() => this.hideParameterWidget(), 100);
        }
    };

    private coordsInsideEditor(x: number, y: number): boolean {
        if (this.monacoContainer) {
            const clientRect = this.monacoContainer.getBoundingClientRect();
            if (x >= clientRect.left && x <= clientRect.right && y >= clientRect.top && y <= clientRect.bottom) {
                return true;
            }
        }
        return false;
    }

    /**
     * This will hide the parameter widget if the user is not hovering over
     * the parameter widget for this monaco editor.
     *
     * Notes: See issue https://github.com/microsoft/vscode-python/issues/7851 for further info.
     * Hide the parameter widget if all of the following conditions have been met:
     * - ditor doesn't have focus
     * - Mouse is not over the editor
     * - Mouse is not over (hovering) the parameter widget
     *
     * @private
     * @returns
     * @memberof MonacoEditor
     */
    private hideParameterWidget() {
        if (!this.state.editor || !this.state.editor.getDomNode() || !this.widgetParent) {
            return;
        }
        // Find all elements that the user is hovering over.
        // Its possible the parameter widget is one of them.
        const hoverElements: Element[] = Array.prototype.slice.call(document.querySelectorAll(':hover'));
        // Find all parameter widgets related to this monaco editor that are currently displayed.
        const visibleParameterHintsWidgets: Element[] = Array.prototype.slice.call(
            this.widgetParent.querySelectorAll('.parameter-hints-widget.visible')
        );
        if (hoverElements.length === 0 && visibleParameterHintsWidgets.length === 0) {
            // If user is not hovering over anything and there are no visible parameter widgets,
            // then, we have nothing to do but get out of here.
            return;
        }

        // Find all parameter widgets related to this monaco editor.
        const knownParameterHintsWidgets: HTMLDivElement[] = Array.prototype.slice.call(
            this.widgetParent.querySelectorAll(WidgetCSSSelector.Parameters)
        );

        // Lets not assume we'll have the exact same DOM for parameter widgets.
        // So, just remove the event handler, and add it again later.
        if (this.parameterWidget) {
            this.parameterWidget.removeEventListener('mouseleave', this.outermostParentLeave);
        }
        // These are the classes that will appear on a parameter widget when they are visible.
        const parameterWidgetClasses = ['editor-widget', 'parameter-hints-widget', 'visible'];

        // Find the parameter widget the user is currently hovering over.
        this.parameterWidget = hoverElements.find((item) => {
            if (typeof item.className !== 'string') {
                return false;
            }
            // Check if user is hovering over a parameter widget.
            const classes = item.className.split(' ');
            if (!parameterWidgetClasses.every((cls) => classes.indexOf(cls) >= 0)) {
                // Not all classes required in a parameter hint widget are in this element.
                // Hence this is not a parameter widget.
                return false;
            }

            // Ok, this element that the user is hovering over is a parameter widget.

            // Next, check whether this parameter widget belongs to this monaco editor.
            // We have a list of parameter widgets that belong to this editor, hence a simple lookup.
            return knownParameterHintsWidgets.some((widget) => widget === item);
        });

        if (this.parameterWidget) {
            // We know the user is hovering over the parameter widget for this editor.
            // Hovering could mean the user is scrolling through a large parameter list.
            // We need to add a mouse leave event handler, so as to hide this.
            this.parameterWidget.addEventListener('mouseleave', this.outermostParentLeave);

            // In case the event handler doesn't get fired, have a backup of checking within 1s.
            setTimeout(() => this.hideParameterWidget(), 1000);
            return;
        }
        if (visibleParameterHintsWidgets.length === 0) {
            // There are no parameter widgets displayed for this editor.
            // Hence nothing to do.
            return;
        }
        // If the editor has focus, don't hide the parameter widget.
        // This is the default behavior. Let the user hit `Escape` or click somewhere
        // to forcefully hide the parameter widget.
        if (this.state.editor.hasWidgetFocus()) {
            return;
        }

        // If we got here, then the user is not hovering over the paramter widgets.
        // & the editor doesn't have focus.
        // However some of the parameter widgets associated with this monaco editor are visible.
        // We need to hide them.

        // Solution: Hide the widgets manually.
        this.hideWidgets(this.widgetParent, [WidgetCSSSelector.Parameters]);
    }
    /**
     * Hides widgets such as parameters and hover, that belong to a given parent HTML element.
     *
     * @private
     * @param {HTMLDivElement} widgetParent
     * @param {string[]} selectors
     * @memberof MonacoEditor
     */
    private hideWidgets(widgetParent: HTMLDivElement, selectors: string[]) {
        for (const selector of selectors) {
            for (const widget of Array.from<HTMLDivElement>(widgetParent.querySelectorAll(selector))) {
                widget.setAttribute(
                    'class',
                    widget.className
                        .split(' ')
                        .filter((cls: string) => cls !== 'visible')
                        .join(' ')
                );
                if (widget.style.visibility !== 'hidden') {
                    widget.style.visibility = 'hidden';
                }
            }
        }
    }
    /**
     * Hides the hover and parameters widgets related to other monaco editors.
     * Use this to ensure we only display hover/parameters widgets for current editor (by hiding others).
     *
     * @private
     * @returns
     * @memberof MonacoEditor
     */
    private hideAllOtherHoverAndParameterWidgets() {
        const root = document.getElementById('root');
        if (!root || !this.widgetParent) {
            return;
        }
        const widgetParents: HTMLDivElement[] = Array.prototype.slice.call(
            root.querySelectorAll('div.monaco-editor-pretend-parent')
        );
        widgetParents
            .filter((widgetParent) => widgetParent !== this.widgetParent)
            .forEach((widgetParent) =>
                this.hideWidgets(widgetParent, [WidgetCSSSelector.Parameters, WidgetCSSSelector.Hover])
            );
    }
    private updateMargin(editor: monacoEditor.editor.IStandaloneCodeEditor) {
        const editorNode = editor.getDomNode();
        if (editorNode) {
            try {
                const elements = editorNode.getElementsByClassName('margin-view-overlays');
                if (elements && elements.length) {
                    const margin = elements[0] as HTMLDivElement;

                    // Create  special class name based on the line number property
                    const specialExtra = `margin-view-overlays-border-${this.props.options.lineNumbers}`;
                    if (margin.className && !margin.className.includes(specialExtra)) {
                        margin.className = `margin-view-overlays ${specialExtra}`;
                    }

                    // Watch the scrollable element (it's where the code lines up)
                    const scrollable = editorNode.getElementsByClassName('monaco-scrollable-element');
                    if (!this.watchingMargin && scrollable && scrollable.length && this.styleObserver) {
                        const watching = scrollable[0] as HTMLDivElement;
                        this.watchingMargin = true;
                        this.styleObserver.observe(watching, { attributes: true, attributeFilter: ['style'] });
                    }
                }
            } catch {
                // Ignore if we can't get modify the margin class
            }
        }
    }

    private updateWidgetParent(editor: monacoEditor.editor.IStandaloneCodeEditor | undefined) {
        // Reparent the hover widgets. They cannot be inside anything that has overflow hidden or scrolling or they won't show
        // up overtop of anything. Warning, this is a big hack. If the class name changes or the logic
        // for figuring out the position of hover widgets changes, this won't work anymore.
        // appendChild on a DOM node moves it, but doesn't clone it.
        // https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
        const editorNode = editor ? editor.getDomNode() : undefined;
        if (editor && editorNode && !this.state.widgetsReparented) {
            this.setState({ widgetsReparented: true });
            try {
                const elements = editorNode.getElementsByClassName('overflowingContentWidgets');
                if (elements && elements.length) {
                    const contentWidgets = elements[0] as HTMLDivElement;
                    if (contentWidgets) {
                        // Go up to the document.
                        const document = contentWidgets.getRootNode() as HTMLDocument;

                        // His first child with the id 'root' should be where we want to parent our overflow widgets
                        if (document && document.getElementById) {
                            const root = document.getElementById('root');
                            if (root) {
                                // We need to create a dummy 'monaco-editor' div so that the content widgets get the same styles.
                                this.widgetParent = document.createElement('div', {});
                                this.widgetParent.setAttribute(
                                    'class',
                                    `${editorNode.className} monaco-editor-pretend-parent`
                                );

                                root.appendChild(this.widgetParent);
                                this.widgetParent.appendChild(contentWidgets);

                                // Listen for changes so we can update the position dynamically
                                editorNode.addEventListener('mouseenter', this.startUpdateWidgetPosition);

                                // We also need to trick the editor into thinking mousing over the hover does not
                                // mean the mouse has left the editor.
                                // tslint:disable-next-line: no-any
                                const hover = editor.getContribution('editor.contrib.hover') as any;
                                if (
                                    hover._toUnhook &&
                                    hover._toUnhook._toDispose &&
                                    hover._toUnhook._toDispose &&
                                    hover.contentWidget
                                ) {
                                    // This should mean our 5th element is the event handler for mouse leave. Remove it.
                                    const set = hover._toUnhook._toDispose as Set<IDisposable>;
                                    if (set.size === HOVER_DISPOSABLE_EVENT_COUNT) {
                                        // This is horribly flakey, Is set always guaranteed to put stuff in the same order?
                                        const array = Array.from(set);
                                        array[HOVER_DISPOSABLE_LEAVE_INDEX].dispose();
                                        set.delete(array[HOVER_DISPOSABLE_LEAVE_INDEX]);

                                        // Instead listen to mouse leave for our hover widget
                                        const hoverWidget = this.widgetParent.getElementsByClassName(
                                            'monaco-editor-hover'
                                        )[0] as HTMLElement;
                                        if (hoverWidget) {
                                            hoverWidget.addEventListener('mouseenter', this.onHoverEnter);
                                            hoverWidget.addEventListener('mouseleave', this.onHoverLeave);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // If something fails, then the hover will just work inside the main frame
                if (!this.props.testMode) {
                    logMessage(`Error moving editor widgets: ${e}`);
                }

                // Make sure we don't try moving it around.
                this.widgetParent = undefined;
            }
        }
    }
}
