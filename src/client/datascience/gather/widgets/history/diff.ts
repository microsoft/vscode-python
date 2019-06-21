import { CharacterRange } from '../codeversion';
import { ILocation } from '../../analysis/parse/python/python-parser';
import { diff_match_patch } from 'diff-match-patch';

/**
 * Object instance for text diffing library.
 */
let diffMatchPatch = new diff_match_patch();

export type Diff = {
  text: string;
  beforeLines: number[];
  afterLines: number[];
  changeLocations: ILocation[];
};

type DiffLine = {
  text: string;
  version: 'before' | 'after' | 'both';
  changeRanges: CharacterRange[];
  index: number;
};

enum EditKind {
  Deletion = -1,
  Same = 0,
  Insertion = 1,
}

/**
 * Difference two versions of text. This outputs:
 * - a buffer of line-by-line text of a pairwise diff
 * - line numbers of the versions of the line from before, and from after
 * - character ranges of all locations where the text has changed
 */
export function computeTextDiff(before: string, after: string): Diff {
  // Diff the two versions of the text.
  let diff = diffMatchPatch.diff_main(before, after);
  diffMatchPatch.diff_cleanupSemantic(diff);

  // Plaintext for the diff representation.
  let beforeLine = '';
  let afterLine = '';
  let diffLines: DiffLine[] = [];
  let beforeLineChanges: CharacterRange[] = [];
  let afterLineChanges: CharacterRange[] = [];

  function addLines(
    beforeLine: string,
    afterLine: string,
    beforeLineChanges?: CharacterRange[],
    afterLineChanges?: CharacterRange[]
  ): void {
    beforeLineChanges = beforeLineChanges || [];
    afterLineChanges = afterLineChanges || [];
    if (beforeLine === afterLine) {
      diffLines.push({
        text: beforeLine,
        version: 'both',
        changeRanges: [],
        index: diffLines.length,
      });
    } else {
      if (beforeLine != null) {
        diffLines.push({
          text: beforeLine,
          version: 'before',
          changeRanges: beforeLineChanges.concat(),
          index: diffLines.length,
        });
        beforeLineChanges = [];
      }
      if (afterLine != null) {
        diffLines.push({
          text: afterLine,
          version: 'after',
          changeRanges: afterLineChanges.concat(),
          index: diffLines.length,
        });
        afterLineChanges = [];
      }
    }
  }

  // Sort diff segments so that "before" segments always appear before "after" segments.
  // This is so we can make sure to enqueue "before" version of lines before "after" ones.
  diff.sort((segment1, segment2) =>
    segment1[0] === 0 || segment2[0] === 0 ? 0 : segment1[0]
  );

  // Iterate through the list of diff chunks to:
  for (let segment of diff) {
    let action: EditKind = segment[0];
    let substring = segment[1];
    let substringLines = substring.split('\n');

    for (let l = 0; l < substringLines.length; l++) {
      let substringLine = substringLines[l];
      let isLastLine = l === substringLines.length - 1;
      let isInitialNewline = l === 0 && substringLine === '';
      switch (action) {
        case EditKind.Same: // same in both versions
          beforeLine += substringLine;
          afterLine += substringLine;
          if (!isLastLine) {
            addLines(
              beforeLine,
              afterLine,
              beforeLineChanges,
              afterLineChanges
            );
            beforeLine = '';
            afterLine = '';
          }
          break;
        case EditKind.Deletion: // in before, not after
          if (isInitialNewline) substringLine = '⏎';
          beforeLineChanges.push({
            start: beforeLine.length,
            end: beforeLine.length + substringLine.length,
          });
          beforeLine += substringLine;
          if (!isLastLine) {
            addLines(beforeLine, null, beforeLineChanges);
            beforeLine = '';
          }
          break;
        case EditKind.Insertion: // in after, not before
          if (isInitialNewline) substringLine = '⏎';
          afterLineChanges.push({
            start: afterLine.length,
            end: afterLine.length + substringLine.length,
          });
          afterLine += substringLine;
          if (!isLastLine) {
            addLines(null, afterLine, null, afterLineChanges);
            afterLine = '';
          }
          break;
      }
    }
  }

  // Add any residual before and after lines to the text.
  beforeLine = before.length > 0 ? beforeLine : undefined;
  afterLine = after.length > 0 ? afterLine : undefined;
  addLines(beforeLine, afterLine, beforeLineChanges, afterLineChanges);

  let beforeLineNumbers: number[] = [];
  let afterLineNumbers: number[] = [];
  let changeLocations: ILocation[] = [];

  // All "before" diff lines should go before "after" diff lines.
  // All other lines should preserve their original order.
  diffLines.sort((diffLine1, diffLine2) => {
    if (
      diffLine1.version === 'both' ||
      diffLine2.version === 'both' ||
      diffLine1.version === diffLine2.version
    ) {
      return diffLine1.index - diffLine2.index;
    } else return diffLine1.version === 'before' ? -1 : 1;
  });

  let diffTextLines = [];
  for (let i = 0; i < diffLines.length; i++) {
    let diffLine = diffLines[i];
    let lineNumber = i + 1;
    diffTextLines.push(diffLine.text);
    if (diffLine.version === 'before') {
      beforeLineNumbers.push(lineNumber);
    }
    if (diffLine.version === 'after') {
      afterLineNumbers.push(lineNumber);
    }
    for (let range of diffLine.changeRanges) {
      changeLocations.push({
        first_line: lineNumber,
        first_column: range.start,
        last_line: lineNumber,
        last_column: range.end,
      });
    }
  }

  return {
    text: diffTextLines.join('\n'),
    beforeLines: beforeLineNumbers,
    afterLines: afterLineNumbers,
    changeLocations: changeLocations,
  };
}
