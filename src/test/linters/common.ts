// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as os from 'os';
import * as TypeMoq from 'typemoq';
import { DiagnosticSeverity, TextDocument, Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { Product } from '../../client/common/installer/productInstaller';
import { ProductNames } from '../../client/common/installer/productNames';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonToolExecutionService } from '../../client/common/process/types';
import {
    Flake8CategorySeverity,
    IConfigurationService,
    IInstaller,
    IMypyCategorySeverity,
    IOutputChannel,
    IPycodestyleCategorySeverity,
    IPylintCategorySeverity,
    IPythonSettings
} from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { LINTERID_BY_PRODUCT } from '../../client/linters/constants';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinter, ILinterManager, ILintMessage, LinterId } from '../../client/linters/types';

export function newMockDocument(filename: string): TypeMoq.IMock<TextDocument> {
    const uri = Uri.file(filename);
    const doc = TypeMoq.Mock.ofType<TextDocument>(undefined, TypeMoq.MockBehavior.Strict);
    doc.setup(s => s.uri).returns(() => uri);
    return doc;
}

export function linterMessageAsLine(msg: ILintMessage): string {
    switch (msg.provider) {
        case 'pydocstyle': {
            return `<filename>:${msg.line} spam:${os.EOL}\t${msg.code}: ${msg.message}`;
        }
        default: {
            return `${msg.line},${msg.column},${msg.type},${msg.code}:${msg.message}`;
        }
    }
}

export function getLinterID(product: Product): LinterId {
    const linterID = LINTERID_BY_PRODUCT.get(product);
    if (!linterID) {
        throwUnknownProduct(product);
    }
    return linterID!;
}

export function getProductName(product: Product, capitalize = true): string {
    let prodName = ProductNames.get(product);
    if (!prodName) {
        prodName = Product[product];
    }
    if (capitalize) {
        return prodName.charAt(0).toUpperCase() + prodName.slice(1);
    } else {
        return prodName;
    }
}

export function throwUnknownProduct(product: Product) {
    throw Error(`unsupported product ${Product[product]} (${product})`);
}

export class LintingSettings {
    public enabled: boolean;
    public ignorePatterns: string[];
    public prospectorEnabled: boolean;
    public prospectorArgs: string[];
    public pylintEnabled: boolean;
    public pylintArgs: string[];
    public pycodestyleEnabled: boolean;
    public pycodestyleArgs: string[];
    public pylamaEnabled: boolean;
    public pylamaArgs: string[];
    public flake8Enabled: boolean;
    public flake8Args: string[];
    public pydocstyleEnabled: boolean;
    public pydocstyleArgs: string[];
    public lintOnSave: boolean;
    public maxNumberOfProblems: number;
    public pylintCategorySeverity: IPylintCategorySeverity;
    public pycodestyleCategorySeverity: IPycodestyleCategorySeverity;
    public flake8CategorySeverity: Flake8CategorySeverity;
    public mypyCategorySeverity: IMypyCategorySeverity;
    public prospectorPath: string;
    public pylintPath: string;
    public pycodestylePath: string;
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
        this.flake8Path = 'flake8';
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

