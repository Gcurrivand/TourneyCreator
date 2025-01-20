const AppDataSource = require('../database/datasource');
const TeamBuildingMethod = require('../enums/teamBuildingMethod');

function calculateTeamWeight(team) {
    return team.reduce((sum, player) => sum + player.rankWeight, 0);
}

function calculateVariance(teams) {
    const weights = teams.map(team => calculateTeamWeight(team));
    const mean = weights.reduce((sum, weight) => sum + weight, 0) / teams.length;
    return weights.reduce((sum, weight) => sum + Math.pow(weight - mean, 2), 0) / teams.length;
}

function canAddPlayerToTeam(player, team) {
    // Check for OTP conflicts
    if (player.isOtp) {
        const playerHunters = new Set(player.hunters.split(' '));
        for (const teamPlayer of team) {
            if (teamPlayer.isOtp) {
                const teamPlayerHunters = new Set(teamPlayer.hunters.split(' '));
                // Check if there's any overlap in hunters
                for (const hunter of playerHunters) {
                    if (teamPlayerHunters.has(hunter)) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function verifyPlayerCount(players, numberOfTeams, numOfPlayersPerTeam) {
    if (players.length < numberOfTeams * numOfPlayersPerTeam) {
        throw new Error(`Pas assez de joueurs. Il faut ${numberOfTeams * numOfPlayersPerTeam} joueurs mais il n'y a que ${players.length}`);
    }

    if (players.length > numberOfTeams * numOfPlayersPerTeam) {
        throw new Error(`Trop de joueurs. Il faut ${numberOfTeams * numOfPlayersPerTeam} joueurs mais il y a ${players.length}`);
    }
}

function balancedTeams(players, numberOfTeams, numOfPlayersPerTeam) {
    verifyPlayerCount(players, numberOfTeams, numOfPlayersPerTeam);

    // Sort players by rank weight descending
    const sortedPlayers = [...players].sort((a, b) => b.rankWeight - a.rankWeight);
    
    // Initialize teams
    let teams = Array.from({ length: numberOfTeams }, () => []);
    let bestTeams = null;
    let bestVariance = Infinity;
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
        // Reset teams
        teams = Array.from({ length: numberOfTeams }, () => []);
        let remainingPlayers = [...sortedPlayers];
        let validCombination = true;

        // Try to fill each team
        for (let teamIndex = 0; teamIndex < numberOfTeams && validCombination; teamIndex++) {
            while (teams[teamIndex].length < numOfPlayersPerTeam && remainingPlayers.length > 0) {
                let playerAdded = false;
                
                // Try to add a player from the remaining pool
                for (let i = 0; i < remainingPlayers.length; i++) {
                    if (canAddPlayerToTeam(remainingPlayers[i], teams[teamIndex])) {
                        teams[teamIndex].push(remainingPlayers[i]);
                        remainingPlayers.splice(i, 1);
                        playerAdded = true;
                        break;
                    }
                }

                // If we couldn't add any player, this combination won't work
                if (!playerAdded) {
                    validCombination = false;
                    break;
                }
            }

            // Check if team has correct number of players
            if (teams[teamIndex].length !== numOfPlayersPerTeam) {
                validCombination = false;
            }
        }

        // If we found a valid combination, calculate its variance
        if (validCombination && remainingPlayers.length === 0) {
            const variance = calculateVariance(teams);
            if (variance < bestVariance) {
                bestVariance = variance;
                bestTeams = teams.map(team => [...team]);
                console.log(`New best variance: ${bestVariance}`);
            }
        }

        // Shuffle the sorted players array for next attempt
        sortedPlayers.sort(() => Math.random() - 0.5);
        attempts++;
    }

    if (!bestTeams) {
        throw new Error('Unable to create balanced teams while respecting OTP constraints');
    }

    return bestTeams;
}

function randomizeTeams(players, numberOfTeams, numOfPlayersPerTeam) {
    verifyPlayerCount(players, numberOfTeams, numOfPlayersPerTeam);

    let teams = Array.from({ length: numberOfTeams }, () => []);
    let remainingPlayers = [...players];
    let currentTeamIndex = 0;
    let attempts = 0;
    const maxAttempts = 1000;

    while (remainingPlayers.length > 0 && attempts < maxAttempts) {
        // Skip full teams
        while (teams[currentTeamIndex].length >= numOfPlayersPerTeam) {
            currentTeamIndex = (currentTeamIndex + 1) % numberOfTeams;
        }

        const randomIndex = Math.floor(Math.random() * remainingPlayers.length);
        const player = remainingPlayers[randomIndex];

        if (canAddPlayerToTeam(player, teams[currentTeamIndex])) {
            teams[currentTeamIndex].push(player);
            remainingPlayers.splice(randomIndex, 1);
            currentTeamIndex = (currentTeamIndex + 1) % numberOfTeams;
            attempts = 0;
        } else {
            attempts++;
            currentTeamIndex = (currentTeamIndex + 1) % numberOfTeams;
        }
    }

    // Verify all teams have the correct number of players
    if (remainingPlayers.length > 0 || teams.some(team => team.length !== numOfPlayersPerTeam)) {
        throw new Error('Unable to create random teams while respecting OTP constraints');
    }

    return teams;
}

function parseExcludedPlayers(excludeString) {
    const excludedPlayers = [];
    let currentUsername = '';
    let inQuotes = false;

    // Split the string into characters and process each one
    for (let i = 0; i < excludeString.length; i++) {
        const char = excludeString[i];

        if (char === '"') {
            if (inQuotes) {
                // End of quoted username
                if (currentUsername) {
                    excludedPlayers.push(currentUsername);
                    currentUsername = '';
                }
            }
            inQuotes = !inQuotes;
        } else if (char === ' ' && !inQuotes) {
            // Space outside quotes means username separator
            if (currentUsername) {
                excludedPlayers.push(currentUsername);
                currentUsername = '';
            }
        } else {
            currentUsername += char;
        }
    }

    // Add the last username if there is one
    if (currentUsername) {
        excludedPlayers.push(currentUsername);
    }

    return excludedPlayers;
}

async function createTeams(lobbyName, numberOfTeams, numOfPlayersPerTeam, method, excludeString = '') {
    const lobbyRepository = AppDataSource.getRepository("Lobby");
    const teamRepository = AppDataSource.getRepository("Team");
    const playerRepository = AppDataSource.getRepository("Player");
    
    const lobby = await lobbyRepository.findOne({
        where: { name: lobbyName },
        relations: ['players', 'teams', 'teams.players']
    });

    if (!lobby) {
        throw new Error(`Lobby "${lobbyName}" not found`);
    }

    // If teams exist for this lobby, remove them and clear player associations
    if (lobby.teams && lobby.teams.length > 0) {
        // Reset team association for all players in the lobby
        for (const team of lobby.teams) {
            if (team.players) {
                for (const player of team.players) {
                    await playerRepository.update(
                        { id: player.id },
                        { team: null }
                    );
                }
            }
        }
        
        // Remove all teams from the lobby
        await teamRepository.remove(lobby.teams);
    }

    // Parse excluded players considering quoted usernames
    const excludedPlayers = parseExcludedPlayers(excludeString);
    
    // Filter out excluded players
    const availablePlayers = lobby.players.filter(player => !excludedPlayers.includes(player.username));
    const excludedLobbyPlayers = lobby.players.filter(player => excludedPlayers.includes(player.username));

    let teams;
    switch (method) {
        case TeamBuildingMethod.BALANCED:
            teams = balancedTeams(availablePlayers, numberOfTeams, numOfPlayersPerTeam);
            break;
        case TeamBuildingMethod.RANDOM:
            teams = randomizeTeams(availablePlayers, numberOfTeams, numOfPlayersPerTeam);
            break;
        default:
            throw new Error(`Unknown team building method: ${method}`);
    }

    const savedTeams = [];
    for (let i = 0; i < teams.length; i++) {
        // Create and save the team first
        const team = await teamRepository.save({
            teamNumber: i,
            lobby: lobby,
            averageRankWeight: calculateTeamWeight(teams[i]) / teams[i].length
        });

        // Update player associations with the saved team
        for (const player of teams[i]) {
            await playerRepository.update(
                { id: player.id },
                { team: { id: team.id } }
            );
        }

        // Fetch the complete team with players for the response
        const savedTeam = await teamRepository.findOne({
            where: { id: team.id },
            relations: ['players', 'lobby']
        });

        savedTeams.push(savedTeam);
    }

    // Distribute excluded players back to teams
    if (excludedLobbyPlayers.length > 0) {
        for (let i = 0; i < excludedLobbyPlayers.length; i++) {
            const player = excludedLobbyPlayers[i];
            const teamIndex = i % savedTeams.length;
            
            await playerRepository.update(
                { id: player.id },
                { team: { id: savedTeams[teamIndex].id } }
            );
        }

        // Refresh saved teams to include excluded players
        for (let i = 0; i < savedTeams.length; i++) {
            savedTeams[i] = await teamRepository.findOne({
                where: { id: savedTeams[i].id },
                relations: ['players', 'lobby']
            });
        }
    }

    return savedTeams;
}

module.exports = {
    createTeams
};