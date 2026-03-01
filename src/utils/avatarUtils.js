/**
 * Generates initials from a name string (up to 2 characters).
 * @param {string} name 
 * @returns {string}
 */
export const getAvatarInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Generates a consistent background color based on a name string.
 * Uses a predefined palette of premium colors.
 * @param {string} name 
 * @returns {string} Hex color
 */
export const getAvatarColor = (name) => {
    const palette = [
        '#059669', // Emerald
        '#0891b2', // Cyan
        '#4f46e5', // Indigo
        '#7c3aed', // Violet
        '#c026d3', // Fuchsia
        '#db2777', // Pink
        '#dc2626', // Red
        '#ea580c', // Orange
        '#ca8a04', // Yellow
        '#65a30d', // Lime
        '#16a34a', // Green
        '#2563eb', // Blue
    ];

    if (!name) return '#94a3b8'; // Slate 400

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % palette.length;
    return palette[index];
};
