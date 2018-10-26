// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Custom module loader so we skip .css files that break non webpack wrapped compiles
// tslint:disable-next-line:no-var-requires no-require-imports
const Module = require('module');

// tslint:disable-next-line:no-function-expression
(function() {
    const origRequire = Module.prototype.require;
    const _require = (context, path) => {
        return origRequire.call(context, path);
    };

    Module.prototype.require = function(path) {
        if (path.endsWith('.css')) {
            return '';
        }
        // tslint:disable-next-line:no-invalid-this
        return _require(this, path);
    };
})();

import * as assert from 'assert';
import { mount } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import { IWebPanel, IWebPanelMessage, IWebPanelMessageListener, IWebPanelProvider  } from '../../client/common/application/types';
import { PlatformService } from '../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../client/common/process/types';
import { IDisposableRegistry, ILogger } from '../../client/common/types';
import { Cell } from '../../client/datascience/history-react/cell';
import { MainPanel } from '../../client/datascience/history-react/mainPanel';
import { HistoryProvider } from '../../client/datascience/historyProvider';
import { JupyterServerProvider } from '../../client/datascience/jupyterServerProvider';
import { IVsCodeApi } from '../../client/datascience/react-common/postOffice';
import { IHistoryProvider, IJupyterServerProvider  } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { MockPythonExecutionService } from './executionServiceMock';
import { waitForUpdate } from './reactHelpers';

// tslint:disable-next-line:max-func-body-length
suite('History output tests', () => {
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let logger: TypeMoq.IMock<ILogger>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    const disposables: Disposable[] = [];
    let serverProvider: IJupyterServerProvider;
    let pythonExecutionService : IPythonExecutionService;
    let factory : TypeMoq.IMock<IPythonExecutionFactory>;
    let platformService : IPlatformService;
    let webPanelProvider : TypeMoq.IMock<IWebPanelProvider>;
    let webPanel : TypeMoq.IMock<IWebPanel>;
    let historyProvider : IHistoryProvider;
    let webPanelListener : IWebPanelMessageListener;
    let globalAcquireVsCodeApi : () => IVsCodeApi;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        platformService = new PlatformService();
        logger = TypeMoq.Mock.ofType<ILogger>();
        webPanelProvider = TypeMoq.Mock.ofType<IWebPanelProvider>();
        webPanel = TypeMoq.Mock.ofType<IWebPanel>();
        pythonExecutionService = new MockPythonExecutionService();
        factory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();

        factory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService));
        fileSystem.setup(f => f.getFileHash(TypeMoq.It.isAny())).returns(() => Promise.resolve('42'));
        // tslint:disable-next-line:no-empty
        logger.setup(l => l.logInformation(TypeMoq.It.isAny())).returns((m) => {}); // console.log(m)); // REnable this to debug the server

        // Setup the webpanel provider so that it returns our dummy web panel. It will have to talk to our global JSDOM window so that the react components can link into it
        webPanelProvider.setup(p => p.create(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns((listener : IWebPanelMessageListener, title: string, script: string) => {
            // Keep track of the current listener. It listens to messages through the vscode api
            webPanelListener = listener;

            // Return our dummy web panel
            return webPanel.object;
        });
        webPanel.setup(p => p.postMessage(TypeMoq.It.isAny())).callback((m : IWebPanelMessage) => window.postMessage(m, '*')); // See JSDOM valid target origins
        webPanel.setup(p => p.show());

        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny())).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILogger), TypeMoq.It.isAny())).returns(() => logger.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny())).returns(() => platformService);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IJupyterServerProvider), TypeMoq.It.isAny())).returns(() => serverProvider);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWebPanelProvider), TypeMoq.It.isAny())).returns(() => webPanelProvider.object);
        serverProvider = new JupyterServerProvider(disposables, logger.object, factory.object);
        historyProvider = new HistoryProvider(serviceContainer.object);

        // Setup a global for the acquireVsCodeApi so that the React PostOffice can find it
        globalAcquireVsCodeApi = () : IVsCodeApi => {
            return {
                // tslint:disable-next-line:no-any
                postMessage: (msg: any) => {
                    if (webPanelListener) {
                        webPanelListener.onMessage(msg.type, msg.payload);
                    }
                },
                // tslint:disable-next-line:no-any no-empty
                setState: (msg: any) => {

                },
                // tslint:disable-next-line:no-any no-empty
                getState: () => {
                    return {};
                }
            };
        };
        // tslint:disable-next-line:no-string-literal
        global['acquireVsCodeApi'] = globalAcquireVsCodeApi;
    });

    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
    });

    test('Simple text', async () => {
        if (await serverProvider.isSupported()) {
            // Create our main panel and tie it into the JSDOM
            const wrapper = mount(<MainPanel theme='vscode-light' skipDefault={true} />);

            // Get an update promise so we can wait for the add code
            const updatePromise = waitForUpdate(wrapper, MainPanel);

            // Send some code to the history and make sure it ends up in the html returned from our render
            const history = await historyProvider.getOrCreateHistory();
            await history.addCode('a=1\na', 'foo.py', 2);

            // Wait for the render to go through
            await updatePromise;

            const foundResult = wrapper.find('Cell');
            assert.equal(foundResult.length, 1, 'Didn\'t find any cells being rendered');
        } else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    }).timeout(60000);

    test('Loc React test', async () => {
        // Create our main panel and tie it into the JSDOM
        const wrapper = mount(<MainPanel theme='vscode-light' skipDefault={false} />);

        // Our cell should have been rendered. It should have a method to get a loc string
        const cellFound = wrapper.find('Cell');
        const cell = cellFound.at(0).instance() as Cell;
        assert.equal(cell.getUnknownMimeTypeString(), 'Unknown mime type from helper', 'Unknown mime type did not come from script');
    });

    // Tests to do:
    // 1) Cell output works on different mime types. Could just use a notebook to drive
    // 2) History commands work (export/restart/clear all)
    // 3) Jupyter server commands work (open notebook)
});
