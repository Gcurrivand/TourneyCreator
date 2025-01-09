const { SlashCommandBuilder } = require('discord.js');
const matchResultsService = require('../../services/matchResultsService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('deleteresults')
        .setDescription('Delete all match results for a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setAutocomplete(true)
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('Confirm deletion')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const lobbyName = interaction.options.getString('lobby');
            const confirmed = interaction.options.getBoolean('confirm');

            if (!confirmed) {
                return await interaction.editReply({
                    content: '❌ Operation cancelled. Please confirm deletion by setting confirm to true.',
                    ephemeral: true
                });
            }

            const deletedCount = await matchResultsService.deleteMatchResults(lobbyName);
            
            await interaction.editReply({
                content: `✅ Successfully deleted ${deletedCount} match results from lobby "${lobbyName}"`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in deleteresults command:', error);
            await interaction.editReply({
                content: `❌ Failed to delete results: ${error.message}`,
                ephemeral: true
            });
        }
    },
};