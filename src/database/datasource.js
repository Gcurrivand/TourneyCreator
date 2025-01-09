const { DataSource } = require('typeorm');
const Event = require('./entities/Events');
const Lobby = require('./entities/Lobbies');
const Player = require('./entities/Players');
const Team = require('./entities/Teams');
const MatchResult = require('./entities/MatchResults');
const path = require('path');

const AppDataSource = new DataSource({
    type: "sqlite",
    database: path.join(__dirname, '..', 'data', 'database.db'),
    synchronize: true,
    logging: true,
    entities: [
        Event,
        Lobby,
        Player,
        Team,
        MatchResult
    ],
    subscribers: [],
    migrations: [],
});
module.exports = AppDataSource;