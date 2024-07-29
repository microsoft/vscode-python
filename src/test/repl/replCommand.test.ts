// Create test suite and test cases for the `replUtils` module
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ICommandManager } from '../../client/common/application/types';
import { ICodeExecutionHelper } from '../../client/terminals/types';
import * as replCommands from '../../client/repl/replCommands';
import * as replUtils from '../../client/repl/replUtils';
import { Commands } from '../../client/common/constants';
// import { executeInTerminal, getActiveInterpreter, getSendToNativeREPLSetting } from '../../client/repl/replUtils';

suite('REPL - register native repl command', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let executionHelper: TypeMoq.IMock<ICodeExecutionHelper>;
    let getSendToNativeREPLSettingStub: sinon.SinonStub;
    // @ts-ignore: TS6133
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let registerCommandSpy: sinon.SinonSpy; // Need this for getSendToNativeREPLSetting test #ignore unused variable error on this line // @ts-ignore: TS6133
    let executeInTerminalStub: sinon.SinonStub;
    setup(() => {
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        executionHelper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
        // Define the registerCommand method on the mock object
        commandManager
            .setup((cm) => cm.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => TypeMoq.Mock.ofType<Disposable>().object);

        getSendToNativeREPLSettingStub = sinon.stub(replUtils, 'getSendToNativeREPLSetting');
        getSendToNativeREPLSettingStub.returns(false);
        executeInTerminalStub = sinon.stub(replUtils, 'executeInTerminal');
        executeInTerminalStub.returns(Promise.resolve());
        registerCommandSpy = sinon.spy(commandManager.object, 'registerCommand');
    });

    teardown(() => {
        sinon.restore();
    });

    test('Ensure repl command is registered', async () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        const disposableArray: Disposable[] = [disposable.object];

        await replCommands.registerReplCommands(
            disposableArray,
            interpreterService.object,
            executionHelper.object,
            commandManager.object,
        );

        // Check to see if the command was registered
        commandManager.verify(
            (c) => c.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.atLeastOnce(),
        );
    });

    test('Ensure getSendToNativeREPLSetting is called', async () => {
        // const disposable = TypeMoq.Mock.ofType<Disposable>();
        // const disposableArray: Disposable[] = [disposable.object];

        let commandHandler: undefined | (() => Promise<void>);
        commandManager
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .setup((c) => c.registerCommand as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .returns(() => (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === Commands.Exec_In_REPL) {
                    commandHandler = callback;
                }
                // eslint-disable-next-line no-void
                return { dispose: () => void 0 };
            });
        replCommands.registerReplCommands(
            [TypeMoq.Mock.ofType<Disposable>().object],
            interpreterService.object,
            executionHelper.object,
            commandManager.object,
        );

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        await commandHandler!();

        sinon.assert.calledOnce(getSendToNativeREPLSettingStub);
    });

    test('Ensure executeInTerminal is called when getSendToNativeREPLSetting returns false', async () => {
        getSendToNativeREPLSettingStub.returns(false);

        let commandHandler: undefined | (() => Promise<void>);
        commandManager
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .setup((c) => c.registerCommand as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .returns(() => (command: string, callback: (...args: any[]) => any, _thisArg?: any) => {
                if (command === Commands.Exec_In_REPL) {
                    commandHandler = callback;
                }
                // eslint-disable-next-line no-void
                return { dispose: () => void 0 };
            });
        replCommands.registerReplCommands(
            [TypeMoq.Mock.ofType<Disposable>().object],
            interpreterService.object,
            executionHelper.object,
            commandManager.object,
        );

        expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');

        await commandHandler!();

        // Check to see if executeInTerminal was called
        sinon.assert.calledOnce(executeInTerminalStub);
    });
});
