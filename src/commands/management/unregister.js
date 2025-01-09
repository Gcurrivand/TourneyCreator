const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unregister')
        .setDescription('Unregister a player')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The in-game username to unregister')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const username = interaction.options.getString('username');
            
            // Get the player before removing them to check their lobby
            const player = await playerService.getPlayerByUsername(username);
            const lobbyName = player.lobby?.name;

            // Remove player from lobby
            await playerService.removePlayerFromLobby(username);

            // Remove lobby role if it exists
            if (lobbyName) {
                try {
                    const member = await interaction.guild.members.fetch(player.discordId);
                    const role = interaction.guild.roles.cache.find(r => r.name === lobbyName);
                    if (member && role) {
                        await member.roles.remove(role);
                    }
                } catch (error) {
                    console.error('Error removing role:', error);
                }
            }

            await interaction.editReply({
                content: `✅ Successfully unregistered ${username}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in unregister command:', error);
            await interaction.editReply({
                content: `❌ Failed to unregister: ${error.message}`,
                ephemeral: true
            });
        }
    },
};