        this.pycodestyleEnabled = false;
        this.pycodestylePath = 'pycodestyle';
        this.pycodestyleArgs = [];
        this.pycodestyleCategorySeverity = {
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

export class BaseTestFixture {
    public serviceContainer: TypeMoq.IMock<IServiceContainer>;
    public linterManager: LinterManager;

    // services
    public workspaceService: TypeMoq.IMock<IWorkspaceService>;
    public installer: TypeMoq.IMock<IInstaller>;
    public appShell: TypeMoq.IMock<IApplicationShell>;

    // config
    public configService: TypeMoq.IMock<IConfigurationService>;
    public pythonSettings: TypeMoq.IMock<IPythonSettings>;
    public lintingSettings: LintingSettings;

    // data
    public outputChannel: TypeMoq.IMock<IOutputChannel>;

    // artifacts
    public output: string;
    public logged: string[];

    constructor(
        platformService: IPlatformService,
        filesystem: IFileSystem,
        pythonToolExecService: IPythonToolExecutionService,
        pythonExecFactory: IPythonExecutionFactory,
        configService?: TypeMoq.IMock<IConfigurationService>,
        serviceContainer?: TypeMoq.IMock<IServiceContainer>,
        ignoreConfigUpdates = false,
        public readonly workspaceDir = '.',
        protected readonly printLogs = false
    ) {
        this.serviceContainer = serviceContainer
            ? serviceContainer
            : TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);

        // services

        this.workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        this.installer = TypeMoq.Mock.ofType<IInstaller>(undefined, TypeMoq.MockBehavior.Strict);
        this.appShell = TypeMoq.Mock.ofType<IApplicationShell>(undefined, TypeMoq.MockBehavior.Strict);

        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny()))
            .returns(() => filesystem);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny()))
            .returns(() => this.workspaceService.object);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IInstaller), TypeMoq.It.isAny()))
            .returns(() => this.installer.object);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny()))
            .returns(() => platformService);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IPythonToolExecutionService), TypeMoq.It.isAny()))
            .returns(() => pythonToolExecService);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IPythonExecutionFactory), TypeMoq.It.isAny()))
            .returns(() => pythonExecFactory);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny()))
            .returns(() => this.appShell.object);
        this.initServices();

        // config

        this.configService = configService
            ? configService
            : TypeMoq.Mock.ofType<IConfigurationService>(undefined, TypeMoq.MockBehavior.Strict);
        this.pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>(undefined, TypeMoq.MockBehavior.Strict);
        this.lintingSettings = new LintingSettings();

        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => this.configService.object);
        this.configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => this.pythonSettings.object);
        this.pythonSettings.setup(s => s.linting).returns(() => this.lintingSettings);
        this.initConfig(ignoreConfigUpdates);

        // data

        this.outputChannel = TypeMoq.Mock.ofType<IOutputChannel>(undefined, TypeMoq.MockBehavior.Strict);

        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny()))
            .returns(() => this.outputChannel.object);
        this.initData();

        // artifacts

        this.output = '';
        this.logged = [];

        // linting

        this.linterManager = new LinterManager(this.serviceContainer.object, this.workspaceService.object!);
        this.serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(ILinterManager), TypeMoq.It.isAny()))
            .returns(() => this.linterManager);
    }

    public async getLinter(product: Product, enabled = true): Promise<ILinter> {
        const info = this.linterManager.getLinterInfo(product);
        // tslint:disable-next-line:no-any
        (this.lintingSettings as any)[info.enabledSettingName] = enabled;

        await this.linterManager.setActiveLintersAsync([product]);
        await this.linterManager.enableLintingAsync(enabled);
        return this.linterManager.createLinter(product, this.outputChannel.object, this.serviceContainer.object);
    }

    public async getEnabledLinter(product: Product): Promise<ILinter> {
        return this.getLinter(product, true);
    }

    public async getDisabledLinter(product: Product): Promise<ILinter> {
        return this.getLinter(product, false);
    }

    protected newMockDocument(filename: string): TypeMoq.IMock<TextDocument> {
        return newMockDocument(filename);
    }

    private initServices(): void {
        const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceFolder.setup(f => f.uri).returns(() => Uri.file(this.workspaceDir));
        this.workspaceService
            .setup(s => s.getWorkspaceFolder(TypeMoq.It.isAny()))
            .returns(() => workspaceFolder.object);

        this.appShell
            .setup(a => a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
    }

    private initConfig(ignoreUpdates = false): void {
        this.configService
            .setup(c => c.updateSetting(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((setting, value) => {
                if (ignoreUpdates) {
                    return;
                }
                const prefix = 'linting.';
                if (setting.startsWith(prefix)) {
                    // tslint:disable-next-line:no-any
                    (this.lintingSettings as any)[setting.substring(prefix.length)] = value;
                }
            })
            .returns(() => Promise.resolve(undefined));

        this.pythonSettings.setup(s => s.jediEnabled).returns(() => true);
    }

    private initData(): void {
        this.outputChannel
            .setup(o => o.appendLine(TypeMoq.It.isAny()))
            .callback(line => {
                if (this.output === '') {
                    this.output = line;
                } else {
                    this.output = `${this.output}${os.EOL}${line}`;
                }
            });
        this.outputChannel
            .setup(o => o.append(TypeMoq.It.isAny()))
            .callback(data => {
                this.output += data;
            });
        this.outputChannel.setup(o => o.show());
    }
}
