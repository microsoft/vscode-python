export class BlockRegEx {
    constructor(private regEx: RegExp, public startWord: string) {}
    public test(value: string): boolean {
        // Clear the cache
        this.regEx.lastIndex = -1;
        return this.regEx.test(value);
    }
}

export const IF_REGEX = new BlockRegEx(/^( |\t)*if +.*: *$/g, 'if');
export const ELIF_REGEX = new BlockRegEx(/^( |\t)*elif +.*: *$/g, 'elif');
export const ELSE_REGEX = new BlockRegEx(/^( |\t)*else *: *$/g, 'else');
export const FOR_IN_REGEX = new BlockRegEx(/^( |\t)*for \w in .*: *$/g, 'for');
export const ASYNC_FOR_IN_REGEX = new BlockRegEx(/^( |\t)*async *for \w in .*: *$/g, 'for');
export const WHILE_REGEX = new BlockRegEx(/^( |\t)*while .*: *$/g, 'while');
export const TRY_REGEX = new BlockRegEx(/^( |\t)*try *: *$/g, 'try');
export const FINALLY_REGEX = new BlockRegEx(/^( |\t)*finally *: *$/g, 'finally');
export const EXCEPT_REGEX = new BlockRegEx(/^( |\t)*except *\w* *(as)? *\w* *: *$/g, 'except');
export const DEF_REGEX = new BlockRegEx(/^( |\t)*def \w *\(.*$/g, 'def');
export const ASYNC_DEF_REGEX = new BlockRegEx(/^( |\t)*async *def \w *\(.*$/g, 'async');
export const CLASS_REGEX = new BlockRegEx(/^( |\t)*class *\w* *.*: *$/g, 'class');
