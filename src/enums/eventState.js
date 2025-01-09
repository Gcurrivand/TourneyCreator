const EventState = {
    CREATED: 'CREATED',
    CHECKIN: 'CHECKIN',
    RUNNING: 'RUNNING',
    ENDED: 'ENDED',

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
    },

    /**
     * Check if a state is active (not ended)
     * @param {string} state - The state to check
     * @returns {boolean} Whether the state is active
     */
    isActive(state) {
        return state !== this.ENDED;
    }
};

module.exports = EventState;