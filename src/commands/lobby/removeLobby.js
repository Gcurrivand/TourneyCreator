const { SlashCommandBuilder } = require('discord.js');
const lobbyService = require('../../services/lobbiesService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('removelobby')
        .setDescription('Remove a lobby and all its players')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby to remove')
                .setAutocomplete(true)
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const lobbyName = interaction.options.getString('name');
            
            const removedLobby = await lobbyService.removeLobbyByName(lobbyName);

            await interaction.editReply({
                content: `✅ Lobby "${removedLobby.name}" has been removed successfully. All players have been removed from the lobby.`
            });

        } catch (error) {
            console.error('Error in removelobby command:', error);
            await interaction.editReply({
                content: `❌ Failed to remove lobby: ${error.message}`,
                ephemeral: true
            });
        }
    },
};