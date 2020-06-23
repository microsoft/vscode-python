/**
 * Result of rewriting a magic line.
 */
export declare type Rewrite = {
    text?: string;
    annotations?: MagicAnnotation[];
};
/**
 * An annotation to hold metadata about what a magic is doing.
 */
export declare type MagicAnnotation = {
    key: string;
    value: string;
};
/**
 * Position of a text match for magics.
 */
export declare type MatchPosition = [{
    line: number;
    col: number;
}, {
    line: number;
    col: number;
}];
/**
 * Interface for command-specific magic rewrites.
 */
export interface LineMagicRewriter {
    /**
     * Name of the magic command this will apply to.
     */
    commandName: string;
    /**
     * Rewrite the line magic.
     * @param matchedText the original matched text from the program
     * @param magicStmt the line magic text with newlines and continuations removed
     * @param position ((start_line, start_col),(end_line, end_col)) of `matchedText` within the cell
     * @return rewrite operation. Leave text empty if you want to use default rewrites.
     */
    rewrite(matchedText: string, magicStmt: string, position: MatchPosition): Rewrite;
}
/**
 * Utility to rewrite IPython code to remove magics.
 * Should be applied at to cells, not the entire program, to properly handle cell magics.
 * One of the most important aspects of the rewriter is that it shouldn't change the line number
 * of any of the statements in the program. If it does, this will make it impossible to
 * map back from the results of code analysis to the relevant code in the editor.
 */
export declare class MagicsRewriter {
    /**
     * Construct a magics rewriter.
     */
    constructor(lineMagicRewriters?: LineMagicRewriter[]);
    /**
     * Rewrite code so that it doesn't contain magics.
     */
    rewrite(text: string, lineMagicRewriters?: LineMagicRewriter[]): string;
    rewriteShellCommand(text: string): string;
    /**
     * Default rewrite rule for cell magics.
     */
    rewriteCellMagic(text: string): string;
    /**
     * Default rewrite rule for line magics.
     */
    rewriteLineMagic(text: string, lineMagicRewriters?: LineMagicRewriter[]): string;
    private _lineMagicRewriters;
    private _defaultLineMagicRewriters;
}
/**
 * Line magic rewriter for the "time" magic.
 */
export declare class TimeLineMagicRewriter implements LineMagicRewriter {
    commandName: string;
    rewrite(matchedText: string, magicStmt: string, position: MatchPosition): Rewrite;
}
/**
 * Line magic rewriter for the "pylab" magic.
 */
export declare class PylabLineMagicRewriter implements LineMagicRewriter {
    commandName: string;
    rewrite(matchedText: string, magicStmt: string, position: MatchPosition): Rewrite;
}
