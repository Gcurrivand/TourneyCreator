const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('setplayerstate')
        .setDescription("Modify a player's lobby state")
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Player username')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('state')
                .setDescription('New state for the player')
                .setRequired(true)
                .setAutocomplete(true)),
    
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === 'state') {
            const states = PlayerState.getAllStates();
            const filtered = states.filter(state => 
                state.toLowerCase().startsWith(focusedOption.value.toLowerCase())
            );
            await interaction.respond(
                filtered.map(state => ({ name: state, value: state }))
            );
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const username = interaction.options.getString('username');
            const state = interaction.options.getString('state');
            
            const player = await playerService.setPlayerState(username, state);
            
            await interaction.editReply({
                content: `✅ ${player.username} state updated to: ${state}`
            });
            
        } catch (error) {
            console.error('Error in setplayerstate:', error);
            await interaction.editReply({
                content: `❌ Error updating state: ${error.message}`,
                ephemeral: true
            });
        }
    }
};