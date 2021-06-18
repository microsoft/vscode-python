// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import * as assert from 'assert';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { DeprecatePythonPath } from '../../../client/common/experiments/groups';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { IFileSystem } from '../../../client/common/platform/types';
import { IExperimentService } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { InterpreterSelector } from '../../../client/interpreter/configuration/interpreterSelector/interpreterSelector';
import { IInterpreterComparer, IInterpreterQuickPickItem } from '../../../client/interpreter/configuration/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';

const info: PythonEnvironment = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    envType: EnvironmentType.Unknown,
    version: new SemVer('1.0.0-alpha'),
    sysPrefix: '',
    sysVersion: '',
};

class InterpreterQuickPickItem implements IInterpreterQuickPickItem {
    public path: string;

    public label: string;

    public description!: string;

    public detail?: string;

    public interpreter = ({} as unknown) as PythonEnvironment;

    constructor(l: string, p: string) {
        this.path = p;
        this.label = l;
    }
}

suite('Interpreters - selector', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let comparer: TypeMoq.IMock<IInterpreterComparer>;
    let experimentsManager: TypeMoq.IMock<IExperimentService>;
    const ignoreCache = false;
    class TestInterpreterSelector extends InterpreterSelector {
        public async suggestionToQuickPickItem(
            suggestion: PythonEnvironment,
            workspaceUri?: Uri,
        ): Promise<IInterpreterQuickPickItem> {
            return super.suggestionToQuickPickItem(suggestion, workspaceUri);
        }
    }

    let selector: TestInterpreterSelector;

    setup(() => {
        experimentsManager = TypeMoq.Mock.ofType<IExperimentService>();
        experimentsManager.setup((e) => e.inExperimentSync(DeprecatePythonPath.experiment)).returns(() => false);
        comparer = TypeMoq.Mock.ofType<IInterpreterComparer>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup((x) => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a: string, b: string) => a === b);

        comparer.setup((c) => c.compare(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => 0);
        selector = new TestInterpreterSelector(interpreterService.object, comparer.object, new PathUtils(false));
    });

    [true, false].forEach((isWindows) => {
        test(`Suggestions (${isWindows ? 'Windows' : 'Non-Windows'})`, async () => {
            selector = new TestInterpreterSelector(
                interpreterService.object,
                comparer.object,
                new PathUtils(isWindows),
            );

            const initial: PythonEnvironment[] = [
                { displayName: '1', path: 'c:/path1/path1', envType: EnvironmentType.Unknown },
                { displayName: '2', path: 'c:/path1/path1', envType: EnvironmentType.Unknown },
                { displayName: '2', path: 'c:/path2/path2', envType: EnvironmentType.Unknown },
                { displayName: '2 (virtualenv)', path: 'c:/path2/path2', envType: EnvironmentType.VirtualEnv },
                { displayName: '3', path: 'c:/path2/path2', envType: EnvironmentType.Unknown },
                { displayName: '4', path: 'c:/path4/path4', envType: EnvironmentType.Conda },
            ].map((item) => {
                return { ...info, ...item };
            });
            interpreterService
                .setup((x) => x.getInterpreters(TypeMoq.It.isAny(), { onSuggestion: true, ignoreCache }))
                .returns(() => new Promise((resolve) => resolve(initial)));

            const actual = await selector.getSuggestions(undefined, ignoreCache);

            const expected: InterpreterQuickPickItem[] = [
                new InterpreterQuickPickItem('1', 'c:/path1/path1'),
                new InterpreterQuickPickItem('2', 'c:/path1/path1'),
                new InterpreterQuickPickItem('2', 'c:/path2/path2'),
                new InterpreterQuickPickItem('2 (virtualenv)', 'c:/path2/path2'),
                new InterpreterQuickPickItem('3', 'c:/path2/path2'),
                new InterpreterQuickPickItem('4', 'c:/path4/path4'),
            ];

            assert.equal(actual.length, expected.length, 'Suggestion lengths are different.');
            for (let i = 0; i < expected.length; i += 1) {
                assert.equal(
                    actual[i].label,
                    expected[i].label,
                    `Suggestion label is different at ${i}: exected '${expected[i].label}', found '${actual[i].label}'.`,
                );
                assert.equal(
                    actual[i].path,
                    expected[i].path,
                    `Suggestion path is different at ${i}: exected '${expected[i].path}', found '${actual[i].path}'.`,
                );
            }
        });
    });
});
