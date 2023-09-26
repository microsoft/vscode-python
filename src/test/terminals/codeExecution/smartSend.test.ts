import * as TypeMoq from 'typemoq';
import * as path from 'path';
import { TextEditor, Selection, window, Uri, Position, TextDocument } from 'vscode';
import * as fs from 'fs-extra';
import { SemVer } from 'semver';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../../../client/common/application/types';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IConfigurationService, IExperimentService } from '../../../client/common/types';
import { CodeExecutionHelper } from '../../../client/terminals/codeExecution/helper';
import { IServiceContainer } from '../../../client/ioc/types';
import { ICodeExecutionHelper } from '../../../client/terminals/types';
import { EnableREPLSmartSend } from '../../../client/common/experiments/groups';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { PYTHON_PATH } from '../../common';
import { Architecture } from '../../../client/common/utils/platform';
import { ProcessService } from '../../../client/common/process/proc';

const TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'terminalExec');

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

    let processService: TypeMoq.IMock<IProcessService>;

    let document: TypeMoq.IMock<TextDocument>;
    const workingPython: PythonEnvironment = {
        path: PYTHON_PATH,
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        displayName: 'Python',
        envType: EnvironmentType.Unknown,
        architecture: Architecture.x64,
    };

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
        processService = TypeMoq.Mock.ofType<IProcessService>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processService.setup((x: any) => x.then).returns(() => undefined);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IDocumentManager)))
            .returns(() => documentManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell)))
            .returns(() => applicationShell.object);
        processServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));
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
        // interpreterService
        //     .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
        //     .returns(() => Promise.resolve(({ path: 'ps' } as unknown) as PythonEnvironment));
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(workingPython));
        // processServiceFactory.setup((p) => p.create()).returns(() => Promise.resolve(processService.object));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // processService.setup((p) => (p as any).then).returns(() => undefined);

        /// /////////////////
        // processServiceFactory
        //     .setup((p) => p.create(TypeMoq.It.isAny()))
        //     .returns(() => Promise.resolve(processService.object));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // processService.setup((p) => (p as any).then).returns(() => undefined);

        codeExecutionHelper = new CodeExecutionHelper(serviceContainer.object);
        document = TypeMoq.Mock.ofType<TextDocument>();
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

    test('Smart selection before normalization', async () => {
        experimentService
            .setup((exp) => exp.inExperimentSync(TypeMoq.It.isValue(EnableREPLSmartSend.experiment)))
            .returns(() => true);

        // editor.setup((e) => e.selection).returns(() => new Selection(0, 0, 0, 0));
        // const textEditor = await window.showTextDocument(Uri.file(path.join(TEST_FILES_PATH, `sample_raw.py`)));

        // const activeEditor = TypeMoq.Mock.ofType<TextEditor>();
        // const selection = TypeMoq.Mock.ofType<Selection>();
        // selection.setup((s) => s.isEmpty).returns(() => true);

        const activeEditor = TypeMoq.Mock.ofType<TextEditor>();
        const firstIndexPosition = new Position(0, 0);
        const selection = TypeMoq.Mock.ofType<Selection>();
        // activeEditor.setup((e) => e.selection).returns(() => selection.object);
        const wholeFileContent = await fs.readFile(path.join(TEST_FILES_PATH, `sample_smart_selection.py`), 'utf8');

        selection.setup((s) => s.anchor).returns(() => firstIndexPosition);
        selection.setup((s) => s.active).returns(() => firstIndexPosition);
        selection.setup((s) => s.isEmpty).returns(() => true);
        activeEditor.setup((e) => e.selection).returns(() => selection.object);

        documentManager.setup((d) => d.activeTextEditor).returns(() => activeEditor.object);
        document.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => wholeFileContent);
        const actualProcessService = new ProcessService();
        processService
            .setup((p) => p.execObservable(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((file, args, options) =>
                actualProcessService.execObservable.apply(actualProcessService, [file, args, options]),
            );
        // Imitiate we are sending from the very first line.
        const normalizedCode = await codeExecutionHelper.normalizeLines('my_dict = {', wholeFileContent);
        console.log('hi');
    });
});
