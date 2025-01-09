const { SlashCommandBuilder } = require('discord.js');
const EventState = require('../../enums/eventState');
const eventService = require('../../services/eventService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('seteventstate')
        .setDescription('Change l\'état d\'un événement')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('Nom de l\'événement')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('state')
                .setDescription('Nouvel état de l\'événement')
                .setRequired(true)
                .addChoices(
                    { name: 'Created', value: EventState.CREATED },
                    { name: 'CheckIn', value: EventState.CHECKIN },
                    { name: 'Running', value: EventState.RUNNING },
                    { name: 'Ended', value: EventState.ENDED }
                )),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const event = interaction.options.getString('event');
            const newState = interaction.options.getString('state');

            const updatedEvent = await eventService.setEventState(event, newState);
            
            await interaction.editReply({
                content: `✅ L'état de l'événement "${event}" a été changé en ${newState}`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erreur: ${error.message}`,
                ephemeral: true
            });
        }
    },
};