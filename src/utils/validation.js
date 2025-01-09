function isValidDateFormat(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!regex.test(dateString)) {
        return false;
    }

    const [datePart, timePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    const date = new Date(year, month - 1, day, hour, minute);

    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day &&
           date.getHours() === hour &&
           date.getMinutes() === minute;
}

function formatDate(date) {
    return date.toISOString();
}

module.exports = {
    isValidDateFormat,
    formatDate
};