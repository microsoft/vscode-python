// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, EventEmitter, Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { IDisposableRegistry } from '../../client/common/types';
import * as workspaceApis from '../../client/common/vscodeApis/workspaceApis';
import * as envExt from '../../client/envExt/api.internal';
import { getEnvsExplicitFalseScope, registerEnvironmentsExtensionTelemetry } from '../../client/envExt/telemetry';
import * as telemetry from '../../client/telemetry';
import { EventName } from '../../client/telemetry/constants';
import { EnvsExplicitFalseScope } from '../../client/telemetry/types';

type Inspection = {
    defaultValue?: boolean;
    globalValue?: boolean;
    workspaceValue?: boolean;
    workspaceFolderValue?: boolean;
};

function configuration(values?: Inspection): WorkspaceConfiguration {
    const config = typemoq.Mock.ofType<WorkspaceConfiguration>();
    config
        .setup((c) => c.inspect<boolean>('useEnvironmentsExtension'))
        .returns(() => (values ? { key: 'python.useEnvironmentsExtension', ...values } : undefined));
    return config.object;
}

suite('Environments extension telemetry', () => {
    const first: WorkspaceFolder = {
        name: 'first',
        index: 0,
        uri: Uri.file(path.join(process.cwd(), 'first')),
    };
    const second: WorkspaceFolder = {
        name: 'second',
        index: 1,
        uri: Uri.file(path.join(process.cwd(), 'second')),
    };
    let getConfiguration: sinon.SinonStub;
    let getWorkspaceFolders: sinon.SinonStub;
    let sendTelemetryEvent: sinon.SinonStub;
    let changes: EventEmitter<ConfigurationChangeEvent>;
    let disposables: IDisposableRegistry;
    const decisionTelemetry = {
        envsDecisionReason: 'resolvedSettingFalse' as const,
        envsAvailableToHostNow: true,
        envsActiveNow: true,
        envsResolvedSettingNow: false,
        envsCachedDecision: false,
    };

    setup(() => {
        getConfiguration = sinon.stub(workspaceApis, 'getConfiguration').returns(configuration({}));
        getWorkspaceFolders = sinon.stub(workspaceApis, 'getWorkspaceFolders').returns(undefined);
        sendTelemetryEvent = sinon.stub(telemetry, 'sendTelemetryEvent');
        changes = new EventEmitter<ConfigurationChangeEvent>();
        sinon.stub(workspaceApis, 'onDidChangeConfiguration').callsFake((listener) => changes.event(listener));
        sinon.stub(envExt, 'getEnvExtensionDecisionTelemetry').returns(decisionTelemetry);
        disposables = [];
    });

    teardown(() => {
        disposables.forEach((disposable) => disposable.dispose());
        changes.dispose();
        sinon.restore();
    });

    const scopeCases: { inspection: Inspection; expected: EnvsExplicitFalseScope }[] = [
        { inspection: {}, expected: 'none' },
        { inspection: { globalValue: false }, expected: 'user' },
        { inspection: { workspaceValue: false }, expected: 'workspace' },
        { inspection: { workspaceFolderValue: false }, expected: 'folder' },
        { inspection: { globalValue: false, workspaceValue: false }, expected: 'multiple' },
        { inspection: { globalValue: false, workspaceFolderValue: false }, expected: 'multiple' },
        { inspection: { workspaceValue: false, workspaceFolderValue: false }, expected: 'multiple' },
        {
            inspection: { globalValue: false, workspaceValue: false, workspaceFolderValue: false },
            expected: 'multiple',
        },
    ];
    scopeCases.forEach(({ inspection, expected }) => {
        test(`reports ${expected} for ${JSON.stringify(inspection)}`, () => {
            getConfiguration.returns(configuration(inspection));
            getWorkspaceFolders.returns([first]);

            assert.strictEqual(getEnvsExplicitFalseScope(), expected);
            sinon.assert.alwaysCalledWithExactly(getConfiguration, 'python', first.uri);
        });
    });

    [undefined, false, true].forEach((defaultValue) => {
        test(`ignores the default value ${defaultValue}`, () => {
            getConfiguration.returns(configuration({ defaultValue }));

            assert.strictEqual(getEnvsExplicitFalseScope(), 'none');
        });
    });

    test('handles unavailable setting inspection', () => {
        getConfiguration.returns(configuration());

        assert.strictEqual(getEnvsExplicitFalseScope(), 'none');
    });

    test('does not count explicit true settings as opt-outs', () => {
        getWorkspaceFolders.returns([first]);
        getConfiguration.returns(
            configuration({ defaultValue: false, globalValue: true, workspaceValue: true, workspaceFolderValue: true }),
        );

        assert.strictEqual(getEnvsExplicitFalseScope(), 'none');
    });

    test('reports a user false even when higher-precedence values are true', () => {
        getWorkspaceFolders.returns([first]);
        getConfiguration.returns(
            configuration({ globalValue: false, workspaceValue: true, workspaceFolderValue: true }),
        );

        assert.strictEqual(getEnvsExplicitFalseScope(), 'user');
    });

    test('checks later folders with their own configuration scope', () => {
        getWorkspaceFolders.returns([first, second]);
        getConfiguration.withArgs('python', first.uri).returns(configuration({ workspaceFolderValue: true }));
        getConfiguration.withArgs('python', second.uri).returns(configuration({ workspaceFolderValue: false }));

        assert.strictEqual(getEnvsExplicitFalseScope(), 'folder');
        sinon.assert.calledWithExactly(getConfiguration, 'python', second.uri);
    });

    test('multiple false folders are one scope kind', () => {
        getWorkspaceFolders.returns([first, second]);
        getConfiguration.returns(configuration({ workspaceFolderValue: false }));

        assert.strictEqual(getEnvsExplicitFalseScope(), 'folder');
    });

    test('inspects user and workspace settings with no folders', () => {
        getConfiguration.returns(configuration({ globalValue: false, workspaceValue: false }));

        assert.strictEqual(getEnvsExplicitFalseScope(), 'multiple');
        sinon.assert.calledOnceWithExactly(getConfiguration, 'python', undefined);
    });

    test('registration does not emit a configuration-change event', () => {
        registerEnvironmentsExtensionTelemetry(disposables);

        assert.lengthOf(disposables, 1);
        sinon.assert.notCalled(sendTelemetryEvent);
    });

    test('ignores unrelated configuration changes', () => {
        registerEnvironmentsExtensionTelemetry(disposables);
        changes.fire({ affectsConfiguration: (section) => section === 'python.defaultInterpreterPath' });

        sinon.assert.notCalled(sendTelemetryEvent);
        sinon.assert.notCalled(getConfiguration);
    });

    test('emits the current scope when false is added, moved, and removed', () => {
        registerEnvironmentsExtensionTelemetry(disposables);
        const event: ConfigurationChangeEvent = {
            affectsConfiguration: (section) => section === 'python.useEnvironmentsExtension',
        };
        getConfiguration.returns(configuration({ globalValue: false }));
        changes.fire(event);
        getConfiguration.returns(configuration({ workspaceValue: false }));
        changes.fire(event);
        getConfiguration.returns(configuration({ workspaceValue: true }));
        changes.fire(event);

        assert.deepEqual(
            sendTelemetryEvent.getCalls().map((call) => call.args),
            ['user', 'workspace', 'none'].map((envsExplicitFalseScope) => [
                EventName.ENVIRONMENTS_EXTENSION_SETTING_CHANGED,
                undefined,
                { envsExplicitFalseScope, ...decisionTelemetry },
            ]),
        );
    });

    test('uses the current workspace folders on configuration changes', () => {
        registerEnvironmentsExtensionTelemetry(disposables);
        getWorkspaceFolders.returns([second]);
        getConfiguration.withArgs('python', second.uri).returns(configuration({ workspaceFolderValue: false }));
        changes.fire({ affectsConfiguration: () => true });

        sinon.assert.calledOnceWithExactly(
            sendTelemetryEvent,
            EventName.ENVIRONMENTS_EXTENSION_SETTING_CHANGED,
            undefined,
            { envsExplicitFalseScope: 'folder', ...decisionTelemetry },
        );
    });

    test('stops reporting after disposal', () => {
        registerEnvironmentsExtensionTelemetry(disposables);
        disposables.forEach((disposable) => disposable.dispose());
        changes.fire({ affectsConfiguration: () => true });

        sinon.assert.notCalled(sendTelemetryEvent);
    });
});
