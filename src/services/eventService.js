const AppDataSource = require('../database/datasource');
const EventState = require('../enums/eventState');

async function createEvent(name, startDate) {
    const eventRepository = AppDataSource.getRepository("Event");

    const event = await eventRepository.save({
        name: name,
        startDate: startDate,
        state: EventState.CREATED
    });

    return event;
}

async function getEventById(eventId) {
    const eventRepository = AppDataSource.getRepository("Event");
    
    const event = await eventRepository.findOne({
        where: { id: eventId },
        relations: ['lobbies', 'lobbies.players', 'lobbies.teams'],
        order: {
            lobbies: {
                id: 'ASC'
            }
        }
    });

    if (!event) {
        throw new Error(`Event with ID ${eventId} not found`);
    }

    return event;
}

async function getEventsByStates(states) {
    const eventRepository = AppDataSource.getRepository("Event");
    
    if (!Array.isArray(states) || states.length === 0) {
        throw new Error('States must be a non-empty array');
    }

    states.forEach(state => {
        if (!EventState.isValid(state)) {
            throw new Error(`Invalid state: ${state}`);
        }
    });
    
    const events = await eventRepository.find({
        where: states.map(state => ({ state })),
        relations: ['lobbies', 'lobbies.players', 'lobbies.teams'],
        order: {
            id: 'DESC',
            lobbies: {
                id: 'ASC'
            }
        }
    });

    return events;
}


async function getEventByName(eventName) {
    const eventRepository = AppDataSource.getRepository("Event");
    
    const event = await eventRepository.findOne({
        where: { name: eventName },
        relations: ['lobbies', 'lobbies.players', 'lobbies.teams'],
        order: {
            lobbies: {
                id: 'ASC'
            }
        }
    });

    if (!event) {
        throw new Error(`Event "${eventName}" not found`);
    }

    return event;
}

async function getCurrentEvent() {
    const eventRepository = AppDataSource.getRepository("Event");
    
    const event = await eventRepository.findOne({
        where: [
            { state: EventState.CREATED },
            { state: EventState.CHECKIN },
            { state: EventState.RUNNING }
        ],
        relations: ['lobbies', 'lobbies.players', 'lobbies.teams'],
        order: {
            id: 'DESC',
            lobbies: {
                id: 'ASC'
            }
        }
    });

    if (!event) {
        throw new Error('No active event found');
    }

    return event;
}

async function setEventState(eventName, state) {
    const eventRepository = AppDataSource.getRepository("Event");
    
    const event = await eventRepository.findOne({
        where: { name: eventName }
    });

    if (!event) {
        throw new Error(`Event "${eventName}" not found`);
    }

    if (!Object.values(EventState).includes(state)) {
        throw new Error(`Invalid state: ${state}`);
    }

    event.state = state;
    return await eventRepository.save(event);
}

async function getAllEvents() {
    const eventRepository = AppDataSource.getRepository("Event");
    
    return await eventRepository.find({
        relations: ['lobbies', 'lobbies.players'],
        order: {
            id: 'DESC'
        }
    });
}

async function isEventInCheckinState(eventId) {
    const eventRepository = AppDataSource.getRepository("Event");
    
    const event = await eventRepository.findOne({
        where: { id: eventId }
    });

    if (!event) {
        throw new Error('Event not found');
    }

    return event.state === EventState.CHECKIN;
}

module.exports = {
    createEvent,
    getEventById,
    getCurrentEvent,
    getEventByName,
    setEventState,
    getAllEvents,
    isEventInCheckinState,
    getEventsByStates
};