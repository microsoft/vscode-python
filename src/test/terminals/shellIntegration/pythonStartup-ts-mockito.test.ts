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
import { mock, instance, when, anything, verify, reset } from 'ts-mockito';
import path from 'path';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import { registerPythonStartup } from '../../../client/terminals/pythonStartup';
import { IExtensionContext } from '../../../client/common/types';

suite.only('temporarily try with ts-mockito', () => {
    // let context: IExtensionContext;
    let getConfigurationStub: sinon.SinonStub;
    let pythonConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let editorConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    // let context: TypeMoq.IMock<IExtensionContext>;
    let context: IExtensionContext;
    let createDirectoryStub: sinon.SinonStub;
    let copyStub: sinon.SinonStub;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // let environmentVariableCollection: TypeMoq.IMock<EnvironmentVariableCollection>;
    // let globalEnvironmentVariableCollection: TypeMoq.IMock<GlobalEnvironmentVariableCollection>;

    let collection: EnvironmentVariableCollection;
    let globalCollection: GlobalEnvironmentVariableCollection;

    const joinPathStub = sinon.stub(Uri, 'joinPath');
    const sourcePathStub = sinon.stub(path, 'join');

    setup(() => {
        // context = TypeMoq.Mock.ofType<IExtensionContext>();
        context = mock<IExtensionContext>();
        // context.setup((c) => c).returns(() => context.object);
        // environmentVariableCollection = TypeMoq.Mock.ofType<EnvironmentVariableCollection>();
        // globalEnvironmentVariableCollection = TypeMoq.Mock.ofType<GlobalEnvironmentVariableCollection>();

        // context.setup((c) => c.environmentVariableCollection).returns(() => globalEnvironmentVariableCollection.object);
        // globalEnvironmentVariableCollection
        //     .setup((c) => c.getScoped(TypeMoq.It.isAny()))
        //     .returns(() => environmentVariableCollection.object);
        // context.setup((c) => c.storageUri).returns(() => Uri.parse('a'));
        // context
        //     .setup((c) =>
        //         c.environmentVariableCollection.replace(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
        //     )
        //     .returns(() => Promise.resolve());

        globalCollection = mock<GlobalEnvironmentVariableCollection>();
        collection = mock<EnvironmentVariableCollection>();
        when(context.environmentVariableCollection).thenReturn(instance(globalCollection));
        when(globalCollection.getScoped(anything())).thenReturn(instance(collection));

        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        createDirectoryStub = sinon.stub(workspaceApis, 'createDirectory');
        copyStub = sinon.stub(workspaceApis, 'copy');
        when(context.storageUri).thenReturn(undefined);

        // Stub the Uri.joinPath method
        joinPathStub.returns(Uri.parse('file:///mock/path/pythonrc.py'));

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
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => false);
        when(context.storageUri).thenReturn(Uri.parse('file:///a/b/c'));

        // Stub the Uri.joinPath method
        joinPathStub.returns(Uri.parse('file:///mock/path/pythonrc.py'));

        await registerPythonStartup(context);

        // Make sure context.environmentVariableCollection.replace is called once
        // context.verify(
        //     (c) => c.environmentVariableCollection.replace(TypeMoq.It.isAny(), TypeMoq.It.isAny()),
        //     TypeMoq.Times.once(),
        // );
        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();
        // verify(collection.replace(anything(), anything(), anything())).once();
        verify(collection.delete(anything())).once();
        // context.verify((c) => c.environmentVariableCollection.delete(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });
});
