// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { EOL } from 'os';
import * as vscode from 'vscode';
import * as proxy from './jediProxy';

export function extractSignatureAndDocumentation(definition: proxy.IAutoCompleteItem, highlightCode: boolean = false): [string, string] {
    // Somtimes the signature of the function, class (whatever) is broken into multiple lines
    // Here's an example
    // ```python
    // def __init__(self, group=None, target=None, name=None,
    //              args=(), kwargs=None, verbose=None):
    //     """This constructor should always be called with keyword arguments. Arguments are:

    //     *group* should be None; reserved for future extension when a ThreadGroup
    //     class is implemented.
    ///    """
    /// ```
    const txt = definition.description || definition.text;
    const rawDocString = typeof definition.raw_docstring === 'string' ? definition.raw_docstring.trim() : '';
    const firstLineOfRawDocString = rawDocString.length > 0 ? rawDocString.split(/\r?\n/)[0] : '';
    let lines = txt.split(/\r?\n/);
    const startIndexOfDocString = firstLineOfRawDocString === '' ? -1 : lines.findIndex(line => line.indexOf(firstLineOfRawDocString) === 0);

    const signatureLines = startIndexOfDocString === -1 ? [lines.shift()] : lines.splice(0, startIndexOfDocString);
    let signature = signatureLines.filter(line => line.trim().length > 0).join(EOL);

    // tslint:disable-next-line:switch-default
    switch (definition.type) {
        case vscode.CompletionItemKind.Constructor:
        case vscode.CompletionItemKind.Function:
        case vscode.CompletionItemKind.Method: {
            signature = `def ${signature}`;
            break;
        }
        case vscode.CompletionItemKind.Class: {
            signature = `class ${signature}`;
            break;
        }
    }

    // check if we have any sample code in the documentation
    if (highlightCode) {
        lines = lines.map(line => {
            if (line.trim().startsWith('>>> ')) {
                return '```python\n' + line.substring(4).trim() + '\n```';
            }
            return line;
        });
    }
    return [signature, lines.join(EOL).trim().replace(/^\s+|\s+$/g, '').trim()];
}

export function highlightCode(docstring: string): string {
    /**********
     *
     * Magic. Do not touch. [What is the best comment in source code](https://stackoverflow.com/a/185106)
     *
     * This method uses several regexs to 'translate' reStructruedText syntax (Python doc syntax) to Markdown syntax.
     *
     * Let's just keep it unchanged unless a better solution becomes possible.
     *
     **********/
    // Add 2 line break before and after docstring (used to match a blank line)
    docstring = EOL + EOL + docstring.trim() + EOL + EOL;
    // Section title -> heading level 2
    docstring = docstring.replace(/(.+\r?\n)[-=]+\r?\n/g, `## $1${EOL}`);
    // Directives: '.. directive::' -> '**directive**'
    docstring = docstring.replace(/\.\. (.*)::/g, '**$1**');
    // Pattern of 'var : description'
    const paramLinePattern = '[\\*\\w_]+ ?:[^:\r\n]+';
    // Add new line after and before param line
    docstring = docstring.replace(new RegExp(`(${EOL + paramLinePattern})`, 'g'), `$1${EOL}`);
    docstring = docstring.replace(new RegExp(`(${EOL + paramLinePattern + EOL})`, 'g'), `${EOL}$1`);
    // 'var : description' -> '`var` description'
    docstring = docstring.replace(/\r?\n([\*\w]+) ?: ?([^:\r\n]+\r?\n)/g, `${EOL}\`$1\` $2`);
    // Doctest blocks: begin with `>>>` and end with blank line
    // tslint:disable-next-line:prefer-template
    docstring = docstring.replace(/(>>>[\w\W]+?\r?\n)\r?\n/g, `${'```python' + EOL}$1${'```' + EOL + EOL}`);
    // Literal blocks: begin with `::` (literal blocks are indented or quoted; for simplicity, we end literal blocks with blank line)
    // tslint:disable-next-line:prefer-template
    docstring = docstring.replace(/(\r?\n[^\.]*)::\r?\n\r?\n([\w\W]+?\r?\n)\r?\n/g, `$1${EOL + '```' + EOL}$2${'```' + EOL + EOL}`);
    // Remove indentation in Field lists and Literal blocks
    let inCodeBlock = false;
    let codeIndentation = 0;
    const lines = docstring.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            if (inCodeBlock) {
                codeIndentation = lines[i + 1].match(/^ */)[0].length;
            }
            continue;
        }
        if (!inCodeBlock) {
            lines[i] = line.replace(/^ {4,8}/, '');
            // Field lists: ':field:' -> '**field**'
            lines[i] = lines[i].replace(/:(.+?):/g, '**$1** ');
        } else {
            if (codeIndentation !== 0) {
                lines[i] = line.substring(codeIndentation);
            }
        }
    }
    docstring = lines.join(EOL);
    // Grid Tables
    docstring = docstring.replace(/\r?\n[\+-]+\r?\n/g, EOL);
    docstring = docstring.replace(/\r?\n[\+=]+\r?\n/g, s => s.replace(/\+/g, '|').replace(/=/g, '-'));
    return docstring.trim();
}
