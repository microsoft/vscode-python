// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Problems as VSCProblems, ProblemSeverity } from '../../../../out/smoke/vscode/areas/problems/problems';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { noop } from '../helpers';
import '../helpers/extensions';
import { getSelector } from '../selectors';

export class Problems extends VSCProblems {
    constructor(code: Code) {
        super(code);
    }
    public async getProblemCount(type?: ProblemSeverity) {
        if (type) {
            const selector = VSCProblems.getSelectorInProblemsView(ProblemSeverity.ERROR);
            return context.app.code.waitForElements(selector, true, undefined, { retryCount: 2 })
                .catch(() => []).then(items => items.length);
        } else {
            const selector = getSelector('ProblemsBadge');
            const element = await context.app.code.waitForElement(selector, (ele) => !!ele, 2).catch(noop);
            if (!element || element.textContent.trim() === '') {
                return 0;
            }
            return parseInt(element.textContent.trim(), 10);
        }
    }
    public async getProblemFiles() {
        const selector = getSelector('FileNameInProblemsPanel');
        return context.app.code.waitForElements(selector, true, undefined, { retryCount: 2 })
            .then(eles => eles.map(ele => ele.textContent.normalize()))
            .catch(() => []);
    }
    public async getProblemMessages() {
        const selector = getSelector('ProblemMessageInProblemsPanel');
        return context.app.code.waitForElements(selector, true, undefined, { retryCount: 2 })
            .then(eles => eles.map(ele => ele.textContent.normalize()))
            .catch(() => [] as string[]);
    }
}
