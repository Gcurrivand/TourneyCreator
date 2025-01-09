const AppDataSource = require('../database/datasource');

async function getTeamById(teamId) {
    const teamRepository = AppDataSource.getRepository("Team");
    
    const team = await teamRepository.findOne({
        where: { id: teamId },
        relations: ['players', 'lobby'],
        order: {
            players: {
                username: 'ASC'
            }
        }
    });

    if (!team) {
        throw new Error(`Team with ID ${teamId} not found`);
    }

    return team;
}

async function getTeamPlayers(teamId) {
    const team = await getTeamById(teamId);
    
    if (!team.players || team.players.length === 0) {
        return [];
    }

    // Sort players by rank weight for consistent display
    return team.players.sort((a, b) => {
        // First sort by rank weight
        if (b.rankWeight !== a.rankWeight) {
            return b.rankWeight - a.rankWeight;
        }
        // Then by username if rank weights are equal
        return a.username.localeCompare(b.username);
    });
}

async function getTeamsByLobbyId(lobbyId) {
    const teamRepository = AppDataSource.getRepository("Team");
    
    const teams = await teamRepository.find({
        where: { lobby: { id: lobbyId } },
        relations: ['players', 'lobby'],
        order: {
            teamNumber: 'ASC',
            players: {
                rankWeight: 'DESC',
                username: 'ASC'
            }
        }
    });

    return teams;
}

async function getAllTeams() {
    const teamRepository = AppDataSource.getRepository("Team");
    return await teamRepository.find({
        relations: ['players', 'lobby'],
        order: {
            id: 'DESC'
        }
    });
}

module.exports = {
    getTeamById,
    getTeamPlayers,
    getTeamsByLobbyId,
    getAllTeams
};