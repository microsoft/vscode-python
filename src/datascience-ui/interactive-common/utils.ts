export function getMaxWidth(charLength: number): string {
    // This comes from a linear regression
    const width = 0.57674 * charLength + 1.70473;
    const unit = 'em';
    return Math.round(width).toString() + unit;
}
