// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IToken, TokenType } from './types';

class BracePair {
    public readonly openBrace: TokenType;
    public readonly closeBrace: TokenType;

    constructor(openBrace: TokenType, closeBrace: TokenType) {
        this.openBrace = openBrace;
        this.closeBrace = closeBrace;
    }
}

class Stack {
    private store: IToken[] = [];
    public push(val: IToken) {
        this.store.push(val);
    }
    public pop(): IToken | undefined {
        return this.store.pop();
    }
    public get length(): number {
        return this.store.length;
    }
}

export class BraceCounter {
    private readonly bracePairs: BracePair[] = [
        new BracePair(TokenType.OpenBrace, TokenType.CloseBrace),
        new BracePair(TokenType.OpenBracket, TokenType.CloseBracket),
        new BracePair(TokenType.OpenCurly, TokenType.CloseCurly),
    ];
    private braceStacks: Stack[] = [new Stack(), new Stack(), new Stack()];

    public get count(): number {
        let c = 0;
        for (const s of this.braceStacks) {
            c += s.length;
        }
        return c;
    }

    public isOpened(type: TokenType): boolean {
        for (let i = 0; i < this.bracePairs.length; i += 1) {
            const pair = this.bracePairs[i];
            if (pair.openBrace === type || pair.closeBrace === type) {
                return this.braceStacks[i].length > 0;
            }
        }
        return false;
    }

    public countBrace(brace: IToken): boolean {
        for (let i = 0; i < this.bracePairs.length; i += 1) {
            const pair = this.bracePairs[i];
            if (pair.openBrace === brace.type) {
                this.braceStacks[i].push(brace);
                return true;
            }
            if (pair.closeBrace === brace.type) {
                if (this.braceStacks[i].length > 0) {
                    this.braceStacks[i].pop();
                }
                return true;
            }
        }
        return false;
    }
}
