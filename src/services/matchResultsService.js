const AppDataSource = require('../database/datasource');
const axios = require('axios');
const Points = require('../enums/points');
const lobbiesService = require('./lobbiesService');
const POINTS = {
    1: 3,
    2: 2,
    3: 1
};

async function fetchMatchesForLobby(lobby, userId) {
    const matches = [];
    let currentPage = 1;
    
    try {
        while (matches.length < lobby.numberOfGames) {
            const response = await axios.get(
                `https://supervive.op.gg/api/players/${userId}/matches?page=${currentPage}`
            );


            if (response.status !== 200 || !response.data.data?.length) {
                break;
            }

            const customGames = response.data.data.filter(match => match.queue_id === "customgame");
            const startTime = new Date(lobby.startDate).getTime();
            const endTime = lobby.endDate ? new Date(lobby.endDate).getTime() : Date.now();

            for (const match of customGames) {
                const matchTime = new Date(match.match_start).getTime();

                if (matchTime >= startTime && matchTime <= endTime) {
                    const matchDetails = await fetchMatchDetails(match.match_id);
                    if (matchDetails) {
                        matches.push({
                            matchId: match.match_id,
                            details: matchDetails
                        });
                    }

                    if (matches.length >= lobby.numberOfGames) {
                        break;
                    }
                }
            }
            currentPage++;
        }
        return matches;
    } catch (error) {
        console.error('Error fetching matches:', error);
        throw new Error('Failed to fetch matches');
    }
}

async function fetchMatchDetails(matchId) {
    try {
        const response = await axios.get(`https://supervive.op.gg/api/matches/steam-${matchId}`);
        if (response.status === 200) {
            return response.data;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching match details for ${matchId}:`, error);
        return null;
    }
}

async function processMatchData(matchData, lobbyName) {
    const teams = new Map();

    try {
        for (const player of matchData) {
            const teamId = parseInt(player.team_id);
            const lobby = await lobbiesService.getLobbyByName(lobbyName);
            const team = lobby.teams.find(t => t.teamNumber === teamId);

            if (!teams.has(team.teamNumber)) {
                teams.set(team.teamNumber, {
                    teamNumber: team.teamNumber,
                    survivalDuration: 0,
                    teamDamage: 0,
                    tankedDamage: 0,
                    kills: 0,
                    deaths: 0,
                    players: []
                });
            }

            const teamData = teams.get(team.teamNumber);
            teamData.survivalDuration = Math.max(teamData.survivalDuration, player.survival_duration || 0);
            teamData.teamDamage += player.stats?.HeroDamageDone || 0;
            teamData.kills += player.stats?.Kills || 0;
            teamData.deaths += player.stats?.Deaths || 0;
            teamData.players.push(player);
        }

        // Sort teams by survival duration and calculate results
        const sortedTeams = Array.from(teams.entries())
            .sort((a, b) => b[1].survivalDuration - a[1].survivalDuration);

        return sortedTeams.map(([_, teamData], index) => ({
            teamNumber: teamData.teamNumber, // Use the stored team number
            points: Points.getPoints(index + 1) + teamData.kills,
            teamDamage: Math.round(teamData.teamDamage),
            tankedDamage: Math.round(teamData.tankedDamage),
            kills: teamData.kills,
            deaths: teamData.deaths,
            placement: index + 1
        }));

    } catch (error) {
        console.error('Error processing match data:', error);
        throw new Error('Failed to process match data');
    }
}

async function saveMatchResults(lobbyId, matchId, results) {
    const matchResultRepository = AppDataSource.getRepository("MatchResult");
    const lobbyRepository = AppDataSource.getRepository("Lobby");

    try {
        const lobby = await lobbyRepository.findOne({
            where: { id: lobbyId },
            relations: ['teams']
        });

        if (!lobby) {
            throw new Error(`Lobby with ID ${lobbyId} not found`);
        }

        const sortedResults = results.sort((a, b) => b.points - a.points);

        const savedResults = await Promise.all(sortedResults.map(async result => {
            const team = lobby.teams.find(t => t.teamNumber === result.teamNumber);
            if (!team) {
                throw new Error(`Team ${result.teamNumber} not found in lobby ${lobbyId}`);
            }

            return await matchResultRepository.save({
                matchId,
                lobby,
                team,
                placement: result.placement,
                points: result.points,
                teamDamage: result.teamDamage,
                tankedDamage: result.tankedDamage,
                kills: result.kills,
                deaths: result.deaths
            });
        }));

        return savedResults;

    } catch (error) {
        console.error('Error saving match results:', error);
        throw new Error('Failed to save match results');
    }
}

async function setLobbyMatches(lobbyName, endDate = null, userId = null) {
    try {
        const lobbyRepository = AppDataSource.getRepository("Lobby");
        const lobby = await lobbyRepository.findOne({
            where: { name: lobbyName }
        });

        if (!lobby) {
            throw new Error(`Lobby "${lobbyName}" not found`);
        }

        // Parse endDate if provided, otherwise use current time
        const endDateTime = endDate ? new Date(endDate) : new Date();
        
        // Validate date format
        if (endDate && isNaN(endDateTime.getTime())) {
            throw new Error('Invalid end date format. Please use YYYY-MM-DD HH:mm');
        }

        // Update lobby object with the end date
        lobby.endDate = endDateTime;
        await lobbyRepository.save(lobby);

        const matches = await fetchMatchesForLobby(lobby, userId);
        
        for (const match of matches) {
            const results = await processMatchData(match.details, lobbyName);
            console.log("consoleresults");
            console.log(results);
            await saveMatchResults(lobby.id, match.matchId, results);
        }

        return {
            success: true,
            message: `Successfully processed ${matches.length} matches up to ${endDateTime.toLocaleString()}`
        };

    } catch (error) {
        console.error('Error setting lobby matches:', error);
        throw new Error(`Failed to set lobby matches: ${error.message}`);
    }
}

async function getLobbyResults(lobbyName) {
    try {
        const matchResultRepository = AppDataSource.getRepository("MatchResult");
        const lobbyRepository = AppDataSource.getRepository("Lobby");

        const lobby = await lobbyRepository.findOne({
            where: { name: lobbyName }
        });

        if (!lobby) {
            throw new Error(`Lobby "${lobbyName}" not found`);
        }

        const results = await matchResultRepository.find({
            where: { lobby: { id: lobby.id } },
            relations: ['team'],
            order: {
                matchId: "ASC",
                points: "DESC"
            }
        });

        return results;

    } catch (error) {
        console.error('Error getting lobby results:', error);
        throw new Error(`Failed to get lobby results: ${error.message}`);
    }
}

async function deleteMatchResults(lobbyName) {
    try {
        const matchResultRepository = AppDataSource.getRepository("MatchResult");
        const lobbyRepository = AppDataSource.getRepository("Lobby");

        const lobby = await lobbyRepository.findOne({
            where: { name: lobbyName }
        });

        if (!lobby) {
            throw new Error(`Lobby "${lobbyName}" not found`);
        }

        const results = await matchResultRepository.find({
            where: { lobby: { id: lobby.id } }
        });

        if (results.length === 0) {
            return 0;
        }

        await matchResultRepository.remove(results);
        return results.length;

    } catch (error) {
        console.error('Error deleting match results:', error);
        throw new Error(`Failed to delete match results: ${error.message}`);
    }
}

module.exports = {
    setLobbyMatches,
    fetchMatchesForLobby,
    processMatchData,
    saveMatchResults,
    getLobbyResults,
    deleteMatchResults
};
