const Hunters = require('../enums/hunters');

function formatHuntersWithEmoji(huntersString, guild) {
    if (!huntersString) return 'None';

    const hunters = huntersString.split(' ')
        .map(h => Hunters.normalizeHunterName(h));
    
    return hunters
        .map(hunter => {
            const emoji = guild.emojis.cache.find(e => e.name === hunter);
            return emoji ? `<:${emoji.name}:${emoji.id}>` : hunter;
        })
        .join(' ');
}

module.exports = {
    formatHuntersWithEmoji
};