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

    let bestTeams = null;
    let bestVariance = Infinity;
    const maxAttempts = 100000;  // Max attempts to find 10 valid configurations
    const requiredValidConfigs = 100;
    let validConfigCount = 0;

    for (let attempt = 0; attempt < maxAttempts && validConfigCount < requiredValidConfigs; attempt++) {
        try {
            // Create a shuffled copy of players for each attempt
            const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
            const teams = Array.from({ length: numberOfTeams }, () => []);
            const remainingPlayers = [...shuffledPlayers];
            
            // Distribute players while respecting OTP constraints
            while (remainingPlayers.length > 0) {
                let placed = false;
                
                // Try to place player in best team
                for (const [i, player] of remainingPlayers.entries()) {
                    for (const team of teams) {
                        if (team.length < numOfPlayersPerTeam && canAddPlayerToTeam(player, team)) {
                            team.push(player);
                            remainingPlayers.splice(i, 1);
                            placed = true;
                            break;
                        }
                    }
                    if (placed) break;
                }
                
                if (!placed) throw new Error('No valid placement found');
            }

            // Calculate variance for this configuration
            const variance = calculateVariance(teams);
            
            // Track best configuration
            if (variance < bestVariance) {
                bestVariance = variance;
                bestTeams = teams.map(team => [...team]);
                validConfigCount++;
            }
        } catch (error) {
            // Invalid configuration, try again
        }
    }

    if (!bestTeams) {
        throw new Error('Unable to create balanced teams after multiple attempts');
    }

    return bestTeams;
}

function randomizeTeams(players, numberOfTeams, numOfPlayersPerTeam) {
    verifyPlayerCount(players, numberOfTeams, numOfPlayersPerTeam);

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const teams = Array.from({ length: numberOfTeams }, () => []);

    for (const player of shuffledPlayers) {
        const validTeams = teams.filter(team => 
            team.length < numOfPlayersPerTeam && 
            canAddPlayerToTeam(player, team)
        );

        if (validTeams.length === 0) {
            throw new Error('No valid team found for player');
        }

        // Randomly select a valid team
        const randomIndex = Math.floor(Math.random() * validTeams.length);
        validTeams[randomIndex].push(player);
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

    // Parse excluded players
    const excludedUsernames = parseExcludedPlayers(excludeString);

    // Keep all players but track excluded ones
    const allPlayers = [...lobby.players];
    const excludedPlayers = allPlayers.filter(p => excludedUsernames.includes(p.username));
    const teamCreationPlayers = allPlayers.filter(p => !excludedUsernames.includes(p.username));

    // Verify we have enough players including excluded ones
    const totalPlayersNeeded = numberOfTeams * numOfPlayersPerTeam;
    if (allPlayers.length < totalPlayersNeeded) {
        throw new Error(`Pas assez de joueurs. Il faut ${totalPlayersNeeded} joueurs mais il n'y a que ${allPlayers.length}`);
    }

    // Modified team creation logic with exclusion math
    let teams;
    switch(method) {
        case TeamBuildingMethod.BALANCED_WITH_EXCLUDED:
        case TeamBuildingMethod.RANDOM_WITH_EXCLUDED:
            const excludedCount = excludedPlayers.length;
            const initialPlayersNeeded = totalPlayersNeeded - excludedCount;

            // Add validation for integer division
            if (initialPlayersNeeded <= 0) {
                throw new Error(`Cannot exclude ${excludedCount} players when only ${totalPlayersNeeded} needed`);
            }

            if (initialPlayersNeeded % numberOfTeams !== 0) {
                throw new Error(`Cannot divide ${initialPlayersNeeded} players into ${numberOfTeams} teams evenly`);
            }

            const initialPlayersPerTeam = initialPlayersNeeded / numberOfTeams;
            verifyPlayerCount(teamCreationPlayers, numberOfTeams, initialPlayersPerTeam);

            if (method === TeamBuildingMethod.BALANCED_WITH_EXCLUDED) {
                teams = balancedTeams(teamCreationPlayers, numberOfTeams, initialPlayersPerTeam);
            } else {
                teams = randomizeTeams(teamCreationPlayers, numberOfTeams, initialPlayersPerTeam);
            }
            break;

        case TeamBuildingMethod.BALANCED:
            teams = balancedTeams(teamCreationPlayers, numberOfTeams, numOfPlayersPerTeam);
            break;

        case TeamBuildingMethod.RANDOM:
            teams = randomizeTeams(teamCreationPlayers, numberOfTeams, numOfPlayersPerTeam);
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
    if (excludedPlayers.length > 0) {
        // Modified distribution logic
        const allTeams = [...savedTeams];
        while (excludedPlayers.length > 0) {
            const player = excludedPlayers.pop();
            const team = allTeams.shift() || savedTeams[0];  // Fallback to first team
            await playerRepository.update(
                { id: player.id },
                { team: { id: team.id } }
            );
            allTeams.push(team);  // Rotate teams
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