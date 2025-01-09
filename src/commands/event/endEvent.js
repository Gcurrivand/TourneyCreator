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
                .setAutocomplete(true)
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

            // Remove Discord roles by deleting the lobby roles
            for (const lobby of event.lobbies) {
                const role = interaction.guild.roles.cache.find(r => r.name === lobby.name);
                if (!role) {
                    console.log(`Role "${lobby.name}" not found`);
                    continue;
                }

                try {
                    await role.delete(`Event ${eventName} ended`);
                    console.log(`Deleted role "${lobby.name}"`);
                } catch (error) {
                    console.error(`Failed to delete role "${lobby.name}":`, error);
                    await interaction.followUp({
                        content: `⚠️ Failed to delete role "${lobby.name}" - make sure the bot has "Manage Roles" permission and its role is higher than the target role`,
                        ephemeral: true
                    });
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