// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import { IDisposable } from 'monaco-editor';
import { Disposable } from 'vscode';

import { nbformat } from '@jupyterlab/coreutils';
import { LanguageServerType } from '../../client/activation/types';
import { createDeferred } from '../../client/common/utils/async';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { takeSnapshot, writeDiffSnapshot } from './helpers';
import * as InteractiveHelpers from './interactiveWindowTestHelpers';
import * as NativeHelpers from './nativeEditorTestHelpers';
import { addMockData, enterEditorKey, getInteractiveEditor, getNativeEditor, typeCode } from './testHelpers';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
[LanguageServerType.Microsoft, LanguageServerType.Node].forEach((languageServerType) => {
    suite(`DataScience Intellisense tests with ${languageServerType} LanguageServer mocked`, () => {
        const disposables: Disposable[] = [];
        let ioc: DataScienceIocContainer;
        let snapshot: any;

        suiteSetup(() => {
            snapshot = takeSnapshot();
        });

        setup(async () => {
            ioc = new DataScienceIocContainer();
            ioc.registerDataScienceTypes(false, languageServerType);
            return ioc.activate();
        });

        suiteTeardown(() => {
            writeDiffSnapshot(snapshot, 'Intellisense');
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

        function getHoverText(
            type: 'Interactive' | 'Native',
            wrapper: ReactWrapper<any, Readonly<{}>, React.Component>
        ): string {
            assert.ok(wrapper);
            const editor = type === 'Interactive' ? getInteractiveEditor(wrapper) : getNativeEditor(wrapper, 0);
            assert.ok(editor);
            const domNode = editor?.getDOMNode();
            assert.ok(domNode);
            const nodes = domNode!.getElementsByClassName('hover-contents');
            assert.ok(nodes && nodes.length);
            const innerTexts: string[] = [];
            for (let i = 0; i < nodes.length; i += 1) {
                const node = nodes.item(i) as HTMLElement;
                const content = node.textContent;
                if (content) {
                    innerTexts.push(content);
                }
            }
            return innerTexts.join('');
        }

        function verifyIntellisenseVisible(
            wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
            expectedSpan: string
        ) {
            const innerTexts = getIntellisenseTextLines(wrapper);
            assert.ok(innerTexts.includes(expectedSpan), 'Intellisense row not matching');
        }

        function verifyIntellisenseNotVisible(
            wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
            expectedSpan: string
        ) {
            const innerTexts = getIntellisenseTextLines(wrapper);
            assert.ok(!innerTexts.includes(expectedSpan), 'Intellisense row is showing');
        }

        function verifyHoverVisible(
            type: 'Interactive' | 'Native',
            wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
            expectedSpan: string
        ) {
            const innerText = getHoverText(type, wrapper);
            assert.ok(innerText.includes(expectedSpan), `${innerText} not matching ${expectedSpan}`);
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

        function waitForHover(
            type: 'Interactive' | 'Native',
            wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
            line: number,
            column: number
        ): Promise<void> {
            wrapper.update();
            const editorEnzyme = type === 'Interactive' ? getInteractiveEditor(wrapper) : getNativeEditor(wrapper, 0);
            const reactEditor = editorEnzyme?.instance() as MonacoEditor;
            const editor = reactEditor.state.editor;
            if (editor) {
                // The hover controller has a hover model on it. It has an event
                // that fires when the hover controller is opened.
                const hover = editor.getContribution('editor.contrib.hover') as any;
                if (hover && hover.contentWidget) {
                    const promise = createDeferred<void>();
                    const timer = setTimeout(() => {
                        promise.reject(new Error('Timed out waiting for hover'));
                    }, 10000);
                    const originalShowAt = hover.contentWidget.showAt.bind(hover.contentWidget);
                    hover.contentWidget.showAt = (p: any, r: any, f: any) => {
                        clearTimeout(timer);
                        promise.resolve();
                        hover.contentWidget.showAt = originalShowAt;
                        originalShowAt(p, r, f);
                    };
                    hover.contentWidget.startShowingAt(
                        { startLineNumber: line, endLineNumber: line, startColumn: column, endColumn: column },
                        0,
                        false
                    );
                    return promise.promise;
                }
            }

            return Promise.reject(new Error('Hover not found'));
        }

        function clearEditor(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
            const editor = getInteractiveEditor(wrapper);
            const inst = editor.instance() as MonacoEditor;
            inst.state.model!.setValue('');
        }

        InteractiveHelpers.runMountedTest(
            'Simple autocomplete',
            async (wrapper) => {
                // Create an interactive window so that it listens to the results.
                const interactiveWindow = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
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

        InteractiveHelpers.runMountedTest(
            'Multiple interpreters',
            async (wrapper) => {
                // Create an interactive window so that it listens to the results.
                const interactiveWindow = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
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
                const oldActive = await interpreterService.getActiveInterpreter(undefined);
                const interpreters = await interpreterService.getInterpreters(undefined);
                if (interpreters.length > 1 && oldActive) {
                    const firstOther = interpreters.filter((i) => i.path !== oldActive.path);
                    ioc.forceSettingsChanged(undefined, firstOther[0].path);
                    const active = await interpreterService.getActiveInterpreter(undefined);
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

        InteractiveHelpers.runMountedTest(
            'Jupyter autocomplete',
            async (wrapper) => {
                if (ioc.mockJupyter) {
                    // This test only works when mocking.

                    // Create an interactive window so that it listens to the results.
                    const interactiveWindow = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
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

        InteractiveHelpers.runMountedTest(
            'Jupyter autocomplete not timeout',
            async (wrapper) => {
                if (ioc.mockJupyter) {
                    // This test only works when mocking.

                    // Create an interactive window so that it listens to the results.
                    const interactiveWindow = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
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

        InteractiveHelpers.runMountedTest(
            'Filtered Jupyter autocomplete, verify magic commands appear',
            async (wrapper) => {
                if (ioc.mockJupyter) {
                    // This test only works when mocking.

                    // Create an interactive window so that it listens to the results.
                    const interactiveWindow = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
                    await interactiveWindow.show();

                    // Then enter some code. Don't submit, we're just testing that autocomplete appears
                    const suggestion = waitForSuggestion(wrapper);
                    typeCode(getInteractiveEditor(wrapper), 'print');
                    enterEditorKey(wrapper, { code: ' ', ctrlKey: true });
                    await suggestion.promise;
                    suggestion.disposable.dispose();
                    verifyIntellisenseNotVisible(wrapper, '%%bash');

                    // Force suggestion box to disappear so that shutdown doesn't try to generate suggestions
                    // while we're destroying the editor.
                    clearEditor(wrapper);
                }
            },
            () => {
                return ioc;
            }
        );

        InteractiveHelpers.runMountedTest(
            'Filtered Jupyter autocomplete, verify magic commands are filtered',
            async (wrapper) => {
                if (ioc.mockJupyter) {
                    // This test only works when mocking.

                    // Create an interactive window so that it listens to the results.
                    const interactiveWindow = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
                    await interactiveWindow.show();

                    // Then enter some code. Don't submit, we're just testing that autocomplete appears
                    const suggestion = waitForSuggestion(wrapper);
                    typeCode(getInteractiveEditor(wrapper), ' ');
                    enterEditorKey(wrapper, { code: ' ', ctrlKey: true });
                    await suggestion.promise;
                    suggestion.disposable.dispose();
                    verifyIntellisenseVisible(wrapper, '%%bash');

                    // Force suggestion box to disappear so that shutdown doesn't try to generate suggestions
                    // while we're destroying the editor.
                    clearEditor(wrapper);
                }
            },
            () => {
                return ioc;
            }
        );
        const notebookJSON: nbformat.INotebookContent = {
            nbformat: 4,
            nbformat_minor: 2,
            cells: [
                {
                    cell_type: 'code',
                    execution_count: 1,
                    metadata: {
                        collapsed: true
                    },
                    outputs: [
                        {
                            data: {
                                'text/plain': ['1']
                            },
                            output_type: 'execute_result',
                            execution_count: 1,
                            metadata: {}
                        }
                    ],
                    source: ['a=1\n', 'a']
                },
                {
                    cell_type: 'code',
                    execution_count: 2,
                    metadata: {},
                    outputs: [
                        {
                            data: {
                                'text/plain': ['2']
                            },
                            output_type: 'execute_result',
                            execution_count: 2,
                            metadata: {}
                        }
                    ],
                    source: ['b=2\n', 'b']
                },
                {
                    cell_type: 'code',
                    execution_count: 3,
                    metadata: {},
                    outputs: [
                        {
                            data: {
                                'text/plain': ['3']
                            },
                            output_type: 'execute_result',
                            execution_count: 3,
                            metadata: {}
                        }
                    ],
                    source: ['c=3\n', 'c']
                }
            ],
            metadata: {
                orig_nbformat: 4,
                kernelspec: {
                    display_name: 'JUNK',
                    name: 'JUNK'
                },
                language_info: {
                    name: 'python',
                    version: '1.2.3'
                }
            }
        };
        NativeHelpers.runMountedTest(
            'Hover on notebook',
            async (wrapper) => {
                // Create an notebook so that it listens to the results.
                const notebook = await NativeHelpers.openEditor(ioc, JSON.stringify(notebookJSON));
                await notebook.show();

                // Cause a hover event over the first character
                await waitForHover('Native', wrapper, 1, 1);
                verifyHoverVisible('Native', wrapper, 'a=1\na');
                await NativeHelpers.closeNotebook(notebook, wrapper);
            },
            () => {
                return ioc;
            }
        );

        InteractiveHelpers.runMountedTest(
            'Hover on interactive',
            async (wrapper) => {
                // Create an interactive window so that it listens to the results.
                const window = await InteractiveHelpers.getOrCreateInteractiveWindow(ioc);
                addMockData(ioc, 'a=1\na', 1);
                addMockData(ioc, 'b=2\nb', 2);

                await InteractiveHelpers.addCode(ioc, wrapper, 'a=1\na');
                await InteractiveHelpers.addCode(ioc, wrapper, 'b=2\nb');

                // Cause a hover event over the first character
                await waitForHover('Interactive', wrapper, 1, 1);
                verifyHoverVisible('Interactive', wrapper, 'a=1\na\nb=2\nb');

                await InteractiveHelpers.closeInteractiveWindow(window, wrapper);
            },
            () => {
                return ioc;
            }
        );
    });
});
