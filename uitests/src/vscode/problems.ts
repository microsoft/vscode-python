// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '../helpers/extensions';
import { Selector } from '../selectors';
import { IApplication, IProblems } from '../types';

export class Problems implements IProblems {
    constructor(private readonly app: IApplication) {}
    public async waitUntilOpened(): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.ProblemsPanel), {
            timeout: 3000,
            visible: true
        });
    }
    public async getProblemCount() {
        const selector = this.app.getCSSSelector(Selector.ProblemsBadge);
        const content = await this.app.driver.$eval(selector, ele => ele.textContent || '').catch(() => '');
        return content.trim() === '' ? 0 : parseInt(content.trim(), 10);
    }
    public async getProblemFiles() {
        const selector = this.app.getCSSSelector(Selector.FileNameInProblemsPanel);
        return this.app.driver
            .$$eval(selector, elements => elements.map(element => element.textContent || ''))
            .then(items => items.map(item => item.normalize()))
            .catch(() => []);
    }
    public async getProblemMessages(): Promise<string[]> {
        const selector = this.app.getCSSSelector(Selector.ProblemMessageInProblemsPanel);
        return this.app.driver
            .$$eval(selector, elements => elements.map(element => element.textContent || ''))
            .then(items => items.map(item => item.normalize()))
            .catch<string[]>(() => []);
    }
}
