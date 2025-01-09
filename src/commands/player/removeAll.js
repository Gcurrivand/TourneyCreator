const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('removeall')
        .setDescription('Remove all players from their current lobbies'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const removedCount = await playerService.removeAllPlayersFromLobbies();

            await interaction.editReply({
                content: `✅ ${removedCount} joueurs ont été désinscrits`
            });

        } catch (error) {
            console.error('Error in removeall command:', error);
            await interaction.editReply({
                content: `❌ Failed to remove all players: ${error.message}`,
                ephemeral: true
            });
        }
    },
};