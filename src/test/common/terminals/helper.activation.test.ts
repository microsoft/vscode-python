// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import { ITerminalManager, IWorkspaceService } from '../../../client/common/application/types';
import { EnumEx } from '../../../client/common/enumUtils';
import { IPlatformService } from '../../../client/common/platform/types';
import { Bash } from '../../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import { ITerminalActivationCommandProvider, ITerminalHelper, TerminalShellType } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service helpers', () => {
    let helper: ITerminalHelper;
    let terminalManager: TypeMoq.IMock<ITerminalManager>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let disposables: Disposable[] = [];
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;

    setup(() => {
        terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        disposables = [];

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(ITerminalManager)).returns(() => terminalManager.object);
        serviceContainer.setup(c => c.get(IPlatformService)).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(IDisposableRegistry)).returns(() => disposables);
        serviceContainer.setup(c => c.get(IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(IInterpreterService)).returns(() => interpreterService.object);

        helper = new TerminalHelper(serviceContainer.object);
    });
    teardown(() => {
        disposables.filter(item => !!item).forEach(item => item.dispose());
    });

    test('Activation command is undefined for unknown active interpreter', async () => {
        // tslint:disable-next-line:no-any
        interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined as any));
        const commands = await helper.getEnvironmentActivationCommands(TerminalShellType.other);

        expect(commands).to.equal(undefined, 'Activation command should be undefined if terminal type cannot be determined');
    });

    test('Activation command is undefined for unknown terminal', async () => {
        interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => {
            const interpreterInfo: PythonInterpreter = {
                path: 'python',
                version: '',
                type: InterpreterType.Unknown
            };
            return Promise.resolve(interpreterInfo);
        });

        const bashActivation = new Bash(serviceContainer.object);
        const commandPromptActivation = new CommandPromptAndPowerShell(serviceContainer.object);
        serviceContainer.setup(c => c.getAll(ITerminalActivationCommandProvider)).returns(() => [bashActivation, commandPromptActivation]);
        const commands = await helper.getEnvironmentActivationCommands(TerminalShellType.other);

        expect(commands).to.equal(undefined, 'Activation command should be undefined if terminal type cannot be determined');
    });
});

EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(terminalShell => {
    suite(`Terminal Service helpers (${terminalShell.name})`, () => {
        let helper: ITerminalHelper;
        let terminalManager: TypeMoq.IMock<ITerminalManager>;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let disposables: Disposable[] = [];
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let interpreterService: TypeMoq.IMock<IInterpreterService>;

        setup(() => {
            terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            disposables = [];

            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            serviceContainer.setup(c => c.get(ITerminalManager)).returns(() => terminalManager.object);
            serviceContainer.setup(c => c.get(IPlatformService)).returns(() => platformService.object);
            serviceContainer.setup(c => c.get(IDisposableRegistry)).returns(() => disposables);
            serviceContainer.setup(c => c.get(IWorkspaceService)).returns(() => workspaceService.object);
            serviceContainer.setup(c => c.get(IInterpreterService)).returns(() => interpreterService.object);

            helper = new TerminalHelper(serviceContainer.object);
        });
        teardown(() => {
            disposables.filter(disposable => !!disposable).forEach(disposable => disposable.dispose());
        });

        async function activationCommandShouldReturnCorrectly(shellType: TerminalShellType, expectedActivationCommand?: string[]) {
            const interpreterInfo: PythonInterpreter = {
                path: 'python',
                version: '',
                type: InterpreterType.Unknown
            };
            interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(interpreterInfo));

            // This will only work for the current shell type.
            const validProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
            validProvider.setup(p => p.isShellSupported(TypeMoq.It.isValue(shellType))).returns(() => true);
            validProvider.setup(p => p.getActivationCommands(TypeMoq.It.isValue(interpreterInfo), TypeMoq.It.isValue(shellType))).returns(() => Promise.resolve(expectedActivationCommand));

            // This will support other providers.
            const invalidProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
            invalidProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(item => shellType !== shellType);

            serviceContainer.setup(c => c.getAll(ITerminalActivationCommandProvider)).returns(() => [validProvider.object, invalidProvider.object]);
            const commands = await helper.getEnvironmentActivationCommands(shellType);

            validProvider.verify(p => p.getActivationCommands(TypeMoq.It.isValue(interpreterInfo), TypeMoq.It.isValue(shellType)), TypeMoq.Times.once());
            validProvider.verify(p => p.isShellSupported(TypeMoq.It.isValue(shellType)), TypeMoq.Times.once());
            invalidProvider.verify(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
            invalidProvider.verify(p => p.isShellSupported(TypeMoq.It.isValue(shellType)), TypeMoq.Times.once());

            expect(commands).to.deep.equal(expectedActivationCommand, 'Incorrect activation command');
        }

        test(`Activation command should be correctly identified for ${terminalShell.name} (command array)`, async () => {
            await activationCommandShouldReturnCorrectly(terminalShell.value, ['a', 'b']);
        });
        test(`Activation command should be correctly identified for ${terminalShell.name} (command string)`, async () => {
            await activationCommandShouldReturnCorrectly(terminalShell.value, ['command to be executed']);
        });
        test(`Activation command should be correctly identified for ${terminalShell.name} (undefined)`, async () => {
            await activationCommandShouldReturnCorrectly(terminalShell.value);
        });

        async function activationCommandShouldReturnUndefined(shellType: TerminalShellType) {
            const interpreterInfo: PythonInterpreter = {
                path: 'python',
                version: '',
                type: InterpreterType.Unknown
            };
            interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(interpreterInfo));

            // This will support other providers.
            const invalidProvider = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
            invalidProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(item => shellType !== shellType);

            serviceContainer.setup(c => c.getAll(ITerminalActivationCommandProvider)).returns(() => [invalidProvider.object]);
            const commands = await helper.getEnvironmentActivationCommands(shellType);

            invalidProvider.verify(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
            expect(commands).to.deep.equal(undefined, 'Incorrect activation command');
        }

        test(`Activation command should return undefined ${terminalShell.name} (no matching providers)`, async () => {
            await activationCommandShouldReturnUndefined(terminalShell.value);
        });
    });
});
