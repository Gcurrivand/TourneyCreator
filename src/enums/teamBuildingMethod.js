const TeamBuildingMethod = {
    BALANCED: 'BALANCED',
    RANDOM: 'RANDOM',
    BALANCED_WITH_EXCLUDED: 'BALANCED_WITH_EXCLUDED',
    RANDOM_WITH_EXCLUDED: 'RANDOM_WITH_EXCLUDED',

    /**
     * Check if a method is valid
     * @param {string} method - The method to validate
     * @returns {boolean} Whether the method is valid
     */
    isValid(method) {
        return Object.values(this)
            .filter(value => typeof value === 'string')
            .includes(method);
    },

    /**
     * Get all available methods
     * @returns {string[]} Array of all valid methods
     */
    getAllMethods() {
        return Object.values(this)
            .filter(value => typeof value === 'string');
    }
};

module.exports = TeamBuildingMethod;