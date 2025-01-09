const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const matchResultsService = require('../../services/matchResultsService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lobbyresult')
        .setDescription('Show match results for a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setAutocomplete(true)
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const lobbyName = interaction.options.getString('lobby');
            const results = await matchResultsService.getLobbyResults(lobbyName);

            if (results.length === 0) {
                return await interaction.editReply({
                    content: '❌ No results found for lobby "' + lobbyName + '"',
                    ephemeral: true
                });
            }

            // Group results by match
            const matchGroups = results.reduce((groups, result) => {
                if (!groups[result.matchId]) {
                    groups[result.matchId] = [];
                }
                groups[result.matchId].push(result);
                return groups;
            }, {});

            // Send initial message
            await interaction.editReply(`📊 Results for lobby "${lobbyName}":`);

            // Create an embed for each match
            for (const [matchId, matchResults] of Object.entries(matchGroups)) {
                const matchEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Match ${matchId}`)
                    .setTimestamp();

                // Sort by placement
                matchResults.sort((a, b) => a.placement - b.placement);

                let matchDescription = '';
                for (const result of matchResults) {
                    matchDescription += `Team ${result.team.teamNumber}: ${result.points} points ` +
                                      `(${result.kills} kills, ${result.deaths} deaths, ` +
                                      `${result.teamDamage} damage)\n`;
                }

                matchEmbed.setDescription(matchDescription);
                await interaction.followUp({ embeds: [matchEmbed] });
            }

            // Calculate total points per team
            const teamTotals = results.reduce((totals, result) => {
                const teamKey = `Team ${result.team.teamNumber}`;
                if (!totals[teamKey]) {
                    totals[teamKey] = {
                        points: 0,
                        kills: 0,
                        deaths: 0,
                        teamDamage: 0
                    };
                }
                totals[teamKey].points += result.points;
                totals[teamKey].kills += result.kills;
                totals[teamKey].deaths += result.deaths;
                totals[teamKey].teamDamage += result.teamDamage;
                return totals;
            }, {});

            // Create summary embed
            const summaryEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('📈 Overall Summary')
                .setTimestamp();

            let summaryDescription = '';
            Object.entries(teamTotals)
                .sort((a, b) => b[1].points - a[1].points)
                .forEach(([team, stats]) => {
                    summaryDescription += `${team}: ${stats.points} total points ` +
                                        `(${stats.kills} kills, ${stats.deaths} deaths, ` +
                                        `${stats.teamDamage} damage)\n`;
                });

            summaryEmbed.setDescription(summaryDescription);
            await interaction.followUp({ embeds: [summaryEmbed] });

        } catch (error) {
            console.error('Error in results command:', error);
            await interaction.editReply({
                content: `❌ Failed to get results: ${error.message}`,
                ephemeral: true
            });
        }
    },
};