// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { IArgumentsHelper, IUnitTestHelper, Tests, TestsToRun } from '../common/types';

@injectable()
export class UnitTestHelper implements IUnitTestHelper {
    private readonly argsHelper: IArgumentsHelper;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.argsHelper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
    }
    public getStartDirectory(args: string[]): string {
        const shortValue = this.argsHelper.getOptionValues(args, '-s');
        if (typeof shortValue === 'string') {
            return shortValue;
        }
        const longValue = this.argsHelper.getOptionValues(args, '--start-directory');
        if (typeof longValue === 'string') {
            return longValue;
        }
        return '.';
    }
    public getIdsOfTestsToRun(tests: Tests, testsToRun: TestsToRun): string[] {
        const testIds: string[] = [];
        if (testsToRun && testsToRun.testFolder) {
            // Get test ids of files in these folders.
            testsToRun.testFolder.forEach((folder) => {
                tests.testFiles.forEach((f) => {
                    if (f.fullPath.startsWith(folder.name)) {
                        testIds.push(f.nameToRun);
                    }
                });
            });
        }
        if (testsToRun && testsToRun.testFile) {
            testIds.push(...testsToRun.testFile.map((f) => f.nameToRun));
        }
        if (testsToRun && testsToRun.testSuite) {
            testIds.push(...testsToRun.testSuite.map((f) => f.nameToRun));
        }
        if (testsToRun && testsToRun.testFunction) {
            testIds.push(...testsToRun.testFunction.map((f) => f.nameToRun));
        }
        return testIds;
    }
}
