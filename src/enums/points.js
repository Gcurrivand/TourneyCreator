const Points = {
    1: 15,
    2: 12,
    3: 10,
    4: 8,
    5: 6,
    6: 4,
    7: 2,
    8: 1,

    /**
     * Get points for a placement
     * @param {number} placement - The placement to get points for
     * @returns {number} The points for the placement, or 0 if not found
     */
    getPoints(placement) {
        return this[placement] || 0;
    },

    /**
     * Get all placements that award points
     * @returns {number[]} Array of all placements that award points
     */
    getAllPlacements() {
        return Object.keys(this)
            .filter(key => typeof this[key] === 'number')
            .map(Number);
    }
};

module.exports = Points;