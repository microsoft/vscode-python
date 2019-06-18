// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import { IDisposable } from 'monaco-editor';
import { Disposable } from 'vscode';

import { createDeferred } from '../../client/common/utils/async';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-window/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-window/interactiveWindowTypes';
import { IInteractiveWindow, IInteractiveWindowProvider } from '../../client/datascience/types';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getEditor, runMountedTest, typeCode } from './interactiveWindowTestHelpers';

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

    async function getOrCreateInteractiveWindow(): Promise<IInteractiveWindow> {
        const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        const result = await interactiveWindowProvider.getOrCreateActive();

        // During testing the MainPanel sends the init message before our interactive window is created.
        // Pretend like it's happening now
        const listener = ((result as any).messageListener) as InteractiveWindowMessageListener;
        listener.onMessage(InteractiveWindowMessages.Started, {});

        return result;
    }

    function getIntellisenseTextLines(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) : string[] {
        assert.ok(wrapper);
        const editor = getEditor(wrapper);
        assert.ok(editor);
        const domNode = editor.getDOMNode();
        assert.ok(domNode);
        const nodes = domNode!.getElementsByClassName('monaco-list-row');
        assert.ok(nodes && nodes.length);
        const innerTexts: string[] = [];
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes.item(i) as HTMLElement;
            const content = node.textContent;
            if (content) {
                innerTexts.push(content);
            }
        }
        return innerTexts;
    }

    function verifyIntellisenseVisible(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedSpan: string) {
        const innerTexts = getIntellisenseTextLines(wrapper);
        assert.ok(innerTexts.includes(expectedSpan), 'Intellisense row not matching');
    }

    function verifyIntellisenseMissing(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedSpan: string) {
        const innerTexts = getIntellisenseTextLines(wrapper);
        assert.ok(!innerTexts.includes(expectedSpan), 'Intellisense row was found when not expected');
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
        // Create an interactive window so that it listens to the results.
        const interactiveWindow = await getOrCreateInteractiveWindow();
        await interactiveWindow.show();

        // Then enter some code. Don't submit, we're just testing that autocomplete appears
        const suggestion = waitForSuggestion(wrapper);
        typeCode(wrapper, 'print');
        await suggestion.promise;
        suggestion.disposable.dispose();
        verifyIntellisenseVisible(wrapper, 'print');
    }, () => { return ioc; });

    runMountedTest('Jupyter autocomplete', async (wrapper) => {
        if (ioc.mockJupyter) {
            // This test only works when mocking.

            // Create an interactive window so that it listens to the results.
            const interactiveWindow = await getOrCreateInteractiveWindow();
            await interactiveWindow.show();

            // Then enter some code. Don't submit, we're just testing that autocomplete appears
            const suggestion = waitForSuggestion(wrapper);
            typeCode(wrapper, 'print');
            await suggestion.promise;
            suggestion.disposable.dispose();
            verifyIntellisenseVisible(wrapper, 'printly');
        }
    }, () => { return ioc; });

    runMountedTest('Jupyter autocomplete timeout', async (wrapper) => {
        if (ioc.mockJupyter) {
            // This test only works when mocking.

            // Create an interactive window so that it listens to the results.
            const interactiveWindow = await getOrCreateInteractiveWindow();
            await interactiveWindow.show();

            // Force a timeout on the jupyter completions
            ioc.mockJupyter.getCurrentSession()!.setCompletionTimeout(1000);

            // Then enter some code. Don't submit, we're just testing that autocomplete appears
            const suggestion = waitForSuggestion(wrapper);
            typeCode(wrapper, 'print');
            await suggestion.promise;
            suggestion.disposable.dispose();
            verifyIntellisenseMissing(wrapper, 'printly');
        }
    }, () => { return ioc; });
});
