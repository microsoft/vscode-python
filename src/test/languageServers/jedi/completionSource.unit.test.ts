// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, CompletionItemKind, Position, SymbolKind, TextDocument, TextLine } from 'vscode';
import { IAutoCompleteSettings, IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { JediFactory } from '../../../client/languageServices/jediProxyFactory';
import { CompletionSource } from '../../../client/providers/completionSource';
import { IItemInfoSource } from '../../../client/providers/itemInfoSource';
import { IAutoCompleteItem, ICompletionResult, JediProxyHandler } from '../../../client/providers/jediProxy';

suite('Completion Provider', () => {
    let completionSource: CompletionSource;
    let jediHandler: TypeMoq.IMock<JediProxyHandler<ICompletionResult>>;
    let autoCompleteSettings: TypeMoq.IMock<IAutoCompleteSettings>;
    let itemInfoSource: TypeMoq.IMock<IItemInfoSource>;
    setup(() => {
        const jediFactory = TypeMoq.Mock.ofType(JediFactory);
        jediHandler = TypeMoq.Mock.ofType<JediProxyHandler<ICompletionResult>>();
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        autoCompleteSettings = TypeMoq.Mock.ofType<IAutoCompleteSettings>();
        autoCompleteSettings = TypeMoq.Mock.ofType<IAutoCompleteSettings>();

        jediFactory.setup((j) => j.getJediProxyHandler(TypeMoq.It.isAny())).returns(() => jediHandler.object);
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => configService.object);
        configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        pythonSettings.setup((p) => p.autoComplete).returns(() => autoCompleteSettings.object);
        itemInfoSource = TypeMoq.Mock.ofType<IItemInfoSource>();
        completionSource = new CompletionSource(jediFactory.object, serviceContainer.object, itemInfoSource.object);
    });

    async function testDocumentation(source: string, addBrackets: boolean) {
        const doc = TypeMoq.Mock.ofType<TextDocument>();
        const position = new Position(1, 1);
        const token = new CancellationTokenSource().token;
        const lineText = TypeMoq.Mock.ofType<TextLine>();
        const completionResult = TypeMoq.Mock.ofType<ICompletionResult>();

        const autoCompleteItems: IAutoCompleteItem[] = [
            {
                description: 'description',
                kind: SymbolKind.Function,
                raw_docstring: 'raw docstring',
                rawType: CompletionItemKind.Function,
                rightLabel: 'right label',
                text: 'some text',
                type: CompletionItemKind.Function,
            },
        ];

        autoCompleteSettings.setup((a) => a.addBrackets).returns(() => addBrackets);
        doc.setup((d) => d.fileName).returns(() => '');
        doc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => source);
        doc.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns(() => lineText.object);
        doc.setup((d) => d.offsetAt(TypeMoq.It.isAny())).returns(() => 0);
        lineText.setup((l) => l.text).returns(() => source);
        completionResult.setup((c) => c.requestId).returns(() => 1);
        completionResult.setup((c) => c.items).returns(() => autoCompleteItems);
        completionResult.setup((c: any) => c.then).returns(() => undefined);
        jediHandler
            .setup((j) => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
                return Promise.resolve(completionResult.object);
            });

        const expectedSource = `${source}${autoCompleteItems[0].text}`;
        itemInfoSource
            .setup((i) =>
                i.getItemInfoFromText(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    expectedSource,
                    TypeMoq.It.isAny(),
                ),
            )
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());

        const [item] = await completionSource.getVsCodeCompletionItems(doc.object, position, token);
        await completionSource.getDocumentation(item, token);
        itemInfoSource.verifyAll();
    }

    test("Ensure docs are provided when 'addBrackets' setting is false", async () => {
        const source = 'if True:\n    print("Hello")\n';
        await testDocumentation(source, false);
    });
    test("Ensure docs are provided when 'addBrackets' setting is true", async () => {
        const source = 'if True:\n    print("Hello")\n';
        await testDocumentation(source, true);
    });
});
