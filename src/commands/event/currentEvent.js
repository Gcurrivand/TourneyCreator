const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const eventService = require('../../services/eventService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('currentevent')
        .setDescription('Display information about the currently running event'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const event = await eventService.getCurrentEvent();

            const embed = new EmbedBuilder()
                .setTitle(`Evenements en cours: ${event.name}`)
                .setColor('#0099ff')
                .setTimestamp()
                .addFields({
                    name: 'État',
                    value: `${event.state}`,
                    inline: false
                });

            for (const lobby of event.lobbies) {
                const registeredCount = lobby.players.filter(p => p.state === PlayerState.REGISTERED).length;
                const checkedCount = lobby.players.filter(p => p.state === PlayerState.CHECKED).length;
                
                const teamsStatus = lobby.teams && lobby.teams.length > 0 ? '✅ Teams Done' : '❌ Teams Not Created';
                
                embed.addFields({
                    name: `${lobby.name}`,
                    value: `Registered: ${registeredCount}\nChecked: ${checkedCount}\nTotal: ${lobby.players.length}\nTeams: ${teamsStatus}`,
                    inline: false
                });
            }

            const totalPlayers = event.lobbies.reduce((sum, lobby) => sum + lobby.players.length, 0);
            embed.addFields({
                name: 'Summary',
                value: `Total Lobbies: ${event.lobbies.length}\nTotal Players: ${totalPlayers}`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in current command:', error);
            await interaction.editReply({
                content: `❌ ${error.message}`,
                ephemeral: true
            });
        }
    },
};