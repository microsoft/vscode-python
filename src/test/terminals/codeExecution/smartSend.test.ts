import * as TypeMoq from 'typemoq';
import { TextEditor, Selection } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../../../client/common/application/types';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IConfigurationService, IExperimentService } from '../../../client/common/types';
import { CodeExecutionHelper } from '../../../client/terminals/codeExecution/helper';
import { IServiceContainer } from '../../../client/ioc/types';
import { ICodeExecutionHelper } from '../../../client/terminals/types';
import { EnableREPLSmartSend } from '../../../client/common/experiments/groups';

suite('REPL - Smart Send', () => {
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let applicationShell: TypeMoq.IMock<IApplicationShell>;

    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let commandManager: TypeMoq.IMock<ICommandManager>;

    let processServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let configurationService: TypeMoq.IMock<IConfigurationService>;

    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let codeExecutionHelper: ICodeExecutionHelper;
    let experimentService: TypeMoq.IMock<IExperimentService>;

    // suite set up only run once for each suite. Very start
    // set up --- before each test
    // tests -- actual tests
    // tear down -- run after each test
    // suite tear down only run once at the very end.

    // all object that is common to every test. What each test needs
    setup(() => {
        // Create mock
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        applicationShell = TypeMoq.Mock.ofType<IApplicationShell>();
        processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();

        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IDocumentManager)))
            .returns(() => documentManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell)))
            .returns(() => applicationShell.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IProcessServiceFactory)))
            .returns(() => processServiceFactory.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
            .returns(() => interpreterService.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICommandManager))).returns(() => commandManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
            .returns(() => configurationService.object);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentService.object);
        codeExecutionHelper = new CodeExecutionHelper(serviceContainer.object);
    });

    test('Test executeCommand with cursorMove is called', async () => {
        const activeEditor = TypeMoq.Mock.ofType<TextEditor>();
        const selection = TypeMoq.Mock.ofType<Selection>();
        selection.setup((s) => s.isEmpty).returns(() => true);
        activeEditor.setup((e) => e.selection).returns(() => selection.object);
        // experimentService
        //     .setup((exp) => exp.inExperiment(EnableREPLSmartSend.experiment))
        //     .returns(() => Promise.resolve(true))
        //     .verifiable(TypeMoq.Times.once());
        experimentService
            .setup((exp) => exp.inExperimentSync(TypeMoq.It.isValue(EnableREPLSmartSend.experiment)))
            .returns(() => true);
        // mock experiment service.
        // mock what happens when commandManager.executeCommand
        // just use Typemoq
        // verify arugments that executeCommand is being passed
        // verify that executeCommand is called once for each argument

        commandManager
            .setup((c) =>
                c.executeCommand('cursorMove', {
                    to: 'down',
                    by: 'line',
                    value: Number(3),
                }),
            )
            .verifiable(TypeMoq.Times.once());
        commandManager
            .setup((c) => c.executeCommand('cursorEnd'))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        // .returns(() => Promise.resolve())
        try {
            await codeExecutionHelper.moveToNextBlock(3, activeEditor.object);

            commandManager.verifyAll();
        } catch (error) {
            console.log(error);
        }
    });
});
