const { SlashCommandBuilder } = require('discord.js');
const eventService = require('../../services/eventService');
const playerService = require('../../services/playersService');
const EventState = require('../../enums/eventState');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('end')
        .setDescription('End an event and remove all players from its lobbies')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('The name of the event to end')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('Confirm ending the event')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const eventName = interaction.options.getString('event');
            const confirmed = interaction.options.getBoolean('confirm');

            if (!confirmed) {
                return await interaction.editReply({
                    content: '❌ Operation cancelled. Please confirm ending the event by setting confirm to true.',
                    ephemeral: true
                });
            }

            const event = await eventService.getEventByName(eventName);
            
            // Update event state
            await eventService.setEventState(eventName, EventState.ENDED);

            // Remove all players from all lobbies in this event
            let removedPlayersCount = 0;
            for (const lobby of event.lobbies) {
                for (const player of lobby.players) {
                    await playerService.removePlayerFromLobby(player.username);
                    removedPlayersCount++;
                }
            }

            await interaction.editReply({
                content: `✅ Event "${eventName}" has been ended.\n` +
                        `Removed ${removedPlayersCount} players from ${event.lobbies.length} lobbies.`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in end command:', error);
            await interaction.editReply({
                content: `❌ Failed to end event: ${error.message}`,
                ephemeral: true
            });
        }
    },
};