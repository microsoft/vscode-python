// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { IApplicationShell, ICommandManager, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { IFileSystem } from '../../client/common/platform/types';
import { IPathUtils } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { IInterpreterQuickPickItem, InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector';
import { IInterpreterComparer } from '../../client/interpreter/configuration/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
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
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    setup(() => {
        const commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        const comparer = TypeMoq.Mock.ofType<IInterpreterComparer>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a: string, b: string) => a === b);
        fileSystem
            .setup(x => x.getRealPath(TypeMoq.It.isAnyString()))
            .returns((a: string) => new Promise(resolve => resolve(a)));

        comparer.setup(c => c.compare(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => 0);

        serviceContainer.setup(c => c.get(IWorkspaceService)).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(IApplicationShell)).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(IInterpreterService)).returns(() => interpreterService.object);
        serviceContainer.setup(c => c.get(IDocumentManager)).returns(() => documentManager.object);
        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(IInterpreterComparer)).returns(() => comparer.object);
        serviceContainer.setup(c => c.get(ICommandManager)).returns(() => commandManager.object);
    });

    [true, false].forEach(isWindows => {
        test(`Suggestions (${isWindows} ? 'Windows' : 'Non-Windows')`, async () => {
            serviceContainer
                .setup(c => c.get(IPathUtils))
                .returns(() => new PathUtils(isWindows));

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

            const selector = new InterpreterSelector(serviceContainer.object);
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
});
