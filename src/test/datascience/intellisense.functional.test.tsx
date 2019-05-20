// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import { IDisposable } from 'monaco-editor';
import { Disposable } from 'vscode';

import { createDeferred } from '../../client/common/utils/async';
import { HistoryMessageListener } from '../../client/datascience/history/historyMessageListener';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IHistory, IHistoryProvider } from '../../client/datascience/types';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getEditor, runMountedTest, typeCode } from './historyTestHelpers';

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

    function verifyIntellisenseVisible(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedSpan: string) {
        assert.ok(wrapper);
        const editor = getEditor(wrapper);
        assert.ok(editor);
        const domNode = editor.getDOMNode();
        assert.ok(domNode);
        const node = domNode!.querySelector('.monaco-list-row .label-name .highlight') as HTMLElement;
        assert.ok(node);
        assert.equal(node!.innerHTML, expectedSpan, 'Intellisense row not matching');
    }

    function waitForSuggestion(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) : { disposable: IDisposable; promise: Promise<void>} {
        const editorEnzyme = getEditor(wrapper);
        const reactEditor = editorEnzyme.instance() as MonacoEditor;
        const editor = reactEditor.state.editor;
        if (editor) {
            // The suggest controller has a suggest model on it. It has an event
            // that fires when the suggest controller is opened.
            const suggest = editor.getContribution('editor.contrib.suggestController') as any;
            if (suggest && suggest._model) {
                const promise = createDeferred<void>();
                const disposable = suggest._model.onDidSuggest(() => {
                    promise.resolve();
                });
                return {
                    disposable,
                    promise: promise.promise
                };
            }
        }

        return {
            disposable: {
                dispose: noop
            },
            promise: Promise.resolve()
        };
    }

    runMountedTest('Simple autocomplete', async (wrapper) => {
        // Create a history so that it listens to the results.
        const history = await getOrCreateHistory();
        await history.show();

        // Then enter some code. Don't submit, we're just testing that autocomplete appears
        const suggestion = waitForSuggestion(wrapper);
        typeCode(wrapper, 'print');
        await suggestion.promise;
        suggestion.disposable.dispose();
        verifyIntellisenseVisible(wrapper, 'print');
    }, () => { return ioc; });
});
