const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const eventService = require('../../services/eventService');
const PlayerState = require('../../enums/playerState');
const { formatHuntersWithEmoji } = require('../../utils/hunterDisplay');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lobbies')
        .setDescription('Display all lobbies in an event')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('The name of the event')
                .setAutocomplete(true)
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const eventName = interaction.options.getString('event');
            const event = await eventService.getEventByName(eventName);

            if (!event || !event.lobbies || event.lobbies.length === 0) {
                return await interaction.editReply({
                    content: `❌ Pas de lobbies trouvés pour "${eventName}"`,
                    ephemeral: true
                });
            }

            const embeds = [new EmbedBuilder()
                .setTitle(`Lobbies for ${event.name}`)
                .setColor('#0099ff')];

            let currentEmbed = embeds[0];
            let currentEmbedLength = currentEmbed.data.title.length;

            for (const lobby of event.lobbies) {
                const sortedPlayers = [...lobby.players].sort((a, b) => {
                    const dateA = a.lastRegisteredAt ? new Date(a.lastRegisteredAt) : new Date(0);
                    const dateB = b.lastRegisteredAt ? new Date(b.lastRegisteredAt) : new Date(0);
                    return dateA - dateB;
                });

                const registeredPlayers = sortedPlayers.filter(p => p.state === PlayerState.REGISTERED);
                const checkedPlayers = sortedPlayers.filter(p => p.state === PlayerState.CHECKED);
                
                // Format players list with a helper function
                const formatPlayerList = (players, partNumber = '') => {
                    return players
                        .map(p => {
                            const regDate = p.lastRegisteredAt ? 
                                new Date(p.lastRegisteredAt).toLocaleString('fr-FR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }) : 'N/A';
                            return `${regDate} - ${p.username} (${p.rank})${p.isOtp ? ' OTP' : ''} ` +
                                   `${formatHuntersWithEmoji(p.hunters, interaction.guild)}`;
                        })
                        .join('\n');
                };

                // Split registered players if needed
                let registeredList = '';
                if (registeredPlayers.length > 0) {
                    registeredList = '**Registered:**\n' + formatPlayerList(registeredPlayers);
                }

                // Split checked players if needed
                let checkedList = '';
                if (checkedPlayers.length > 0) {
                    checkedList = '\n\n**Checked:**\n' + formatPlayerList(checkedPlayers);
                }

                // Combine lists and split if too long
                const fullList = registeredList + checkedList;
                const chunks = [];
                let currentChunk = '';
                const lines = fullList.split('\n');

                for (const line of lines) {
                    if ((currentChunk + line + '\n').length > 1000) {  // Leave some buffer
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                if (currentChunk) chunks.push(currentChunk);

                chunks.forEach((chunk, index) => {
                    const fieldName = index === 0 
                        ? `${lobby.name} (${lobby.players.length} players)`
                        : ` `;
                    const fieldValue = chunk || 'No players';
                    const fieldLength = fieldName.length + fieldValue.length;

                    // Create new embed if adding this field would exceed limits
                    if (currentEmbedLength + fieldLength > 6000) {
                        const newEmbed = new EmbedBuilder()
                            .setTitle(`Lobbies for ${event.name} (cont.)`)
                            .setColor('#0099ff');
                        embeds.push(newEmbed);
                        currentEmbed = newEmbed;
                        currentEmbedLength = newEmbed.data.title.length;
                    }

                    currentEmbed.addFields({
                        name: fieldName,
                        value: fieldValue,
                        inline: false
                    });
                    
                    currentEmbedLength += fieldLength;
                });
            }

            await interaction.editReply({ embeds: embeds });

        } catch (error) {
            console.error('Error in lobbies command:', error);
            await interaction.editReply({
                content: `❌ Failed to get lobbies: ${error.message}`,
                ephemeral: true
            });
        }
    },
};