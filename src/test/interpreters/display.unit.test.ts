import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import {
    ConfigurationTarget,
    Disposable,
    EventEmitter,
    StatusBarAlignment,
    StatusBarItem,
    Uri,
    WorkspaceFolder,
} from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { IFileSystem } from '../../client/common/platform/types';
import { IDisposableRegistry, IOutputChannel, IPathUtils, ReadWrite } from '../../client/common/types';
import { Interpreters } from '../../client/common/utils/localize';
import { Architecture } from '../../client/common/utils/platform';
import {
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterService,
    IInterpreterStatusbarVisibilityFilter,
    IPython27SupportPrompt,
} from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { IServiceContainer } from '../../client/ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../client/pythonEnvironments/info';

const info: PythonEnvironment = {
    architecture: Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    envType: EnvironmentType.Unknown,
    version: new SemVer('0.0.0-alpha'),
    sysPrefix: '',
    sysVersion: '',
};

suite('Interpreters Display', () => {
    let applicationShell: TypeMoq.IMock<IApplicationShell>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let disposableRegistry: Disposable[];
    let statusBar: TypeMoq.IMock<StatusBarItem>;
    let interpreterDisplay: IInterpreterDisplay;
    let interpreterHelper: TypeMoq.IMock<IInterpreterHelper>;
    let pathUtils: TypeMoq.IMock<IPathUtils>;
    let output: TypeMoq.IMock<IOutputChannel>;
    let python27SupportPrompt: TypeMoq.IMock<IPython27SupportPrompt>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        applicationShell = TypeMoq.Mock.ofType<IApplicationShell>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        interpreterHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        disposableRegistry = [];
        statusBar = TypeMoq.Mock.ofType<StatusBarItem>();
        pathUtils = TypeMoq.Mock.ofType<IPathUtils>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        python27SupportPrompt = TypeMoq.Mock.ofType<IPython27SupportPrompt>();

        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IOutputChannel), STANDARD_OUTPUT_CHANNEL))
            .returns(() => output.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell)))
            .returns(() => applicationShell.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
            .returns(() => interpreterService.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry))).returns(() => disposableRegistry);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterHelper)))
            .returns(() => interpreterHelper.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IPathUtils))).returns(() => pathUtils.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPython27SupportPrompt)))
            .returns(() => python27SupportPrompt.object);

        applicationShell
            .setup((a) => a.createStatusBarItem(TypeMoq.It.isValue(StatusBarAlignment.Left), TypeMoq.It.isValue(100)))
            .returns(() => statusBar.object);
        pathUtils.setup((p) => p.getDisplayName(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p) => p);
        python27SupportPrompt
            .setup((p) => p.shouldShowPrompt(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(false));

        createInterpreterDisplay();
    });
    function createInterpreterDisplay(filters: IInterpreterStatusbarVisibilityFilter[] = []) {
        interpreterDisplay = new InterpreterDisplay(serviceContainer.object);
        filters.forEach((f) => interpreterDisplay.registerVisibilityFilter(f));
    }
    function setupWorkspaceFolder(resource: Uri, workspaceFolder?: Uri) {
        if (workspaceFolder) {
            const mockFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            mockFolder.setup((w) => w.uri).returns(() => workspaceFolder);
            workspaceService
                .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource)))
                .returns(() => mockFolder.object);
        } else {
            workspaceService.setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource))).returns(() => undefined);
        }
    }
    test('Statusbar must be created and have command name initialized', () => {
        statusBar.verify((s) => (s.command = TypeMoq.It.isValue('python.setInterpreter')), TypeMoq.Times.once());
        expect(disposableRegistry).to.be.lengthOf.above(0);
        expect(disposableRegistry).contain(statusBar.object);
    });
    test('Display name and tooltip must come from interpreter info', async () => {
        const resource = Uri.file('x');
        const workspaceFolder = Uri.file('workspace');
        const activeInterpreter: PythonEnvironment = {
            ...info,
            displayName: 'Dummy_Display_Name',
            envType: EnvironmentType.Unknown,
            path: path.join('user', 'development', 'env', 'bin', 'python'),
        };
        setupWorkspaceFolder(resource, workspaceFolder);
        interpreterService
            .setup((i) => i.getInterpreters(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve([]));
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve(activeInterpreter));

        await interpreterDisplay.refresh(resource);

        statusBar.verify((s) => (s.text = TypeMoq.It.isValue(activeInterpreter.displayName)!), TypeMoq.Times.once());
        statusBar.verify((s) => (s.tooltip = TypeMoq.It.isValue(activeInterpreter.path)!), TypeMoq.Times.atLeastOnce());
    });
    test('Log the output channel if displayed needs to be updated with a new interpreter', async () => {
        const resource = Uri.file('x');
        const workspaceFolder = Uri.file('workspace');
        const activeInterpreter: PythonEnvironment = {
            ...info,
            displayName: 'Dummy_Display_Name',
            envType: EnvironmentType.Unknown,
            path: path.join('user', 'development', 'env', 'bin', 'python'),
        };
        pathUtils
            .setup((p) => p.getDisplayName(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => activeInterpreter.path);
        setupWorkspaceFolder(resource, workspaceFolder);
        interpreterService
            .setup((i) => i.getInterpreters(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve([]));
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve(activeInterpreter));
        output
            .setup((o) => o.appendLine(Interpreters.pythonInterpreterPath().format(activeInterpreter.path)))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());

        await interpreterDisplay.refresh(resource);

        output.verifyAll();
    });
    test('If interpreter is not identified then tooltip should point to python Path', async () => {
        const resource = Uri.file('x');
        const pythonPath = path.join('user', 'development', 'env', 'bin', 'python');
        const workspaceFolder = Uri.file('workspace');
        const displayName = 'This is the display name';

        setupWorkspaceFolder(resource, workspaceFolder);
        const pythonInterpreter: PythonEnvironment = ({
            displayName,
            path: pythonPath,
        } as any) as PythonEnvironment;
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve(pythonInterpreter));

        await interpreterDisplay.refresh(resource);

        statusBar.verify((s) => (s.tooltip = TypeMoq.It.isValue(pythonPath)), TypeMoq.Times.atLeastOnce());
        statusBar.verify((s) => (s.text = TypeMoq.It.isValue(displayName)), TypeMoq.Times.once());
    });
    test('If interpreter file does not exist then update status bar accordingly', async () => {
        const resource = Uri.file('x');
        const pythonPath = path.join('user', 'development', 'env', 'bin', 'python');
        const workspaceFolder = Uri.file('workspace');
        setupWorkspaceFolder(resource, workspaceFolder);

        interpreterService
            .setup((i) => i.getInterpreters(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve([{} as any]));
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => Promise.resolve(undefined));
        fileSystem.setup((f) => f.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));
        interpreterHelper
            .setup((v) => v.getInterpreterInformation(TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(undefined));

        await interpreterDisplay.refresh(resource);

        statusBar.verify((s) => (s.color = TypeMoq.It.isValue('')), TypeMoq.Times.once());
        statusBar.verify(
            (s) => (s.text = TypeMoq.It.isValue('$(alert) Select Python Interpreter')),
            TypeMoq.Times.once(),
        );
    });
    test('Ensure we try to identify the active workspace when a resource is not provided ', async () => {
        const workspaceFolder = Uri.file('x');
        const resource = workspaceFolder;
        const pythonPath = path.join('user', 'development', 'env', 'bin', 'python');
        const activeInterpreter: PythonEnvironment = {
            ...info,
            displayName: 'Dummy_Display_Name',
            envType: EnvironmentType.Unknown,
            companyDisplayName: 'Company Name',
            path: pythonPath,
        };
        fileSystem.setup((fs) => fs.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(resource)))
            .returns(() => Promise.resolve(activeInterpreter))
            .verifiable(TypeMoq.Times.once());
        interpreterHelper
            .setup((i) => i.getActiveWorkspaceUri(undefined))
            .returns(() => {
                return { folderUri: workspaceFolder, configTarget: ConfigurationTarget.Workspace };
            })
            .verifiable(TypeMoq.Times.once());

        await interpreterDisplay.refresh();

        interpreterHelper.verifyAll();
        interpreterService.verifyAll();
        statusBar.verify((s) => (s.text = TypeMoq.It.isValue(activeInterpreter.displayName)!), TypeMoq.Times.once());
        statusBar.verify((s) => (s.tooltip = TypeMoq.It.isValue(pythonPath)!), TypeMoq.Times.atLeastOnce());
    });
    suite('Visibility', () => {
        const resource = Uri.file('x');
        setup(() => {
            const workspaceFolder = Uri.file('workspace');
            const activeInterpreter: PythonEnvironment = {
                ...info,
                displayName: 'Dummy_Display_Name',
                envType: EnvironmentType.Unknown,
                path: path.join('user', 'development', 'env', 'bin', 'python'),
            };
            setupWorkspaceFolder(resource, workspaceFolder);
            interpreterService
                .setup((i) => i.getInterpreters(TypeMoq.It.isValue(workspaceFolder)))
                .returns(() => Promise.resolve([]));
            interpreterService
                .setup((i) => i.getActiveInterpreter(TypeMoq.It.isValue(workspaceFolder)))
                .returns(() => Promise.resolve(activeInterpreter));
        });
        test('Status bar must be displayed', async () => {
            await interpreterDisplay.refresh(resource);

            statusBar.verify((s) => s.show(), TypeMoq.Times.once());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.never());
        });
        test('Status bar must not be displayed if a filter is registered that needs it to be hidden', async () => {
            const filter1: IInterpreterStatusbarVisibilityFilter = { hidden: true };
            const filter2: IInterpreterStatusbarVisibilityFilter = { hidden: false };
            createInterpreterDisplay([filter1, filter2]);

            await interpreterDisplay.refresh(resource);

            statusBar.verify((s) => s.show(), TypeMoq.Times.never());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.once());
        });
        test('Status bar must not be displayed if both filters need it to be hidden', async () => {
            const filter1: IInterpreterStatusbarVisibilityFilter = { hidden: true };
            const filter2: IInterpreterStatusbarVisibilityFilter = { hidden: true };
            createInterpreterDisplay([filter1, filter2]);

            await interpreterDisplay.refresh(resource);

            statusBar.verify((s) => s.show(), TypeMoq.Times.never());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.once());
        });
        test('Status bar must be displayed if both filter needs it to be displayed', async () => {
            const filter1: IInterpreterStatusbarVisibilityFilter = { hidden: false };
            const filter2: IInterpreterStatusbarVisibilityFilter = { hidden: false };
            createInterpreterDisplay([filter1, filter2]);

            await interpreterDisplay.refresh(resource);

            statusBar.verify((s) => s.show(), TypeMoq.Times.once());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.never());
        });
        test('Status bar must hidden if a filter triggers need for status bar to be hidden', async () => {
            const event1 = new EventEmitter<void>();
            const filter1: ReadWrite<IInterpreterStatusbarVisibilityFilter> = { hidden: false, changed: event1.event };
            const event2 = new EventEmitter<void>();
            const filter2: ReadWrite<IInterpreterStatusbarVisibilityFilter> = { hidden: false, changed: event2.event };
            createInterpreterDisplay([filter1, filter2]);

            await interpreterDisplay.refresh(resource);

            statusBar.verify((s) => s.show(), TypeMoq.Times.once());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.never());

            // Filter one will now want the status bar to get hidden.
            statusBar.reset();
            filter1.hidden = true;
            event1.fire();

            statusBar.verify((s) => s.show(), TypeMoq.Times.never());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.once());

            // Filter two now needs it to be displayed.
            statusBar.reset();
            event2.fire();

            // No changes.
            statusBar.verify((s) => s.show(), TypeMoq.Times.never());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.once());

            // Filter two now needs it to be displayed & filter 1 will allow it to be displayed.
            filter1.hidden = false;
            statusBar.reset();
            event2.fire();

            // No changes.
            statusBar.verify((s) => s.show(), TypeMoq.Times.once());
            statusBar.verify((s) => s.hide(), TypeMoq.Times.never());
        });
    });
});
