// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import { Disposable } from 'vscode';

import { HistoryMessageListener } from '../../client/datascience/history/historyMessageListener';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IHistory, IHistoryProvider } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { runMountedTest, typeCode } from './historyTestHelpers';
import { ILanguageServer } from '../../client/activation/types';
import { MockLanguageServer } from './mockLanguageServer';
import { MockLanguageClient } from './mockLanguageClient';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('DataScience Intellisense tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;

    setup(() => {
        ioc = new DataScienceIocContainer();
        // For this test, jedi is turned off so we use our mock language server
        ioc.changeJediEnabled(false);
        ioc.registerDataScienceTypes();
    });

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
    });

    // suiteTeardown(() => {
    //     asyncDump();
    // });

    async function getOrCreateHistory(): Promise<IHistory> {
        const historyProvider = ioc.get<IHistoryProvider>(IHistoryProvider);
        const result = await historyProvider.getOrCreateActive();

        // During testing the MainPanel sends the init message before our history is created.
        // Pretend like it's happening now
        const listener = ((result as any).messageListener) as HistoryMessageListener;
        listener.onMessage(HistoryMessages.Started, {});

        return result;
    }

    function verifyIntellisenseVisible(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
        assert.ok(wrapper);
    }

    function getCompletionRequestPromise() : Promise<void> {
        const languageServer = ioc.get<ILanguageServer>(ILanguageServer) as MockLanguageServer;
        const languageClient = languageServer.languageClient as MockLanguageClient;
        return languageClient.waitForRequest();
    }

    runMountedTest('Simple autocomplete', async (wrapper) => {
        // Create a history so that it listens to the results.
        const history = await getOrCreateHistory();
        await history.show();

        // Then enter some code. Don't submit, we're just testing that autocomplete appears
        const requestPromise = getCompletionRequestPromise();
        typeCode(wrapper, 'print');
        await requestPromise;
        verifyIntellisenseVisible(wrapper);
    }, () => { return ioc; });
});
