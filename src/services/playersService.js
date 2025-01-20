const AppDataSource = require('../database/datasource');
const Ranks = require('../enums/rank');
const Hunters = require('../enums/hunters');
const PlayerState  = require('../enums/playerState');
const { formatDate } = require('../utils/validation');

async function usernameExists(username) {
    const playerRepository = AppDataSource.getRepository("Player");
    
    return await playerRepository.exists({
        where: { username: username }
    });
}

async function getPlayerByUsername(username) {
    const playerRepository = AppDataSource.getRepository("Player");
    
    const player = await playerRepository.findOne({
        where: { username: username },
        relations: ['lobby', 'lobby.event']
    });

    if (!player) {
        throw new Error(`Player with username ${username} not found`);
    }

    return player;
}

async function createPlayer(username, rank, huntersString, discordId = null) {
    const playerRepository = AppDataSource.getRepository("Player");
    
    const rankWeight = Ranks.getRankWeight(rank);
    if (rankWeight === null) {
        throw new Error(`Invalid rank: ${rank}`);
    }

    const hunterValidation = Hunters.validateHunters(huntersString);
    if (!hunterValidation.isValid) {
        throw new Error(hunterValidation.message);
    }

    const player = await playerRepository.save({
        username,
        rank: rank.toUpperCase(),
        rankWeight,
        hunters: hunterValidation.hunters.join(' '),
        isOtp: hunterValidation.isOtp,
        state: null,
        discordId,
        lastRegisteredAt: formatDate(new Date())
    });

    return player;
}

async function updatePlayer(username, rank, huntersString, discordId = null) {
    const playerRepository = AppDataSource.getRepository("Player");

    const player = await getPlayerByUsername(username);

    if (!player) {
        throw new Error(`Player "${username}" not found`);
    }

    const rankWeight = Ranks.getRankWeight(rank);
    if (rankWeight === null) {
        throw new Error(`Invalid rank: ${rank}`);
    }

    const hunterValidation = Hunters.validateHunters(huntersString);
    if (!hunterValidation.isValid) {
        throw new Error(hunterValidation.message);
    }

    player.rank = rank.toUpperCase();
    player.rankWeight = rankWeight;
    player.hunters = hunterValidation.hunters.join(' ');
    player.isOtp = hunterValidation.isOtp;
    if (discordId) {
        player.discordId = discordId;
    }
    player.lastRegisteredAt = formatDate(new Date());  // Store as string

    return await playerRepository.save(player);
}

async function addPlayerToLobby(lobbyId, username) {
    const playerRepository = AppDataSource.getRepository("Player");
    const lobbyRepository = AppDataSource.getRepository("Lobby");


    const lobby = await lobbyRepository.findOne({
        where: { id: lobbyId }
    });
    if (!lobby) {
        throw new Error(`Lobby with ID ${lobbyId} not found`);
    }

    const player = await getPlayerByUsername(username);

    if (!player) {
        throw new Error(`Player with ID ${player.id} not found`);
    }
    player.lobby = lobby;
    player.state = PlayerState.REGISTERED;

    return await playerRepository.save(player);
}

async function movePlayerToLobby(username, newLobbyName) {
    const playerRepository = AppDataSource.getRepository("Player");
    const lobbyService = require('./lobbiesService');
    
    const player = await getPlayerByUsername(username);
    if (!player) {
        throw new Error(`Player "${username}" not found`);
    }

    const newLobby = await lobbyService.getLobbyByName(newLobbyName);
    if (!newLobby) {
        throw new Error(`Lobby "${newLobbyName}" not found`);
    }

    player.team = null;
    player.lobby = newLobby;
    player.state = PlayerState.REGISTERED;

    return await playerRepository.save(player);
}

async function removePlayerFromLobby(username) {
    const playerRepository = AppDataSource.getRepository("Player");
    
    const player = await getPlayerByUsername(username);
    
    if (!player) {
        throw new Error(`Player "${username}" not found`);
    }

    player.team = null;
    player.lobby = null;
    player.state = null;

    return await playerRepository.save(player);
}

async function setPlayerState(username, state) {
    const playerRepository = AppDataSource.getRepository("Player");
    
    const player = await getPlayerByUsername(username);
    if (!player) {
        throw new Error(`Player "${username}" not found`);
    }

    if (!player.lobby) {
        throw new Error(`Player "${username}" is not in any lobby`);
    }

    player.state = state;
    return await playerRepository.save(player);
}

module.exports = {
    createPlayer,
    addPlayerToLobby,
    movePlayerToLobby,
    getPlayerByUsername,
    updatePlayer,
    usernameExists,
    removePlayerFromLobby,
    setPlayerState
};