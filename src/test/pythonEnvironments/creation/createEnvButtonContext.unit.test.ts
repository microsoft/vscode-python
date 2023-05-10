// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import { TextDocument, TextDocumentChangeEvent, WorkspaceConfiguration } from 'vscode';
import * as cmdApis from '../../../client/common/vscodeApis/commandApis';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import { IDisposableRegistry } from '../../../client/common/types';
import { registerCreateEnvButtonFeatures } from '../../../client/pythonEnvironments/creation/createEnvButtonContext';

chaiUse(chaiAsPromised);

class FakeDisposable {
    public dispose() {
        // Do nothing
    }
}

function getInstallableToml(): typemoq.IMock<TextDocument> {
    const pyprojectTomlPath = 'pyproject.toml';
    const pyprojectToml = typemoq.Mock.ofType<TextDocument>();
    pyprojectToml.setup((p) => p.fileName).returns(() => pyprojectTomlPath);
    pyprojectToml
        .setup((p) => p.getText(typemoq.It.isAny()))
        .returns(
            () =>
                '[project]\nname = "spam"\nversion = "2020.0.0"\n[build-system]\nrequires = ["setuptools ~= 58.0", "cython ~= 0.29.0"]\n[project.optional-dependencies]\ntest = ["pytest"]\ndoc = ["sphinx", "furo"]',
        );
    return pyprojectToml;
}

function getNonInstallableToml(): typemoq.IMock<TextDocument> {
    const pyprojectTomlPath = 'pyproject.toml';
    const pyprojectToml = typemoq.Mock.ofType<TextDocument>();
    pyprojectToml.setup((p) => p.fileName).returns(() => pyprojectTomlPath);
    pyprojectToml
        .setup((p) => p.getText(typemoq.It.isAny()))
        .returns(() => '[project]\nname = "spam"\nversion = "2020.0.0"\n');
    return pyprojectToml;
}

function getSomeFile(): typemoq.IMock<TextDocument> {
    const someFilePath = 'something.py';
    const someFile = typemoq.Mock.ofType<TextDocument>();
    someFile.setup((p) => p.fileName).returns(() => someFilePath);
    someFile.setup((p) => p.getText(typemoq.It.isAny())).returns(() => 'print("Hello World")');
    return someFile;
}

