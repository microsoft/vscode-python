// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, DebugConfigurationProvider, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { IInvalidPythonPathInDebuggerService } from '../../../../../client/application/diagnostics/types';
import { IDocumentManager, IWorkspaceService } from '../../../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../../../client/common/constants';
import { IPlatformService } from '../../../../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../../../client/common/process/types';
import { IConfigurationService, IPythonSettings } from '../../../../../client/common/types';
import { OSType } from '../../../../../client/common/utils/platform';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { IDebugEnvironmentVariablesService } from '../../../../../client/debugger/extension/configuration/resolvers/helper';
import { LaunchConfigurationResolver } from '../../../../../client/debugger/extension/configuration/resolvers/launch';
import { ILaunchDebugConfigurationResolverExperiment } from '../../../../../client/debugger/extension/configuration/types';
import { DebugOptions, LaunchRequestArguments } from '../../../../../client/debugger/types';
import { IInterpreterHelper } from '../../../../../client/interpreter/contracts';
import { getOSType } from '../../../../common';
import { getInfoPerOS, setUpOSMocks } from './common';

getInfoPerOS().forEach(([osName, osType, path]) => {
    if (osType === OSType.Unknown) {
        return;
    }

    suite(`Debugging - Config Resolver Launch, OS = ${osName}`, () => {
        let debugProvider: DebugConfigurationProvider;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let pythonExecutionService: TypeMoq.IMock<IPythonExecutionService>;
        let helper: TypeMoq.IMock<IInterpreterHelper>;
        let workspaceService: TypeMoq.IMock<IWorkspaceService>;
        let documentManager: TypeMoq.IMock<IDocumentManager>;
        let diagnosticsService: TypeMoq.IMock<IInvalidPythonPathInDebuggerService>;
        let debugEnvHelper: TypeMoq.IMock<IDebugEnvironmentVariablesService>;
        let configExperiment: TypeMoq.IMock<ILaunchDebugConfigurationResolverExperiment>;
        function createMoqWorkspaceFolder(folderPath: string) {
            const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
            return folder.object;
        }
        function setupIoc(pythonPath: string, workspaceFolder?: WorkspaceFolder) {
            const confgService = TypeMoq.Mock.ofType<IConfigurationService>();
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            documentManager = TypeMoq.Mock.ofType<IDocumentManager>();

            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            diagnosticsService = TypeMoq.Mock.ofType<IInvalidPythonPathInDebuggerService>();
            debugEnvHelper = TypeMoq.Mock.ofType<IDebugEnvironmentVariablesService>();
            configExperiment = TypeMoq.Mock.ofType<ILaunchDebugConfigurationResolverExperiment>();

            pythonExecutionService = TypeMoq.Mock.ofType<IPythonExecutionService>();
            helper = TypeMoq.Mock.ofType<IInterpreterHelper>();
            pythonExecutionService.setup((x: any) => x.then).returns(() => undefined);
            const factory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
            factory
                .setup(f => f.create(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(pythonExecutionService.object));
            helper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
            diagnosticsService
                .setup(h => h.validatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(true));

            const settings = TypeMoq.Mock.ofType<IPythonSettings>();
            settings.setup(s => s.pythonPath).returns(() => pythonPath);
            if (workspaceFolder) {
                settings.setup(s => s.envFile).returns(() => path.join(workspaceFolder!.uri.fsPath, '.env2'));
            }
            confgService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            setUpOSMocks(osType, platformService);
            debugEnvHelper.setup(x => x.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
            configExperiment
                .setup(c => c.modifyConfigurationBasedOnExperiment(TypeMoq.It.isAny()))
                .returns(() => {
                    return;
                });

            debugProvider = new LaunchConfigurationResolver(
                workspaceService.object,
                documentManager.object,
                diagnosticsService.object,
                platformService.object,
                confgService.object,
                debugEnvHelper.object,
                configExperiment.object
            );
        }
        function setupActiveEditor(fileName: string | undefined, languageId: string) {
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
        }
        function setupWorkspaces(folders: string[]) {
            const workspaceFolders = folders.map(createMoqWorkspaceFolder);
            workspaceService.setup(w => w.workspaceFolders).returns(() => workspaceFolders);
        }
        test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, workspaceFolder);

            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(
                workspaceFolder,
                {} as DebugConfiguration
            );

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', 'python');
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(__dirname.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(__dirname, '.env2').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test("Defaults should be returned when an object with 'noDebug' property is passed with a Workspace Folder and active file", async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, workspaceFolder);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                noDebug: true
            } as any) as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', 'python');
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(__dirname.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(__dirname, '.env2').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, createMoqWorkspaceFolder(path.dirname(pythonFile)));
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);
            const filePath = Uri.file(path.dirname('')).fsPath;

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', 'python');
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(filePath.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(filePath, '.env2').toLowerCase());
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
            expect(debugConfig).to.have.property('type', 'python');
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
            expect(debugConfig).to.have.property('type', 'python');
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
            const defaultWorkspace = path.join('usr', 'desktop');
            setupIoc(pythonPath, createMoqWorkspaceFolder(defaultWorkspace));
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);
            const filePath = Uri.file(defaultWorkspace).fsPath;

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', 'python');
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', activeFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(filePath.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(filePath, '.env2').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test("Ensure 'port' is left unaltered", async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const port = 12341234;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                port,
                request: 'launch'
            } as any) as DebugConfiguration);

            expect(debugConfig).to.have.property('port', port);
        });
        test("Ensure 'localRoot' is left unaltered", async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const localRoot = `Debug_PythonPath_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                localRoot,
                request: 'launch'
            } as any) as DebugConfiguration);

            expect(debugConfig).to.have.property('localRoot', localRoot);
        });
        test("Ensure 'remoteRoot' is left unaltered", async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const remoteRoot = `Debug_PythonPath_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                remoteRoot,
                request: 'launch'
            } as any) as DebugConfiguration);

            expect(debugConfig).to.have.property('remoteRoot', remoteRoot);
        });
        test("Ensure 'localRoot' and 'remoteRoot' are not used", async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
            const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                localRoot,
                remoteRoot,
                request: 'launch'
            } as any) as DebugConfiguration);

            expect(debugConfig!.pathMappings).to.be.equal(undefined, 'unexpected pathMappings');
        });
        test('Ensure non-empty path mappings are used', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const expected = {
                localRoot: `Debug_PythonPath_Local_Root_${new Date().toString()}`,
                remoteRoot: `Debug_PythonPath_Remote_Root_${new Date().toString()}`
            };
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                pathMappings: [expected]
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.be.deep.equal([expected]);
        });
        test('Ensure replacement in path mappings happens', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                pathMappings: [
                    {
                        localRoot: '${workspaceFolder}/spam',
                        remoteRoot: '${workspaceFolder}/spam'
                    }
                ]
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.be.deep.equal([
                {
                    localRoot: `${workspaceFolder.uri.fsPath}/spam`,
                    remoteRoot: '${workspaceFolder}/spam'
                }
            ]);
        });
        test('Ensure path mappings are not automatically added if missing', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);
            const localRoot = `Debug_PythonPath_${new Date().toString()}`;

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                localRoot: localRoot
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.be.equal(undefined, 'unexpected pathMappings');
        });
        test('Ensure path mappings are not automatically added if empty', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);
            const localRoot = `Debug_PythonPath_${new Date().toString()}`;

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                localRoot: localRoot,
                pathMappings: []
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.be.equal(undefined, 'unexpected pathMappings');
        });
        test('Ensure path mappings are not automatically added to existing', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);
            const localRoot = `Debug_PythonPath_${new Date().toString()}`;

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                localRoot: localRoot,
                pathMappings: [
                    {
                        localRoot: '/spam',
                        remoteRoot: '.'
                    }
                ]
            } as any) as DebugConfiguration);

            expect(debugConfig).to.have.property('localRoot', localRoot);
            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.be.deep.equal([
                {
                    localRoot: '/spam',
                    remoteRoot: '.'
                }
            ]);
        });
        test('Ensure drive letter is lower cased for local path mappings on Windows when with existing path mappings', async function() {
            if (getOSType() !== OSType.Windows || osType !== OSType.Windows) {
                // tslint:disable-next-line: no-invalid-this
                return this.skip();
            }
            const workspaceFolder = createMoqWorkspaceFolder(path.join('C:', 'Debug', 'Python_Path'));
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);
            const localRoot = Uri.file(path.join(workspaceFolder.uri.fsPath, 'app')).fsPath;

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                pathMappings: [
                    {
                        localRoot,
                        remoteRoot: '/app/'
                    }
                ]
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            const expected = Uri.file(`c${localRoot.substring(1)}`).fsPath;
            expect(pathMappings).to.deep.equal([
                {
                    localRoot: expected,
                    remoteRoot: '/app/'
                }
            ]);
        });
        test('Ensure drive letter is not lower cased for local path mappings on non-Windows when with existing path mappings', async function() {
            if (getOSType() === OSType.Windows || osType === OSType.Windows) {
                // tslint:disable-next-line: no-invalid-this
                return this.skip();
            }
            const workspaceFolder = createMoqWorkspaceFolder(path.join('USR', 'Debug', 'Python_Path'));
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);
            const localRoot = Uri.file(path.join(workspaceFolder.uri.fsPath, 'app')).fsPath;

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                pathMappings: [
                    {
                        localRoot,
                        remoteRoot: '/app/'
                    }
                ]
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.deep.equal([
                {
                    localRoot,
                    remoteRoot: '/app/'
                }
            ]);
        });
        test('Ensure local path mappings are not modified when not pointing to a local drive', async () => {
            const workspaceFolder = createMoqWorkspaceFolder(path.join('Server', 'Debug', 'Python_Path'));
            setupActiveEditor('spam.py', PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                request: 'launch',
                pathMappings: [
                    {
                        localRoot: '/spam',
                        remoteRoot: '.'
                    }
                ]
            } as any) as DebugConfiguration);

            const pathMappings = (debugConfig as LaunchRequestArguments).pathMappings;
            expect(pathMappings).to.deep.equal([
                {
                    localRoot: '/spam',
                    remoteRoot: '.'
                }
            ]);
        });
        test('Ensure `${config:python.pythonPath}` is replaced with actual pythonPath', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PYTHON_LANGUAGE);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                pythonPath: '${config:python.pythonPath}'
            } as any) as DebugConfiguration);

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
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                pythonPath: debugPythonPath
            } as any) as DebugConfiguration);

            expect(debugConfig).to.have.property('pythonPath', debugPythonPath);
        });
        test('Test defaults of debugger', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(
                workspaceFolder,
                {} as DebugConfiguration
            );

            expect(debugConfig).to.have.property('console', 'integratedTerminal');
            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('showReturnValue', true);
            expect(debugConfig).to.have.property('debugOptions');
            const expectedOptions = [DebugOptions.ShowReturnValue];
            if (osType === OSType.Windows) {
                expectedOptions.push(DebugOptions.FixFilePathCase);
            }
            expect((debugConfig as any).debugOptions).to.be.deep.equal(expectedOptions);
        });
        test('Test defaults of python debugger', async () => {
            if ('python' === DebuggerTypeName) {
                return;
            }
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(
                workspaceFolder,
                {} as DebugConfiguration
            );

            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('showReturnValue', true);
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).to.be.deep.equal([]);
        });
        test('Test overriding defaults of debugger', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {
                redirectOutput: true,
                justMyCode: false
            } as LaunchRequestArguments);

            expect(debugConfig).to.have.property('console', 'integratedTerminal');
            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('showReturnValue', true);
            expect(debugConfig).to.have.property('redirectOutput', true);
            expect(debugConfig).to.have.property('justMyCode', false);
            expect(debugConfig).to.have.property('debugOptions');
            const expectedOptions = [
                DebugOptions.DebugStdLib,
                DebugOptions.ShowReturnValue,
                DebugOptions.RedirectOutput
            ];
            if (osType === OSType.Windows) {
                expectedOptions.push(DebugOptions.FixFilePathCase);
            }
            expect((debugConfig as any).debugOptions).to.be.deep.equal(expectedOptions);
        });
        const testsForJustMyCode = [
            {
                justMyCode: false,
                debugStdLib: true,
                expectedResult: false
            },
            {
                justMyCode: false,
                debugStdLib: false,
                expectedResult: false
            },
            {
                justMyCode: false,
                debugStdLib: undefined,
                expectedResult: false
            },
            {
                justMyCode: true,
                debugStdLib: false,
                expectedResult: true
            },
            {
                justMyCode: true,
                debugStdLib: true,
                expectedResult: true
            },
            {
                justMyCode: true,
                debugStdLib: undefined,
                expectedResult: true
            },
            {
                justMyCode: undefined,
                debugStdLib: false,
                expectedResult: true
            },
            {
                justMyCode: undefined,
                debugStdLib: true,
                expectedResult: false
            },
            {
                justMyCode: undefined,
                debugStdLib: undefined,
                expectedResult: true
            }
        ];
        test('Ensure justMyCode property is correctly derived from debugStdLib', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);
            testsForJustMyCode.forEach(async testParams => {
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {
                    debugStdLib: testParams.debugStdLib,
                    justMyCode: testParams.justMyCode
                } as LaunchRequestArguments);
                expect(debugConfig).to.have.property('justMyCode', testParams.expectedResult);
            });
        });
        const testsForRedirectOutput = [
            {
                console: 'internalConsole',
                redirectOutput: undefined,
                expectedRedirectOutput: true
            },
            {
                console: 'integratedTerminal',
                redirectOutput: undefined,
                expectedRedirectOutput: undefined
            },
            {
                console: 'externalTerminal',
                redirectOutput: undefined,
                expectedRedirectOutput: undefined
            },
            {
                console: 'internalConsole',
                redirectOutput: false,
                expectedRedirectOutput: false
            },
            {
                console: 'integratedTerminal',
                redirectOutput: false,
                expectedRedirectOutput: false
            },
            {
                console: 'externalTerminal',
                redirectOutput: false,
                expectedRedirectOutput: false
            },
            {
                console: 'internalConsole',
                redirectOutput: true,
                expectedRedirectOutput: true
            },
            {
                console: 'integratedTerminal',
                redirectOutput: true,
                expectedRedirectOutput: true
            },
            {
                console: 'externalTerminal',
                redirectOutput: true,
                expectedRedirectOutput: true
            }
        ];
        test('Ensure redirectOutput property is correctly derived from console type', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);
            testsForRedirectOutput.forEach(async testParams => {
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {
                    console: testParams.console,
                    redirectOutput: testParams.redirectOutput
                } as LaunchRequestArguments);
                expect(debugConfig).to.have.property('redirectOutput', testParams.expectedRedirectOutput);
                if (testParams.expectedRedirectOutput) {
                    expect(debugConfig).to.have.property('debugOptions');
                    expect((debugConfig as any).debugOptions).to.contain(DebugOptions.RedirectOutput);
                }
            });
        });
        test('Test fixFilePathCase', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(
                workspaceFolder,
                {} as DebugConfiguration
            );
            if (osType === OSType.Windows) {
                expect(debugConfig)
                    .to.have.property('debugOptions')
                    .contains(DebugOptions.FixFilePathCase);
            } else {
                expect(debugConfig)
                    .to.have.property('debugOptions')
                    .not.contains(DebugOptions.FixFilePathCase);
            }
        });
        test('Jinja added for Pyramid', async () => {
            const workspacePath = path.join('usr', 'development', 'wksp1');
            const pythonPath = path.join(workspacePath, 'env', 'bin', 'python');
            const workspaceFolder = createMoqWorkspaceFolder(workspacePath);
            const pythonFile = 'xyz.py';

            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const options = { debugOptions: [DebugOptions.Pyramid], pyramid: true };

            const debugConfig = await debugProvider.resolveDebugConfiguration!(
                workspaceFolder,
                (options as any) as DebugConfiguration
            );
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).contains(DebugOptions.Jinja);
        });
        test('Auto detect flask debugging', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, ({
                module: 'flask'
            } as any) as DebugConfiguration);

            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).contains(DebugOptions.Jinja);
        });
        test('Test validation of Python Path when launching debugger (with invalid python path)', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            diagnosticsService.reset();
            diagnosticsService
                .setup(h =>
                    h.validatePythonPath(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {
                redirectOutput: false,
                pythonPath
            } as LaunchRequestArguments);

            diagnosticsService.verifyAll();
            expect(debugConfig).to.be.equal(undefined, 'Not undefined');
        });
        test('Test validation of Python Path when launching debugger (with valid python path)', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            diagnosticsService.reset();
            diagnosticsService
                .setup(h =>
                    h.validatePythonPath(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve(true))
                .verifiable(TypeMoq.Times.once());

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {
                redirectOutput: false,
                pythonPath
            } as LaunchRequestArguments);

            diagnosticsService.verifyAll();
            expect(debugConfig).to.not.be.equal(undefined, 'is undefined');
        });
        test('Resolve path to envFile', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            const expectedEnvFilePath = `${workspaceFolder.uri.fsPath}${
                osType === OSType.Windows ? '\\' : '/'
            }${'wow.envFile'}`;
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

            diagnosticsService.reset();
            diagnosticsService
                .setup(h =>
                    h.validatePythonPath(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve(true));

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {
                redirectOutput: false,
                pythonPath,
                envFile: path.join('${workspaceFolder}', 'wow.envFile')
            } as LaunchRequestArguments);

            expect(debugConfig!.envFile).to.be.equal(expectedEnvFilePath);
        });
        async function testSetting(
            requestType: 'launch' | 'attach',
            settings: Record<string, boolean>,
            debugOptionName: DebugOptions,
            mustHaveDebugOption: boolean
        ) {
            setupIoc('pythonPath');
            const debugConfiguration: DebugConfiguration = {
                request: requestType,
                type: 'python',
                name: '',
                ...settings
            };
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, debugConfiguration);
            if (mustHaveDebugOption) {
                expect((debugConfig as any).debugOptions).contains(debugOptionName);
            } else {
                expect((debugConfig as any).debugOptions).not.contains(debugOptionName);
            }
        }
        type LaunchOrAttach = 'launch' | 'attach';
        const items: LaunchOrAttach[] = ['launch', 'attach'];
        items.forEach(requestType => {
            test(`Must not contain Sub Process when not specified (${requestType})`, async () => {
                await testSetting(requestType, {}, DebugOptions.SubProcess, false);
            });
            test(`Must not contain Sub Process setting=false (${requestType})`, async () => {
                await testSetting(requestType, { subProcess: false }, DebugOptions.SubProcess, false);
            });
            test(`Must not contain Sub Process setting=true (${requestType})`, async () => {
                await testSetting(requestType, { subProcess: true }, DebugOptions.SubProcess, true);
            });
        });
    });
});
