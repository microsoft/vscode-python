// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IProcessServiceFactory } from '../../client/common/process/types';
import { IInterpreterService, PythonInterpreter } from '../../client/interpreter/contracts';
import { DataScienceIocContainer } from './dataScienceIocContainer';

export async function getNotebookCapableInterpreter(
    ioc: DataScienceIocContainer,
    processFactory: IProcessServiceFactory
): Promise<PythonInterpreter | undefined> {
    const is = ioc.serviceContainer.get<IInterpreterService>(IInterpreterService);
    const list = await is.getInterpreters();
    const procService = await processFactory.create();
    if (procService) {
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < list.length; i += 1) {
            const result = await procService.exec(list[i].path, ['-m', 'jupyter', 'notebook', '--version'], {
                env: process.env
            });
            if (!result.stderr) {
                return list[i];
            }
        }
    }
    return undefined;
}

// IP = * format is a bit different from localhost format
export function getIPConnectionInfo(output: string): string | undefined {
    // String format: http://(NAME or IP):PORT/
    const nameAndPortRegEx = /(https?):\/\/\(([^\s]*) or [0-9.]*\):([0-9]*)\/(?:\?token=)?([a-zA-Z0-9]*)?/;

    const urlMatch = nameAndPortRegEx.exec(output);
    if (urlMatch && !urlMatch[4]) {
        return `${urlMatch[1]}://${urlMatch[2]}:${urlMatch[3]}/`;
    } else if (urlMatch && urlMatch.length === 5) {
        return `${urlMatch[1]}://${urlMatch[2]}:${urlMatch[3]}/?token=${urlMatch[4]}`;
    }

    // In Notebook 6.0 instead of the above format it returns a single valid web address so just return that
    return getConnectionInfo(output);
}

export function getConnectionInfo(output: string): string | undefined {
    const UrlPatternRegEx = /(https?:\/\/[^\s]+)/;

    const urlMatch = UrlPatternRegEx.exec(output);
    if (urlMatch) {
        return urlMatch[0];
    }
    return undefined;
}
