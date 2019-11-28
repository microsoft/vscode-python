// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as Cors from '@koa/cors';
import * as Koa from 'koa';

const app = new Koa();
app.use(Cors());
app.use(async ctx => {
    ctx.body = `<div>'Hello from Koa'</div>`;
});

app.listen(9890);
// tslint:disable-next-line: no-console
console.log('9890');
