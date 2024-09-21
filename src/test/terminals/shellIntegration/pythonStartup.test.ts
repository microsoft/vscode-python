// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import {
    EnvironmentVariableCollection,
    GlobalEnvironmentVariableCollection,
    Uri,
    WorkspaceConfiguration,
} from 'vscode';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import { registerPythonStartup } from '../../../client/terminals/pythonStartup';
import { IExtensionContext } from '../../../client/common/types';

suite('Terminal - Shell Integration with PYTHONSTARTUP', () => {
    // let context: IExtensionContext;
    let getConfigurationStub: sinon.SinonStub;
    let pythonConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let editorConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let context: TypeMoq.IMock<IExtensionContext>;
    let createDirectoryStub: sinon.SinonStub;
    let copyStub: sinon.SinonStub;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let environmentVariableCollection: TypeMoq.IMock<EnvironmentVariableCollection>;
    let globalEnvironmentVariableCollection: TypeMoq.IMock<GlobalEnvironmentVariableCollection>;
    setup(() => {
        context = TypeMoq.Mock.ofType<IExtensionContext>();
        // context.setup((c) => c).returns(() => context.object);
        environmentVariableCollection = TypeMoq.Mock.ofType<EnvironmentVariableCollection>();
        globalEnvironmentVariableCollection = TypeMoq.Mock.ofType<GlobalEnvironmentVariableCollection>();

        // Question: Why do we have to set up environmentVariableCollection and globalEnvironmentVariableCollection in this flip-flop way?
        // Reference: /vscode-python/src/test/interpreters/activation/terminalEnvVarCollectionService.unit.test.ts
        context.setup((c) => c.environmentVariableCollection).returns(() => globalEnvironmentVariableCollection.object);
        globalEnvironmentVariableCollection
            .setup((c) => c.getScoped(TypeMoq.It.isAny()))
            .returns(() => environmentVariableCollection.object);
        context.setup((c) => c.storageUri).returns(() => Uri.parse('a'));

        // Commenting out 41 to 45 will pas first couple test. "c.environmentVariableCollection is not a function" crashes everything.
        context
            .setup((c) =>
                c.environmentVariableCollection.replace(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            )
            .returns(() => Promise.resolve()); // TODO: what is wrong with this --> complaining it is NOT a Function
        // Marker -----
        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        createDirectoryStub = sinon.stub(workspaceApis, 'createDirectory');
        copyStub = sinon.stub(workspaceApis, 'copy');

        pythonConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        editorConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        getConfigurationStub.callsFake((section: string) => {
            if (section === 'python') {
                return pythonConfig.object;
            }
            return editorConfig.object;
        });

        createDirectoryStub.callsFake((_) => Promise.resolve());
        copyStub.callsFake((_, __, ___) => Promise.resolve());
    });

    teardown(() => {
        sinon.restore();
    });

    test('Verify createDirectory is called when shell integration is enabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => true);

        await registerPythonStartup(context.object);

        // Verify createDirectoryStub has been called
        sinon.assert.calledOnce(createDirectoryStub);
    });

    test('Verify createDirectory is not called when shell integration is disabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => false);

        await registerPythonStartup(context.object);

        // Verify createDirectoryStub has not been called
        sinon.assert.notCalled(createDirectoryStub);
    });

    test('Verify copy is called when shell integration is enabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => true);

        await registerPythonStartup(context.object);

        // Verify copyStub has been called
        sinon.assert.calledOnce(copyStub);
    });

    test('Verify copy is not called when shell integration is disabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => false);

        await registerPythonStartup(context.object);

        // Verify copyStub has not been called
        sinon.assert.notCalled(copyStub);
    });

    // TODO: figure out what is wrong. How is environmentVariableCollection not a function in context?
    test('Verify environment collection.replace is called when shell integration is enabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => true);

        await registerPythonStartup(context.object);

        // Verify environment collection.replace has been called
        sinon.assert.calledOnce(context.environmentVariableCollection.replace);
    });
});
