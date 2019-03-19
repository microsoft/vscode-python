// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable-next-line:no-stateless-class no-unnecessary-class
export class ErrorUtils {
    public static outputHasModuleNotInstalledError(moduleName: string, content?: string): boolean {
        return content && (content!.indexOf(`No module named ${moduleName}`) > 0 || content!.indexOf(`No module named '${moduleName}'`) > 0) ? true : false;
    }
}
