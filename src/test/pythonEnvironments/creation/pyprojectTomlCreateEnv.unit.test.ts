// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import { TextDocument, TextDocumentChangeEvent } from 'vscode';
import * as cmdApis from '../../../client/common/vscodeApis/commandApis';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import { IDisposableRegistry } from '../../../client/common/types';
import { registerPyProjectTomlCreateEnvFeatures } from '../../../client/pythonEnvironments/creation/pyprojectTomlCreateEnv';

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

    setup(() => {
        executeCommandStub = sinon.stub(cmdApis, 'executeCommand');
        getOpenTextDocumentsStub = sinon.stub(workspaceApis, 'getOpenTextDocuments');
        onDidOpenTextDocumentStub = sinon.stub(workspaceApis, 'onDidOpenTextDocument');
        onDidChangeTextDocumentStub = sinon.stub(workspaceApis, 'onDidChangeTextDocument');

        onDidOpenTextDocumentStub.returns(new FakeDisposable());
        onDidChangeTextDocumentStub.returns(new FakeDisposable());
    });

    teardown(() => {
        sinon.restore();
        disposables.forEach((d) => d.dispose());
    });

    test('Installable pyproject.toml is already open in the editor on extension activate', async () => {
        const pyprojectToml = getInstallableToml();
        getOpenTextDocumentsStub.returns([pyprojectToml.object]);

        registerPyProjectTomlCreateEnvFeatures(disposables);

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', true));
    });

    test('Non installable pyproject.toml is already open in the editor on extension activate', async () => {
        const pyprojectToml = getNonInstallableToml();
        getOpenTextDocumentsStub.returns([pyprojectToml.object]);

        registerPyProjectTomlCreateEnvFeatures(disposables);

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', false));
    });

    test('Some random file open in the editor on extension activate', async () => {
        const someFile = getSomeFile();
        getOpenTextDocumentsStub.returns([someFile.object]);

        registerPyProjectTomlCreateEnvFeatures(disposables);

        assert.ok(executeCommandStub.notCalled);
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

        registerPyProjectTomlCreateEnvFeatures(disposables);
        handler(pyprojectToml.object);

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', true));
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

        registerPyProjectTomlCreateEnvFeatures(disposables);
        handler(pyprojectToml.object);

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', false));
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

        registerPyProjectTomlCreateEnvFeatures(disposables);
        handler(someFile.object);

        assert.ok(executeCommandStub.notCalled);
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

        registerPyProjectTomlCreateEnvFeatures(disposables);
        handler({ contentChanges: [], document: pyprojectToml.object, reason: undefined });

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', true));
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

        registerPyProjectTomlCreateEnvFeatures(disposables);
        handler({ contentChanges: [], document: pyprojectToml.object, reason: undefined });

        assert.ok(executeCommandStub.calledOnceWithExactly('setContext', 'pipInstallableToml', false));
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

        registerPyProjectTomlCreateEnvFeatures(disposables);
        handler({ contentChanges: [], document: someFile.object, reason: undefined });

        assert.ok(executeCommandStub.notCalled);
    });
});
