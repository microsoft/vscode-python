// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../client/common/application/types';
import * as constants from '../client/common/constants';
import { ITerminalHelper, TerminalShellType } from '../client/common/terminal/types';
import { IExperimentService, IInterpreterPathService } from '../client/common/types';
import * as envExt from '../client/envExt/api.internal';
import * as envExtTelemetry from '../client/envExt/telemetry';
import { IInterpreterService } from '../client/interpreter/contracts';
import { IServiceContainer } from '../client/ioc/types';
import { hasUserDefinedPythonPath, sendStartupTelemetry } from '../client/startupTelemetry';
import * as telemetry from '../client/telemetry';
import { EventName } from '../client/telemetry/constants';
import { IStartupDurations } from '../client/types';

suite('Startup Telemetry - hasUserDefinedPythonPath()', async () => {
    const resource = Uri.parse('a');
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let experimentsManager: TypeMoq.IMock<IExperimentService>;
    let interpreterPathService: TypeMoq.IMock<IInterpreterPathService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        experimentsManager = TypeMoq.Mock.ofType<IExperimentService>();
        interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer.setup((s) => s.get(IExperimentService)).returns(() => experimentsManager.object);
        serviceContainer.setup((s) => s.get(IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup((s) => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
    });

    suite('Startup Telemetry - explicit Environments opt-out scope', () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let sendTelemetryEvent: sinon.SinonStub;
        let durations: IStartupDurations;

        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            const terminalHelper = TypeMoq.Mock.ofType<ITerminalHelper>();
            terminalHelper.setup((helper) => helper.identifyTerminalShell()).returns(() => TerminalShellType.bash);
            const interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            interpreterService
                .setup((service) => service.hasInterpreters(TypeMoq.It.isAny()))
                .returns(async () => false);
            interpreterService.setup((service) => service.refreshPromise).returns(() => Promise.resolve());
            interpreterService.setup((service) => service.getActiveInterpreter()).returns(async () => undefined);
            const interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
            interpreterPathService
                .setup((service) => service.inspect(TypeMoq.It.isAny()))
                .returns(() => ({
                    globalValue: undefined,
                    workspaceValue: undefined,
                    workspaceFolderValue: undefined,
                }));
            serviceContainer
                .setup((container) => container.get(IWorkspaceService))
                .returns(() => workspaceService.object);
            serviceContainer.setup((container) => container.get(ITerminalHelper)).returns(() => terminalHelper.object);
            serviceContainer
                .setup((container) => container.get(IInterpreterService))
                .returns(() => interpreterService.object);
            serviceContainer
                .setup((container) => container.get(IInterpreterPathService))
                .returns(() => interpreterPathService.object);
            sinon.stub(constants, 'isTestExecution').returns(false);
            sinon.stub(envExt, 'useEnvExtension').returns(false);
            sinon.stub(envExtTelemetry, 'getEnvsExplicitFalseScope').returns('workspace');
            sendTelemetryEvent = sinon.stub(telemetry, 'sendTelemetryEvent');
            durations = {
                totalNonBlockingActivateTime: 0,
                totalActivateTime: 0,
                startActivateTime: 0,
                codeLoadingTime: 0,
            };
        });

        teardown(() => sinon.restore());

        [true, false].forEach((isTrusted) => {
            test(`includes explicit-false scope in startup telemetry when workspace trust is ${isTrusted}`, async () => {
                workspaceService.setup((service) => service.isTrusted).returns(() => isTrusted);

                await sendStartupTelemetry(
                    Promise.resolve(),
                    durations,
                    { elapsedTime: 10 },
                    serviceContainer.object,
                    false,
                );

                sinon.assert.calledOnceWithExactly(
                    sendTelemetryEvent,
                    EventName.EDITOR_LOAD,
                    durations,
                    sinon.match({ envsExplicitFalseScope: 'workspace', isFirstSession: false }),
                );
                if (isTrusted) {
                    expect(sendTelemetryEvent.firstCall.args[2].usingEnvironmentsExtension).to.equal(false);
                }
            });
        });
    });

    [undefined, 'python'].forEach((globalValue) => {
        [undefined, 'python'].forEach((workspaceValue) => {
            [undefined, 'python'].forEach((workspaceFolderValue) => {
                test(`Return false if using settings equals {globalValue: ${globalValue}, workspaceValue: ${workspaceValue}, workspaceFolderValue: ${workspaceFolderValue}}`, () => {
                    interpreterPathService
                        .setup((i) => i.inspect(resource))
                        .returns(() => ({ globalValue, workspaceValue, workspaceFolderValue } as any));
                    const result = hasUserDefinedPythonPath(resource, serviceContainer.object);
                    expect(result).to.equal(false, 'Should be false');
                });
            });
        });
    });

    test('Return true if using setting value equals something else', () => {
        interpreterPathService
            .setup((i) => i.inspect(resource))
            .returns(() => ({ globalValue: 'something else' } as any));
        const result = hasUserDefinedPythonPath(resource, serviceContainer.object);
        expect(result).to.equal(true, 'Should be true');
    });
});
