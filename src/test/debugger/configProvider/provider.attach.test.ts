// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion no-invalid-this

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, DebugConfigurationProvider, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../client/common/constants';
import { EnumEx } from '../../../client/common/enumUtils';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { PythonV2DebugConfigurationProvider } from '../../../client/debugger';
import { AttachRequestArguments, DebugOptions } from '../../../client/debugger/Common/Contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { DebuggerTypeName } from '../../../client/debugger/Common/constants';

enum OS {
    Windows,
    Mac,
    Linux
}
[
    { debugType: DebuggerTypeName, class: PythonV2DebugConfigurationProvider }
].forEach(provider => {
    EnumEx.getNamesAndValues(OS).forEach(os => {
        suite(`Debugging - Config Provider attach, ${provider.debugType}, OS = ${os.name}`, () => {
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let debugProvider: DebugConfigurationProvider;
            let platformService: TypeMoq.IMock<IPlatformService>;
            let fileSystem: TypeMoq.IMock<IFileSystem>;
            const debugOptionsAvailable = [DebugOptions.RedirectOutput];
            if (os.value === OS.Windows) {
                debugOptionsAvailable.push(DebugOptions.FixFilePathCase);
                debugOptionsAvailable.push(DebugOptions.WindowsClient);
            } else {
                debugOptionsAvailable.push(DebugOptions.UnixClient);
            }
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                platformService = TypeMoq.Mock.ofType<IPlatformService>();
                fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
                platformService.setup(p => p.isWindows).returns(() => os.value === OS.Windows);
                platformService.setup(p => p.isMac).returns(() => os.value === OS.Mac);
                platformService.setup(p => p.isLinux).returns(() => os.value === OS.Linux);
                debugProvider = new provider.class(serviceContainer.object);
            });
            function createMoqWorkspaceFolder(folderPath: string) {
                const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
                folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
                return folder.object;
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
            test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', async () => {
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                const pythonFile = 'xyz.py';

                setupActiveEditor(pythonFile, PYTHON_LANGUAGE);

                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { request: 'attach' } as DebugConfiguration);

                expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
                expect(debugConfig).to.have.property('request', 'attach');
                expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
            });
            test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', async () => {
                const pythonFile = 'xyz.py';

                setupActiveEditor(pythonFile, PYTHON_LANGUAGE);
                setupWorkspaces([]);

                const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

                expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
                expect(debugConfig).to.have.property('request', 'attach');
                expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                expect(debugConfig).to.have.property('host', 'localhost');
            });
            test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and no active file', async () => {
                setupActiveEditor(undefined, PYTHON_LANGUAGE);
                setupWorkspaces([]);

                const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

                expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
                expect(debugConfig).to.have.property('request', 'attach');
                expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                expect(debugConfig).to.have.property('host', 'localhost');
            });
            test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and non python file', async () => {
                const activeFile = 'xyz.js';

                setupActiveEditor(activeFile, 'javascript');
                setupWorkspaces([]);

                const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

                expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
                expect(debugConfig).to.have.property('request', 'attach');
                expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                expect(debugConfig).to.not.have.property('localRoot');
                expect(debugConfig).to.have.property('host', 'localhost');
            });
            test('Defaults should be returned when an empty object is passed without Workspace Folder, with a workspace and an active python file', async () => {
                const activeFile = 'xyz.py';
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, { request: 'attach' } as DebugConfiguration);

                expect(Object.keys(debugConfig!)).to.have.lengthOf.least(3);
                expect(debugConfig).to.have.property('request', 'attach');
                expect(debugConfig).to.have.property('debugOptions').deep.equal(debugOptionsAvailable);
                expect(debugConfig).to.have.property('host', 'localhost');
            });
            test('Ensure \'localRoot\' is left unaltered', async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig).to.have.property('localRoot', localRoot);
            });
            ['localhost', '127.0.0.1', '::1'].forEach(host => {
                test(`Ensure path mappings are automatically added when host is '${host}'`, async () => {
                    const activeFile = 'xyz.py';
                    const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                    setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                    const defaultWorkspace = path.join('usr', 'desktop');
                    setupWorkspaces([defaultWorkspace]);

                    const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                    const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, host, request: 'attach' } as any as DebugConfiguration);

                    expect(debugConfig).to.have.property('localRoot', localRoot);
                    const pathMappings = (debugConfig as AttachRequestArguments).pathMappings;
                    expect(pathMappings).to.be.lengthOf(1);
                    expect(pathMappings![0].localRoot).to.be.equal(workspaceFolder.uri.fsPath);
                    expect(pathMappings![0].remoteRoot).to.be.equal(workspaceFolder.uri.fsPath);
                });
            });
            ['192.168.1.123', 'don.debugger.com'].forEach(host => {
                test(`Ensure path mappings are not automatically added when host is '${host}'`, async () => {
                    const activeFile = 'xyz.py';
                    const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                    setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                    const defaultWorkspace = path.join('usr', 'desktop');
                    setupWorkspaces([defaultWorkspace]);

                    const localRoot = `Debug_PythonPath_${new Date().toString()}`;
                    const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, host, request: 'attach' } as any as DebugConfiguration);

                    expect(debugConfig).to.have.property('localRoot', localRoot);
                    const pathMappings = (debugConfig as AttachRequestArguments).pathMappings;
                    expect(pathMappings).to.be.lengthOf(0);
                });
            });
            test('Ensure \'localRoot\' and \'remoteRoot\' is used', async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
                const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, remoteRoot, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig!.pathMappings).to.be.lengthOf(1);
                expect(debugConfig!.pathMappings).to.deep.include({ localRoot, remoteRoot });
            });
            test('Ensure \'localRoot\' and \'remoteRoot\' is used', async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const localRoot = `Debug_PythonPath_Local_Root_${new Date().toString()}`;
                const remoteRoot = `Debug_PythonPath_Remote_Root_${new Date().toString()}`;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { localRoot, remoteRoot, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig!.pathMappings).to.be.lengthOf(1);
                expect(debugConfig!.pathMappings).to.deep.include({ localRoot, remoteRoot });
            });
            test('Ensure \'remoteRoot\' is left unaltered', async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const remoteRoot = `Debug_PythonPath_${new Date().toString()}`;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { remoteRoot, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig).to.have.property('remoteRoot', remoteRoot);
            });
            test('Ensure \'port\' is left unaltered', async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const port = 12341234;
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { port, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig).to.have.property('port', port);
            });
            test('Ensure \'debugOptions\' are left unaltered', async () => {
                const activeFile = 'xyz.py';
                const workspaceFolder = createMoqWorkspaceFolder(__dirname);
                setupActiveEditor(activeFile, PYTHON_LANGUAGE);
                const defaultWorkspace = path.join('usr', 'desktop');
                setupWorkspaces([defaultWorkspace]);

                const debugOptions = debugOptionsAvailable.slice().concat(DebugOptions.Jinja, DebugOptions.Sudo);
                const expectedDebugOptions = debugOptions.slice();
                const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { debugOptions, request: 'attach' } as any as DebugConfiguration);

                expect(debugConfig).to.have.property('debugOptions').to.be.deep.equal(expectedDebugOptions);
            });
        });
    });
});
