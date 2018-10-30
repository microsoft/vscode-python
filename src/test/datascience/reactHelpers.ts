// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ComponentClass, configure, ReactWrapper  } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';
import { JSDOM } from 'jsdom';
import * as React from 'react';

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
        createContextualFragment: str => JSDOM.fragment(str)
    });

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

function waitForRender<P, S, C>(component: React.Component<P, S, C>) : Promise<void> {
    return new Promise((resolve, reject) => {
        if (component) {
            let originalRenderFunc = component.render;
            if (originalRenderFunc) {
                originalRenderFunc = originalRenderFunc.bind(component);
            }
            component.render = () => {
                let result : React.ReactNode = null;

                // When the render occurs, call the original function and resolve our promise
                if (originalRenderFunc) {
                    result = originalRenderFunc();
                }

                // Reset our render function
                component.render = originalRenderFunc;

                resolve();

                return result;
            };
        } else {
            reject('Cannot find the component for waitForRender');
        }
    });
}

export async function waitForUpdate<P, S, C>(wrapper: ReactWrapper<P, S, C>, mainClass: ComponentClass<P>) : Promise<void> {
    const mainObj = wrapper.find(mainClass).instance();
    if (mainObj) {
        // Hook the render first.
        const renderPromise = waitForRender(mainObj);

        // First wait for the update
        await waitForComponentDidUpdate(mainObj);

        // Force a render
        wrapper.update();

        // Wait for the render
        await renderPromise;
    }
}
