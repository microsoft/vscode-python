/**
 * Result of rewriting a magic line.
 */
export type Rewrite = {
    text?: string;
    annotations?: MagicAnnotation[];
};

/**
 * An annotation to hold metadata about what a magic is doing.
 */
export type MagicAnnotation = {
    key: string;
    value: string;
};

/**
 * Position of a text match for magics.
 */
export type MatchPosition = [{ line: number; col: number }, { line: number; col: number }];

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
     * @param postion ((start_line, start_col),(end_line, end_col)) of `matchedText` within the cell
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
export class MagicsRewriter {
    /**
     * Construct a magics rewriter.
     */
    constructor(lineMagicRewriters?: LineMagicRewriter[]) {
        this._lineMagicRewriters = lineMagicRewriters || this._defaultLineMagicRewriters;
    }

    /**
     * Rewrite code so that it doesn't contain magics.
     */
    rewrite(text: string, lineMagicRewriters?: LineMagicRewriter[]) {
        text = this.rewriteCellMagic(text);
        text = this.rewriteLineMagic(text, this._lineMagicRewriters);
        return text;
    }

    /**
     * Default rewrite rule for cell magics.
     */
    rewriteCellMagic(text: string): string {
        if (text.match(/\s*%%/)) {
            return text
                .split('\n')
                .map(l => '#' + l)
                .join('\n');
        }
        return text;
    }

    /**
     * Default rewrite rule for line magics.
     */
    rewriteLineMagic(text: string, lineMagicRewriters?: LineMagicRewriter[]): string {
        // Create a mapping from character offsets to line starts.
        let lines = text.split('\n');
        let lastLineStart = 0;
        let lineStarts: number[] = lines.map((line, i) => {
            if (i == 0) {
                return 0;
            }
            let lineStart = lastLineStart + lines[i - 1].length + 1;
            lastLineStart = lineStart;
            return lineStart;
        });

        // Map magic to comment and location.
        return text.replace(/^\s*(%(?:\\\s*\n|[^\n])+)/gm, (match, magicStmt) => {
            // Find the start and end lines where the character appeared.
            let startLine = -1,
                startCol = -1;
            let endLine = -1,
                endCol = -1;
            let offset = match.length - magicStmt.length;
            for (let i = 0; i < lineStarts.length; i++) {
                if (offset >= lineStarts[i]) {
                    startLine = i;
                    startCol = offset - lineStarts[i];
                }
                if (offset + magicStmt.length >= lineStarts[i]) {
                    endLine = i;
                    endCol = offset + magicStmt.length - lineStarts[i];
                }
            }

            let position: MatchPosition = [{ line: startLine, col: startCol }, { line: endLine, col: endCol }];

            let magicStmtCleaned = magicStmt.replace(/\\\s*\n/g, '');
            let commandMatch = magicStmtCleaned.match(/^%(\w+).*/);
            let rewriteText;
            let annotations: MagicAnnotation[] = [];

            // Look for command-specific rewrite rules.
            if (commandMatch && commandMatch.length >= 2) {
                let command = commandMatch[1];
                if (lineMagicRewriters) {
                    for (let lineMagicRewriter of lineMagicRewriters) {
                        if (lineMagicRewriter.commandName == command) {
                            let rewrite = lineMagicRewriter.rewrite(match, magicStmtCleaned, position);
                            if (rewrite.text) {
                                rewriteText = rewrite.text;
                            }
                            if (rewrite.annotations) {
                                annotations = annotations.concat(rewrite.annotations);
                            }
                            break;
                        }
                    }
                }
            }

            // Default rewrite: comment out all lines.
            if (!rewriteText) {
                rewriteText = match
                    .split('\n')
                    .map(s => '#' + s)
                    .join('\n');
            }

            // Add annotations to the beginning of the magic.
            for (let annotation of annotations) {
                rewriteText = "'''" + annotation.key + ': ' + annotation.value + "'''" + ' ' + rewriteText;
            }
            return rewriteText;
        });
    }

    private _lineMagicRewriters: LineMagicRewriter[];
    private _defaultLineMagicRewriters = [new TimeLineMagicRewriter(), new PylabLineMagicRewriter()];
}

/**
 * Line magic rewriter for the "time" magic.
 */
export class TimeLineMagicRewriter implements LineMagicRewriter {
    commandName: string = 'time';
    rewrite(matchedText: string, magicStmt: string, position: MatchPosition): Rewrite {
        return {
            text: matchedText.replace(/^\s*%time/, match => {
                return '"' + ' '.repeat(match.length - 2) + '"';
            })
        };
    }
}

/**
 * Line magic rewriter for the "pylab" magic.
 */
export class PylabLineMagicRewriter implements LineMagicRewriter {
    commandName: string = 'pylab';
    rewrite(matchedText: string, magicStmt: string, position: MatchPosition): Rewrite {
        let defData = ['numpy', 'matplotlib', 'pylab', 'mlab', 'pyplot', 'np', 'plt', 'display', 'figsize', 'getfigs'].map(symbolName => {
            return {
                name: symbolName,
                pos: [[position[0].line, position[0].col], [position[1].line, position[1].col]]
            };
        });
        return {
            annotations: [{ key: 'defs', value: JSON.stringify(defData) }]
        };
    }
}
