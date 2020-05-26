// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../client/common/application/types';
import { DeprecatePythonPath } from '../client/common/experiments/groups';
import { IExperimentsManager, IInterpreterPathService } from '../client/common/types';
import { IServiceContainer } from '../client/ioc/types';
import { hasUserDefinedPythonPath } from '../client/startupTelemetry';

suite('Startup Telemetry - hasUserDefinedPythonPath()', async () => {
    const resource = Uri.parse('a');
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let experimentsManager: TypeMoq.IMock<IExperimentsManager>;
    let interpreterPathService: TypeMoq.IMock<IInterpreterPathService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        experimentsManager = TypeMoq.Mock.ofType<IExperimentsManager>();
        interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        experimentsManager
            .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
            .returns(() => undefined);
        serviceContainer.setup((s) => s.get(IExperimentsManager)).returns(() => experimentsManager.object);
        serviceContainer.setup((s) => s.get(IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup((s) => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
    });

    function setupConfigProvider(): TypeMoq.IMock<WorkspaceConfiguration> {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService
            .setup((w) => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(resource)))
            .returns(() => workspaceConfig.object);
        return workspaceConfig;
    }

    [undefined, 'python'].forEach((globalValue) => {
        [undefined, 'python'].forEach((workspaceValue) => {
            [undefined, 'python'].forEach((workspaceFolderValue) => {
                test(`Return false if using settings equals {globalValue: ${globalValue}, workspaceValue: ${workspaceValue}, workspaceFolderValue: ${workspaceFolderValue}}`, () => {
                    experimentsManager
                        .setup((e) => e.inExperiment(DeprecatePythonPath.experiment))
                        .returns(() => false);
                    const workspaceConfig = setupConfigProvider();
                    // tslint:disable-next-line: no-any
                    workspaceConfig
                        .setup((w) => w.inspect('pythonPath'))
                        // tslint:disable-next-line: no-any
                        .returns(() => ({ globalValue, workspaceValue, workspaceFolderValue } as any));
                    const result = hasUserDefinedPythonPath(resource, serviceContainer.object);
                    expect(result).to.equal(false, 'Should be false');
                });
            });
        });
    });

    test('Return true if using setting value equals something else', () => {
        experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        // tslint:disable-next-line: no-any
        workspaceConfig.setup((w) => w.inspect('pythonPath')).returns(() => ({ globalValue: 'something else' } as any));
        const result = hasUserDefinedPythonPath(resource, serviceContainer.object);
        expect(result).to.equal(true, 'Should be true');
    });

    test('If in Deprecate PythonPath experiment, use the new API to inspect settings', () => {
        experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
        interpreterPathService
            .setup((i) => i.inspect(resource))
            .returns(() => ({}))
            .verifiable(TypeMoq.Times.once());
        hasUserDefinedPythonPath(resource, serviceContainer.object);
        interpreterPathService.verifyAll();
    });
});
