const { Events } = require('discord.js');
const eventService = require('../services/eventService');
const teamService = require('../services/teamService');
const lobbiesService = require('../services/lobbiesService');
const playersService = require('../services/playersService');
const EventState = require('../enums/eventState');
const PlayerState = require('../enums/playerState');
const TeamBuildingMethod = require('../enums/teamBuildingMethod');


async function handleEventAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const events = await eventService.getAllEvents();
    
    const filtered = events
        .filter(event => 
            EventState.isActive(event.state) &&
            event.name.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .slice(0, 25);
    
    await interaction.respond(
        filtered.map(event => ({ name: event.name, value: event.name }))
    );
}

async function handleLobbyAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const lobbies = await lobbiesService.getAllLobbies();
    
    const filtered = lobbies
        .filter(lobby => 
            EventState.isActive(lobby.event.state) &&
            lobby.name.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .slice(0, 25);
    
    await interaction.respond(
        filtered.map(lobby => ({ name: lobby.name, value: lobby.name }))
    );
}

async function handleTeamAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const teams = await teamService.getAllTeams();
    
    const filtered = teams.filter(team => 
        team.id.toString().includes(focusedValue.toLowerCase()) || 
        team.lobby.name.toLowerCase().includes(focusedValue.toLowerCase())
    ).slice(0, 25);
    
    await interaction.respond(
        filtered.map(team => ({ 
            name: `${team.lobby.name} - Team ${team.teamNumber}`, 
            value: team.id 
        }))
    );
}

async function handlePlayerAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const players = await playersService.getAllPlayers();
    
    const filtered = players.filter(player => 
        player.username.toLowerCase().includes(focusedValue.toLowerCase())
    ).slice(0, 25);
    
    await interaction.respond(
        filtered.map(player => ({ name: player.username, value: player.username }))
    );
}

async function handleStateAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const states = PlayerState.getAllStates();
    
    const filtered = states.filter(state => 
        state.toLowerCase().includes(focusedValue)
    ).slice(0, 25);
    
    await interaction.respond(
        filtered.map(state => ({ name: state, value: state }))
    );
}

async function handleMethodAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    const filtered = TeamBuildingMethod.getAllMethods()
        .filter(m => m.toLowerCase().includes(focusedValue))
        .slice(0, 25);
    
    await interaction.respond(
        filtered.map(m => ({ 
            name: m.replace(/_/g, ' '), 
            value: m 
        }))
    );
}

module.exports = {
    handleAutocomplete: async (interaction) => {
        if (!interaction.isAutocomplete()) return;

        try {
            const optionName = interaction.options.getFocused(true).name;
            
            // Map option names to their handlers
            const autocompleteHandlers = {
                event: handleEventAutocomplete,
                lobby: handleLobbyAutocomplete,
                team: handleTeamAutocomplete,
                player: handlePlayerAutocomplete,
                username: handlePlayerAutocomplete,
                state: handleStateAutocomplete,
                method: handleMethodAutocomplete
            };

            if (autocompleteHandlers[optionName]) {
                return await autocompleteHandlers[optionName](interaction);
            }

        } catch (error) {
            console.error('Autocomplete Error:', error);
        }
    }
};