// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EOL } from 'os';
import { isWhiteSpace } from '../../language/characters';

export class RestTextConverter {
  // tslint:disable-next-line:cyclomatic-complexity
  public toMarkdown(docstring: string): string {
    // This method uses several regexs to 'translate' reStructruredText
    // https://en.wikipedia.org/wiki/ReStructuredText
    // (Python doc syntax) to Markdown syntax. It only translates
    // as much as needed to display tooltips in intellisense.

    // Determine if this is actually a reStructruredText
    if (docstring.indexOf('::') < 0 && docstring.indexOf('..')) {
      // If documentation contains markdown symbols such as ** (power of) in code, escape them.
      return this.escapeMarkdown(docstring);
    }

    const md: string[] = [];
    let inCodeBlock = false;

    const lines = docstring.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      let line = lines[i];

      if (inCodeBlock) {
        // Pseudo-code block terminates by a line without leading
        // whitespace. Pseudo-code blocks are used to preserve
        // pre-formatted text.
        if (line.length > 0 && !isWhiteSpace(line.charCodeAt(0))) {
          md.push('```');
          inCodeBlock = false;
        }
      }

      if (line.startsWith('```')) {
        md.push(line);
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (i < lines.length - 1 && (lines[i + 1].startsWith('==='))) {
        // Section title -> heading level 3
        md.push(`### ${line}`);
        i += 1; // Eat line with ===
        continue;
      }

      if (i < lines.length - 1 && (lines[i + 1].startsWith('---'))) {
        // Subsection title -> heading level 4
        md.push(`#### ${line}`);
        i += 1; // Eat line with ---
        continue;
      }

      if (line.startsWith('..') && line.indexOf('::') >= 0) {
        continue; // Ignore assorted tags likes .. seealso::
      }
      if (line.indexOf('generated/') >= 0) {
        continue; // ignore generated content
      }
      if (line.startsWith('===') || line.startsWith('---')) {
        continue;
      }

      if (line.endsWith('::')) {
        // Literal blocks begin with `::`. Such as sequence like
        // '... as shown below::' that is followed by a preformatted text.
        if (line.length > 2) {
          md.push(line.substring(0, line.length - 1));
        }
        md.push('```');
        inCodeBlock = true;
        continue;
      }

      line = line.replace(/``/g, '`'); // Convert double backticks to single
      if (line.length > 0 && isWhiteSpace(line.charCodeAt(0))) {
        // Keep hard line breaks for the pre-indented content
        line = `  ${line}  `;
      }

      if (md.length > 0 && (md[md.length - 1].length === 0 || md[md.length - 1] === '```') && line.length === 0) {
        continue; // Avoid more than one empty line in a row
      }

      md.push(line);
    }

    if (inCodeBlock) {
      md.push('```');
    }
    return md.join(EOL).trim();
  }

  public escapeMarkdown(text: string): string {
    // Not complete escape list so it does not interfere
    // with subsequent code highlighting (see above).
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/\_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\!/g, '\\!');
  }
}
