const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const lobbyService = require('../../services/lobbiesService');
const teamService = require('../../services/teamService');
const PlayerState = require('../../enums/playerState');
const { formatHuntersWithEmoji, getHunterAttachments } = require('../../utils/hunterDisplay');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Display all teams in a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setAutocomplete(true)
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const lobbyName = interaction.options.getString('lobby');
            const lobby = await lobbyService.getLobbyByName(lobbyName);
            
            if (!lobby.teams || lobby.teams.length === 0) {
                return await interaction.editReply({
                    content: `❌ No teams found in lobby "${lobbyName}"`,
                    ephemeral: true
                });
            }

            // Send initial reply
            await interaction.editReply(`📋 Teams in ${lobby.name}:`);

            let totalPlayers = 0;
            let totalTeamWeight = 0;

            // Create and send an embed for each team
            for (const team of lobby.teams) {
                const teamEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTimestamp();

                const registeredPlayers = team.players.filter(p => p.state === PlayerState.REGISTERED);
                const checkedPlayers = team.players.filter(p => p.state === PlayerState.CHECKED);
                
                let playersList = '';
                if (registeredPlayers.length > 0) {
                    playersList += '**Registered:**\n' + registeredPlayers
                        .map(p => `${p.username} (${p.rank})${p.isOtp ? ' OTP' : ''} ` +
                             `${formatHuntersWithEmoji(p.hunters, interaction.guild)}`)
                        .join('\n') + '\n\n';
                }
                if (checkedPlayers.length > 0) {
                    playersList += '**Checked:**\n' + checkedPlayers
                        .map(p => `${p.username} (${p.rank})${p.isOtp ? ' OTP' : ''} ` +
                             `${formatHuntersWithEmoji(p.hunters, interaction.guild)}`)
                        .join('\n');
                }

                totalPlayers += team.players.length;
                totalTeamWeight += team.averageRankWeight * team.players.length;

                teamEmbed.setTitle(`Team ${team.teamNumber}`)
                    .addFields({
                        name: `Average Weight: ${team.averageRankWeight.toFixed(2)}`,
                        value: playersList || 'No players',
                        inline: false
                    });

                // Send team embed (no more attachments needed)
                await interaction.followUp({
                    embeds: [teamEmbed]
                });
            }

            // Send summary embed
            const avgLobbyWeight = totalPlayers > 0 ? totalTeamWeight / totalPlayers : 0;
            const summaryEmbed = new EmbedBuilder()
                .setTitle('Lobby Summary')
                .setColor('#0099ff')
                .addFields({
                    name: 'Statistics',
                    value: `Teams: ${lobby.teams.length}\n` +
                           `Total Players: ${totalPlayers}\n` +
                           `Average Lobby Weight: ${avgLobbyWeight.toFixed(2)}`,
                    inline: false
                })
                .setTimestamp();

            await interaction.followUp({ embeds: [summaryEmbed] });

        } catch (error) {
            console.error('Error in teams command:', error);
            await interaction.editReply({
                content: `❌ Failed to get teams: ${error.message}`,
                ephemeral: true
            });
        }
    },
};