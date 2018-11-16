// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-default-export no-invalid-this
export default function (source: string) {
    const sourcePath = this.resourcePath;
    if (sourcePath.indexOf('node_modules') === -1) {
        if (source.indexOf('unicode/category') > 0) {
            source = source.replace(/\'unicode\/category\//gm, '\'./unicode_category_');
            source = source.replace(/"unicode\/category\//gm, '"./unicode_category_');
        }
        if (source.indexOf('@jupyterlab\/services') > 0) {
            source = source.replace(/\'@jupyterlab\/services\'/gm, '\'./@jupyterlab/services\'');
            source = source.replace(/"@jupyterlab\/services"/gm, '"./@jupyterlab/services"');
        }
        if (source.indexOf('azure-storage') > 0) {
            source = source.replace(/\'azure-storage\'/gm, '\'./azure-storage\'');
            source = source.replace(/"azure-storage"/gm, '"./azure-storage"');
        }
    }
    return source;
}
