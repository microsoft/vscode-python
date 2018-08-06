// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, DebugConfigurationProvider, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../client/common/constants';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { IConfigurationService, ILogger, IPythonSettings } from '../../../client/common/types';
import { PythonV2DebugConfigurationProvider } from '../../../client/debugger';
import { DebugOptions, LaunchRequestArguments } from '../../../client/debugger/Common/Contracts';
import { PythonLaunchDebugConfiguration } from '../../../client/debugger/configProviders/baseProvider';
import { ConfigurationProviderUtils } from '../../../client/debugger/configProviders/configurationProviderUtils';
import { IConfigurationProviderUtils } from '../../../client/debugger/configProviders/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { DebuggerTypeName } from '../../../client/debugger/Common/constants';

[
    { debugType: DebuggerTypeName, class: PythonV2DebugConfigurationProvider }
].forEach(provider => {
    suite(`Debugging - Config Provider ${provider.debugType}`, () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let debugProvider: DebugConfigurationProvider;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let fileSystem: TypeMoq.IMock<IFileSystem>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let pythonExecutionService: TypeMoq.IMock<IPythonExecutionService>;
        let logger: TypeMoq.IMock<ILogger>;
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            debugProvider = new provider.class(serviceContainer.object);
        });
        function createMoqWorkspaceFolder(folderPath: string) {
            const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
            return folder.object;
        }
        function setupIoc(pythonPath: string, isWindows: boolean = false, isMac: boolean = false, isLinux: boolean = false) {
            const confgService = TypeMoq.Mock.ofType<IConfigurationService>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            logger = TypeMoq.Mock.ofType<ILogger>();

            pythonExecutionService = TypeMoq.Mock.ofType<IPythonExecutionService>();
            pythonExecutionService.setup((x: any) => x.then).returns(() => undefined);
            const factory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
            factory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService.object));

            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPythonExecutionFactory))).returns(() => factory.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => confgService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationProviderUtils))).returns(() => new ConfigurationProviderUtils(serviceContainer.object));
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILogger))).returns(() => logger.object);

            const settings = TypeMoq.Mock.ofType<IPythonSettings>();
            settings.setup(s => s.pythonPath).returns(() => pythonPath);
            confgService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            setupOs(isWindows, isMac, isLinux);
        }
        function setupActiveEditor(fileName: string | undefined, languageId: string) {
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
            if (fileName) {
                const textEditor = TypeMoq.Mock.ofType<TextEditor>();
                const document = TypeMoq.Mock.ofType<TextDocument>();
                document.setup(d => d.languageId).returns(() => languageId);
                document.setup(d => d.fileName).returns(() => fileName);
                textEditor.setup(t => t.document).returns(() => document.object);
                documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
            } else {
                documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
            }
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDocumentManager))).returns(() => documentManager.object);
        }
        function setupWorkspaces(folders: string[]) {
            const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            const workspaceFolders = folders.map(createMoqWorkspaceFolder);
            workspaceService.setup(w => w.workspaceFolders).returns(() => workspaceFolders);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
        }
        function setupOs(isWindows: boolean, isMac: boolean, isLinux: boolean) {
            platformService.setup(p => p.isWindows).returns(() => isWindows);
            platformService.setup(p => p.isMac).returns(() => isMac);
            platformService.setup(p => p.isLinux).returns(() => isLinux);
        }
        test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);

            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(__dirname.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(__dirname, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an object with \'noDebug\' property is passed with a Workspace Folder and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { noDebug: true } as any as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(__dirname.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(__dirname, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);
            const filePath = Uri.file(path.dirname('')).fsPath;

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(filePath.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(filePath, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and no active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            setupIoc(pythonPath);
            setupActiveEditor(undefined, PYTHON_LANGUAGE);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', '');
            expect(debugConfig).not.to.have.property('cwd');
            expect(debugConfig).not.to.have.property('envFile');
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and non python file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.js';
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, 'javascript');
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', '');
            expect(debugConfig).not.to.have.property('cwd');
            expect(debugConfig).not.to.have.property('envFile');
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, with a workspace and an active python file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);
            const filePath = Uri.file(defaultWorkspace).fsPath;

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', activeFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(filePath.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(filePath, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Ensure `${config:python.pythonPath}` is replaced with actual pythonPath', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { pythonPath: '${config:python.pythonPath}' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('pythonPath', pythonPath);
        });
        test('Ensure hardcoded pythonPath is left unaltered', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugPythonPath = `Debug_PythonPath_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { pythonPath: debugPythonPath } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('pythonPath', debugPythonPath);
        });
        test('Test defaults of debugger', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);

            expect(debugConfig).to.have.property('console', 'integratedTerminal');
            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).to.be.deep.equal(['RedirectOutput']);
        });
        test('Test defaults of python debugger', async () => {
            if (provider.debugType === DebuggerTypeName) {
                return;
            }
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);

            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).to.be.deep.equal([DebugOptions.RedirectOutput]);
        });
        test('Test overriding defaults of debugger', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { redirectOutput: false } as PythonLaunchDebugConfiguration<LaunchRequestArguments>);

            expect(debugConfig).to.have.property('console', 'integratedTerminal');
            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).to.be.deep.equal([]);
        });
        async function testFixFilePathCase(isWindows: boolean, isMac: boolean, isLinux: boolean) {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, isWindows, isMac, isLinux);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);
            if (isWindows) {
                expect(debugConfig).to.have.property('debugOptions').contains(DebugOptions.FixFilePathCase);
            } else {
                expect(debugConfig).to.have.property('debugOptions').not.contains(DebugOptions.FixFilePathCase);
            }
        }
        test('Test fixFilePathCase for Windows', async () => {
            await testFixFilePathCase(true, false, false);
        });
        test('Test fixFilePathCase for Linux', async () => {
            await testFixFilePathCase(false, false, true);
        });
        test('Test fixFilePathCase for Mac', async () => {
            await testFixFilePathCase(false, true, false);
        });
        async function testPyramidConfiguration(isWindows: boolean, isLinux: boolean, isMac: boolean, addPyramidDebugOption: boolean = true, pyramidExists = true, shouldWork = true) {
            const workspacePath = path.join('usr', 'development', 'wksp1');
            const pythonPath = path.join(workspacePath, 'env', 'bin', 'python');
            const pyramidFilePath = path.join(path.dirname(pythonPath), 'lib', 'site_packages', 'pyramid', '__init__.py');
            const pserveFilePath = path.join(path.dirname(pyramidFilePath), 'scripts', 'pserve.py');
            const args = ['-c', 'import pyramid;print(pyramid.__file__)'];
            const workspaceFolder = createMoqWorkspaceFolder(workspacePath);
            const pythonFile = 'xyz.py';

            setupIoc(pythonPath, isWindows, isMac, isLinux);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            if (pyramidExists) {
                pythonExecutionService.setup(e => e.exec(TypeMoq.It.isValue(args), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({ stdout: pyramidFilePath }))
                    .verifiable(TypeMoq.Times.exactly(addPyramidDebugOption ? 1 : 0));
            } else {
                pythonExecutionService.setup(e => e.exec(TypeMoq.It.isValue(args), TypeMoq.It.isAny()))
                    .returns(() => Promise.reject('No Module Available'))
                    .verifiable(TypeMoq.Times.exactly(addPyramidDebugOption ? 1 : 0));
            }
            fileSystem.setup(f => f.fileExists(TypeMoq.It.isValue(pserveFilePath)))
                .returns(() => Promise.resolve(pyramidExists))
                .verifiable(TypeMoq.Times.exactly(pyramidExists && addPyramidDebugOption ? 1 : 0));
            appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAny()))
                .verifiable(TypeMoq.Times.exactly(pyramidExists || !addPyramidDebugOption ? 0 : 1));
            logger.setup(a => a.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .verifiable(TypeMoq.Times.exactly(pyramidExists || !addPyramidDebugOption ? 0 : 1));
            const options = addPyramidDebugOption ? { debugOptions: [DebugOptions.Pyramid], pyramid: true } : {};

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, options as any as DebugConfiguration);
            if (shouldWork) {
                expect(debugConfig).to.have.property('program', pserveFilePath);

                expect(debugConfig).to.have.property('debugOptions');
                expect((debugConfig as any).debugOptions).contains(DebugOptions.Jinja);
            } else {
                expect(debugConfig!.program).to.be.not.equal(pserveFilePath);
            }
            pythonExecutionService.verifyAll();
            fileSystem.verifyAll();
            appShell.verifyAll();
            logger.verifyAll();
        }
        test('Program is set for Pyramid (windows)', async () => {
            await testPyramidConfiguration(true, false, false);
        });
        test('Program is set for Pyramid (Linux)', async () => {
            await testPyramidConfiguration(false, true, false);
        });
        test('Program is set for Pyramid (Mac)', async () => {
            await testPyramidConfiguration(false, false, true);
        });
        test('Program is not set for Pyramid when DebugOption is not set (windows)', async () => {
            await testPyramidConfiguration(true, false, false, false, false, false);
        });
        test('Program is not set for Pyramid when DebugOption is not set (Linux)', async () => {
            await testPyramidConfiguration(false, true, false, false, false, false);
        });
        test('Program is not set for Pyramid when DebugOption is not set (Mac)', async () => {
            await testPyramidConfiguration(false, false, true, false, false, false);
        });
        test('Message is displayed when pyramid script does not exist (windows)', async () => {
            await testPyramidConfiguration(true, false, false, true, false, false);
        });
        test('Message is displayed when pyramid script does not exist (Linux)', async () => {
            await testPyramidConfiguration(false, true, false, true, false, false);
        });
        test('Message is displayed when pyramid script does not exist (Mac)', async () => {
            await testPyramidConfiguration(false, false, true, true, false, false);
        });
        test('Auto detect flask debugging', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { module: 'flask' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).contains(DebugOptions.RedirectOutput);
            expect((debugConfig as any).debugOptions).contains(DebugOptions.Jinja);
        });
    });
});
