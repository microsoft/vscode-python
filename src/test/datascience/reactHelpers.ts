// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ComponentClass, configure, ReactWrapper  } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { noop } from '../../client/common/utils/misc';

export function setUpDomEnvironment() {
    // tslint:disable-next-line:no-http-string
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost'});
    const { window } = dom;

    // tslint:disable-next-line:no-string-literal
    global['window'] = window;
    // tslint:disable-next-line:no-string-literal
    global['document'] = window.document;
    // tslint:disable-next-line:no-string-literal
    global['navigator'] = {
        userAgent: 'node.js',
        platform: 'node'
    };
    // tslint:disable-next-line:no-string-literal
    global['self'] = window;
    copyProps(window, global);

    // Special case. Transform needs createRange
    // tslint:disable-next-line:no-string-literal
    global['document'].createRange = () => ({
        createContextualFragment: str => JSDOM.fragment(str),
        setEnd : (endNode, endOffset) => noop(),
        setStart : (startNode, startOffset) => noop(),
        getBoundingClientRect : () => null,
        getClientRects: () => []
    });

    // Another special case. CodeMirror needs selection
    // tslint:disable-next-line:no-string-literal
    global['document'].selection = {
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
    // tslint:disable-next-line:no-eval
    const fetchMod = eval('require')('node-fetch');
    // tslint:disable-next-line:no-string-literal
    global['fetch'] = fetchMod;
    // tslint:disable-next-line:no-string-literal
    global['Request'] = fetchMod.Request;
    // tslint:disable-next-line:no-string-literal
    global['Headers'] = fetchMod.Headers;
    // tslint:disable-next-line:no-string-literal no-eval
    global['WebSocket'] = eval('require')('ws');

    // For the loc test to work, we have to have a global getter for loc strings
    // tslint:disable-next-line:no-string-literal no-eval
    global['getLocStrings'] = () => {
        return { 'DataScience.unknownMimeType' : 'Unknown mime type from helper' };
    };

    global['getInitialSettings'] = () => {
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
            collapseCellInputCodeByDefault: true
        };
    };

    configure({ adapter: new Adapter() });
}

function copyProps(src, target) {
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
