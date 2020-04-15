// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { CommandManager } from '../../client/common/application/commandManager';
import { DocumentManager } from '../../client/common/application/documentManager';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { CommandRegistry } from '../../client/datascience/commands/commandRegistry';
import { pruneCell } from '../../client/datascience/common';
import { DataScience } from '../../client/datascience/datascience';
import { DataScienceCodeLensProvider } from '../../client/datascience/editor-integration/codelensprovider';
import { IDataScienceCodeLensProvider } from '../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('DataScience Tests', () => {
    let dataScience: DataScience;
    let cmdManager: CommandManager;
    let codeLensProvider: IDataScienceCodeLensProvider;
    let configService: IConfigurationService;
    let docManager: IDocumentManager;
    let workspaceService: IWorkspaceService;
    let cmdRegistry: CommandRegistry;
    let settings: IPythonSettings;
    let onDidChangeSettings: sinon.SinonStub;
    let onDidChangeActiveTextEditor: sinon.SinonStub;
    setup(() => {
        cmdManager = mock(CommandManager);
        codeLensProvider = mock(DataScienceCodeLensProvider);
        configService = mock(ConfigurationService);
        workspaceService = mock(WorkspaceService);
        cmdRegistry = mock(CommandRegistry);
        docManager = mock(DocumentManager);
        settings = mock(PythonSettings);

        dataScience = new DataScience(
            instance(cmdManager),
            // tslint:disable-next-line: no-any
            [] as any,
            // tslint:disable-next-line: no-any
            { subscriptions: [] } as any,
            instance(codeLensProvider),
            instance(configService),
            instance(docManager),
            instance(workspaceService),
            instance(cmdRegistry)
        );

        onDidChangeSettings = sinon.stub();
        onDidChangeActiveTextEditor = sinon.stub();
        when(configService.getSettings(anything())).thenReturn(instance(settings));
        when(settings.onDidChange).thenReturn(onDidChangeSettings);
        // tslint:disable-next-line: no-any
        when(settings.datascience).thenReturn({} as any);
        when(docManager.onDidChangeActiveTextEditor).thenReturn(onDidChangeActiveTextEditor);
    });

    suite('Activate', () => {
        setup(async () => {
            await dataScience.activate();
        });

        test('Should register commands', async () => {
            verify(cmdRegistry.register()).once();
        });
        test('Should add handler for Settings Changed', async () => {
            assert.ok(onDidChangeSettings.calledOnce);
        });
        test('Should add handler for ActiveTextEditorChanged', async () => {
            assert.ok(onDidChangeActiveTextEditor.calledOnce);
        });
    });

    suite('Cell pruning', () => {
        test('Remove output and execution count from non code', () => {
            const cell: nbformat.ICell = {
                cell_type: 'markdown',
                outputs: [],
                execution_count: '23',
                source: 'My markdown',
                metadata: {}
            };
            const result = pruneCell(cell);
            assert.equal(Object.keys(result).indexOf('outputs'), -1, 'Outputs inside markdown');
            assert.equal(Object.keys(result).indexOf('execution_count'), -1, 'Execution count inside markdown');
        });
        test('Outputs dont contain extra data', () => {
            const cell: nbformat.ICell = {
                cell_type: 'code',
                outputs: [
                    {
                        output_type: 'display_data',
                        extra: {}
                    }
                ],
                execution_count: '23',
                source: 'My source',
                metadata: {}
            };
            const result = pruneCell(cell);
            // tslint:disable-next-line: no-any
            assert.equal((result.outputs as any).length, 1, 'Outputs were removed');
            assert.equal(result.execution_count, '23', 'Output execution count removed');
            const output = (result.outputs as nbformat.IOutput[])[0];
            assert.equal(Object.keys(output).indexOf('extra'), -1, 'Output still has extra data');
            assert.notEqual(Object.keys(output).indexOf('output_type'), -1, 'Output is missing output_type');
        });
        test('Display outputs still have their data', () => {
            const cell: nbformat.ICell = {
                cell_type: 'code',
                execution_count: 2,
                metadata: {},
                outputs: [
                    {
                        output_type: 'display_data',
                        data: {
                            'text/plain': "Box(children=(Label(value='My label'),))",
                            'application/vnd.jupyter.widget-view+json': {
                                version_major: 2,
                                version_minor: 0,
                                model_id: '90c99248d7bb490ca132427de6d1e235'
                            }
                        },
                        metadata: { bob: 'youruncle' }
                    }
                ],
                source: ["line = widgets.Label('My label')\n", 'box = widgets.Box([line])\n', 'box']
            };

            const result = pruneCell(cell);
            // tslint:disable-next-line: no-any
            assert.equal((result.outputs as any).length, 1, 'Outputs were removed');
            assert.equal(result.execution_count, 2, 'Output execution count removed');
            assert.deepEqual(result.outputs, cell.outputs, 'Outputs were modified');
        });
        test('Stream outputs still have their data', () => {
            const cell: nbformat.ICell = {
                cell_type: 'code',
                execution_count: 2,
                metadata: {},
                outputs: [
                    {
                        output_type: 'stream',
                        name: 'stdout',
                        text: 'foobar'
                    }
                ],
                source: ["line = widgets.Label('My label')\n", 'box = widgets.Box([line])\n', 'box']
            };

            const result = pruneCell(cell);
            // tslint:disable-next-line: no-any
            assert.equal((result.outputs as any).length, 1, 'Outputs were removed');
            assert.equal(result.execution_count, 2, 'Output execution count removed');
            assert.deepEqual(result.outputs, cell.outputs, 'Outputs were modified');
        });
        test('Errors outputs still have their data', () => {
            const cell: nbformat.ICell = {
                cell_type: 'code',
                execution_count: 2,
                metadata: {},
                outputs: [
                    {
                        output_type: 'error',
                        ename: 'stdout',
                        evalue: 'stdout is a value',
                        traceback: ['more']
                    }
                ],
                source: ["line = widgets.Label('My label')\n", 'box = widgets.Box([line])\n', 'box']
            };

            const result = pruneCell(cell);
            // tslint:disable-next-line: no-any
            assert.equal((result.outputs as any).length, 1, 'Outputs were removed');
            assert.equal(result.execution_count, 2, 'Output execution count removed');
            assert.deepEqual(result.outputs, cell.outputs, 'Outputs were modified');
        });
        test('Execute result outputs still have their data', () => {
            const cell: nbformat.ICell = {
                cell_type: 'code',
                execution_count: 2,
                metadata: {},
                outputs: [
                    {
                        output_type: 'execute_result',
                        execution_count: '4',
                        data: {
                            'text/plain': "Box(children=(Label(value='My label'),))",
                            'application/vnd.jupyter.widget-view+json': {
                                version_major: 2,
                                version_minor: 0,
                                model_id: '90c99248d7bb490ca132427de6d1e235'
                            }
                        },
                        metadata: { foo: 'bar' }
                    }
                ],
                source: ["line = widgets.Label('My label')\n", 'box = widgets.Box([line])\n', 'box']
            };

            const result = pruneCell(cell);
            // tslint:disable-next-line: no-any
            assert.equal((result.outputs as any).length, 1, 'Outputs were removed');
            assert.equal(result.execution_count, 2, 'Output execution count removed');
            assert.deepEqual(result.outputs, cell.outputs, 'Outputs were modified');
        });
        test('Unrecognized outputs still have their data', () => {
            const cell: nbformat.ICell = {
                cell_type: 'code',
                execution_count: 2,
                metadata: {},
                outputs: [
                    {
                        output_type: 'unrecognized',
                        execution_count: '4',
                        data: {
                            'text/plain': "Box(children=(Label(value='My label'),))",
                            'application/vnd.jupyter.widget-view+json': {
                                version_major: 2,
                                version_minor: 0,
                                model_id: '90c99248d7bb490ca132427de6d1e235'
                            }
                        },
                        metadata: {}
                    }
                ],
                source: ["line = widgets.Label('My label')\n", 'box = widgets.Box([line])\n', 'box']
            };

            const result = pruneCell(cell);
            // tslint:disable-next-line: no-any
            assert.equal((result.outputs as any).length, 1, 'Outputs were removed');
            assert.equal(result.execution_count, 2, 'Output execution count removed');
            assert.deepEqual(result.outputs, cell.outputs, 'Outputs were modified');
        });
    });
});
