// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any
// tslint:disable: max-classes-per-file

import { assert, expect } from 'chai';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { PlatformService } from '../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IOutputChannel } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { Pylint } from '../../client/linters/pylint';
import { ILinterInfo, ILinterManager, ILintMessage, LintMessageSeverity } from '../../client/linters/types';

// tslint:disable-next-line:max-func-body-length
suite('Pylint - Function hasConfigurationFile()', () => {
    const folder = path.join('user', 'a', 'b', 'c', 'd');
    const oldValueOfPYLINTRC = process.env.PYLINTRC;
    const pylintrcFiles = ['pylintrc', '.pylintrc'];
    const pylintrc = 'pylintrc';
    const dotPylintrc = '.pylintrc';
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);

        platformService = TypeMoq.Mock.ofType<IPlatformService>();
    });

    teardown(() => {
        if (oldValueOfPYLINTRC === undefined) {
            delete process.env.PYLINTRC;
        } else {
            process.env.PYLINTRC = oldValueOfPYLINTRC;
        }
    });

    pylintrcFiles.forEach(pylintrcFile => {
        test(`If ${pylintrcFile} exists in the current working directory, return true`, async () => {
            fileSystem
                .setup(x => x.fileExists(path.join(folder, pylintrc)))
                .returns(() => Promise.resolve(pylintrc === pylintrcFile));
            fileSystem
                .setup(x => x.fileExists(path.join(folder, dotPylintrc)))
                .returns(() => Promise.resolve(dotPylintrc === pylintrcFile));
            const hasConfig = await Pylint.hasConfigurationFile(fileSystem.object, folder, platformService.object);
            expect(hasConfig).to.equal(true, 'Should return true');
        });

        test(`If the current working directory is in a Python module, Pylint searches up the hierarchy of Python modules until it finds a ${pylintrcFile} file. And if ${pylintrcFile} exists, return true`, async () => {
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c', 'd'), '__init__.py')))
                .returns(() => Promise.resolve(true))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c', 'd'), pylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.atLeastOnce());
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c', 'd'), dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.atLeastOnce());

            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c'), '__init__.py')))
                .returns(() => Promise.resolve(true))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c'), pylintrc)))
                .returns(() => Promise.resolve(pylintrc === pylintrcFile));
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c'), dotPylintrc)))
                .returns(() => Promise.resolve(dotPylintrc === pylintrcFile));
            const hasConfig = await Pylint.hasConfigurationFile(fileSystem.object, folder, platformService.object);
            expect(hasConfig).to.equal(true, 'Should return true');
            fileSystem.verifyAll();
            platformService.verifyAll();
        });

        test(`If ${pylintrcFile} exists in the home directory, return true`, async () => {
            const home = os.homedir();
            fileSystem.setup(x => x.fileExists(path.join(folder, pylintrc))).returns(() => Promise.resolve(false));
            fileSystem.setup(x => x.fileExists(path.join(folder, dotPylintrc))).returns(() => Promise.resolve(false));
            fileSystem
                .setup(x => x.fileExists(path.join(folder, '__init__.py')))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup(x => x.fileExists(path.join(home, '.config', pylintrc)))
                .returns(() => Promise.resolve(pylintrc === pylintrcFile));
            fileSystem
                .setup(x => x.fileExists(path.join(home, dotPylintrc)))
                .returns(() => Promise.resolve(dotPylintrc === pylintrcFile));
            const hasConfig = await Pylint.hasConfigurationFile(fileSystem.object, folder, platformService.object);
            expect(hasConfig).to.equal(true, 'Should return true');
            fileSystem.verifyAll();
            platformService.verifyAll();
        });
    });

    test('If /etc/pylintrc exists in non-Windows platform, return true', async function() {
        if (new PlatformService().isWindows) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        const home = os.homedir();
        fileSystem
            .setup(x => x.fileExists(path.join(folder, pylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(folder, dotPylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(folder, '__init__.py')))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(home, '.config', pylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(home, dotPylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        platformService.setup(x => x.isWindows).returns(() => false);
        fileSystem.setup(x => x.fileExists(path.join('/etc', pylintrc))).returns(() => Promise.resolve(true));
        const hasConfig = await Pylint.hasConfigurationFile(fileSystem.object, folder, platformService.object);
        expect(hasConfig).to.equal(true, 'Should return true');
        fileSystem.verifyAll();
        platformService.verifyAll();
    });

    test('If none of the pylintrc configuration files exist anywhere, return false', async () => {
        const home = os.homedir();
        fileSystem
            .setup(x => x.fileExists(path.join(folder, pylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(folder, dotPylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(folder, '__init__.py')))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(home, '.config', pylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join(home, dotPylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        platformService
            .setup(x => x.isWindows)
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        fileSystem
            .setup(x => x.fileExists(path.join('/etc', pylintrc)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        const hasConfig = await Pylint.hasConfigurationFile(fileSystem.object, folder, platformService.object);
        expect(hasConfig).to.equal(false, 'Should return false');
        fileSystem.verifyAll();
        platformService.verifyAll();
    });

    test('If process.env.PYLINTRC contains the path to pylintrc, return true', async () => {
        process.env.PYLINTRC = path.join('path', 'to', 'pylintrc');
        const hasConfig = await Pylint.hasConfigurationFile(fileSystem.object, folder, platformService.object);
        expect(hasConfig).to.equal(true, 'Should return true');
    });
});

// tslint:disable-next-line:max-func-body-length
suite('Pylint - Function hasConfigurationFileInWorkspace()', () => {
    const pylintrc = 'pylintrc';
    const dotPylintrc = '.pylintrc';
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);

        platformService = TypeMoq.Mock.ofType<IPlatformService>();
    });

    test('If none of the pylintrc files exist up to the workspace root, return false', async () => {
        const folder = path.join('user', 'a', 'b', 'c');
        const root = path.join('user', 'a');

        const rootPathItems = ['user', 'a'];
        const folderPathItems = ['b', 'c']; // full folder path will be prefixed by root path
        let rootPath = '';
        rootPathItems.forEach(item => {
            rootPath = path.join(rootPath, item);
            fileSystem
                .setup(x => x.fileExists(path.join(rootPath, pylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.never());
            fileSystem
                .setup(x => x.fileExists(path.join(rootPath, dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.never());
        });
        let relativeFolderPath = '';
        folderPathItems.forEach(item => {
            relativeFolderPath = path.join(relativeFolderPath, item);
            const absoluteFolderPath = path.join(rootPath, relativeFolderPath);
            fileSystem
                .setup(x => x.fileExists(path.join(absoluteFolderPath, pylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup(x => x.fileExists(path.join(absoluteFolderPath, dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());
        });

        const hasConfig = await Pylint.hasConfigurationFileInWorkspace(fileSystem.object, folder, root);
        expect(hasConfig).to.equal(false, 'Should return false');
        fileSystem.verifyAll();
    });

    [pylintrc, dotPylintrc].forEach(pylintrcFile => {
        test(`If ${pylintrcFile} exists while traversing up to the workspace root, return true`, async () => {
            const folder = path.join('user', 'a', 'b', 'c');
            const root = path.join('user', 'a');

            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c'), pylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b', 'c'), dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());

            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b'), pylintrc)))
                .returns(() => Promise.resolve(pylintrc === pylintrcFile));
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a', 'b'), dotPylintrc)))
                .returns(() => Promise.resolve(dotPylintrc === pylintrcFile));

            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a'), pylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.never());
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user', 'a'), dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.never());

            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user'), dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.never());
            fileSystem
                .setup(x => x.fileExists(path.join(path.join('user'), dotPylintrc)))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.never());

            const hasConfig = await Pylint.hasConfigurationFileInWorkspace(fileSystem.object, folder, root);
            expect(hasConfig).to.equal(true, 'Should return true');
            fileSystem.verifyAll();
        });
    });
});

// tslint:disable-next-line:max-func-body-length
suite('Pylint - Function runLinter()', () => {
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let manager: TypeMoq.IMock<ILinterManager>;
    let output: TypeMoq.IMock<IOutputChannel>;
    let _info: TypeMoq.IMock<ILinterInfo>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let run: sinon.SinonStub<any>;
    let parseMessagesSeverity: sinon.SinonStub<any>;
    const minArgs = [
        '--disable=all',
        '--enable=F' +
            ',unreachable,duplicate-key,unnecessary-semicolon' +
            ',global-variable-not-assigned,unused-variable' +
            ',unused-wildcard-import,binary-op-exception' +
            ',bad-format-string,anomalous-backslash-in-string' +
            ',bad-open-mode' +
            ',E0001,E0011,E0012,E0100,E0101,E0102,E0103,E0104,E0105,E0107' +
            ',E0108,E0110,E0111,E0112,E0113,E0114,E0115,E0116,E0117,E0118' +
            ',E0202,E0203,E0211,E0213,E0236,E0237,E0238,E0239,E0240,E0241' +
            ',E0301,E0302,E0303,E0401,E0402,E0601,E0602,E0603,E0604,E0611' +
            ',E0632,E0633,E0701,E0702,E0703,E0704,E0710,E0711,E0712,E1003' +
            ',E1101,E1102,E1111,E1120,E1121,E1123,E1124,E1125,E1126,E1127' +
            ',E1128,E1129,E1130,E1131,E1132,E1133,E1134,E1135,E1136,E1137' +
            ',E1138,E1139,E1200,E1201,E1205,E1206,E1300,E1301,E1302,E1303' +
            ',E1304,E1305,E1306,E1310,E1700,E1701'
    ];
    const doc = {
        uri: vscode.Uri.file('path/to/doc')
    };
    const args = [
        "--msg-template='{line},{column},{category},{symbol}:{msg}'",
        '--reports=n',
        '--output-format=text',
        doc.uri.fsPath
    ];
    const original_hasConfigurationFileInWorkspace = Pylint.hasConfigurationFileInWorkspace;
    const original_hasConfigurationFile = Pylint.hasConfigurationFile;

    class PylintTest extends Pylint {
        public async run(
            _args: string[],
            _document: vscode.TextDocument,
            _cancellation: vscode.CancellationToken,
            _regEx: string
        ): Promise<ILintMessage[]> {
            return [];
        }
        public parseMessagesSeverity(_error: string, _categorySeverity: any): LintMessageSeverity {
            return 'Severity' as any;
        }
        public get info(): ILinterInfo {
            return _info.object;
        }
        // tslint:disable-next-line: no-unnecessary-override
        public async runLinter(
            document: vscode.TextDocument,
            cancellation: vscode.CancellationToken
        ): Promise<ILintMessage[]> {
            return super.runLinter(document, cancellation);
        }
        public getWorkspaceRootPath(_document: vscode.TextDocument): string {
            return 'path/to/workspaceRoot';
        }
    }

    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        _info = TypeMoq.Mock.ofType<ILinterInfo>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        manager = TypeMoq.Mock.ofType<ILinterManager>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILinterManager))).returns(() => manager.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);
        manager.setup(m => m.getLinterInfo(TypeMoq.It.isAny())).returns(() => undefined as any);
    });

    teardown(() => {
        Pylint.hasConfigurationFileInWorkspace = original_hasConfigurationFileInWorkspace;
        Pylint.hasConfigurationFile = original_hasConfigurationFile;
        sinon.restore();
    });

    test('Use minimal checkers if a) setting to use minimal checkers is true, b) there are no custom arguments and c) there is no pylintrc file next to the file or at the workspace root and above', async () => {
        const settings = {
            linting: {
                pylintUseMinimalCheckers: true
            }
        };
        configService.setup(c => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup(info => info.linterArgs(doc.uri)).returns(() => []);
        Pylint.hasConfigurationFileInWorkspace = () => Promise.resolve(false);
        Pylint.hasConfigurationFile = () => Promise.resolve(false);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(run.args[0][0], minArgs.concat(args));
        assert.ok(parseMessagesSeverity.notCalled);
        assert.ok(run.calledOnce);
    });

    test('Do not use minimal checkers if setting to use minimal checkers is false', async () => {
        const settings = {
            linting: {
                pylintUseMinimalCheckers: false
            }
        };
        configService.setup(c => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup(info => info.linterArgs(doc.uri)).returns(() => []);
        Pylint.hasConfigurationFileInWorkspace = () => Promise.resolve(false);
        Pylint.hasConfigurationFile = () => Promise.resolve(false);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(run.args[0][0], args);
        assert.ok(parseMessagesSeverity.notCalled);
        assert.ok(run.calledOnce);
    });

    test('Do not use minimal checkers if there are custom arguments', async () => {
        const settings = {
            linting: {
                pylintUseMinimalCheckers: true
            }
        };
        configService.setup(c => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup(info => info.linterArgs(doc.uri)).returns(() => ['customArg1', 'customArg2']);
        Pylint.hasConfigurationFileInWorkspace = () => Promise.resolve(false);
        Pylint.hasConfigurationFile = () => Promise.resolve(false);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(run.args[0][0], args);
        assert.ok(parseMessagesSeverity.notCalled);
        assert.ok(run.calledOnce);
    });

    test('Do not use minimal checkers if there is a pylintrc file in the current working directory or when traversing the workspace up to its root (hasConfigurationFileInWorkspace() returns true)', async () => {
        const settings = {
            linting: {
                pylintUseMinimalCheckers: true
            }
        };
        configService.setup(c => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup(info => info.linterArgs(doc.uri)).returns(() => []);
        Pylint.hasConfigurationFileInWorkspace = () => Promise.resolve(true); // This implies method hasConfigurationFileInWorkspace() returns true
        Pylint.hasConfigurationFile = () => Promise.resolve(false);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(run.args[0][0], args);
        assert.ok(parseMessagesSeverity.notCalled);
        assert.ok(run.calledOnce);
    });

    test('Do not use minimal checkers if a pylintrc file exists in the process, in the current working directory or up in the hierarchy tree (hasConfigurationFile() returns true)', async () => {
        const settings = {
            linting: {
                pylintUseMinimalCheckers: true
            }
        };
        configService.setup(c => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup(info => info.linterArgs(doc.uri)).returns(() => []);
        Pylint.hasConfigurationFileInWorkspace = () => Promise.resolve(false);
        Pylint.hasConfigurationFile = () => Promise.resolve(true); // This implies method hasConfigurationFile() returns true
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve([]));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'Severity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(run.args[0][0], args);
        assert.ok(parseMessagesSeverity.notCalled);
        assert.ok(run.calledOnce);
    });

    test('Message returned by runLinter() is as expected', async () => {
        const message = [
            {
                type: 'messageType'
            }
        ];
        const expectedResult = [
            {
                type: 'messageType',
                severity: 'LintMessageSeverity'
            }
        ];
        const settings = {
            linting: {
                pylintUseMinimalCheckers: true
            }
        };
        configService.setup(c => c.getSettings(doc.uri)).returns(() => settings as any);
        _info.setup(info => info.linterArgs(doc.uri)).returns(() => []);
        Pylint.hasConfigurationFileInWorkspace = () => Promise.resolve(false);
        Pylint.hasConfigurationFile = () => Promise.resolve(false);
        run = sinon.stub(PylintTest.prototype, 'run');
        run.callsFake(() => Promise.resolve(message as any));
        parseMessagesSeverity = sinon.stub(PylintTest.prototype, 'parseMessagesSeverity');
        parseMessagesSeverity.callsFake(() => 'LintMessageSeverity');
        const pylint = new PylintTest(output.object, serviceContainer.object);
        const result = await pylint.runLinter(doc as any, mock(vscode.CancellationTokenSource).token);
        assert.deepEqual(result, expectedResult as any);
        assert.ok(parseMessagesSeverity.calledOnce);
        assert.ok(run.calledOnce);
    });
});
