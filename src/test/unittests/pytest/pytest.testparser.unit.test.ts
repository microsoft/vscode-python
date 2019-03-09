// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as typeMoq from 'typemoq';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { TestsHelper } from '../../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/unittests/common/testVisitors/flatteningVisitor';
import { ITestsHelper, TestDiscoveryOptions, TestFile, Tests } from '../../../client/unittests/common/types';
import { TestsParser as PyTestsParser } from '../../../client/unittests/pytest/services/parserService';
import { pytestScenario } from './pytest.testparser.testdata';

use(chaipromise);

// This suite of tests is to ensure that our Python test adapter JSON is being transformed to the
// `Tests` data structure as required by the various testing functions supported by this extension.
// The input data (stringified JSON) and the expected results (Tests described in JSON) are found
// in the `pytest.testparser.testdata.ts` file adjacent to this one.

// tslint:disable-next-line:max-func-body-length
suite('PyTest parser used in discovery', () => {

    // Type for keeping a test function's TestsHelper dependencies intact.
    type TestHelperDependents = {
        serviceContainer: typeMoq.IMock<IServiceContainer>;
        appShell: typeMoq.IMock<IApplicationShell>;
        cmdMgr: typeMoq.IMock<ICommandManager>;
        flattener: TestFlatteningVisitor;
    };

    // Type for keeping test discovery options & dependencies intact.
    type TestParserDiscoveryOptions = {
        outChannel: typeMoq.IMock<OutputChannel>;
        cancelToken: typeMoq.IMock<CancellationToken>;
        wsFolder: typeMoq.IMock<Uri>;
    };

    // Create a TestsHelper and return it (and its dependancies)
    function createTestsHelper(): [TestHelperDependents, TestsHelper] {
        // Setup the service container for use by the parser.
        const tDeps: TestHelperDependents = {
            serviceContainer: typeMoq.Mock.ofType<IServiceContainer>(),
            appShell: typeMoq.Mock.ofType<IApplicationShell>(),
            cmdMgr: typeMoq.Mock.ofType<ICommandManager>(),
            flattener: new TestFlatteningVisitor()
        };

        tDeps.serviceContainer.setup(s => s.get(typeMoq.It.isValue(IApplicationShell), typeMoq.It.isAny()))
            .returns(() => {
                return tDeps.appShell.object;
            });
        tDeps.serviceContainer.setup(s => s.get(typeMoq.It.isValue(ICommandManager), typeMoq.It.isAny()))
            .returns(() => {
                return tDeps.cmdMgr.object;
            });

        const testHelper: TestsHelper = new TestsHelper(tDeps.flattener, tDeps.serviceContainer.object);
        return [tDeps, testHelper];
    }

    function createParserOptions(): [TestParserDiscoveryOptions, TestDiscoveryOptions] {
        // Create mocks used in the test discovery setup.
        const oDeps: TestParserDiscoveryOptions = {
            outChannel: typeMoq.Mock.ofType<OutputChannel>(),
            cancelToken: typeMoq.Mock.ofType<CancellationToken>(),
            wsFolder: typeMoq.Mock.ofType<Uri>()
        };
        oDeps.cancelToken.setup(c => c.isCancellationRequested).returns(() => false);

        // Create the test options for the mocked-up test. All data is either
        // mocked or is taken from the JSON test data itself.
        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: TestDiscoveryOptions = {
            args: [],
            cwd: '.',
            ignoreCache: true,
            outChannel: oDeps.outChannel.object,
            token: oDeps.cancelToken.object,
            workspaceFolder: oDeps.wsFolder.object
        };

        return [oDeps, options];
    }

    pytestScenario.forEach((testScenario) => {
        test(`${testScenario.scenarioDescription} (convert to TestFiles)`, () => {

            let testFilesParsed: TestFile[];
            // set up the test flattener, but extact the TestFiles for inspection here instead of actually flattening them.
            const testHelper = typeMoq.Mock.ofType<ITestsHelper>();
            testHelper.setup(t => t.flattenTestFiles(typeMoq.It.is<TestFile[]>(v => true), typeMoq.It.isAny()))
                .returns((v: TestFile[]) => {
                    testFilesParsed = v;
                    return undefined;
                });

            const parser = new PyTestsParser(testHelper.object);
            const [_, options] = createParserOptions();
            parser.parse(testScenario.json, options);

            expect(testFilesParsed).to.deep.equal(testScenario.expectedTestFiles);
        });
    });

    test('Parser handles the case when there is no test information given', () => {
        const [_, testHelper] = createTestsHelper();
        const [__, options] = createParserOptions();
        const parser = new PyTestsParser(testHelper);

        let result: Tests = parser.parse('', options);
        expect(result).to.be.equal(undefined, 'Received tests structure when input was an empty string?');
        result = parser.parse('      ', options);
        expect(result).to.be.equal(undefined, 'Received tests structure when input was a blank string?');
        result = parser.parse(undefined, options);
        expect(result).to.be.equal(undefined, 'Received tests structure when input was undefined?');
    });

    test('Parser throws error when given invalid JSON string', () => {
        const [_, testHelper] = createTestsHelper();
        const [__, options] = createParserOptions();
        const parser = new PyTestsParser(testHelper);
        try {
            parser.parse('This is not JSON, it is just a string.', options);
            expect('Should_not_get_here').to.be.equal('here', 'Parser did not throw an exception for invalid JSON input.');
        } catch (ex) {
            expect(ex.message).to.contain('Could not discover tests');
        }
    });
});
