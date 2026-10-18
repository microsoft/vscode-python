// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { IWorkspaceService } from '../../client/common/application/types';
import * as constants from '../../client/common/constants';
import { ITerminalHelper, TerminalShellType } from '../../client/common/terminal/types';
import { IInterpreterPathService } from '../../client/common/types';
import * as envExt from '../../client/envExt/api.internal';
import * as envExtTelemetry from '../../client/envExt/telemetry';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { sendErrorTelemetry, sendStartupTelemetry } from '../../client/startupTelemetry';
import * as telemetry from '../../client/telemetry';
import { EventName } from '../../client/telemetry/constants';
import { IStartupDurations } from '../../client/types';

suite('Startup Telemetry - Environments decision inputs', () => {
    let container: TypeMoq.IMock<IServiceContainer>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let useEnvExtension: sinon.SinonStub;
    let getDecision: sinon.SinonStub;
    let send: sinon.SinonStub;
    let durations: IStartupDurations;

    setup(() => {
        container = TypeMoq.Mock.ofType<IServiceContainer>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        const terminal = TypeMoq.Mock.ofType<ITerminalHelper>();
        terminal.setup((t) => t.identifyTerminalShell()).returns(() => TerminalShellType.bash);
        const interpreter = TypeMoq.Mock.ofType<IInterpreterService>();
        interpreter.setup((i) => i.hasInterpreters(TypeMoq.It.isAny())).returns(async () => false);
        interpreter.setup((i) => i.refreshPromise).returns(() => Promise.resolve());
        interpreter.setup((i) => i.getActiveInterpreter()).returns(async () => undefined);
        interpreter.setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(async () => undefined);
        const paths = TypeMoq.Mock.ofType<IInterpreterPathService>();
        paths
            .setup((p) => p.inspect(TypeMoq.It.isAny()))
            .returns(() => ({
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined,
            }));
        container.setup((c) => c.get(IWorkspaceService)).returns(() => workspace.object);
        container.setup((c) => c.get(ITerminalHelper)).returns(() => terminal.object);
        container.setup((c) => c.get(IInterpreterService)).returns(() => interpreter.object);
        container.setup((c) => c.get(IInterpreterPathService)).returns(() => paths.object);
        sinon.stub(constants, 'isTestExecution').returns(false);
        useEnvExtension = sinon.stub(envExt, 'useEnvExtension').returns(false);
        getDecision = sinon.stub(envExt, 'getEnvironmentsExtensionDecisionTelemetry');
        sinon.stub(envExtTelemetry, 'getEnvsExplicitFalseScope').returns('none');
        send = sinon.stub(telemetry, 'sendTelemetryEvent');
        durations = {
            startActivateTime: 0,
            totalActivateTime: 0,
            totalNonBlockingActivateTime: 0,
            codeLoadingTime: 0,
        };
    });

    teardown(() => sinon.restore());

    [false, true].forEach((available) => {
        [false, true].forEach((enabled) => {
            test(`Trusted startup emits decision inputs: available=${available}, enabled=${enabled}`, async () => {
                workspace.setup((w) => w.isTrusted).returns(() => true);
                useEnvExtension.returns(available && enabled);
                const snapshot = { envsAvailableAtDecision: available, envsEnabledAtDecision: enabled };
                getDecision.returns(snapshot);

                await sendStartupTelemetry(Promise.resolve(), durations, { elapsedTime: 10 }, container.object, false);

                sinon.assert.calledOnceWithExactly(
                    send,
                    EventName.EDITOR_LOAD,
                    durations,
                    sinon.match({
                        ...snapshot,
                        usingEnvironmentsExtension: available && enabled,
                        envsExplicitFalseScope: 'none',
                    }),
                );
                sinon.assert.calledTwice(useEnvExtension);
                sinon.assert.calledOnce(getDecision);
                sinon.assert.callOrder(useEnvExtension, getDecision, send);
            });
        });
    });

    [false, true].forEach((hasDecision) => {
        test(`Untrusted startup reads only existing inputs: hasDecision=${hasDecision}`, async () => {
            workspace.setup((w) => w.isTrusted).returns(() => false);
            const snapshot = { envsAvailableAtDecision: false, envsEnabledAtDecision: true };
            getDecision.returns(hasDecision ? snapshot : undefined);

            await sendStartupTelemetry(Promise.resolve(), durations, { elapsedTime: 10 }, container.object, false);

            sinon.assert.notCalled(useEnvExtension);
            sinon.assert.calledOnce(getDecision);
            sinon.assert.calledOnceWithExactly(send, EventName.EDITOR_LOAD, durations, {
                workspaceFolderCount: 0,
                terminal: TerminalShellType.bash,
                isFirstSession: false,
                envsExplicitFalseScope: 'none',
                ...(hasDecision ? snapshot : {}),
            });
        });
    });

    test('Error-only startup without services leaves inputs absent and does not compute a decision', async () => {
        const error = new Error('activation failed');
        await sendErrorTelemetry(error, durations);
        sinon.assert.calledOnceWithExactly(send, EventName.EDITOR_LOAD, durations, {}, error);
        sinon.assert.notCalled(getDecision);
        sinon.assert.notCalled(useEnvExtension);
    });

    test('Error telemetry with services includes already captured inputs', async () => {
        workspace.setup((w) => w.isTrusted).returns(() => false);
        getDecision.returns({ envsAvailableAtDecision: true, envsEnabledAtDecision: false });
        const error = new Error('activation failed');
        await sendErrorTelemetry(error, durations, container.object);
        sinon.assert.calledOnceWithExactly(
            send,
            EventName.EDITOR_LOAD,
            durations,
            sinon.match({ envsAvailableAtDecision: true, envsEnabledAtDecision: false }),
            error,
        );
        sinon.assert.notCalled(useEnvExtension);
    });

    test('Existing test-execution guard still suppresses startup collection', async () => {
        sinon.restore();
        sinon.stub(constants, 'isTestExecution').returns(true);
        const decision = sinon.spy(envExt, 'getEnvironmentsExtensionDecisionTelemetry');
        const sender = sinon.spy(telemetry, 'sendTelemetryEvent');
        await sendStartupTelemetry(Promise.resolve(), durations, { elapsedTime: 10 }, container.object, false);
        assert.isFalse(decision.called);
        assert.isFalse(sender.called);
    });
});
