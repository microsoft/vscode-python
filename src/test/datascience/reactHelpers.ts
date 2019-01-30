// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ComponentClass, configure, ReactWrapper  } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';
import { JSDOM, DOMWindow } from 'jsdom';
import * as React from 'react';
import { noop } from '../../client/common/utils/misc';
import { strictEqual } from 'assert';
import { ITestResultsService } from '../../client/unittests/common/types';

// tslint:disable:no-string-literal no-any

export function setUpDomEnvironment() {
    // tslint:disable-next-line:no-http-string
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost'});
    const { window } = dom;

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
    (global as any)['self'] = window;
    copyProps(window, global);

    // Special case. Transform needs createRange
    (global as any)['document'].createRange = () => ({
        createContextualFragment: (str: string) => JSDOM.fragment(str),
        setEnd : (endNode: any, endOffset: any) => noop(),
        setStart : (startNode: any, startOffset: any) => noop(),
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
        addRange: (range: Range) => noop(),
        createRange: () => null,
        collapse: (parentNode: Node, offset: number) => noop(),
        collapseToEnd: noop,
        collapseToStart: noop,
        containsNode: (node: Node, partlyContained: boolean) => false,
        deleteFromDocument: noop,
        empty: noop,
        extend: (newNode: Node, offset: number) => noop(),
        getRangeAt: (index: number) => null,
        removeAllRanges: noop,
        removeRange: (range: Range) => noop(),
        selectAllChildren: (parentNode: Node) => noop(),
        setBaseAndExtent: (baseNode: Node, baseOffset: number, extentNode: Node, extentOffset: number) => noop(),
        setPosition: (parentNode: Node, offset: number) => noop(),
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
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true
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

function waitForRender<P, S, C>(component: React.Component<P, S, C>, numberOfRenders: number = 1) : Promise<void> {
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

export function createKeyboardEvent(type: string, options: KeyboardEventInit) : KeyboardEvent {
    const domWindow = window as DOMWindow;
    options.bubbles = true;
    options.cancelable = true;

    // JSDOM doesn't support typescript so well. The options are supposed to be flexible to support just about anything, but
    // the type KeyboardEventInit only supports the minimum. Stick in extras with some typecasting hacks
    const charCode = options.key.charCodeAt(0);
    return new domWindow.KeyboardEvent(type, (({ ...options, keyCode: charCode, charCode: charCode } as any) as KeyboardEventInit));
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
