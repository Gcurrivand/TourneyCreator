const { SlashCommandBuilder } = require('discord.js');
const teamBuildingService = require('../../services/teamBuildingService');
const teamsCommand = require('./teams');
const lobbiesService = require('../../services/lobbiesService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('createteams')
        .setDescription('Create teams for a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('teams')
                .setDescription('Number of teams to create')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(10))
        .addIntegerOption(option =>
            option.setName('playersperteam')
                .setDescription('Number of players per team')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5))
        .addStringOption(option =>
            option.setName('method')
                .setDescription('Method to use for team building')
                .setRequired(true)
                .addChoices(
                    { name: 'Balanced', value: 'BALANCED' },
                    { name: 'Random', value: 'RANDOM' }
                ))
        .addStringOption(option =>
            option.setName('exclude')
                .setDescription('Players to exclude (use quotes for names with spaces)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const lobbyName = interaction.options.getString('lobby');
            const numberOfTeams = interaction.options.getInteger('teams');
            const playersPerTeam = interaction.options.getInteger('playersperteam');
            const method = interaction.options.getString('method');
            const excludedPlayers = interaction.options.getString('exclude') || '';

            const players = await lobbiesService.getPlayers(lobbyName);

            if(players.every(player => player.state === PlayerState.CHECKED)){
                await teamBuildingService.createTeams(
                    lobbyName, 
                    numberOfTeams, 
                    playersPerTeam,
                    method,
                    excludedPlayers
                );
            }else{
                throw new Error("All players are not checked");
            }

            // Let the teams command handle all the interaction responses
            await teamsCommand.execute(interaction);

        } catch (error) {
            console.error('Error in createteams command:', error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: `❌ Failed to create teams: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: `❌ Failed to create teams: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    },
};