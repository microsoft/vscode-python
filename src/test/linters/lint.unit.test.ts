// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as os from 'os';
import * as TypeMoq from 'typemoq';
import {
    CancellationTokenSource,
    DiagnosticSeverity,
    TextDocument,
    TextLine,
    Uri,
    WorkspaceFolder
} from 'vscode';
import {
    IApplicationShell,
    IWorkspaceService
} from '../../client/common/application/types';
import { Product } from '../../client/common/installer/productInstaller';
import {
    IFileSystem,
    IPlatformService
} from '../../client/common/platform/types';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    IPythonToolExecutionService
} from '../../client/common/process/types';
import {
    Flake8CategorySeverity,
    IConfigurationService,
    IInstaller,
    ILogger,
    IMypyCategorySeverity,
    IOutputChannel,
    IPep8CategorySeverity,
    IPylintCategorySeverity,
    IPythonSettings
} from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { LinterManager, LINTERS } from '../../client/linters/linterManager';
import {
    ILinter,
    ILinterManager,
    ILintMessage,
    LinterId,
    LintMessageSeverity
} from '../../client/linters/types';

const pylintMessagesToBeReturned: ILintMessage[] = [
    { line: 24, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 30, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 34, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 40, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 44, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 55, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 59, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 62, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', provider: '', type: 'warning' },
    { line: 70, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 84, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: 'warning' },
    { line: 87, column: 0, severity: LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', provider: '', type: 'warning' },
    { line: 11, column: 20, severity: LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', provider: '', type: 'warning' },
    { line: 26, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: 'warning' },
    { line: 36, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' },
    { line: 46, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' },
    { line: 61, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' },
    { line: 72, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' },
    { line: 75, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' },
    { line: 77, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' },
    { line: 83, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: 'warning' }
];
const flake8MessagesToBeReturned: ILintMessage[] = [
    { line: 5, column: 1, severity: LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: 'E' },
    { line: 19, column: 15, severity: LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: 'E' },
    { line: 24, column: 23, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: 'E' },
    { line: 62, column: 30, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: 'E' },
    { line: 70, column: 22, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: 'E' },
    { line: 80, column: 5, severity: LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: 'E' },
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: 'E' }
];
const pep8MessagesToBeReturned: ILintMessage[] = [
    { line: 5, column: 1, severity: LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: 'E' },
    { line: 19, column: 15, severity: LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: 'E' },
    { line: 24, column: 23, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: 'E' },
    { line: 62, column: 30, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: 'E' },
    { line: 70, column: 22, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: 'E' },
    { line: 80, column: 5, severity: LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: 'E' },
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: 'E' }
];
const pydocstyleMessagseToBeReturned: ILintMessage[] = [
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 0, line: 1, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 0, line: 5, type: '', provider: 'pydocstyle' },
    { code: 'D102', severity: LintMessageSeverity.Information, message: 'Missing docstring in public method', column: 4, line: 8, type: '', provider: 'pydocstyle' },
    { code: 'D401', severity: LintMessageSeverity.Information, message: 'First line should be in imperative mood (\'thi\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'This\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'And\', not \'and\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 80, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 80, type: '', provider: 'pydocstyle' }
];

function linterMessagesAsLine(msg: ILintMessage): string {
    switch (msg.provider) {
        case 'pydocstyle': {
            return `<filename>:${msg.line} spam:${os.EOL}\t${msg.code}: ${msg.message}`;
        }
        default: {
            return `${msg.line},${msg.column},${msg.type},${msg.code}:${msg.message}`;
        }
    }
}

function getLinterID(product: Product): LinterId {
    for (const id of Object.keys(LINTERS)) {
        if (LINTERS[id] === product) {
            return id as LinterId;
        }
    }
    throw Error(`unsupprted product ${product}`);
}

class LintingSettings {
    public enabled: boolean;
    public ignorePatterns: string[];
    public prospectorEnabled: boolean;
    public prospectorArgs: string[];
    public pylintEnabled: boolean;
    public pylintArgs: string[];
    public pep8Enabled: boolean;
    public pep8Args: string[];
    public pylamaEnabled: boolean;
    public pylamaArgs: string[];
    public flake8Enabled: boolean;
    public flake8Args: string[];
    public pydocstyleEnabled: boolean;
    public pydocstyleArgs: string[];
    public lintOnSave: boolean;
    public maxNumberOfProblems: number;
    public pylintCategorySeverity: IPylintCategorySeverity;
    public pep8CategorySeverity: IPep8CategorySeverity;
    public flake8CategorySeverity: Flake8CategorySeverity;
    public mypyCategorySeverity: IMypyCategorySeverity;
    public prospectorPath: string;
    public pylintPath: string;
    public pep8Path: string;
    public pylamaPath: string;
    public flake8Path: string;
    public pydocstylePath: string;
    public mypyEnabled: boolean;
    public mypyArgs: string[];
    public mypyPath: string;
    public banditEnabled: boolean;
    public banditArgs: string[];
    public banditPath: string;
    public pylintUseMinimalCheckers: boolean;

    constructor() {
        // mostly from configSettings.ts

        this.enabled = true;
        this.ignorePatterns = [];
        this.lintOnSave = false;
        this.maxNumberOfProblems = 100;

        this.flake8Enabled = false;
        this.flake8Path = 'flake';
        this.flake8Args = [];
        this.flake8CategorySeverity = {
            E: DiagnosticSeverity.Error,
            W: DiagnosticSeverity.Warning,
            F: DiagnosticSeverity.Warning
        };

        this.mypyEnabled = false;
        this.mypyPath = 'mypy';
        this.mypyArgs = [];
        this.mypyCategorySeverity = {
            error: DiagnosticSeverity.Error,
            note: DiagnosticSeverity.Hint
        };

        this.banditEnabled = false;
        this.banditPath = 'bandit';
        this.banditArgs = [];

        this.pep8Enabled = false;
        this.pep8Path = 'pep8';
        this.pep8Args = [];
        this.pep8CategorySeverity = {
            E: DiagnosticSeverity.Error,
            W: DiagnosticSeverity.Warning
        };

        this.pylamaEnabled = false;
        this.pylamaPath = 'pylama';
        this.pylamaArgs = [];

        this.prospectorEnabled = false;
        this.prospectorPath = 'prospector';
        this.prospectorArgs = [];

        this.pydocstyleEnabled = false;
        this.pydocstylePath = 'pydocstyle';
        this.pydocstyleArgs = [];

        this.pylintEnabled = false;
        this.pylintPath = 'pylint';
        this.pylintArgs = [];
        this.pylintCategorySeverity = {
            convention: DiagnosticSeverity.Hint,
            error: DiagnosticSeverity.Error,
            fatal: DiagnosticSeverity.Error,
            refactor: DiagnosticSeverity.Hint,
            warning: DiagnosticSeverity.Warning
        };
        this.pylintUseMinimalCheckers = false;
    }
}

class TestFixture {
    public linterManager: LinterManager;
    public serviceContainer: TypeMoq.IMock<IServiceContainer>;

    // services
    public filesystem: TypeMoq.IMock<IFileSystem>;
    public workspaceService: TypeMoq.IMock<IWorkspaceService>;
    public logger: TypeMoq.IMock<ILogger>;
    public installer: TypeMoq.IMock<IInstaller>;
    public platformService: TypeMoq.IMock<IPlatformService>;
    public pythonToolExecService: TypeMoq.IMock<IPythonToolExecutionService>;
    public pythonExecService: TypeMoq.IMock<IPythonExecutionService>;
    public pythonExecFactory: TypeMoq.IMock<IPythonExecutionFactory>;
    public appShell: TypeMoq.IMock<IApplicationShell>;

    // config
    public configService: TypeMoq.IMock<IConfigurationService>;
    public pythonSettings: TypeMoq.IMock<IPythonSettings>;
    public lintingSettings: LintingSettings;

    // data
    public outputChannel: TypeMoq.IMock<IOutputChannel>;
    public document: TypeMoq.IMock<TextDocument>;

    // artifacts
    public output: string;
    public logged: string[];

    constructor(
        public readonly workspaceDir = '.',
        private readonly printLogs = false
    ) {
        this.serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);

        // services

        this.filesystem = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);
        this.workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        this.logger = TypeMoq.Mock.ofType<ILogger>(undefined, TypeMoq.MockBehavior.Strict);
        this.installer = TypeMoq.Mock.ofType<IInstaller>(undefined, TypeMoq.MockBehavior.Strict);
        this.platformService = TypeMoq.Mock.ofType<IPlatformService>(undefined, TypeMoq.MockBehavior.Strict);
        this.pythonToolExecService = TypeMoq.Mock.ofType<IPythonToolExecutionService>(undefined, TypeMoq.MockBehavior.Strict);
        this.pythonExecService = TypeMoq.Mock.ofType<IPythonExecutionService>(undefined, TypeMoq.MockBehavior.Strict);
        this.pythonExecFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>(undefined, TypeMoq.MockBehavior.Strict);
        this.appShell = TypeMoq.Mock.ofType<IApplicationShell>(undefined, TypeMoq.MockBehavior.Strict);

        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny()))
            .returns(() => this.filesystem.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny()))
            .returns(() => this.workspaceService.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILogger), TypeMoq.It.isAny()))
            .returns(() => this.logger.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInstaller), TypeMoq.It.isAny()))
            .returns(() => this.installer.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny()))
            .returns(() => this.platformService.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPythonToolExecutionService), TypeMoq.It.isAny()))
            .returns(() => this.pythonToolExecService.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPythonExecutionService), TypeMoq.It.isAny()))
            .returns(() => this.pythonExecService.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPythonExecutionFactory), TypeMoq.It.isAny()))
            .returns(() => this.pythonExecFactory.object);
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny()))
            .returns(() => this.appShell.object);
        this.initServices();

        // config

        this.configService = TypeMoq.Mock.ofType<IConfigurationService>(undefined, TypeMoq.MockBehavior.Strict);
        this.pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>(undefined, TypeMoq.MockBehavior.Strict);
        this.lintingSettings = new LintingSettings();

        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => this.configService.object);
        this.configService.setup(c => c.getSettings(TypeMoq.It.isAny()))
            .returns(() => this.pythonSettings.object);
        this.pythonSettings.setup(s => s.linting)
            .returns(() => this.lintingSettings);
        this.initConfig();

        // data

        this.outputChannel = TypeMoq.Mock.ofType<IOutputChannel>(undefined, TypeMoq.MockBehavior.Strict);
        this.document = TypeMoq.Mock.ofType<TextDocument>(undefined, TypeMoq.MockBehavior.Strict);

        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
            .returns(() => this.outputChannel.object);
        this.initData();

        // artifacts

        this.output = '';
        this.logged = [];

        // linting

        this.linterManager = new LinterManager(
            this.serviceContainer.object,
            this.workspaceService.object!
        );
        this.serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILinterManager), TypeMoq.It.isAny()))
            .returns(() => this.linterManager);
    }

    public async getLinter(product: Product, enabled = true): Promise<ILinter> {
        const info = this.linterManager.getLinterInfo(product);
        this.lintingSettings[info.enabledSettingName] = enabled;

        await this.linterManager.setActiveLintersAsync([product]);
        await this.linterManager.enableLintingAsync(enabled);
        return this.linterManager.createLinter(
            product,
            this.outputChannel.object,
            this.serviceContainer.object
        );
    }

    public async getEnabledLinter(product: Product): Promise<ILinter> {
        return this.getLinter(product, true);
    }

    public async getDisabledLinter(product: Product): Promise<ILinter> {
        return this.getLinter(product, false);
    }

    public setDefaultMessages(product: Product): ILintMessage[] {
        let messages: ILintMessage[];
        switch (product) {
            case Product.pylint: {
                messages = pylintMessagesToBeReturned;
                break;
            }
            case Product.flake8: {
                messages = flake8MessagesToBeReturned;
                break;
            }
            case Product.pep8: {
                messages = pep8MessagesToBeReturned;
                break;
            }
            case Product.pydocstyle: {
                messages = pydocstyleMessagseToBeReturned;
                break;
            }
            default: {
                throw Error(`unsupported linter ${product}`);
            }
        }
        this.setMessages(messages, product);
        return messages;
    }

    public setMessages(messages: ILintMessage[], product?: Product) {
        if (messages.length === 0) {
            this.setStdout('');
            return;
        }

        const lines: string[] = [];
        for (const msg of messages) {
            if (msg.provider === '' && product) {
                msg.provider = getLinterID(product);
            }
            const line = linterMessagesAsLine(msg);
            lines.push(line);
        }
        this.setStdout(lines.join(os.EOL) + os.EOL);
    }

    public setStdout(stdout: string) {
        this.pythonToolExecService.setup(s => s.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: stdout }));
    }

    public makeDocument(product: Product, filename: string): TextDocument {
        const uri = Uri.file(filename);
        const doc = TypeMoq.Mock.ofType<TextDocument>(undefined, TypeMoq.MockBehavior.Strict);
        doc.setup(s => s.uri)
            .returns(() => uri);
        if (product === Product.pydocstyle) {
            const dummyLine = TypeMoq.Mock.ofType<TextLine>(undefined, TypeMoq.MockBehavior.Strict);
            dummyLine.setup(d => d.text)
                .returns(() => '    ...');
            doc.setup(s => s.lineAt(TypeMoq.It.isAny()))
                .returns(() => dummyLine.object);
        }
        return doc.object;
    }

    private initServices(): void {
        this.filesystem.setup(f => f.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true));

        const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceFolder.setup(f => f.uri)
            .returns(() => Uri.file(this.workspaceDir));
        this.workspaceService.setup(s => s.getWorkspaceFolder(TypeMoq.It.isAny()))
            .returns(() => workspaceFolder.object);

        this.logger.setup(l => l.logError(TypeMoq.It.isAny()))
            .callback(msg => {
                this.logged.push(msg);
                if (this.printLogs) {
                    // tslint:disable-next-line:no-console
                    console.log(msg);
                }
            })
            .returns(() => undefined);

        // tslint:disable-next-line:no-any
        this.pythonExecService.setup((s: any) => s.then)
            .returns(() => undefined);
        this.pythonExecService.setup(s => s.isModuleInstalled(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true));

        this.pythonExecFactory.setup(f => f.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(this.pythonExecService.object));

        this.appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
    }

    private initConfig(): void {
        this.configService.setup(c => c.updateSetting(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));

        this.pythonSettings.setup(s => s.jediEnabled)
            .returns(() => true);
    }

    private initData(): void {
        this.outputChannel.setup(o => o.appendLine(TypeMoq.It.isAny()))
            .callback(line => {
                if (this.output === '') {
                    this.output = line;
                } else {
                    this.output = `${this.output}${os.EOL}${line}`;
                }
            });
        this.outputChannel.setup(o => o.append(TypeMoq.It.isAny()))
            .callback(data => {
                this.output += data;
            });
        this.outputChannel.setup(o => o.show());
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Linting - functional (mocked)', () => {

    async function testEnablingDisablingOfLinter(
        fixture: TestFixture,
        product: Product,
        enabled: boolean
    ) {
        fixture.lintingSettings.enabled = true;
        fixture.setDefaultMessages(product);
        if (enabled) {
            fixture.setDefaultMessages(product);
        }
        const linter = await fixture.getLinter(product, enabled);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            (new CancellationTokenSource()).token
        );

        if (enabled) {
            assert.notEqual(messages.length, 0, `Expected linter errors when linter is enabled, Output - ${fixture.output}`);
        } else {
            assert.equal(messages.length, 0, `Unexpected linter errors when linter is disabled, Output - ${fixture.output}`);
        }
    }
    for (const prodID of Object.keys(LINTERS)) {
        const product = LINTERS[prodID];
        for (const enabled of [false, true]) {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Add coverage for these linters.
            if (['bandit', 'mypy', 'pylama'].some(id => id === prodID)) {
                continue;
            }
            const productName = prodID.charAt(0).toUpperCase() + prodID.slice(1);
            test(`${enabled ? 'Enable' : 'Disable'} ${productName} and run linter`, async function() {
                if (product === Product.prospector) {
                    // Skipping to solve #3464, tracked by issue #3466.
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }

                const fixture = new TestFixture();
                await testEnablingDisablingOfLinter(fixture, product, enabled);
            });
        }
    }
    for (const useMinimal of [true, false]) {
        for (const enabled of [true, false]) {
            test(`PyLint ${enabled ? 'enabled' : 'disabled'} with${useMinimal ? '' : 'out'} minimal checkers`, async () => {
                const fixture = new TestFixture();
                fixture.lintingSettings.pylintUseMinimalCheckers = useMinimal;
                await testEnablingDisablingOfLinter(fixture, Product.pylint, enabled);
            });
        }
    }

    async function testLinterMessages(
        fixture: TestFixture,
        product: Product
    ) {
        const messagesToBeReceived = fixture.setDefaultMessages(product);
        const linter = await fixture.getEnabledLinter(product);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            (new CancellationTokenSource()).token
        );

        if (messagesToBeReceived.length === 0) {
            assert.equal(messages.length, 0, `No errors in linter, Output - ${fixture.output}`);
        } else {
            if (fixture.output.indexOf('ENOENT') === -1) {
                // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
                // Looks like pylint stops linting as soon as it comes across any ERRORS.
                assert.notEqual(messages.length, 0, `No errors in linter, Output - ${fixture.output}`);
            }
        }
    }
    for (const prodID of Object.keys(LINTERS)) {
        const product = LINTERS[prodID];
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Add coverage for these linters.
        if (['bandit', 'mypy', 'pylama', 'prospector'].some(id => id === prodID)) {
            continue;
        }
        const productName = prodID.charAt(0).toUpperCase() + prodID.slice(1);
        test(`Check ${productName} messages`, async () => {
            const  fixture = new TestFixture();
            await testLinterMessages(fixture, product);
        });
    }

    async function testLinterMessageCount(
        fixture: TestFixture,
        product: Product,
        messageCountToBeReceived: number
    ) {
        fixture.setDefaultMessages(product);
        const linter = await fixture.getEnabledLinter(product);

        const messages = await linter.lint(
            fixture.makeDocument(product, 'spam.py'),
            (new CancellationTokenSource()).token
        );

        assert.equal(messages.length, messageCountToBeReceived, `Expected number of lint errors does not match lint error count, Output - ${fixture.output}`);
    }
    test('Three line output counted as one message (Pylint)', async () => {
        const maxErrors = 5;
        const fixture = new TestFixture();
        fixture.lintingSettings.maxNumberOfProblems = maxErrors;

        await testLinterMessageCount(fixture, Product.pylint, maxErrors);
    });
});
