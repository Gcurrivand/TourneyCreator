const Hunters = {
    // List of valid hunters
    VALID_HUNTERS: new Set([
        'brall', 'jin', 'ghost', 'joule', 'myth', 'shiv', 'shrike',
        'bishop', 'kingpin', 'felix', 'oath', 'elluna', 'zeph',
        'celeste', 'hudson', 'void', 'beebo', 'crysta'
    ]),

    /**
     * Normalize a hunter name (remove accents and convert to lowercase)
     * @param {string} hunterName - The hunter name to normalize
     * @returns {string} Normalized hunter name
     */
    normalizeHunterName(hunterName) {
        return hunterName.trim()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    },

    /**
     * Validate a list of hunters
     * @param {string} huntersString - Comma-separated list of hunters
     * @returns {Object} Object containing validation result and processed hunters or error message
     */
    validateHunters(huntersString) {
        if (!huntersString || huntersString.trim() === '') {
            return {
                isValid: false,
                message: 'No hunters provided'
            };
        }

        const huntersList = huntersString.split(' ')
            .map(h => this.normalizeHunterName(h))
            .filter(h => h !== '');

        const invalidHunters = huntersList.filter(h => !this.VALID_HUNTERS.has(h));
        
        if (invalidHunters.length > 0) {
            return {
                isValid: false,
                message: `Invalid hunters: ${invalidHunters.join(', ')}\nAvailable hunters: ${[...this.VALID_HUNTERS].sort().join(', ')}`
            };
        }

        return {
            isValid: true,
            hunters: huntersList,
            isOtp: huntersList.length === 1
        };
    },

    /**
     * Get all available hunters
     * @returns {string[]} Array of all valid hunters
     */
    getAllHunters() {
        return [...this.VALID_HUNTERS].sort();
    }
};

module.exports = Hunters;