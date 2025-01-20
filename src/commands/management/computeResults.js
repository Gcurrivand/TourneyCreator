const { SlashCommandBuilder } = require('discord.js');
const matchResultsService = require('../../services/matchResultsService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('computeresults')
        .setDescription('Compute and save match results for a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('enddate')
                .setDescription('End date (YYYY-MM-DD HH:mm)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const lobbyName = interaction.options.getString('lobby');
            const endDate = interaction.options.getString('enddate');
            
            await interaction.editReply('Score en cours de calcul pour "' + lobbyName + '". Cela peut prendre quelques minutes...');
            
            const result = await matchResultsService.setLobbyMatches(lobbyName, endDate);
            
            await interaction.editReply('Score calculé pour "' + lobbyName + '"!\n' +
                                     result.message);
        } catch (error) {
            console.error('Error in computeresults command:', error);
            await interaction.editReply('❌ Erreur lors du calcul des scores: ' + error.message);
        }
    },
};