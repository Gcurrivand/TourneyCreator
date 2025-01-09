const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('setallplayerstate')
        .setDescription("Set state for all players in a lobby")
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('Lobby name')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('state')
                .setDescription('State to set for all players')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const lobbyName = interaction.options.getString('lobby');
            const state = interaction.options.getString('state');
            
            const affectedCount = await playerService.setAllPlayersStateInLobby(lobbyName, state);
            
            await interaction.editReply({
                content: `✅ Set ${state} state for ${affectedCount} players in ${lobbyName}`
            });
            
        } catch (error) {
            console.error('Error in setallplayerstate:', error);
            await interaction.editReply({
                content: `❌ Error updating states: ${error.message}`,
                ephemeral: true
            });
        }
    }
};