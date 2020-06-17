// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { ComponentClass, mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import { IStartPage } from '../../client/common/startPage/types';
import { StartPage } from '../../datascience-ui/startPage/startPage';
import { DataScienceIocContainer } from '../datascience/dataScienceIocContainer';

suite('StartPage tests', () => {
    let start: IStartPage;
    let ioc: DataScienceIocContainer;

    setup(async () => {
        process.env.UITEST_DISABLE_INSIDERS = '1';
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        await ioc.activate();
    });

    teardown(async () => {
        await ioc.dispose();
    });

    // tslint:disable-next-line: no-any
    function mountWebView(): ReactWrapper<any, Readonly<{}>, React.Component> {
        // Setup our webview panel
        const wrapper = ioc.createWebView(
            () => mount(<StartPage skipDefault={true} baseTheme={'vscode-light'} testMode={true} />),
            'default'
        );

        // Make sure the plot viewer provider and execution factory in the container is created (the extension does this on startup in the extension)
        start = ioc.get<IStartPage>(IStartPage);

        return wrapper;
    }

    // tslint:disable:no-any
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

    async function waitForUpdate<P, S, C>(wrapper: ReactWrapper<P, S, C>, mainClass: ComponentClass<P>): Promise<void> {
        const mainObj = wrapper.find(mainClass).instance();
        if (mainObj) {
            // First wait for the update
            await waitForComponentDidUpdate(mainObj);

            // Force a render
            wrapper.update();
        }
    }

    async function waitForStartPage(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>): Promise<void> {
        // Get a render promise with the expected number of renders
        const renderPromise = waitForUpdate(wrapper, StartPage);

        // Call our function to add a plot
        await start.open();

        // Wait for all of the renders to go through
        await renderPromise;
    }

    const startPageDom =
        '<div class="title-row"><div class="title-icon"><i class="image-button-image"></i></div><div class="title">';

    runMountedTest('Load Start Page', async (wrapper) => {
        await waitForStartPage(wrapper);
        const dom = wrapper.getDOMNode();
        assert.ok(dom.innerHTML.includes(startPageDom), 'DOM is not loading correctly');
    });
});
