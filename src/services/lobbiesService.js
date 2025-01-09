const AppDataSource = require('../database/datasource');
const playersService = require('./playersService');

async function getLobbyById(lobbyId) {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    
    const lobby = await lobbyRepository.findOne({
        where: { id: lobbyId },
        relations: {
            players: true,
            teams: {
                players: true
            },
            event: true
        },
        order: {
            teams: {
                teamNumber: 'ASC'
            }
        }
    });

    if (!lobby) {
        throw new Error(`Lobby with ID ${lobbyId} not found`);
    }

    return lobby;
}

async function getLobbyByName(lobbyName) {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    
    const lobby = await lobbyRepository.findOne({
        where: { name: lobbyName },
        relations: {
            players: true,
            teams: {
                players: true
            },
            event: true
        },
        order: {
            teams: {
                teamNumber: 'ASC'
            }
        }
    });

    if (!lobby) {
        throw new Error(`Lobby "${lobbyName}" not found`);
    }

    return lobby;
}

async function addLobbyToEvent(eventName, numberOfGames, customName = null) {
    const eventRepository = AppDataSource.getRepository("Event");
    const lobbyRepository = AppDataSource.getRepository("Lobby");

    const event = await eventRepository.findOne({
        where: { name: eventName },
        relations: ['lobbies']
    });

    if (!event) {
        throw new Error('Event not found');
    }

    const lobbyNumber = event.lobbies.length + 1;

    const lobby = await lobbyRepository.save({
        name: `${event.name}-lobby-${lobbyNumber}`,
        startDate: event.startDate,
        numberOfGames: numberOfGames,
        event: event
    });

    return lobby;
}

async function removeLobbyByName(lobbyName) {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    
    const lobby = await lobbyRepository.findOne({
        where: { name: lobbyName },
        relations: ['players', 'teams']
    });

    if (!lobby) {
        throw new Error(`Lobby "${lobbyName}" not found`);
    }

    // First remove all players from the lobby
    if (lobby.players) {
        for (const player of lobby.players) {
            await playersService.removePlayerFromLobby(player.username);
        }
    }

    // Then remove all teams
    if (lobby.teams) {
        const teamRepository = AppDataSource.getRepository("Team");
        await teamRepository.remove(lobby.teams);
    }

    // Finally remove the lobby itself
    await lobbyRepository.remove(lobby);
    return lobby;
}

async function getPlayers(lobbyName) {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    
    const lobby = await lobbyRepository.findOne({
        where: { name: lobbyName },
        relations: ['players']
    });

    if (!lobby) {
        throw new Error(`Lobby "${lobbyName}" not found`);
    }

    return lobby.players || [];
}

async function getAllLobbies() {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    return await lobbyRepository.find({
        relations: ['event', 'players', 'teams'],
        order: {
            id: 'DESC'
        }
    });
}

async function findNextLobbyWithPlayers(eventId, excludeLobbyId) {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    
    const lobbies = await lobbyRepository.find({
        where: {
            event: { id: eventId },
            id: Not(excludeLobbyId)
        },
        relations: ['players'],
        order: {
            id: 'ASC'
        }
    });

    for (const lobby of lobbies) {
        if (lobby.players && lobby.players.length > 0) {
            return lobby;
        }
    }

    return null;
}

module.exports = {
    addLobbyToEvent,
    removeLobbyByName,
    getLobbyById,
    getLobbyByName,
    getPlayers,
    getAllLobbies,
    findNextLobbyWithPlayers
};