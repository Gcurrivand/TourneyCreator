const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('removeplayer')
        .setDescription('Remove a player from their current lobby')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The in-game username of the player to remove')
                .setAutocomplete(true)
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const username = interaction.options.getString('username');
            
            const player = await playerService.removePlayerFromLobby(username);

            await interaction.editReply({
                content: `✅ ${player.username} n'est plus inscrit`
            });

        } catch (error) {
            console.error('Error in remove command:', error);
            await interaction.editReply({
                content: `❌ Failed to remove player: ${error.message}`,
                ephemeral: true
            });
        }
    },
};