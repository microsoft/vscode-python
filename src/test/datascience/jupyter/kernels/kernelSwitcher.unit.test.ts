// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { PythonSettings } from '../../../../client/common/configSettings';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IConfigurationService, IPythonSettings } from '../../../../client/common/types';
import { Common, DataScience } from '../../../../client/common/utils/localize';
import { Architecture } from '../../../../client/common/utils/platform';
import { JupyterSessionStartError } from '../../../../client/datascience/baseJupyterSession';
import { Commands } from '../../../../client/datascience/constants';
import { JupyterNotebookBase } from '../../../../client/datascience/jupyter/jupyterNotebook';
import { JupyterServerWrapper } from '../../../../client/datascience/jupyter/jupyterServerWrapper';
import { JupyterSessionManagerFactory } from '../../../../client/datascience/jupyter/jupyterSessionManagerFactory';
import { KernelSelector } from '../../../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../../../../client/datascience/jupyter/kernels/kernelSwitcher';
import { LiveKernelModel } from '../../../../client/datascience/jupyter/kernels/types';
import {
    IJupyterKernelSpec,
    IJupyterSessionManagerFactory,
    INotebook,
    INotebookServer
} from '../../../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { noop } from '../../../core';

// tslint:disable: max-func-body-length no-any
suite('Data Science - Kernel Switcher', () => {
    let kernelSwitcher: KernelSwitcher;
    let configService: IConfigurationService;
    let sessionManagerFactory: IJupyterSessionManagerFactory;
    let kernelSelector: KernelSelector;
    let appShell: IApplicationShell;
    let notebook: INotebook;
    let notebookServer: INotebookServer;
    let currentKernel: IJupyterKernelSpec | LiveKernelModel;
    let selectedKernel: LiveKernelModel;
    let selectedKernelSecondTime: LiveKernelModel;
    let selectedInterpreter: PythonInterpreter;
    let settings: IPythonSettings;
    setup(() => {
        notebookServer = mock(JupyterServerWrapper);
        settings = mock(PythonSettings);
        currentKernel = {
            lastActivityTime: new Date(),
            name: 'CurrentKernel',
            numberOfConnections: 0,
            // tslint:disable-next-line: no-any
            session: {} as any
        };
        selectedKernel = {
            lastActivityTime: new Date(),
            name: 'NewKernel',
            numberOfConnections: 0,
            // tslint:disable-next-line: no-any
            session: {} as any
        };
        selectedKernelSecondTime = {
            lastActivityTime: new Date(),
            name: 'SecondKernel',
            numberOfConnections: 0,
            // tslint:disable-next-line: no-any
            session: {} as any
        };
        selectedInterpreter = {
            path: '',
            type: InterpreterType.Conda,
            architecture: Architecture.Unknown,
            sysPrefix: '',
            sysVersion: ''
        };
        notebook = mock(JupyterNotebookBase);
        configService = mock(ConfigurationService);
        sessionManagerFactory = mock(JupyterSessionManagerFactory);
        kernelSelector = mock(KernelSelector);
        appShell = mock(ApplicationShell);

        // tslint:disable-next-line: no-any
        when(settings.datascience).thenReturn({} as any);
        when(notebook.server).thenReturn(instance(notebookServer));
        when(configService.getSettings(anything())).thenReturn(instance(settings));
        kernelSwitcher = new KernelSwitcher(
            instance(configService),
            instance(sessionManagerFactory),
            instance(kernelSelector),
            instance(appShell)
        );
        when(appShell.withProgress(anything(), anything())).thenCall(async (_, cb: () => Promise<void>) => {
            await cb();
        });
    });

    [true, false].forEach(isLocalConnection => {
        // tslint:disable-next-line: max-func-body-length
        suite(isLocalConnection ? 'Local Connection' : 'Remote Connection', () => {
            setup(() => {
                when(notebookServer.getConnectionInfo()).thenReturn({
                    localLaunch: isLocalConnection,
                    baseUrl: '',
                    disconnected: new EventEmitter<number>().event,
                    hostName: '',
                    token: '',
                    localProcExitCode: 0,
                    dispose: noop
                });
            });
            teardown(() => {
                // We should have checked if it was a local connection.
                verify(notebookServer.getConnectionInfo()).atLeast(1);
            });

            [
                { title: 'Without an existing kernel', currentKernel: undefined },
                { title: 'With an existing kernel', currentKernel }
            ].forEach(currentKernelInfo => {
                suite(currentKernelInfo.title, () => {
                    setup(() => {
                        when(notebook.getKernelSpec()).thenReturn(currentKernelInfo.currentKernel);
                    });

                    teardown(() => {
                        verify(notebook.getKernelSpec()).once();

                        if (isLocalConnection) {
                            verify(
                                kernelSelector.selectLocalKernel(
                                    anything(),
                                    anything(),
                                    undefined,
                                    undefined,
                                    currentKernelInfo.currentKernel
                                )
                            ).once();
                        } else {
                            verify(
                                kernelSelector.selectRemoteKernel(
                                    anything(),
                                    anything(),
                                    anything(),
                                    anything(),
                                    anything()
                                )
                            ).once();
                        }
                    });

                    test('Prompt to select local kernel', async () => {
                        when(
                            kernelSelector.selectLocalKernel(
                                anything(),
                                anything(),
                                undefined,
                                undefined,
                                currentKernelInfo.currentKernel
                            )
                        ).thenResolve({});

                        const selection = await kernelSwitcher.switchKernel(instance(notebook));

                        assert.isUndefined(selection);
                    });

                    suite('Kernel Selected', () => {
                        setup(() => {
                            if (isLocalConnection) {
                                when(
                                    kernelSelector.selectLocalKernel(
                                        anything(),
                                        anything(),
                                        undefined,
                                        undefined,
                                        currentKernelInfo.currentKernel
                                    )
                                ).thenResolve({
                                    kernelModel: selectedKernel,
                                    kernelSpec: undefined,
                                    interpreter: selectedInterpreter
                                });
                            } else {
                                when(
                                    kernelSelector.selectRemoteKernel(
                                        anything(),
                                        anything(),
                                        anything(),
                                        anything(),
                                        anything()
                                    )
                                ).thenResolve({
                                    kernelModel: selectedKernel,
                                    kernelSpec: undefined,
                                    interpreter: selectedInterpreter
                                });
                            }
                        });
                        teardown(() => {
                            // Verify display of progress message.
                            verify(appShell.withProgress(anything(), anything())).atLeast(1);
                        });

                        test('Switch to the selected kernel', async () => {
                            when(notebook.setKernelSpec(anything(), anything())).thenResolve();
                            when(notebook.setInterpreter(selectedInterpreter)).thenReturn();

                            const selection = await kernelSwitcher.switchKernel(instance(notebook));

                            assert.isOk(selection);
                            assert.deepEqual(selection?.kernelModel, selectedKernel);
                            assert.deepEqual(selection?.interpreter, selectedInterpreter);
                            assert.deepEqual(selection?.kernelSpec, undefined);
                            verify(notebook.setKernelSpec(anything(), anything())).once();
                            verify(notebook.setInterpreter(selectedInterpreter)).once();
                        });
                        test('Re-throw errors when switching to the selected kernel', async () => {
                            const ex = new Error('Kaboom');
                            when(notebook.setKernelSpec(anything(), anything())).thenReject(ex);

                            const selection = kernelSwitcher.switchKernel(instance(notebook));

                            await assert.isRejected(selection, ex.message);
                            verify(notebook.setInterpreter(selectedInterpreter)).never();
                        });
                        suite('Display error if `JupyterSessionStartError` is throw and retry', () => {
                            setup(function() {
                                if (!isLocalConnection) {
                                    // tslint:disable-next-line: no-invalid-this
                                    this.skip();
                                }
                            });
                            test('Display error', async () => {
                                const ex = new JupyterSessionStartError(new Error('Kaboom'));
                                when(notebook.setKernelSpec(anything(), anything())).thenReject(ex);
                                when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve();

                                const selection = kernelSwitcher.switchKernel(instance(notebook));

                                await assert.isRejected(selection, ex.message);
                                verify(notebook.setInterpreter(selectedInterpreter)).never();
                                const message = DataScience.sessionStartFailedWithKernel().format(
                                    selectedKernel.name,
                                    Commands.ViewJupyterOutput
                                );
                                verify(
                                    appShell.showErrorMessage(
                                        message,
                                        DataScience.selectDifferentKernel(),
                                        Common.cancel()
                                    )
                                ).once();
                            });
                            test('Re-throw error if nothing is selected from prompt', async () => {
                                const ex = new JupyterSessionStartError(new Error('Kaboom'));
                                when(notebook.setKernelSpec(anything(), anything())).thenReject(ex);
                                when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve();

                                const selection = kernelSwitcher.switchKernel(instance(notebook));

                                await assert.isRejected(selection, ex.message);
                                verify(notebook.setInterpreter(selectedInterpreter)).never();
                                const message = DataScience.sessionStartFailedWithKernel().format(
                                    selectedKernel.name,
                                    Commands.ViewJupyterOutput
                                );
                                verify(
                                    appShell.showErrorMessage(
                                        message,
                                        DataScience.selectDifferentKernel(),
                                        Common.cancel()
                                    )
                                ).once();
                            });
                            test('Re-throw error if cancel is selected from prompt', async () => {
                                const ex = new JupyterSessionStartError(new Error('Kaboom'));
                                when(notebook.setKernelSpec(anything(), anything())).thenReject(ex);
                                when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve(
                                    // tslint:disable-next-line: no-any
                                    Common.cancel() as any
                                );

                                const selection = kernelSwitcher.switchKernel(instance(notebook));

                                await assert.isRejected(selection, ex.message);
                                verify(notebook.setInterpreter(selectedInterpreter)).never();
                                const message = DataScience.sessionStartFailedWithKernel().format(
                                    selectedKernel.name,
                                    Commands.ViewJupyterOutput
                                );
                                verify(
                                    appShell.showErrorMessage(
                                        message,
                                        DataScience.selectDifferentKernel(),
                                        Common.cancel()
                                    )
                                ).once();
                            });
                            test('Prompt to select a local kernel if user opts to select a different kernel', async () => {
                                let firstTimeSelectingAKernel = true;
                                let firstTimeSettingAKernel = true;
                                const ex = new JupyterSessionStartError(new Error('Kaboom'));
                                when(notebook.setKernelSpec(anything(), anything())).thenCall(() => {
                                    // If we're setting it the first time, then throw an error.
                                    if (firstTimeSettingAKernel) {
                                        firstTimeSettingAKernel = false;
                                        throw ex;
                                    } else {
                                        // This is the second time, it should succeed without errors.
                                        return;
                                    }
                                });
                                when(
                                    kernelSelector.selectLocalKernel(
                                        anything(),
                                        anything(),
                                        undefined,
                                        anything(),
                                        anything()
                                    )
                                ).thenCall(() => {
                                    // When selecting a kernel the second time, then return a different selection.
                                    firstTimeSelectingAKernel = false;
                                    return {
                                        kernelModel: firstTimeSelectingAKernel
                                            ? selectedKernel
                                            : selectedKernelSecondTime,
                                        kernelSpec: undefined,
                                        interpreter: selectedInterpreter
                                    };
                                });
                                when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve(
                                    // tslint:disable-next-line: no-any
                                    DataScience.selectDifferentKernel() as any
                                );

                                const selection = await kernelSwitcher.switchKernel(instance(notebook));

                                assert.isOk(selection);
                                assert.deepEqual(selection?.kernelModel, selectedKernelSecondTime);
                                assert.deepEqual(selection?.interpreter, selectedInterpreter);
                                assert.deepEqual(selection?.kernelSpec, undefined);
                                verify(notebook.setKernelSpec(anything(), anything())).twice();
                                verify(notebook.setInterpreter(selectedInterpreter)).once();
                                verify(
                                    appShell.showErrorMessage(
                                        anything(),
                                        DataScience.selectDifferentKernel(),
                                        Common.cancel()
                                    )
                                ).once();
                                // first time when user select a kernel, second time is when user selects after failing to switch to the first kernel.
                                verify(
                                    kernelSelector.selectLocalKernel(
                                        anything(),
                                        anything(),
                                        anything(),
                                        anything(),
                                        anything()
                                    )
                                ).twice();
                            });
                        });
                    });
                });
            });
        });
    });
});
