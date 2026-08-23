// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Disposable, EventEmitter, Uri } from 'vscode';
import { FileChangeType } from '../../client/common/platform/fileSystemWatcher';
import * as apiInternal from '../../client/envExt/api.internal';
import { createEnvExtApi } from '../../client/envExt/envExtApi';
import {
    DidChangeEnvironmentEventArgs,
    DidChangeEnvironmentsEventArgs,
    EnvironmentChangeKind,
    PythonEnvironment,
    PythonEnvironmentApi,
} from '../../client/envExt/types';
import { PythonEnvCollectionChangedEvent } from '../../client/pythonEnvironments/base/watcher';

function buildCondaEnvironment(
    name: string,
    version: string,
    prefix: string,
    executable = Uri.joinPath(Uri.file(prefix), 'bin', 'python').fsPath,
): PythonEnvironment {
    return {
        envId: { id: `${name}-${version}`, managerId: 'ms-python.python:conda' },
        name,
        displayName: `${name} (${version})`,
        displayPath: prefix,
        version,
        environmentPath: Uri.file(prefix),
        execInfo: { run: { executable } },
        sysPrefix: prefix,
    };
}

suite('Python Environments extension discovery adapter', () => {
    let environmentChanges: EventEmitter<DidChangeEnvironmentsEventArgs>;
    let activeEnvironmentChanges: EventEmitter<DidChangeEnvironmentEventArgs>;
    let disposables: Disposable[];
    let envExtApi: PythonEnvironmentApi;

    setup(() => {
        environmentChanges = new EventEmitter<DidChangeEnvironmentsEventArgs>();
        activeEnvironmentChanges = new EventEmitter<DidChangeEnvironmentEventArgs>();
        disposables = [];
        envExtApi = ({
            onDidChangeEnvironments: environmentChanges.event,
            onDidChangeEnvironment: activeEnvironmentChanges.event,
            refreshEnvironments: sinon.stub().resolves(),
            resolveEnvironment: sinon.stub().resolves(undefined),
        } as unknown) as PythonEnvironmentApi;
        sinon.stub(apiInternal, 'getEnvExtApi').resolves(envExtApi);
    });

    teardown(() => {
        disposables.forEach((disposable) => disposable.dispose());
        environmentChanges.dispose();
        activeEnvironmentChanges.dispose();
        sinon.restore();
    });

    test('skips a no-Python Conda environment without dropping later valid environments', async () => {
        const api = await createEnvExtApi(disposables);
        const noPython = buildCondaEnvironment('empty', 'no-python', '/conda/envs/empty', '/conda/bin/conda');
        const first = buildCondaEnvironment('first', '3.12.1', '/conda/envs/first');
        const second = buildCondaEnvironment('second', '3.11.9', '/conda/envs/second');
        const events: PythonEnvCollectionChangedEvent[] = [];
        disposables.push(api.onChanged((event) => events.push(event)));

        expect(() =>
            environmentChanges.fire([
                { kind: EnvironmentChangeKind.add, environment: noPython },
                { kind: EnvironmentChangeKind.add, environment: first },
                { kind: EnvironmentChangeKind.add, environment: second },
            ]),
        ).not.to.throw();

        expect(api.getEnvs().map((env) => env.executable.filename)).to.deep.equal([
            first.execInfo.run.executable,
            second.execInfo.run.executable,
        ]);
        expect(events.map((event) => event.type)).to.deep.equal([FileChangeType.Created, FileChangeType.Created]);
    });

    test('isolates an unexpected invalid version from later environments in the batch', async () => {
        const api = await createEnvExtApi(disposables);
        const first = buildCondaEnvironment('first', '3.12.1', '/conda/envs/first');
        const invalid = buildCondaEnvironment('invalid', 'not-a-version', '/conda/envs/invalid');
        const second = buildCondaEnvironment('second', '3.11.9', '/conda/envs/second');

        expect(() =>
            environmentChanges.fire([
                { kind: EnvironmentChangeKind.add, environment: first },
                { kind: EnvironmentChangeKind.add, environment: invalid },
                { kind: EnvironmentChangeKind.add, environment: second },
            ]),
        ).not.to.throw();

        expect(api.getEnvs().map((env) => env.executable.filename)).to.deep.equal([
            first.execInfo.run.executable,
            second.execInfo.run.executable,
        ]);
    });

    test('isolates a structurally malformed event from later environments in the batch', async () => {
        const api = await createEnvExtApi(disposables);
        const valid = buildCondaEnvironment('valid', '3.12.1', '/conda/envs/valid');

        expect(() =>
            environmentChanges.fire([
                ({
                    kind: EnvironmentChangeKind.remove,
                    environment: undefined,
                } as unknown) as DidChangeEnvironmentsEventArgs[number],
                { kind: EnvironmentChangeKind.add, environment: valid },
            ]),
        ).not.to.throw();

        expect(api.getEnvs().map((env) => env.executable.filename)).to.deep.equal([valid.execInfo.run.executable]);
    });

    test('does not publish an active-environment event for a no-Python environment', async () => {
        const api = await createEnvExtApi(disposables);
        const noPython = buildCondaEnvironment('empty', 'no-python', '/conda/envs/empty', '/conda/bin/conda');
        const events: PythonEnvCollectionChangedEvent[] = [];
        disposables.push(api.onChanged((event) => events.push(event)));

        expect(() => activeEnvironmentChanges.fire({ uri: undefined, old: undefined, new: noPython })).not.to.throw();

        expect(events).to.be.empty;
        expect(api.getEnvs()).to.be.empty;
    });

    test('does not publish a partial active-environment change when one side is invalid', async () => {
        const api = await createEnvExtApi(disposables);
        const noPython = buildCondaEnvironment('empty', 'no-python', '/conda/envs/empty', '/conda/bin/conda');
        const valid = buildCondaEnvironment('valid', '3.12.1', '/conda/envs/valid');
        const events: PythonEnvCollectionChangedEvent[] = [];
        disposables.push(api.onChanged((event) => events.push(event)));

        activeEnvironmentChanges.fire({ uri: Uri.file('/workspace'), old: noPython, new: valid });

        expect(events).to.be.empty;
    });

    test('preserves valid active-environment changes', async () => {
        const api = await createEnvExtApi(disposables);
        const oldEnvironment = buildCondaEnvironment('old', '3.11.9', '/conda/envs/old');
        const newEnvironment = buildCondaEnvironment('new', '3.12.1', '/conda/envs/new');
        const events: PythonEnvCollectionChangedEvent[] = [];
        disposables.push(api.onChanged((event) => events.push(event)));

        activeEnvironmentChanges.fire({
            uri: Uri.file('/workspace'),
            old: oldEnvironment,
            new: newEnvironment,
        });

        expect(events).to.have.length(1);
        expect(events[0].type).to.equal(FileChangeType.Changed);
        expect(events[0].old?.executable.filename).to.equal(oldEnvironment.execInfo.run.executable);
        expect(events[0].new?.executable.filename).to.equal(newEnvironment.execInfo.run.executable);
        expect(events[0].searchLocation?.fsPath).to.equal(Uri.file('/workspace').fsPath);
    });

    test('preserves valid active-environment set and clear events', async () => {
        const api = await createEnvExtApi(disposables);
        const environment = buildCondaEnvironment('valid', '3.12.1', '/conda/envs/valid');
        const events: PythonEnvCollectionChangedEvent[] = [];
        disposables.push(api.onChanged((event) => events.push(event)));

        activeEnvironmentChanges.fire({ uri: Uri.file('/workspace'), old: undefined, new: environment });
        activeEnvironmentChanges.fire({ uri: Uri.file('/workspace'), old: environment, new: undefined });

        expect(events).to.have.length(2);
        expect(events[0].old).to.equal(undefined);
        expect(events[0].new?.executable.filename).to.equal(environment.execInfo.run.executable);
        expect(events[1].old?.executable.filename).to.equal(environment.execInfo.run.executable);
        expect(events[1].new).to.equal(undefined);
    });

    test('removes Conda environments using their executable identity', async () => {
        const api = await createEnvExtApi(disposables);
        const environment = buildCondaEnvironment('first', '3.12.1', '/conda/envs/first');
        const events: PythonEnvCollectionChangedEvent[] = [];
        disposables.push(api.onChanged((event) => events.push(event)));
        environmentChanges.fire([{ kind: EnvironmentChangeKind.add, environment }]);

        environmentChanges.fire([{ kind: EnvironmentChangeKind.remove, environment }]);

        expect(api.getEnvs()).to.be.empty;
        expect(events.map((event) => event.type)).to.deep.equal([FileChangeType.Created, FileChangeType.Deleted]);
        expect(events[1].old?.executable.filename).to.equal(environment.execInfo.run.executable);
    });

    test('restores all valid Conda environments after a refresh batch containing a no-Python item', async () => {
        const api = await createEnvExtApi(disposables);
        const oldFirst = buildCondaEnvironment('first', '3.12.0', '/conda/envs/first');
        const oldSecond = buildCondaEnvironment('second', '3.11.8', '/conda/envs/second');
        environmentChanges.fire([
            { kind: EnvironmentChangeKind.add, environment: oldFirst },
            { kind: EnvironmentChangeKind.add, environment: oldSecond },
        ]);

        const noPython = buildCondaEnvironment('empty', 'no-python', '/conda/envs/empty', '/conda/bin/conda');
        const newFirst = buildCondaEnvironment('first', '3.12.1', '/conda/envs/first');
        const newSecond = buildCondaEnvironment('second', '3.11.9', '/conda/envs/second');
        environmentChanges.fire([
            { kind: EnvironmentChangeKind.remove, environment: oldFirst },
            { kind: EnvironmentChangeKind.remove, environment: oldSecond },
            { kind: EnvironmentChangeKind.add, environment: noPython },
            { kind: EnvironmentChangeKind.add, environment: newFirst },
            { kind: EnvironmentChangeKind.add, environment: newSecond },
        ]);

        expect(api.getEnvs().map((env) => env.version.sysVersion)).to.deep.equal(['3.12.1', '3.11.9']);
    });

    test('completes a requested refresh and retains valid environments after a no-Python item', async () => {
        const noPython = buildCondaEnvironment('empty', 'no-python', '/conda/envs/empty', '/conda/bin/conda');
        const valid = buildCondaEnvironment('valid', '3.12.1', '/conda/envs/valid');
        (envExtApi.refreshEnvironments as sinon.SinonStub).callsFake(async () => {
            environmentChanges.fire([
                { kind: EnvironmentChangeKind.add, environment: noPython },
                { kind: EnvironmentChangeKind.add, environment: valid },
            ]);
        });
        const api = await createEnvExtApi(disposables);

        await api.triggerRefresh();

        expect(api.getEnvs().map((env) => env.executable.filename)).to.deep.equal([valid.execInfo.run.executable]);
    });
});
