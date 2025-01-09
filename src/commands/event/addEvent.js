const { SlashCommandBuilder } = require('discord.js');
const { createEvent } = require('../../services/eventService');
const { isValidDateFormat } = require('../../utils/validation');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('addevent')
        .setDescription('Create a new event')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the event')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('startdate')
                .setDescription('The start date of the event (YYYY-MM-DD HH:mm)')
                .setRequired(true)),
    async execute(interaction) {
        try {
            const name = interaction.options.getString('name');
            const startDate = interaction.options.getString('startdate');

            if (!isValidDateFormat(startDate)) {
                return await interaction.reply({
                    content: 'Format de date invalide. Veuillez utiliser YYYY-MM-DD HH:mm',
                    ephemeral: true
                });
            }

            await createEvent(name, startDate);

            await interaction.reply({
                content: `Event "${name}" créé avec succès ✅\nDate de début: ${startDate}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating event:', error);
            await interaction.reply({
                content: 'There was an error while creating the event.',
                ephemeral: true
            });
        }
    },
};