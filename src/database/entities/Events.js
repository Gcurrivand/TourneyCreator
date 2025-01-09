const { EntitySchema } = require('typeorm');

const Event = new EntitySchema({
    name: "Event",
    tableName: "events",
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
        state: {
            type: "text"
        }
    },
    relations: {
        lobbies: {
            type: "one-to-many",
            target: "Lobby",
            inverseSide: "event"
        }
    }
});

module.exports = Event;