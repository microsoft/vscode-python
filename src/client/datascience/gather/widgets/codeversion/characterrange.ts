/**
 * Text range from one character position to another.
 */
export class CharacterRange {
  /**
   * The index of the start character.
   */
  readonly start: number;

  /**
   * The index of the end character.
   */
  readonly end: number;

  /**
   * Construct a character range.
   */
  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
}
