export function getRelativeTime(now: Date, time: Date): string {
    let diff = now.valueOf() - time.valueOf();

    function relativeTime(count: number, unit: string) {
        let units = count > 1 ? unit + 's' : unit;
        return count + ' ' + units + ' ago';
    }

    let headerText = '';
    // Approximate---not exact!
    let seconds = Math.floor(diff / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    let weeks = Math.floor(days / 7);
    let months = Math.floor(weeks / 4); // approximate. Need calendar to be exact
    if (months > 0) headerText = relativeTime(months, 'month');
    else if (weeks > 0) headerText = relativeTime(weeks, 'week');
    else if (days > 0) headerText = relativeTime(days, 'day');
    else if (hours > 0) headerText = relativeTime(hours, 'hour');
    else if (minutes > 0) headerText = relativeTime(minutes, 'minute');
    else if (seconds > 0) headerText = relativeTime(seconds, 'second');
    else headerText = 'Milliseconds ago';
    return headerText;
}
