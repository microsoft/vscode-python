// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { WorkspaceService } from '../../client/common/application/workspace';
import { Product } from '../../client/common/installer/productInstaller';
import {
    CTagsProductPathService, FormatterProductPathService, LinterProductPathService,
    RefactoringLibraryProductPathService, TestFrameworkProductPathService
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../client/common/installer/types';
import { IConfigurationService, ProductType } from '../../client/common/types';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager } from '../../client/linters/types';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const workspaceDir = path.join(__dirname, '..', '..', '..', 'src', 'test');
const workspaceUri = Uri.file(workspaceDir);

const linterConfigDirs = {
    flake8: path.join(pythonFilesPath, 'flake8config'),
    pep8: path.join(pythonFilesPath, 'pep8config'),
    pydocstyle: path.join(pythonFilesPath, 'pydocstyleconfig27'),
    pylint: path.join(pythonFilesPath, 'pylintconfig')
};
const linterConfigRCFiles = {
    pylint: '.pylintrc',
    pydocstyle: '.pydocstyle'
};

const fileToLint = path.join(pythonFilesPath, 'file.py');

const pylintMessagesToBeReturned: ILintMessage[] = [
    { line: 24, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 30, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 34, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 40, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 44, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 55, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 59, column: 0, severity: LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 62, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', provider: '', type: '' },
    { line: 70, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 84, column: 0, severity: LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 87, column: 0, severity: LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', provider: '', type: '' },
    { line: 11, column: 20, severity: LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', provider: '', type: '' },
    { line: 26, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
const flake8MessagesToBeReturned: ILintMessage[] = [
    { line: 5, column: 1, severity: LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pep8MessagesToBeReturned: ILintMessage[] = [
    { line: 5, column: 1, severity: LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pydocstyleMessagesToBeReturned: ILintMessage[] = [
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

const filteredFlake8MessagesToBeReturned: ILintMessage[] = [
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const filteredPep8MessagesToBeReturned: ILintMessage[] = [
    { line: 87, column: 24, severity: LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];

function getMessages(product: Product): ILintMessage[] {
    switch (product) {
        case Product.pylint: {
            return pylintMessagesToBeReturned;
        }
        case Product.flake8: {
            return flake8MessagesToBeReturned;
        }
        case Product.pep8: {
            return pep8MessagesToBeReturned;
        }
        case Product.pydocstyle: {
            return pydocstyleMessagesToBeReturned;
        }
        default: {
            throw Error(`unsupported linter ${product}`);
        }
    }
}

async function getInfoForConfig(product: Product) {
    const prodID = getLinterID(product);
    const dirname = linterConfigDirs[prodID];

    const filename = path.join(dirname, product === Product.pylint ? 'file2.py' : 'file.py');
    let messagesToBeReceived: ILintMessage[] = [];
    switch (product) {
        case Product.flake8: {
            messagesToBeReceived = filteredFlake8MessagesToBeReturned;
            break;
        }
        case Product.pep8: {
            messagesToBeReceived = filteredPep8MessagesToBeReturned;
            break;
        }
        default: { break; }
    }
    const basename = linterConfigRCFiles[prodID];
    return {
        filename,
        messagesToBeReceived,
        origRCFile: basename ? path.join(dirname, basename) : ''
    };
}

// tslint:disable-next-line:max-func-body-length
suite('Linting - General Tests', () => {
    let ioc: UnitTestIocContainer;
    let linterManager: ILinterManager;
    let configService: IConfigurationService;

    suiteSetup(async () => {
        await initialize();
    });
    setup(async () => {
        initializeDI();
        await initializeTest();
        await resetSettings();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
        await resetSettings();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        linterManager = new LinterManager(ioc.serviceContainer, new WorkspaceService());
        configService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
    }

    function makeSettingKey(product: Product): PythonSettingKeys {
        return `linting.${linterManager.getLinterInfo(product).enabledSettingName}` as PythonSettingKeys;
    }

    async function resetSettings() {
        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSetting('linting.enabled', true, rootWorkspaceUri, target);
        await configService.updateSetting('linting.lintOnSave', false, rootWorkspaceUri, target);
        await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);

        linterManager.getAllLinterInfos().forEach(async (x) => {
            await configService.updateSetting(makeSettingKey(x.product), false, rootWorkspaceUri, target);
        });
    }

    test('Linting settings (set/get)', async () => {
        const settings = configService.getSettings();

        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSetting('linting.enabled', true, rootWorkspaceUri, target);
        assert.equal(settings.linting.enabled, true, 'mismatch');
        await configService.updateSetting('linting.enabled', false, rootWorkspaceUri, target);
        assert.equal(settings.linting.enabled, false, 'mismatch');

        await configService.updateSetting('linting.pylintUseMinimalCheckers', true, workspaceUri);
        assert.equal(settings.linting.pylintUseMinimalCheckers, true, 'mismatch');
        await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
        assert.equal(settings.linting.pylintUseMinimalCheckers, false, 'mismatch');

        linterManager.getAllLinterInfos().forEach(async (x) => {
            await configService.updateSetting(makeSettingKey(x.product), true, rootWorkspaceUri, target);
            assert.equal(settings.linting[x.enabledSettingName], true, 'mismatch');
            await configService.updateSetting(makeSettingKey(x.product), false, rootWorkspaceUri, target);
            assert.equal(settings.linting[x.enabledSettingName], false, 'mismatch');
        });
    });

    async function testLinterMessages(
        product: Product,
        pythonFile: string,
        messagesToBeReceived: ILintMessage[]
    ) {
        const outputChannel = ioc.serviceContainer.get<MockOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const doc = await workspace.openTextDocument(pythonFile);

        await linterManager.setActiveLintersAsync([product], doc.uri);
        const linter = await linterManager.createLinter(product, outputChannel, ioc.serviceContainer);

        const messages = await linter.lint(
            doc,
            (new CancellationTokenSource()).token
        );

        if (messagesToBeReceived.length === 0) {
            assert.equal(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
        } else {
            if (outputChannel.output.indexOf('ENOENT') === -1) {
                // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
                // Looks like pylint stops linting as soon as it comes across any ERRORS.
                assert.notEqual(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
            }
        }
    }
    for (const prodID of Object.keys(LINTERS)) {
        const product = LINTERS[prodID];
        const productName = prodID.charAt(0).toUpperCase() + prodID.slice(1);
        test(productName, async function() {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Add coverage for these linters.
            if (['bandit', 'mypy', 'pylama', 'prospector'].some(id => id === prodID)) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }

            const messagesToBeReturned = getMessages(product);
            await testLinterMessages(product, fileToLint, messagesToBeReturned);
        });
    }
    for (const prodID of Object.keys(LINTERS)) {
        const product = LINTERS[prodID];
        const productName = prodID.charAt(0).toUpperCase() + prodID.slice(1);
        // tslint:disable-next-line:max-func-body-length
        test(`${productName} with config in root`, async function() {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Add coverage for these linters.
            if (['bandit', 'mypy', 'pylama', 'prospector'].some(id => id === prodID)) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }

            if (product === Product.pydocstyle) {
                await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
            }

            const { filename, messagesToBeReceived, origRCFile } = await getInfoForConfig(product);
            let rcfile = '';
            async function cleanUp() {
                if (rcfile !== '') {
                    await deleteFile(rcfile);
                }
            }
            if (origRCFile !== '') {
                rcfile = path.join(workspaceUri.fsPath, path.basename(origRCFile));
                await fs.copy(origRCFile, rcfile);
            }

            try {
                await testLinterMessages(product, filename, messagesToBeReceived);
            } finally {
                await cleanUp();
            }
        });
    }
});
