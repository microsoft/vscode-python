// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as TypeMoq from 'typemoq';
import { Range, TextDocument, TextLine, Uri } from 'vscode';

// tslint:disable:max-func-body-length no-trailing-whitespace no-multiline-string
// Disable whitespace / multiline as we use that to pass in our fake file strings

// Helper function to create a document and get line count and lines
export function createDocument(
    inputText: string,
    fileName: string,
    fileVersion: number,
    times: TypeMoq.Times,
    implementGetText?: boolean
): TypeMoq.IMock<TextDocument> {
    const document = TypeMoq.Mock.ofType<TextDocument>();

    // Split our string on newline chars
    const inputLines = inputText.split(/\r?\n/);

    document.setup(d => d.languageId).returns(() => 'python');

    // First set the metadata
    document
        .setup(d => d.fileName)
        .returns(() => Uri.file(fileName).fsPath)
        .verifiable(times);
    document
        .setup(d => d.version)
        .returns(() => fileVersion)
        .verifiable(times);

    // Next add the lines in
    document.setup(d => d.lineCount).returns(() => inputLines.length);

    const textLines = inputLines.map((line, index) => {
        const textLine = TypeMoq.Mock.ofType<TextLine>();
        const testRange = new Range(index, 0, index, line.length);
        textLine.setup(l => l.text).returns(() => line);
        textLine.setup(l => l.range).returns(() => testRange);
        textLine.setup(l => l.isEmptyOrWhitespace).returns(() => line.trim().length === 0);
        return textLine;
    });
    document.setup(d => d.lineAt(TypeMoq.It.isAnyNumber())).returns((index: number) => textLines[index].object);

    // Get text is a bit trickier
    if (implementGetText) {
        document.setup(d => d.getText()).returns(() => inputText);
        document
            .setup(d => d.getText(TypeMoq.It.isAny()))
            .returns((r: Range) => {
                let results = '';
                if (r) {
                    for (let line = r.start.line; line <= r.end.line && line < inputLines.length; line += 1) {
                        const startIndex = line === r.start.line ? r.start.character : 0;
                        const endIndex = line === r.end.line ? r.end.character : inputLines[line].length - 1;
                        results += inputLines[line].slice(startIndex, endIndex + 1);
                        if (line !== r.end.line) {
                            results += '\n';
                        }
                    }
                } else {
                    results = inputText;
                }
                return results;
            });
    }

    return document;
}
