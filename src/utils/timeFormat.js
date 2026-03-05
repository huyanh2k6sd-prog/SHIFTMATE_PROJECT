// Helper to calculate duration in hours correctly handling overnight shifts
export const getDurationHours = (start, end) => {
    if (!start || !end) return 0;
    let h1, m1, h2, m2;
    const parseTime = (t) => {
        if (t.includes('T')) {
            const d = new Date(t);
            return [d.getHours(), d.getMinutes()];
        }
        if (t.length > 8 && t.includes('-') && t.includes(' ')) {
            const d = new Date(t.replace(' ', 'T'));
            if (!isNaN(d.getTime())) return [d.getHours(), d.getMinutes()];
        }
        const parts = t.split(':').map(Number);
        return [parts[0], parts[1]];
    };
    [h1, m1] = parseTime(start);
    [h2, m2] = parseTime(end);
    let duration = (h2 + m2 / 60) - (h1 + m1 / 60);
    if (duration < 0) duration += 24;

    // Round to 1 decimal place
    return Math.round(duration * 10) / 10;
};

// Format date to YYYY-MM-DD specifically in Vietnam timezone
export const formatLocalDate = (d = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
};

// Returns only the date string for current Vietnam time
export const getVietnamDateStr = () => {
    return formatLocalDate(new Date());
};

// Format time (HH:MM 24-hour style) 
// Standardized across employee and manager views
export const formatTime = (timeStr) => {
    if (!timeStr) return '';
    // Handle ISO timestamp with 'T' separator (e.g., "2026-03-03T12:00:00+00")
    if (timeStr.includes('T')) {
        const d = new Date(timeStr);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    // Handle Supabase space-separated timestamp (e.g., "2026-03-03 12:00:00+00")
    // These look like dates with spaces instead of T
    if (timeStr.length > 8 && timeStr.includes('-') && timeStr.includes(' ')) {
        const d = new Date(timeStr.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }
    }
    // Plain time format: "HH:mm:ss" or "HH:mm" — just take HH:mm
    return timeStr.substring(0, 5);
};

// Format time duration string (e.g., "6h 00m")
export const formatDurationStr = (start, end) => {
    if (!start || !end) return '0h';
    let h1, m1, h2, m2;
    const parseTime = (t) => {
        if (t.includes('T')) {
            const d = new Date(t);
            return [d.getHours(), d.getMinutes()];
        }
        if (t.length > 8 && t.includes('-') && t.includes(' ')) {
            const d = new Date(t.replace(' ', 'T'));
            if (!isNaN(d.getTime())) return [d.getHours(), d.getMinutes()];
        }
        const parts = t.split(':').map(Number);
        return [parts[0], parts[1]];
    };
    [h1, m1] = parseTime(start);
    [h2, m2] = parseTime(end);

    let totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    // Handle overnight shifts
    if (totalMins < 0) totalMins += 24 * 60;

    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
};

// Returns a Date object for the current time
export const getVietnamTime = () => {
    return new Date();
};

// Creates a Date object from Vietnam date/time strings (HH:mm[:ss] or ISO)
export const parseVietnamDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;

    // If timeStr is a full ISO string (contains 'T'), use it directly but adjust to Vietnam offset
    if (timeStr.includes('T')) {
        // We want the time component specifically, but normalized to the dateStr provided
        const timePart = timeStr.split('T')[1].substring(0, 5);
        return new Date(`${dateStr}T${timePart}:00+07:00`);
    }

    // Otherwise, assume it's a simple HH:mm[:ss] string
    const cleanTime = timeStr.substring(0, 5);
    return new Date(`${dateStr}T${cleanTime}:00+07:00`);
};

/**
 * Returns an ISO string with +07:00 offset for a given date and HH:mm time.
 * This ensures the database stores the local time correctly without shifting 7 hours.
 */
export const toISOStringWithOffset = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const cleanTime = timeStr.substring(0, 5);
    return `${dateStr}T${cleanTime}:00+07:00`;
};
