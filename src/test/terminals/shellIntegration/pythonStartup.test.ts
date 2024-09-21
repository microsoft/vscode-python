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

        context.setup((c) => c.environmentVariableCollection).returns(() => globalEnvironmentVariableCollection.object);
        globalEnvironmentVariableCollection
            .setup((c) => c.getScoped(TypeMoq.It.isAny()))
            .returns(() => environmentVariableCollection.object);
        context.setup((c) => c.storageUri).returns(() => Uri.parse('a'));
        context
            .setup((c) =>
                c.environmentVariableCollection.replace(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            )
            .returns(() => Promise.resolve());

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

    test('PYTHONSTARTUP is set when setting is enabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => true);

        await registerPythonStartup(context.object);

        // Make sure context.environmentVariableCollection.replace is called once
        context.verify(
            (c) => c.environmentVariableCollection.replace(TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.once(),
        );
        // context.verify((c) => c.environmentVariableCollection.delete(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });
});
