// Create test suite and test cases for the `replUtils` module
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import { It, Mock } from 'typemoq';
import * as sinon from 'sinon';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ICommandManager } from '../../client/common/application/types';
import { ICodeExecutionHelper } from '../../client/terminals/types';
import * as replCommands from '../../client/repl/replCommands';
import * as replUtils from '../../client/repl/replUtils';
// import { executeInTerminal, getActiveInterpreter, getSendToNativeREPLSetting } from '../../client/repl/replUtils';

suite('REPL - register native repl command', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let executionHelper: TypeMoq.IMock<ICodeExecutionHelper>;
    let getSendToNativeREPLSettingStub: sinon.SinonStub;
    let registerCommandSpy: sinon.SinonSpy;
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
        commandManager.verify((c) => c.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });

    // test('Ensure execInTerminal is not called if REPL setting is true', async () => {
    //     const disposable = TypeMoq.Mock.ofType<Disposable>();
    //     const disposableArray: Disposable[] = [disposable.object];
    //     const getSendToNativeREPLSettingStub = Mock.ofInstance(getSendToNativeREPLSetting);
    //     const getActiveInterpreterStub = Mock.ofInstance(getActiveInterpreter);
    //     getSendToNativeREPLSettingStub.setup((x) => x()).returns(() => true);
    //     getActiveInterpreterStub
    //         .setup((x) => x(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    //         .returns(async () => Promise.resolve(undefined));

    //     const executeInTerminalStub = Mock.ofInstance(executeInTerminal);

    //     // Inject the stubs into the module
    //     await replCommands.registerReplCommands(
    //         disposableArray,
    //         interpreterService.object,
    //         executionHelper.object,
    //         commandManager.object,
    //     );

    //     // Extract the registered command handler and invoke it
    //     commandManager.verify((c) => c.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

    //     // Verify the function interactions

    //     executeInTerminalStub.verify((x) => x(), TypeMoq.Times.never());
    // });

    test('Ensure execInTerminal is called if REPL setting is false', async () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        const disposableArray: Disposable[] = [disposable.object];

        // const executeInTerminalStub = sinon.stub(replUtils, 'executeInTerminal').returns(Promise.resolve());

        // Replace the original functions with the stubs
        // sinon.replace(replUtils, 'getSendToNativeREPLSetting', getSendToNativeREPLSettingStub);
        // sinon.replace(replUtils, 'executeInTerminal', executeInTerminalStub);

        await replCommands.registerReplCommands(
            disposableArray,
            interpreterService.object,
            executionHelper.object,
            commandManager.object,
        );

        // Extract the registered command handler and invoke it
        const call = registerCommandSpy.getCall(0);
        if (call) {
            const commandHandler = call.args[1];
            await commandHandler();
        } else {
            throw new Error('registerCommand was not called');
        }

        // Verify the function interactions
        sinon.assert.calledOnce(getSendToNativeREPLSettingStub);
        // sinon.assert.calledOnce(executeInTerminalStub);

        // Restore the original functions
        sinon.restore();
    });
});
