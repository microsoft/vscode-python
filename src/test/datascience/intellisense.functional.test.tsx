// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import { IDisposable } from 'monaco-editor';
import { Disposable } from 'vscode';

import { createDeferred } from '../../client/common/utils/async';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getOrCreateInteractiveWindow, runMountedTest } from './interactiveWindowTestHelpers';
import { getInteractiveEditor, typeCode } from './testHelpers';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('DataScience Intellisense tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;

    setup(() => {
        ioc = new DataScienceIocContainer();
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

    function getIntellisenseTextLines(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>): string[] {
        assert.ok(wrapper);
        const editor = getInteractiveEditor(wrapper);
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

    function verifyIntellisenseVisible(
        wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
        expectedSpan: string
    ) {
        const innerTexts = getIntellisenseTextLines(wrapper);
        assert.ok(innerTexts.includes(expectedSpan), 'Intellisense row not matching');
    }

    function waitForSuggestion(
        wrapper: ReactWrapper<any, Readonly<{}>, React.Component>
    ): { disposable: IDisposable; promise: Promise<void> } {
        const editorEnzyme = getInteractiveEditor(wrapper);
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

    function clearEditor(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
        const editor = getInteractiveEditor(wrapper);
        const inst = editor.instance() as MonacoEditor;
        inst.state.model!.setValue('');
    }

    runMountedTest(
        'Simple autocomplete',
        async wrapper => {
            // Create an interactive window so that it listens to the results.
            const interactiveWindow = await getOrCreateInteractiveWindow(ioc);
            await interactiveWindow.show();

            // Then enter some code. Don't submit, we're just testing that autocomplete appears
            const suggestion = waitForSuggestion(wrapper);
            typeCode(getInteractiveEditor(wrapper), 'print');
            await suggestion.promise;
            suggestion.disposable.dispose();
            verifyIntellisenseVisible(wrapper, 'print');

            // Force suggestion box to disappear so that shutdown doesn't try to generate suggestions
            // while we're destroying the editor.
            clearEditor(wrapper);
        },
        () => {
            return ioc;
        }
    );

    runMountedTest(
        'Multiple interpreters',
        async wrapper => {
            // Create an interactive window so that it listens to the results.
            const interactiveWindow = await getOrCreateInteractiveWindow(ioc);
            await interactiveWindow.show();

            // Then enter some code. Don't submit, we're just testing that autocomplete appears
            let suggestion = waitForSuggestion(wrapper);
            typeCode(getInteractiveEditor(wrapper), 'print');
            await suggestion.promise;
            suggestion.disposable.dispose();
            verifyIntellisenseVisible(wrapper, 'print');

            // Clear the code
            const editor = getInteractiveEditor(wrapper);
            const inst = editor.instance() as MonacoEditor;
            inst.state.model!.setValue('');

            // Then change our current interpreter
            const interpreterService = ioc.get<IInterpreterService>(IInterpreterService);
            const oldActive = await interpreterService.getActiveInterpreter();
            const interpreters = await interpreterService.getInterpreters();
            if (interpreters.length > 1 && oldActive) {
                const firstOther = interpreters.filter(i => i.path !== oldActive.path);
                ioc.forceSettingsChanged(firstOther[0].path);
                const active = await interpreterService.getActiveInterpreter();
                assert.notDeepEqual(active, oldActive, 'Should have changed interpreter');
            }

            // Type in again, make sure it works (should use the current interpreter in the server)
            suggestion = waitForSuggestion(wrapper);
            typeCode(getInteractiveEditor(wrapper), 'print');
            await suggestion.promise;
            suggestion.disposable.dispose();
            verifyIntellisenseVisible(wrapper, 'print');

            // Force suggestion box to disappear so that shutdown doesn't try to generate suggestions
            // while we're destroying the editor.
            inst.state.model!.setValue('');
        },
        () => {
            return ioc;
        }
    );

    runMountedTest(
        'Jupyter autocomplete',
        async wrapper => {
            if (ioc.mockJupyter) {
                // This test only works when mocking.

                // Create an interactive window so that it listens to the results.
                const interactiveWindow = await getOrCreateInteractiveWindow(ioc);
                await interactiveWindow.show();

                // Then enter some code. Don't submit, we're just testing that autocomplete appears
                const suggestion = waitForSuggestion(wrapper);
                typeCode(getInteractiveEditor(wrapper), 'print');
                await suggestion.promise;
                suggestion.disposable.dispose();
                verifyIntellisenseVisible(wrapper, 'printly');

                // Force suggestion box to disappear so that shutdown doesn't try to generate suggestions
                // while we're destroying the editor.
                clearEditor(wrapper);
            }
        },
        () => {
            return ioc;
        }
    );

    runMountedTest(
        'Jupyter autocomplete not timeout',
        async wrapper => {
            if (ioc.mockJupyter) {
                // This test only works when mocking.

                // Create an interactive window so that it listens to the results.
                const interactiveWindow = await getOrCreateInteractiveWindow(ioc);
                await interactiveWindow.show();

                // Force a timeout on the jupyter completions so that it takes some amount of time
                ioc.mockJupyter.getCurrentSession()!.setCompletionTimeout(100);

                // Then enter some code. Don't submit, we're just testing that autocomplete appears
                const suggestion = waitForSuggestion(wrapper);
                typeCode(getInteractiveEditor(wrapper), 'print');
                await suggestion.promise;
                suggestion.disposable.dispose();
                verifyIntellisenseVisible(wrapper, 'printly');

                // Force suggestion box to disappear so that shutdown doesn't try to generate suggestions
                // while we're destroying the editor.
                clearEditor(wrapper);
            }
        },
        () => {
            return ioc;
        }
    );
});
