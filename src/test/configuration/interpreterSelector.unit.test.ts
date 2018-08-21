// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { IApplicationShell, ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { Architecture, IFileSystem } from '../../client/common/platform/types';
import { IInterpreterQuickPickItem, InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';

const info: PythonInterpreter = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};

class InterpreterQuickPickItem implements IInterpreterQuickPickItem {
    public path: string;
    public label: string;
    public description!: string;
    public detail?: string;
    constructor(l: string, p: string) {
        this.path = p;
        this.label = l;
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Interpreters - selector', () => {
    let serviceContainer: IServiceContainer;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;

    setup(() => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);

        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);

        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);

        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, documentManager.object);

        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a: string, b: string) => a === b);
        fileSystem
            .setup(x => x.getRealPath(TypeMoq.It.isAnyString()))
            .returns((a: string) => new Promise(resolve => resolve(a)));

        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fileSystem.object);

        const commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, commandManager.object);
    });

    test('Suggestions', async () => {
        const initial: PythonInterpreter[] = [
            { displayName: '1', path: 'c:/path1/path1', type: InterpreterType.Unknown },
            { displayName: '2', path: 'c:/path1/path1', type: InterpreterType.Unknown },
            { displayName: '2', path: 'c:/path2/path2', type: InterpreterType.Unknown },
            { displayName: '2 (virtualenv)', path: 'c:/path2/path2', type: InterpreterType.VirtualEnv },
            { displayName: '3', path: 'c:/path2/path2', type: InterpreterType.Unknown },
            { displayName: '4', path: 'c:/path4/path4', type: InterpreterType.Conda }
        ].map(item => { return { ...info, ...item }; });
        interpreterService
            .setup(x => x.getInterpreters(TypeMoq.It.isAny()))
            .returns(() => new Promise((resolve) => resolve(initial)));

        const selector = new InterpreterSelector(serviceContainer);
        const actual = await selector.getSuggestions();

        const expected: InterpreterQuickPickItem[] = [
            new InterpreterQuickPickItem('1', 'c:/path1/path1'),
            new InterpreterQuickPickItem('2', 'c:/path1/path1'),
            new InterpreterQuickPickItem('2', 'c:/path2/path2'),
            new InterpreterQuickPickItem('2 (virtualenv)', 'c:/path2/path2'),
            new InterpreterQuickPickItem('3', 'c:/path2/path2'),
            new InterpreterQuickPickItem('4', 'c:/path4/path4')
        ];

        assert.equal(actual.length, expected.length, 'Suggestion lengths are different.');
        for (let i = 0; i < expected.length; i += 1) {
            assert.equal(actual[i].label, expected[i].label,
                `Suggestion label is different at ${i}: exected '${expected[i].label}', found '${actual[i].label}'.`);
            assert.equal(actual[i].path, expected[i].path,
                `Suggestion path is different at ${i}: exected '${expected[i].path}', found '${actual[i].path}'.`);
        }
    });
});
