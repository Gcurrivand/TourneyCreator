const MaxPlayer = {
    SQUAD: 40,
    DUO: 40,
    ARENA: 8,

    /**
     * Get max players for a given game type
     * @param {string} gameType - The type of game
     * @returns {number|null} The max players or null if invalid
     */
    getMaxPlayers(gameType) {
        const upperType = gameType.toUpperCase();
        return this[upperType] || null;
    },

    /**
     * Get all available game types
     * @returns {string[]} Array of all game types
     */
    getAllTypes() {
        return Object.keys(this)
            .filter(key => typeof this[key] === 'number');
    }
};


Object.freeze(MaxPlayer);

module.exports = MaxPlayer;