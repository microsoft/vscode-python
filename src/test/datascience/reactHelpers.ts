// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ComponentClass, configure, ReactWrapper } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';
import { DOMWindow, JSDOM } from 'jsdom';
import * as React from 'react';

import { noop } from '../../client/common/utils/misc';

// tslint:disable:no-string-literal no-any object-literal-key-quotes max-func-body-length

export function setUpDomEnvironment() {
    // tslint:disable-next-line:no-http-string
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost'});
    const { window } = dom;

    // tslist:disable-next-line:no-string-literal no-any
    (global as any)['Element'] = window.Element;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['window'] = window;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['document'] = window.document;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['navigator'] = {
        userAgent: 'node.js',
        platform: 'node'
    };
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['getComputedStyle'] = window.getComputedStyle;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['self'] = window;
    copyProps(window, global);

    // Special case. Transform needs createRange
    (global as any)['document'].createRange = () => ({
        createContextualFragment: (str: string) => JSDOM.fragment(str),
        setEnd : (_endNode: any, _endOffset: any) => noop(),
        setStart : (_startNode: any, _startOffset: any) => noop(),
        getBoundingClientRect : () => null,
        getClientRects: () => []
    });

    // Another special case. CodeMirror needs selection
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['document'].selection = {
        anchorNode: null,
        anchorOffset: 0,
        baseNode: null,
        baseOffset: 0,
        extentNode: null,
        extentOffset: 0,
        focusNode: null,
        focusOffset: 0,
        isCollapsed: false,
        rangeCount: 0,
        type: '',
        addRange: (_range: Range) => noop(),
        createRange: () => null,
        collapse: (_parentNode: Node, _offset: number) => noop(),
        collapseToEnd: noop,
        collapseToStart: noop,
        containsNode: (_node: Node, _partlyContained: boolean) => false,
        deleteFromDocument: noop,
        empty: noop,
        extend: (_newNode: Node, _offset: number) => noop(),
        getRangeAt: (_index: number) => null,
        removeAllRanges: noop,
        removeRange: (_range: Range) => noop(),
        selectAllChildren: (_parentNode: Node) => noop(),
        setBaseAndExtent: (_baseNode: Node, _baseOffset: number, _extentNode: Node, _extentOffset: number) => noop(),
        setPosition: (_parentNode: Node, _offset: number) => noop(),
        toString: () => '{Selection}'
    };

    // For Jupyter server to load correctly. It expects the window object to not be defined
    // tslint:disable-next-line:no-eval no-any
    const fetchMod = eval('require')('node-fetch');
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['fetch'] = fetchMod;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['Request'] = fetchMod.Request;
    // tslint:disable-next-line:no-string-literal no-any
    (global as any)['Headers'] = fetchMod.Headers;
    // tslint:disable-next-line:no-string-literal no-eval no-any
    (global as any)['WebSocket'] = eval('require')('ws');

    // For the loc test to work, we have to have a global getter for loc strings
    // tslint:disable-next-line:no-string-literal no-eval no-any
    (global as any)['getLocStrings'] = () => {
        return { 'DataScience.unknownMimeType' : 'Unknown mime type from helper' };
    };

    // tslint:disable-next-line:no-string-literal no-eval no-any
    (global as any)['getInitialSettings'] = () => {
        return {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 10,
            jupyterLaunchRetries: 3,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true,
            showJupyterVariableExplorer: true,
            variableExplorerExclude: 'module;builtin_function_or_method'
        };
    };

    configure({ adapter: new Adapter() });
}

function copyProps(src: any, target: any) {
    const props = Object.getOwnPropertyNames(src)
        .filter(prop => typeof target[prop] === undefined);
    props.forEach((p : string) => {
        target[p] = src[p];
    });
}

function waitForComponentDidUpdate<P, S, C>(component: React.Component<P, S, C>) : Promise<void> {
    return new Promise((resolve, reject) => {
        if (component) {
            let originalUpdateFunc = component.componentDidUpdate;
            if (originalUpdateFunc) {
                originalUpdateFunc = originalUpdateFunc.bind(component);
            }

            // tslint:disable-next-line:no-any
            component.componentDidUpdate = (prevProps: Readonly<P>, prevState: Readonly<S>, snapshot?: any) => {
                // When the component updates, call the original function and resolve our promise
                if (originalUpdateFunc) {
                    originalUpdateFunc(prevProps, prevState, snapshot);
                }

                // Reset our update function
                component.componentDidUpdate = originalUpdateFunc;

                // Finish the promise
                resolve();
            };
        } else {
            reject('Cannot find the component for waitForComponentDidUpdate');
        }
    });
}

export function waitForRender<P, S, C>(component: React.Component<P, S, C>, numberOfRenders: number = 1) : Promise<void> {
    // tslint:disable-next-line:promise-must-complete
    return new Promise((resolve, reject) => {
        if (component) {
            let originalRenderFunc = component.render;
            if (originalRenderFunc) {
                originalRenderFunc = originalRenderFunc.bind(component);
            }
            let renderCount = 0;
            component.render = () => {
                let result : React.ReactNode = null;

                // When the render occurs, call the original function and resolve our promise
                if (originalRenderFunc) {
                    result = originalRenderFunc();
                }
                renderCount += 1;

                if (renderCount === numberOfRenders) {
                    // Reset our render function
                    component.render = originalRenderFunc;
                    resolve();
                }

                return result;
            };
        } else {
            reject('Cannot find the component for waitForRender');
        }
    });
}

