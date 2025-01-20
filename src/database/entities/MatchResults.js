const { EntitySchema } = require('typeorm');

const MatchResult = new EntitySchema({
    name: "MatchResult",
    tableName: "match_results",
    columns: {
        id: {
            primary: true,
            type: "integer",
            generated: "increment"
        },
        matchId: {
            type: "text",
            name: "match_id"
        },
        placement: {
            type: "integer"
        },
        points: {
            type: "integer",
            default: 0
        },
        teamDamage: {
            type: "integer",
            name: "team_damage",
            default: 0
        },
        tankedDamage: {
            type: "integer",
            name: "tanked_damage",
            default: 0
        },
        kills: {
            type: "integer",
            default: 0
        },
        deaths: {
            type: "integer",
            default: 0
        },
        lobbyId: {
            type: "integer",
            name: "lobby_id"
        },
        teamId: {
            type: "integer",
            name: "team_id"
        }
    },
    relations: {
        lobby: {
            type: "many-to-one",
            target: "Lobby",
            joinColumn: {
                name: "lobby_id"
            }
        },
        team: {
            type: "many-to-one",
            target: "Team",
            joinColumn: {
                name: "team_id"
            }
        }
    },
    indices: [
        {
            name: "unique_match_team",
            unique: true,
            columns: ["matchId", "team"]
        }
    ]
});

module.exports = MatchResult;