const Ranks = {
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
    PLAT: 4,
    DIAMOND: 5,
    MASTER: 6,
    GM: 7,
    LEGEND: 8,

    /**
     * Get the rank weight for a given rank name
     * @param {string} rankName - The name of the rank
     * @returns {number|null} The rank weight or null if invalid
     */
    getRankWeight(rankName) {
        const upperRank = rankName.toUpperCase();
        return this[upperRank] || null;
    },

    /**
     * Get the rank name for a given weight
     * @param {number} weight - The rank weight
     * @returns {string|null} The rank name or null if invalid
     */
    getRankName(weight) {
        for (const [name, value] of Object.entries(this)) {
            if (value === weight && typeof value === 'number') {
                return name.toLowerCase();
            }
        }
        return null;
    }
};

module.exports = Ranks;