export async function waitForUpdate<P, S, C>(wrapper: ReactWrapper<P, S, C>, mainClass: ComponentClass<P>, numberOfRenders: number = 1) : Promise<void> {
    const mainObj = wrapper.find(mainClass).instance();
    if (mainObj) {
        // Hook the render first.
        const renderPromise = waitForRender(mainObj, numberOfRenders);

        // First wait for the update
        await waitForComponentDidUpdate(mainObj);

        // Force a render
        wrapper.update();

        // Wait for the render
        await renderPromise;
    }
}

// map of string chars to keycodes and whether or not shift has to be hit
// this is necessary to generate keypress/keydown events.
// There doesn't seem to be an official way to do this (according to stack overflow)
// so just hardcoding it here.
const keyMap : { [key: string] : { code: number; shift: boolean }} = {
    'A' : { code: 65, shift: false },
    'B' : { code: 66, shift: false },
    'C' : { code: 67, shift: false },
    'D' : { code: 68, shift: false },
    'E' : { code: 69, shift: false },
    'F' : { code: 70, shift: false },
    'G' : { code: 71, shift: false },
    'H' : { code: 72, shift: false },
    'I' : { code: 73, shift: false },
    'J' : { code: 74, shift: false },
    'K' : { code: 75, shift: false },
    'L' : { code: 76, shift: false },
    'M' : { code: 77, shift: false },
    'N' : { code: 78, shift: false },
    'O' : { code: 79, shift: false },
    'P' : { code: 80, shift: false },
    'Q' : { code: 81, shift: false },
    'R' : { code: 82, shift: false },
    'S' : { code: 83, shift: false },
    'T' : { code: 84, shift: false },
    'U' : { code: 85, shift: false },
    'V' : { code: 86, shift: false },
    'W' : { code: 87, shift: false },
    'X' : { code: 88, shift: false },
    'Y' : { code: 89, shift: false },
    'Z' : { code: 90, shift: false },
    '0' : { code: 48, shift: false },
    '1' : { code: 49, shift: false },
    '2' : { code: 50, shift: false },
    '3' : { code: 51, shift: false },
    '4' : { code: 52, shift: false },
    '5' : { code: 53, shift: false },
    '6' : { code: 54, shift: false },
    '7' : { code: 55, shift: false },
    '8' : { code: 56, shift: false },
    '9' : { code: 57, shift: false },
    ')' : { code: 48, shift: true },
    '!' : { code: 49, shift: true },
    '@' : { code: 50, shift: true },
    '#' : { code: 51, shift: true },
    '$' : { code: 52, shift: true },
    '%' : { code: 53, shift: true },
    '^' : { code: 54, shift: true },
    '&' : { code: 55, shift: true },
    '*' : { code: 56, shift: true },
    '(' : { code: 57, shift: true },
    '[' : { code: 219, shift: false },
    '\\' : { code: 209, shift: false },
    ']' : { code: 221, shift: false },
    '{' : { code: 219, shift: true },
    '|' : { code: 209, shift: true },
    '}' : { code: 221, shift: true },
    ';' : { code: 186, shift: false },
    '\'' : { code: 222, shift: false },
    ':' : { code: 186, shift: true },
    '"' : { code: 222, shift: true },
    ',' : { code: 188, shift: false },
    '.' : { code: 190, shift: false },
    '/' : { code: 191, shift: false },
    '<' : { code: 188, shift: true },
    '>' : { code: 190, shift: true },
    '?' : { code: 191, shift: true },
    '`' : { code: 192, shift: false },
    '~' : { code: 192, shift: true },
    ' ' : { code: 32, shift: false },
    '\n' : { code: 13, shift: false },
    '\r' : { code: 0, shift: false } // remove \r from the text.
};

export function createMessageEvent(data: any) : MessageEvent {
    const domWindow = window as DOMWindow;
    return new domWindow.MessageEvent('message', { data });
}

export function createKeyboardEvent(type: string, options: KeyboardEventInit) : KeyboardEvent {
    const domWindow = window as DOMWindow;
    options.bubbles = true;
    options.cancelable = true;

    // charCodes and keyCodes are different things. Compute the keycode for cm to work.
    // This is the key (on an english qwerty keyboard) that would have to be hit to generate the key
    // This site was a great help with the mapping:
    // https://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    const upper = options.key!.toUpperCase();
    const keyCode = keyMap.hasOwnProperty(upper) ? keyMap[upper].code : options.key!.charCodeAt(0);
    const shift = keyMap.hasOwnProperty(upper) ? keyMap[upper].shift || options.shiftKey : options.shiftKey;

    // JSDOM doesn't support typescript so well. The options are supposed to be flexible to support just about anything, but
    // the type KeyboardEventInit only supports the minimum. Stick in extras with some typecasting hacks
    return new domWindow.KeyboardEvent(type, (({ ...options, keyCode, shiftKey: shift } as any) as KeyboardEventInit));
}

export function createInputEvent() : Event {
    const domWindow = window as DOMWindow;
    return new domWindow.Event('input', {bubbles: true, cancelable: false});
}

export function blurWindow() {
    // blur isn't implemented. We just need to dispatch the blur event
    const domWindow = window as DOMWindow;
    const blurEvent = new domWindow.Event('blur', {bubbles: true});
    domWindow.dispatchEvent(blurEvent);
}
