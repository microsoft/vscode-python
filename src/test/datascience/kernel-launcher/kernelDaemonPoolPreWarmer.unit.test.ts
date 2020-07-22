// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { PythonSettings } from '../../../client/common/configSettings';
import { IConfigurationService, IExperimentsManager, IPythonSettings } from '../../../client/common/types';
import { KernelDaemonPool } from '../../../client/datascience/kernel-launcher/kernelDaemonPool';
import { KernelDaemonPreWarmer } from '../../../client/datascience/kernel-launcher/kernelDaemonPreWarmer';
import {
    IInteractiveWindowProvider,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditorProvider,
    IRawNotebookSupportedService
} from '../../../client/datascience/types';

// tslint:disable: max-func-body-length no-any
suite('DataScience - Kernel Daemon Pool PreWarmer', () => {
    let prewarmer: KernelDaemonPreWarmer;
    let notebookEditorProvider: INotebookEditorProvider;
    let interactiveProvider: IInteractiveWindowProvider;
    let usageTracker: INotebookAndInteractiveWindowUsageTracker;
    let rawNotebookSupported: IRawNotebookSupportedService;
    let configService: IConfigurationService;
    let daemonPool: KernelDaemonPool;
    let settings: IPythonSettings;
    setup(() => {
        notebookEditorProvider = mock<INotebookEditorProvider>();
        interactiveProvider = mock<IInteractiveWindowProvider>();
        usageTracker = mock<INotebookAndInteractiveWindowUsageTracker>();
        daemonPool = mock<KernelDaemonPool>();
        rawNotebookSupported = mock<IRawNotebookSupportedService>();
        configService = mock<IConfigurationService>();
        const experiment = mock<IExperimentsManager>();
        when(experiment.inExperiment(anything())).thenReturn(true);

        // Set up our config settings
        settings = mock(PythonSettings);
        when(configService.getSettings()).thenReturn(instance(settings));
        // tslint:disable-next-line: no-any
        when(settings.datascience).thenReturn({} as any);

        prewarmer = new KernelDaemonPreWarmer(
            instance(notebookEditorProvider),
            instance(interactiveProvider),
            [],
            instance(usageTracker),
            instance(daemonPool),
            instance(rawNotebookSupported),
            instance(configService)
        );
    });
    test('Should not pre-warm daemon pool if ds was never used', async () => {
        when(rawNotebookSupported.supported()).thenResolve(true);
        when(usageTracker.lastInteractiveWindowOpened).thenReturn(undefined);
        when(usageTracker.lastNotebookOpened).thenReturn(undefined);

        await prewarmer.activate(undefined);

        verify(daemonPool.preWarmKernelDaemons()).never();
    });

    test('Should not pre-warm daemon pool raw kernel is not supported', async () => {
        when(rawNotebookSupported.supported()).thenResolve(false);

        await prewarmer.activate(undefined);

        verify(daemonPool.preWarmKernelDaemons()).never();
    });

    test('Prewarm if supported and the date works', async () => {
        when(rawNotebookSupported.supported()).thenResolve(true);
        when(usageTracker.lastInteractiveWindowOpened).thenReturn(new Date());
        when(usageTracker.lastNotebookOpened).thenReturn(new Date());

        await prewarmer.activate(undefined);

        verify(daemonPool.preWarmKernelDaemons()).once();
    });
});
