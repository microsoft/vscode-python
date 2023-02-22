// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ActiveState } from '../../../common/environmentManagers/activestate';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { traceError, traceVerbose } from '../../../../logging';
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';
import { findInterpretersInDir } from '../../../common/commonUtils';

export class ActiveStateLocator extends LazyResourceBasedLocator {
    public readonly providerId: string = 'activestate';

    // eslint-disable-next-line class-methods-use-this
    public async *doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const state = await ActiveState.getState();
        if (state === undefined) {
            traceVerbose(`Couldn't locate the state binary.`);
            return;
        }
        const projects = await state.getProjects();
        if (projects === undefined) {
            traceVerbose(`Couldn't fetch State Tool projects.`);
            return;
        }
        for (const project of projects) {
            if (project.executables) {
                for (const dir of project.executables) {
                    try {
                        traceVerbose(`Looking for Python in: ${project.name}`);
                        for await (const exe of findInterpretersInDir(dir)) {
                            traceVerbose(`Found Python executable: ${exe.filename}`);
                            yield { kind: PythonEnvKind.ActiveState, executablePath: exe.filename };
                        }
                    } catch (ex) {
                        traceError(`Failed to process State Tool project: ${JSON.stringify(project)}`, ex);
                    }
                }
            }
        }
    }
}
