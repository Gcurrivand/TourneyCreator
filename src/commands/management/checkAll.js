const { SlashCommandBuilder } = require('discord.js');
const lobbyService = require('../../services/lobbiesService');
const playerService = require('../../services/playersService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('checkall')
        .setDescription('Check all players in a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setAutocomplete(true)
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const lobbyName = interaction.options.getString('lobby');
            const lobby = await lobbyService.getLobbyByName(lobbyName);

            if (!lobby.players || lobby.players.length === 0) {
                return await interaction.editReply({
                    content: `❌ No players found in lobby "${lobbyName}"`,
                    ephemeral: true
                });
            }

            let checkedCount = 0;
            let errors = [];

            // Check all players in the lobby
            for (const player of lobby.players) {
                try {
                    if (player.state === PlayerState.REGISTERED) {
                        await playerService.setPlayerState(player.username, PlayerState.CHECKED);
                        checkedCount++;
                    }
                } catch (error) {
                    errors.push(`${player.username}: ${error.message}`);
                }
            }

            // Prepare response message
            let response = `✅ Successfully checked ${checkedCount} players in "${lobbyName}"`;
            
            if (errors.length > 0) {
                response += '\n\nErrors occurred for the following players:\n' + errors.join('\n');
            }

            await interaction.editReply({
                content: response,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in checkall command:', error);
            await interaction.editReply({
                content: `❌ Failed to check players: ${error.message}`,
                ephemeral: true
            });
        }
    },
};