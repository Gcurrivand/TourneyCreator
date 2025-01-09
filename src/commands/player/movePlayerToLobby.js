const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const playerService = require('../../services/playersService');
const { formatHuntersWithEmoji } = require('../../utils/hunterDisplay');
const playersService = require('../../services/playersService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a player to another lobby')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The username of the player to move')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the destination lobby')    
                .setAutocomplete(true)
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const username = interaction.options.getString('username');
            const newLobbyName = interaction.options.getString('lobby');

            const updatedPlayer = await playerService.movePlayerToLobby(username, newLobbyName);
            await playersService.setPlayerState(username, PlayerState.CHECKED);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Player Moved')
                .addFields(
                    { name: 'Player', value: updatedPlayer.username, inline: true },
                    { name: 'New Lobby', value: newLobbyName, inline: true },
                    { name: 'Details', value: `${updatedPlayer.rank}${updatedPlayer.isOtp ? ' OTP' : ''}\n${formatHuntersWithEmoji(updatedPlayer.hunters, interaction.guild)}` }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in move command:', error);
            await interaction.editReply({
                content: `❌ Failed to move player: ${error.message}`,
                ephemeral: true
            });
        }
    },
};