// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nodeModulesToExternalize } from '../common';

function replaceModule(contents: string, moduleName: string, quotes: '"' | '\''): string {
    const stringToSearch = `${quotes}${moduleName}${quotes}`;
    const stringToReplaceWith = `${quotes}./node_modules/${moduleName}${quotes}`;
    return contents.replace(new RegExp(stringToSearch, 'gm'), stringToReplaceWith);
}
// tslint:disable:no-default-export no-invalid-this
export default function (source: string) {
    nodeModulesToExternalize.forEach(moduleName => {
        if (source.indexOf(moduleName) > 0) {
            source = replaceModule(source, moduleName, '"');
            source = replaceModule(source, moduleName, '\'');
        }
    });
    return source;
}
