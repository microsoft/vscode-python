// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Temporary work around for https://github.com/microsoft/vscode/issues/98106
// tslint:disable

const scriptSrcs = Array.from(document.querySelectorAll('script'))
    .map((item) => item.attributes.getNamedItem('src'))
    .filter((item) => (item?.value || '').endsWith('pvscDummy.js'))
    .map((item) => item?.value)
    .filter((item) => !!item);

if (scriptSrcs.length) {
    console.error('main loaded');
    const src = scriptSrcs[0]!;
    const paths = src.split('/');
    // Remove file name portion from path.
    paths.pop();
    // Remove `renderers` name portion from path.
    paths.pop();
    console.error(paths);
    // tslint:disable-next-line: no-any
    (window as any).__PVSC_Public_Path = `${paths.join('/')}/notebook/`;
    console.error('(window as any).__PVSC_Public_Path');
    // tslint:disable-next-line: no-any
    console.error((window as any).__PVSC_Public_Path);
}