suite('PyProject.toml Create Env Features', () => {
    let executeCommandStub: sinon.SinonStub;
    const disposables: IDisposableRegistry = [];
    let getOpenTextDocumentsStub: sinon.SinonStub;
    let onDidOpenTextDocumentStub: sinon.SinonStub;
    let onDidChangeTextDocumentStub: sinon.SinonStub;
    let onDidChangeConfigurationStub: sinon.SinonStub;
    let getConfigurationStub: sinon.SinonStub;
    let configMock: typemoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        executeCommandStub = sinon.stub(cmdApis, 'executeCommand');
        getOpenTextDocumentsStub = sinon.stub(workspaceApis, 'getOpenTextDocuments');
        onDidOpenTextDocumentStub = sinon.stub(workspaceApis, 'onDidOpenTextDocument');
        onDidChangeTextDocumentStub = sinon.stub(workspaceApis, 'onDidChangeTextDocument');
        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        onDidChangeConfigurationStub = sinon.stub(workspaceApis, 'onDidChangeConfiguration');

        onDidOpenTextDocumentStub.returns(new FakeDisposable());
        onDidChangeTextDocumentStub.returns(new FakeDisposable());
        onDidChangeConfigurationStub.returns(new FakeDisposable());

        configMock = typemoq.Mock.ofType<WorkspaceConfiguration>();
        configMock.setup((c) => c.get<string>(typemoq.It.isAny(), typemoq.It.isAny())).returns(() => 'show');
        getConfigurationStub.returns(configMock.object);
    });

    teardown(() => {
        sinon.restore();
        disposables.forEach((d) => d.dispose());
    });

    test('python.createEnvironment.contentButton setting is set to "show", no files open', async () => {
        getOpenTextDocumentsStub.returns([]);

        registerCreateEnvButtonFeatures(disposables);

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'showCreateEnvButton', true));
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('python.createEnvironment.contentButton setting is set to "hide", no files open', async () => {
        configMock.reset();
        configMock.setup((c) => c.get<string>(typemoq.It.isAny(), typemoq.It.isAny())).returns(() => 'hide');
        getOpenTextDocumentsStub.returns([]);

        registerCreateEnvButtonFeatures(disposables);

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'showCreateEnvButton', false));
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('python.createEnvironment.contentButton setting changed from "hide" to "show"', async () => {
        configMock.reset();
        configMock.setup((c) => c.get<string>(typemoq.It.isAny(), typemoq.It.isAny())).returns(() => 'hide');
        getOpenTextDocumentsStub.returns([]);

        let handler: () => void = () => {
            /* do nothing */
        };
        onDidChangeConfigurationStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'showCreateEnvButton', false));
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        configMock.reset();
        configMock.setup((c) => c.get<string>(typemoq.It.isAny(), typemoq.It.isAny())).returns(() => 'show');
        handler();

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'showCreateEnvButton', true));
    });

    test('python.createEnvironment.contentButton setting changed from "show" to "hide"', async () => {
        configMock.reset();
        configMock.setup((c) => c.get<string>(typemoq.It.isAny(), typemoq.It.isAny())).returns(() => 'show');
        getOpenTextDocumentsStub.returns([]);

        let handler: () => void = () => {
            /* do nothing */
        };
        onDidChangeConfigurationStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'showCreateEnvButton', true));
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        configMock.reset();
        configMock.setup((c) => c.get<string>(typemoq.It.isAny(), typemoq.It.isAny())).returns(() => 'hide');
        handler();

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'showCreateEnvButton', false));
    });

    test('Installable pyproject.toml is already open in the editor on extension activate', async () => {
        const pyprojectToml = getInstallableToml();
        getOpenTextDocumentsStub.returns([pyprojectToml.object]);

        registerCreateEnvButtonFeatures(disposables);

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', true));
    });

    test('Non installable pyproject.toml is already open in the editor on extension activate', async () => {
        const pyprojectToml = getNonInstallableToml();
        getOpenTextDocumentsStub.returns([pyprojectToml.object]);

        registerCreateEnvButtonFeatures(disposables);

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('Some random file open in the editor on extension activate', async () => {
        const someFile = getSomeFile();
        getOpenTextDocumentsStub.returns([someFile.object]);

        registerCreateEnvButtonFeatures(disposables);

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('Installable pyproject.toml is opened in the editor', async () => {
        getOpenTextDocumentsStub.returns([]);

        let handler: (doc: TextDocument) => void = () => {
            /* do nothing */
        };
        onDidOpenTextDocumentStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        const pyprojectToml = getInstallableToml();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.neverCalledWith('setContext', 'pipInstallableToml', true));

        handler(pyprojectToml.object);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', true));
    });

    test('Non Installable pyproject.toml is opened in the editor', async () => {
        getOpenTextDocumentsStub.returns([]);

        let handler: (doc: TextDocument) => void = () => {
            /* do nothing */
        };
        onDidOpenTextDocumentStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        const pyprojectToml = getNonInstallableToml();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        handler(pyprojectToml.object);

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('Some random file is opened in the editor', async () => {
        getOpenTextDocumentsStub.returns([]);

        let handler: (doc: TextDocument) => void = () => {
            /* do nothing */
        };
        onDidOpenTextDocumentStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        const someFile = getSomeFile();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        handler(someFile.object);

        assert.ok(executeCommandStub.neverCalledWith('setContext', 'pipInstallableToml', false));
    });

    test('Installable pyproject.toml is changed', async () => {
        getOpenTextDocumentsStub.returns([]);

        let handler: (d: TextDocumentChangeEvent) => void = () => {
            /* do nothing */
        };
        onDidChangeTextDocumentStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        const pyprojectToml = getInstallableToml();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));

        handler({ contentChanges: [], document: pyprojectToml.object, reason: undefined });

        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', true));
    });

    test('Non Installable pyproject.toml is changed', async () => {
        getOpenTextDocumentsStub.returns([]);

        let handler: (d: TextDocumentChangeEvent) => void = () => {
            /* do nothing */
        };
        onDidChangeTextDocumentStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        const pyprojectToml = getNonInstallableToml();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        handler({ contentChanges: [], document: pyprojectToml.object, reason: undefined });

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('Non Installable pyproject.toml is changed to Installable', async () => {
        getOpenTextDocumentsStub.returns([]);

        let openHandler: (doc: TextDocument) => void = () => {
            /* do nothing */
        };
        onDidOpenTextDocumentStub.callsFake((callback) => {
            openHandler = callback;
            return new FakeDisposable();
        });

        let changeHandler: (d: TextDocumentChangeEvent) => void = () => {
            /* do nothing */
        };
        onDidChangeTextDocumentStub.callsFake((callback) => {
            changeHandler = callback;
            return new FakeDisposable();
        });

        const nonInatallablePyprojectToml = getNonInstallableToml();
        const installablePyprojectToml = getInstallableToml();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        openHandler(nonInatallablePyprojectToml.object);
        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        changeHandler({ contentChanges: [], document: installablePyprojectToml.object, reason: undefined });

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', true));
    });

    test('Some random file is changed', async () => {
        getOpenTextDocumentsStub.returns([]);

        let handler: (d: TextDocumentChangeEvent) => void = () => {
            /* do nothing */
        };
        onDidChangeTextDocumentStub.callsFake((callback) => {
            handler = callback;
            return new FakeDisposable();
        });

        const someFile = getSomeFile();

        registerCreateEnvButtonFeatures(disposables);
        assert.ok(executeCommandStub.calledWithExactly('setContext', 'pipInstallableToml', false));
        executeCommandStub.reset();

        handler({ contentChanges: [], document: someFile.object, reason: undefined });

        assert.ok(executeCommandStub.notCalled);
    });
});
