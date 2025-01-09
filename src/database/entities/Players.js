const { EntitySchema } = require('typeorm');

const Player = new EntitySchema({
    name: "Player",
    tableName: "players",
    columns: {
        id: {
            primary: true,
            type: "integer",
            generated: "increment"
        },
        username: {
            type: "text",
            unique: true,
            transformer: {
                to: (value) => value?.toLowerCase(),
                from: (value) => value
            }
        },
        discordId: {
            type: "text",
            name: "discord_id",
            nullable: true
        },
        rank: {
            type: "text"
        },
        rankWeight: {
            type: "integer",
            name: "rank_weight"
        },
        hunters: {
            type: "text"
        },
        isOtp: {
            type: "boolean",
            name: "is_otp"
        },
        state: {
            type: "text",
            nullable: true
        },
        lastRegisteredAt: {
            type: "text",
            name: "last_registered_at",
            nullable: true
        }
    },
    relations: {
        team: {
            type: "many-to-one",
            target: "Team",
            joinColumn: {
                name: "team_id"
            }
        },
        lobby: {
            type: "many-to-one",
            target: "Lobby",
            joinColumn: {
                name: "lobby_id"
            }
        }
    }
});

module.exports = Player;