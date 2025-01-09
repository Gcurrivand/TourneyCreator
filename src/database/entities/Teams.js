const { EntitySchema } = require('typeorm');

const Team = new EntitySchema({
    name: "Team",
    tableName: "teams",
    columns: {
        id: {
            primary: true,
            type: "integer",
            generated: "increment"
        },
        teamNumber: {
            type: "integer",
            name: "team_number"
        },
        averageRankWeight: {
            type: "float",
            name: "average_rank_weight"
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
        players: {
            type: "one-to-many",
            target: "Player",
            inverseSide: "team"
        },
        matchResults: {
            type: "one-to-many",
            target: "MatchResult",
            inverseSide: "team"
        }
    }
});

module.exports = Team;