const PlayerState = {
    REGISTERED: 'REGISTERED',
    CHECKED: 'CHECKED',

    /**
     * Check if a state is valid
     * @param {string} state - The state to validate
     * @returns {boolean} Whether the state is valid
     */
    isValid(state) {
        return Object.values(this)
            .filter(value => typeof value === 'string')
            .includes(state);
    },

    /**
     * Get all available states
     * @returns {string[]} Array of all valid states
     */
    getAllStates() {
        return Object.values(this)
            .filter(value => typeof value === 'string');
    }
};

module.exports = PlayerState;