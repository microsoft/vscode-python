// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
import '../../client/common/extensions';

import * as assert from 'assert';
import { ComponentClass, mount, ReactWrapper } from 'enzyme';
import { parse } from 'node-html-parser';
import * as React from 'react';
import { Disposable } from 'vscode';

import { IPlotViewerProvider } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/plot/mainPanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';

// import { asyncDump } from '../common/asyncDump';
suite('DataScience PlotViewer tests', () => {
    const disposables: Disposable[] = [];
    let plotViewerProvider: IPlotViewerProvider;
    let ioc: DataScienceIocContainer;

    setup(async () => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        await ioc.activate();
    });

    function mountWebView(): ReactWrapper<any, Readonly<{}>, React.Component> {
        // Setup our webview panel
        const mounted = ioc.createWebView(
            () => mount(<MainPanel skipDefault={true} baseTheme={'vscode-light'} testMode={true} />),
            'default'
        );

        // Make sure the plot viewer provider and execution factory in the container is created (the extension does this on startup in the extension)
        plotViewerProvider = ioc.get<IPlotViewerProvider>(IPlotViewerProvider);

        return mounted.wrapper;
    }

    function waitForComponentDidUpdate<P, S, C>(component: React.Component<P, S, C>): Promise<void> {
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

    function waitForRender<P, S, C>(component: React.Component<P, S, C>, numberOfRenders: number = 1): Promise<void> {
        // tslint:disable-next-line:promise-must-complete
        return new Promise((resolve, reject) => {
            if (component) {
                let originalRenderFunc = component.render;
                if (originalRenderFunc) {
                    originalRenderFunc = originalRenderFunc.bind(component);
                }
                let renderCount = 0;
                component.render = () => {
                    let result: React.ReactNode = null;

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

    async function waitForUpdate<P, S, C>(
        wrapper: ReactWrapper<P, S, C>,
        mainClass: ComponentClass<P>,
        numberOfRenders: number = 1
    ): Promise<void> {
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

            // Force a render
            wrapper.update();
        }
    }

    teardown(async () => {
        for (const disposable of disposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
        await ioc.dispose();
        delete (global as any).ascquireVsCodeApi;
    });

    async function waitForPlot(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, svg: string): Promise<void> {
        // Get a render promise with the expected number of renders
        const renderPromise = waitForUpdate(wrapper, MainPanel, 1);

        // Call our function to add a plot
        await plotViewerProvider.showPlot(svg);

        // Wait for all of the renders to go through
        await renderPromise;
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(
        name: string,
        testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>
    ) {
        test(name, async () => {
            const wrapper = mountWebView();
            try {
                await testFunc(wrapper);
            } finally {
                // Make sure to unmount the wrapper or it will interfere with other tests
                if (wrapper && wrapper.length) {
                    wrapper.unmount();
                }
            }
        });
    }

    function verifySvgValue(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, svg: string) {
        const html = wrapper.html();
        const root = parse(html) as any;
        const drawnSvgs = root.querySelectorAll('.injected-svg') as SVGSVGElement[];
        assert.equal(drawnSvgs.length, 1, 'Injected svg not found');
        const expectedSvg = (parse(svg) as any) as SVGSVGElement;
        const drawnSvg = drawnSvgs[0] as SVGSVGElement;
        const drawnPaths = drawnSvg.querySelectorAll('path');
        const expectedPaths = expectedSvg.querySelectorAll('path');
        assert.equal(drawnPaths.length, expectedPaths.length, 'Paths do not match');
        assert.equal(drawnPaths[0].innerHTML, expectedPaths[0].innerHTML, 'Path values do not match');
    }

    const cancelSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><defs><style>.icon-canvas-transparent,.icon-vs-out{fill:#f6f6f6;}.icon-canvas-transparent{opacity:0;}.icon-vs-bg{fill:#424242;}</style></defs><title>Cancel_16xMD</title><g id="canvas"><path class="icon-canvas-transparent" d="M16,0V16H0V0Z"/></g><g id="outline" style="display: none;"><path class="icon-vs-out" d="M10.475,8l3.469,3.47L11.47,13.944,8,10.475,4.53,13.944,2.056,11.47,5.525,8,2.056,4.53,4.53,2.056,8,5.525l3.47-3.469L13.944,4.53Z" style="display: none;"/></g><g id="iconBg"><path class="icon-vs-bg" d="M9.061,8l3.469,3.47-1.06,1.06L8,9.061,4.53,12.53,3.47,11.47,6.939,8,3.47,4.53,4.53,3.47,8,6.939,11.47,3.47l1.06,1.06Z"/></g></svg>`;

    runMountedTest('Simple SVG', async (wrapper) => {
        await waitForPlot(wrapper, cancelSvg);
        verifySvgValue(wrapper, cancelSvg);
    });

    runMountedTest('Export', async (_wrapper) => {
        // Export isn't runnable inside of JSDOM. So this test does nothing.
    });
});
