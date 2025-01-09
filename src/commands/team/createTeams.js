const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const teamBuildingService = require('../../services/teamBuildingService');
const lobbiesService = require('../../services/lobbiesService');
const PlayerState = require('../../enums/playerState');
const selectMenus = require('../../utils/selectMenus');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('createteams')
        .setDescription('Start team creation process with interactive view')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('Select a lobby')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('teams')
                .setDescription('Number of teams to create')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('players')
                .setDescription('Players per team')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('method')
                .setDescription('Team creation method')
                .setAutocomplete(true)
                .setRequired(true)),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Get values directly from command options
            const lobbyName = interaction.options.getString('lobby');
            const numberOfTeams = interaction.options.getString('teams');
            const playersPerTeam = interaction.options.getString('players');
            const method = interaction.options.getString('method');

            let excludedPlayers = '';
            const players = await lobbiesService.getPlayers(lobbyName);
            if(method.includes('_WITH_EXCLUDED')) {
                excludedPlayers = await selectMenus.handleSelect(
                    interaction,
                    'exclude',
                    { players }
                ) || '';
            }

            // Existing team creation logic
            if(players.every(player => player.state === PlayerState.CHECKED)){
                await teamBuildingService.createTeams(
                    lobbyName, 
                    numberOfTeams, 
                    playersPerTeam,
                    method,
                    excludedPlayers
                );
            } else {
                throw new Error("All players must be checked in before creating teams");
            }

            await interaction.editReply({
                content: `✅ Successfully created ${numberOfTeams} teams with ` +
                        `${playersPerTeam} players each using ${method.replace(/_/g, ' ').toLowerCase()}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in createteams command:', error);
            await interaction.editReply({
                content: `❌ Failed to create teams: ${error.message}`,
                ephemeral: true
            });
        }
    }
};