// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as Cors from '@koa/cors';
import * as fs from 'fs-extra';
import * as Koa from 'koa';
import * as compress from 'koa-compress';
import * as logger from 'koa-logger';
import * as Stream from 'stream';

import { Identifiers } from '../../../datascience/constants';
import { noop } from '../../utils/misc';

const app = new Koa();
app.use(Cors());
app.use(compress());
app.use(logger());
app.use(async ctx => {
    ctx.type = 'html';
    try {
        const readable = new Stream.Readable();
        readable._read = noop;
        readable.push(await generateReactHtml(ctx.query));
        readable.push(null);
        ctx.body = readable;
    } catch (e) {
        ctx.body = `<div>${e}</div>`;
    }
});

app.listen(9890);
// tslint:disable-next-line: no-console
console.log('9890');

// tslint:disable: no-any
async function generateReactHtml(query: any) {
    const settings = query.settings ? query.settings : '';
    const embeddedCss = query.embeddedCss ? query.embeddedCss : '';
    const uriBase = ''; //webView.asWebviewUri(Uri.file(this.rootPath));
    const scripts = query.scripts ? query.scripts : '';
    const loaded = await getIndexBundle(scripts);
    const locDatabase = '';
    const style = embeddedCss ? embeddedCss : '';
    const settingsString = settings ? settings : '{}';

    return `<!doctype html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta http-equiv="Content-Security-Policy" content="img-src 'self' data: https: http: blob:; default-src 'unsafe-inline' 'unsafe-eval' vscode-resource: data: https: http:;">
            <meta name="theme-color" content="#000000">
            <meta name="theme" content="${Identifiers.GeneratedThemeName}"/>
            <title>React App</title>
            <style type="text/css">
            ${style}
            </style>
        </head>
        <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script type="text/javascript">
            ${getVsCodeApiScript({})}
            </script>
            <script type="text/javascript">
                function resolvePath(relativePath) {
                    if (relativePath && relativePath[0] == '.' && relativePath[1] != '.') {
                        return "${uriBase}" + relativePath.substring(1);
                    }

                    return "${uriBase}" + relativePath;
                }
                function getLocStrings() {
                    return ${locDatabase};
                }
                function getInitialSettings() {
                    return ${settingsString};
                }
            </script>
            <script>
            ${loaded}
            </script>
        </body>
    </html>`;
}

function getVsCodeApiScript(state: any) {
    return `
        const acquireVsCodeApi = (function() {
            const originalPostMessage = window.parent.postMessage.bind(window.parent);
            const targetOrigin = '*';
            let acquired = false;

            let state = ${state ? `JSON.parse("${JSON.stringify(state)}")` : undefined};

            return () => {
                if (acquired) {
                    throw new Error('An instance of the VS Code API has already been acquired');
                }
                acquired = true;
                return Object.freeze({
                    postMessage: function(msg) {
                        return originalPostMessage({ command: 'onmessage', data: msg }, targetOrigin);
                    },
                    setState: function(newState) {
                        state = newState;
                        originalPostMessage({ command: 'do-update-state', data: JSON.stringify(newState) }, targetOrigin);
                        return newState;
                    },
                    getState: function() {
                        return state;
                    }
                });
            };
        })();
        delete window.parent;
        delete window.top;
        delete window.frameElement;
    `;
}

function getIndexBundle(script: string): Promise<string> {
    return fs.readFile(script, 'utf-8');
}
