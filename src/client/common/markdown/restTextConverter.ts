// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EOL } from 'os';
import { isWhiteSpace } from '../../language/characters';

export class RestTextConverter {
  // tslint:disable-next-line:cyclomatic-complexity
  public toMarkdown(docstring: string): string {
    // This method uses several regexs to 'translate' reStructruredText
    // (Python doc syntax) to Markdown syntax.

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
        if (line.length > 0 && !isWhiteSpace(line.charCodeAt(0))) {
          md.push('```');
          inCodeBlock = false;
        }
      }

      if (line.startsWith('```')) {
        md.push(line);
        inCodeBlock = true;
        continue;
      }

      if (i < lines.length - 1 && (lines[i + 1].startsWith('==='))) {
        // Section title -> heading level 3
        md.push(`### ${line}`);
        i += 1;
        continue;
      }

      if (i < lines.length - 1 && (lines[i + 1].startsWith('---'))) {
        md.push(`#### ${line}`);
        i += 1;
        continue;
      }

      if (line.startsWith('..') && line.indexOf('::') >= 0) {
        continue;
      }
      if (line.indexOf('generated/') >= 0) {
        continue;
      }
      if (line.startsWith('===') || line.startsWith('---')) {
        continue;
      }

      if (line.endsWith('::')) {
        // Literal blocks: begin with `::`
        if (line.length > 2) {
          md.push(line.substring(0, line.length - 1));
        }
        md.push('```');
        inCodeBlock = true;
        continue;
      }

      line = line.replace(/``/g, '`');
      if (line.length > 0 && isWhiteSpace(line.charCodeAt(0))) {
        line = `  ${line}  `; // Keep hard line breaks for the indented content
      }

      if (md.length > 0 && (md[md.length - 1].length === 0 || md[md.length - 1] === '```') && line.length === 0) {
        continue; // Avoid consequent empty lines
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
