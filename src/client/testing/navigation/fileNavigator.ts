// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { swallowExceptions } from '../../common/utils/decorators';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TestFile } from '../common/types';
import { ITestCodeNavigator, ITestNavigatorHelper } from './types';

@injectable()
export class TestFileCodeNavigator implements ITestCodeNavigator {
    constructor(@inject(ITestNavigatorHelper) private readonly helper: ITestNavigatorHelper) {}
    @swallowExceptions('Navigate to test file')
    @captureTelemetry(EventName.UNITTEST_NAVIGATE, { byFile: true })
    public async navigateTo(_: Uri, item: TestFile, __: boolean): Promise<void> {
        await this.helper.openFile(Uri.file(item.fullPath));
    }
}
