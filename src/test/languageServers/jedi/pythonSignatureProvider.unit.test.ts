// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect, use } from 'chai';
import * as chaipromise from 'chai-as-promised';
import * as TypeMoq from 'typemoq';
import { CancellationToken, Position, SignatureHelp, TextDocument, TextLine, Uri } from 'vscode';
import { JediFactory } from '../../../client/languageServices/jediProxyFactory';
import { IArgumentsResult, JediProxyHandler } from '../../../client/providers/jediProxy';
import { isPositionInsideStringOrComment } from '../../../client/providers/providerUtilities';
import { PythonSignatureProvider } from '../../../client/providers/signatureProvider';

use(chaipromise);

suite('Signature Provider unit tests', () => {
    let pySignatureProvider: PythonSignatureProvider;
    let jediHandler: TypeMoq.IMock<JediProxyHandler<IArgumentsResult>>;
    let argResultItems: IArgumentsResult;
    setup(() => {
        const jediFactory = TypeMoq.Mock.ofType(JediFactory);
        jediHandler = TypeMoq.Mock.ofType<JediProxyHandler<IArgumentsResult>>();
        jediFactory.setup((j) => j.getJediProxyHandler(TypeMoq.It.isAny())).returns(() => jediHandler.object);
        pySignatureProvider = new PythonSignatureProvider(jediFactory.object);
        argResultItems = {
            definitions: [
                {
                    description: 'The result',
                    docstring: 'Some docstring goes here.',
                    name: 'print',
                    paramindex: 0,
                    params: [
                        {
                            description: 'Some parameter',
                            docstring: 'gimme docs',
                            name: 'param',
                            value: 'blah',
                        },
                    ],
                },
            ],
            requestId: 1,
        };
    });

    function testSignatureReturns(source: string, pos: number): Thenable<SignatureHelp> {
        const doc = TypeMoq.Mock.ofType<TextDocument>();
        const position = new Position(0, pos);
        const lineText = TypeMoq.Mock.ofType<TextLine>();
        const argsResult = TypeMoq.Mock.ofType<IArgumentsResult>();
        const cancelToken = TypeMoq.Mock.ofType<CancellationToken>();
        cancelToken.setup((ct) => ct.isCancellationRequested).returns(() => false);

        doc.setup((d) => d.fileName).returns(() => '');
        doc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => source);
        doc.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns(() => lineText.object);
        doc.setup((d) => d.offsetAt(TypeMoq.It.isAny())).returns(() => pos - 1); // pos is 1-based
        const docUri = TypeMoq.Mock.ofType<Uri>();
        docUri.setup((u) => u.scheme).returns(() => 'http');
        doc.setup((d) => d.uri).returns(() => docUri.object);
        lineText.setup((l) => l.text).returns(() => source);
        argsResult.setup((c) => c.requestId).returns(() => 1);

        argsResult.setup((c) => c.definitions).returns(() => (argResultItems as any)[0].definitions);
        jediHandler
            .setup((j) => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
                return Promise.resolve(argResultItems);
            });

        return pySignatureProvider.provideSignatureHelp(doc.object, position, cancelToken.object);
    }

    function testIsInsideStringOrComment(sourceLine: string, sourcePos: number): boolean {
        const textLine: TypeMoq.IMock<TextLine> = TypeMoq.Mock.ofType<TextLine>();
        textLine.setup((t) => t.text).returns(() => sourceLine);
        const doc: TypeMoq.IMock<TextDocument> = TypeMoq.Mock.ofType<TextDocument>();
        const pos: Position = new Position(1, sourcePos);

        doc.setup((d) => d.fileName).returns(() => '');
        doc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => sourceLine);
        doc.setup((d) => d.lineAt(TypeMoq.It.isAny())).returns(() => textLine.object);
        doc.setup((d) => d.offsetAt(TypeMoq.It.isAny())).returns(() => sourcePos);

        return isPositionInsideStringOrComment(doc.object, pos);
    }

    test('Ensure no signature is given within a string.', async () => {
        const source = "  print('Python is awesome,')\n";
        const sigHelp: SignatureHelp = await testSignatureReturns(source, 27);
        expect(sigHelp).to.not.be.equal(
            undefined,
            'Expected to get a blank signature item back - did the pattern change here?',
        );
        expect(sigHelp.signatures.length).to.equal(0, 'Signature provided for symbols within a string?');
    });
    test('Ensure no signature is given within a line comment.', async () => {
        const source = "#  print('Python is awesome,')\n";
        const sigHelp: SignatureHelp = await testSignatureReturns(source, 28);
        expect(sigHelp).to.not.be.equal(
            undefined,
            'Expected to get a blank signature item back - did the pattern change here?',
        );
        expect(sigHelp.signatures.length).to.equal(0, 'Signature provided for symbols within a full-line comment?');
    });
    test('Ensure no signature is given within a comment tailing a command.', async () => {
        const source = "  print('Python') # print('is awesome,')\n";
        const sigHelp: SignatureHelp = await testSignatureReturns(source, 38);
        expect(sigHelp).to.not.be.equal(
            undefined,
            'Expected to get a blank signature item back - did the pattern change here?',
        );
        expect(sigHelp.signatures.length).to.equal(0, 'Signature provided for symbols within a trailing comment?');
    });
    test('Ensure signature is given for built-in print command.', async () => {
        const source = "  print('Python',)\n";
        let sigHelp: SignatureHelp;
        try {
            sigHelp = await testSignatureReturns(source, 18);
            expect(sigHelp).to.not.equal(
                undefined,
                'Expected to get a blank signature item back - did the pattern change here?',
            );
            expect(sigHelp.signatures.length).to.not.equal(
                0,
                'Expected dummy argresult back from testing our print signature.',
            );
            expect(sigHelp.activeParameter).to.be.equal(
                0,
                "Parameter for print should be the first member of the test argresult's params object.",
            );
            expect(sigHelp.activeSignature).to.be.equal(
                0,
                'The signature for print should be the first member of the test argresult.',
            );
            expect(sigHelp.signatures[sigHelp.activeSignature].label).to.be.equal(
                'print(param)',
                `Expected arg result calls for specific returned signature of \'print(param)\' but we got ${
                    sigHelp.signatures[sigHelp.activeSignature].label
                }`,
            );
        } catch (error) {
            assert(false, `Caught exception ${error}`);
        }
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected.', () => {
        const sourceLine: string = "  print('Hello world!')\n";
        const sourcePos: number = sourceLine.length - 1;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.not.be.equal(
            true,
            [`Position set to the end of ${sourceLine} but `, 'is reported as being within a string or comment.'].join(
                '',
            ),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at end of source.', () => {
        const sourceLine: string = "  print('Hello world!')\n";
        const sourcePos: number = 0;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.not.be.equal(
            true,
            [`Position set to the end of ${sourceLine} but `, 'is reported as being within a string or comment.'].join(
                '',
            ),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at beginning of source.', () => {
        const sourceLine: string = "  print('Hello world!')\n";
        const sourcePos: number = 0;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.not.be.equal(
            true,
            [
                `Position set to the beginning of ${sourceLine} but `,
                'is reported as being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a string.', () => {
        const sourceLine: string = "  print('Hello world!')\n";
        const sourcePos: number = 16;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within the string in ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected immediately before a string.', () => {
        const sourceLine: string = "  print('Hello world!')\n";
        const sourcePos: number = 8;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            false,
            [
                `Position set to just before the string in ${sourceLine} (position ${sourcePos}) but `,
                'is reported as being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected immediately in a string.', () => {
        const sourceLine: string = "  print('Hello world!')\n";
        const sourcePos: number = 9;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set to the start of the string in ${sourceLine} (position ${sourcePos}) but `,
                'is reported as being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a comment.', () => {
        const sourceLine: string = "#  print('Hello world!')\n";
        const sourcePos: number = 16;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a full line comment ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a trailing comment.', () => {
        const sourceLine: string = "  print('Hello world!') # some comment...\n";
        const sourcePos: number = 34;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a trailing line comment ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at the very end of a trailing comment.', () => {
        const sourceLine: string = "  print('Hello world!') # some comment...\n";
        const sourcePos: number = sourceLine.length - 1;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a trailing line comment ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a multiline string.', () => {
        const sourceLine: string =
            "  stringVal = '''This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!'''\n";
        const sourcePos: number = 48;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at the very last quote on a multiline string.', () => {
        const sourceLine: string =
            "  stringVal = '''This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!'''\n";
        const sourcePos: number = sourceLine.length - 2; // just at the last '
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a multiline string (double-quoted).', () => {
        const sourceLine: string =
            '  stringVal = """This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!"""\n';
        const sourcePos: number = 48;
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at the very last quote on a multiline string (double-quoted).', () => {
        const sourceLine: string =
            '  stringVal = """This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!"""\n';
        const sourcePos: number = sourceLine.length - 2; // just at the last '
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected during construction of a multiline string (double-quoted).', () => {
        const sourceLine: string = '  stringVal = """This is a multiline\nstring that you can use\nto test this stuff';
        const sourcePos: number = sourceLine.length - 1; // just at the last position in the string before it's termination
        const isInsideStrComment: boolean = testIsInsideStringOrComment(sourceLine, sourcePos);

        expect(isInsideStrComment).to.be.equal(
            true,
            [
                `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
                'is reported as NOT being within a string or comment.',
            ].join(''),
        );
    });
});
