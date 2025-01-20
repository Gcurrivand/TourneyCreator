const { EntitySchema } = require('typeorm');

const Lobby = new EntitySchema({
    name: "Lobby",
    tableName: "lobbies",
    columns: {
        id: {
            primary: true,
            type: "integer",
            generated: "increment"
        },
        name: {
            type: "text",
            nullable: false
        },
        startDate: {
            type: "text",
            name: "start_date"
        },
        endDate: {
            type: "text",
            name: "end_date",
            nullable: true
        },
        numberOfGames: {
            type: "integer",
            name: "number_of_games",
            default: 5
        }
    },
    relations: {
        event: {
            type: "many-to-one",
            target: "Event",
            joinColumn: {
                name: "event_id"
            }
        },
        players: {
            type: "one-to-many",
            target: "Player",
            inverseSide: "lobby"
        },
        teams: {
            type: "one-to-many",
            target: "Team",
            inverseSide: "lobby"
        },
        matchResults: {
            type: "one-to-many",
            target: "MatchResult",
            inverseSide: "lobby"
        }
    }
});

module.exports = Lobby;