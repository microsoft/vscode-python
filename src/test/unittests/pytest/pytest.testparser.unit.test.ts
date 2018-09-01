// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as typeMoq from 'typemoq';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { getOSType } from '../../..//client/common/platform/osinfo';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { OSType } from '../../../client/common/platform/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { TestsHelper } from '../../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/unittests/common/testVisitors/flatteningVisitor';
import { FlattenedTestFunction, TestDiscoveryOptions, Tests } from '../../../client/unittests/common/types';
import { TestsParser as PyTestsParser } from '../../../client/unittests/pytest/services/parserService';
import { PytestDataPlatformType, pytestScenarioData } from './pytest_unittest_parser_data';

use(chaipromise);

// The PyTest test parsing is done via the stdout result of the
// `pytest --collect-only` command.
//
// There are a few limitations with this approach, the largest issue is mixing
// package and non-package style codebases (stdout does not give subdir
// information of tests in a package when __init__.py is not present).
//
// However, to test all of the various layouts that are available, we have
// created a JSON structure that defines all the tests - see file
// `pytest_unittest_parser_data.ts` in this folder.
suite('Unit Tests - PyTest - Test Parser used in discovery', () => {

    // Build tests for the test data that is relevant for this platform.
    const testPlatformType: PytestDataPlatformType =
        getOSType() === OSType.Windows ?
            PytestDataPlatformType.Windows : PytestDataPlatformType.NonWindows;

    pytestScenarioData.forEach((testScenario) => {
        if (testPlatformType === testScenario.platform) {

            const testDescription: string =
                `PyTest${testScenario.pytest_version_spec}: ${testScenario.description}`;

            test(testDescription, async () => {
                // Setup the service container for use by the parser.
                const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
                const appShell = typeMoq.Mock.ofType<IApplicationShell>();
                const cmdMgr = typeMoq.Mock.ofType<ICommandManager>();
                serviceContainer.setup(s => s.get(typeMoq.It.isValue(IApplicationShell), typeMoq.It.isAny()))
                    .returns(() => {
                        return appShell.object;
                    });
                serviceContainer.setup(s => s.get(typeMoq.It.isValue(ICommandManager), typeMoq.It.isAny()))
                    .returns(() => {
                        return cmdMgr.object;
                    });

                // Create mocks used in the test discovery setup.
                const outChannel = typeMoq.Mock.ofType<OutputChannel>();
                const cancelToken = typeMoq.Mock.ofType<CancellationToken>();
                cancelToken.setup(c => c.isCancellationRequested).returns(() => false);
                const wsFolder = typeMoq.Mock.ofType<Uri>();

                // Create the test options for the mocked-up test. All data is either
                // mocked or is taken from the JSON test data itself.
                const options: TestDiscoveryOptions = {
                    args: [],
                    cwd: testScenario.rootdir,
                    ignoreCache: true,
                    outChannel: outChannel.object,
                    token: cancelToken.object,
                    workspaceFolder: wsFolder.object
                };

                // Setup the parser.
                const testFlattener: TestFlatteningVisitor = new TestFlatteningVisitor();
                const testHlp: TestsHelper = new TestsHelper(testFlattener, serviceContainer.object);
                const parser = new PyTestsParser(testHlp);

                // Each test scenario has a 'stdout' member that is an array of
                // stdout lines. Join them here such that the parser can operate
                // on stdout-like data.
                const stdout: string = testScenario.stdout.join('\n');

                const parsedTests: Tests = parser.parse(stdout, options);

                // Now we can actually perform tests.
                expect(parsedTests).is.not.equal(
                    undefined,
                    'Should have gotten tests extracted from the parsed pytest result content.');

                expect(parsedTests.testFunctions.length).equals(
                    testScenario.functionCount,
                    `Parsed pytest summary contained ${testScenario.functionCount} test functions.`);

                testScenario.test_functions.forEach((funcName: string) => {
                    const findAllTests: FlattenedTestFunction[] | undefined = parsedTests.testFunctions.filter(
                        (tstFunc: FlattenedTestFunction) => {
                            return tstFunc.testFunction.nameToRun === funcName;
                        });
                    // Each test identified in the testScenario should exist once and only once.
                    expect(findAllTests).is.not.equal(undefined, `Could not find "${funcName}" in tests.`);
                    expect(findAllTests.length).is.equal(1, 'There should be exactly one instance of each test.');
                });

            });
        }
    });
});
