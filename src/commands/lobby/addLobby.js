const { SlashCommandBuilder } = require('discord.js');
const { addLobbyToEvent } = require('../../services/lobbiesService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('addlobby')
        .setDescription('Add a new lobby to an existing event')
        .addStringOption(option =>
            option.setName('eventname')
                .setDescription('The name of the existing event')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('games')
                .setDescription('Number of games for this lobby')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)),
    async execute(interaction) {
        try {
            const eventName = interaction.options.getString('eventname');
            const numberOfGames = interaction.options.getInteger('games');

            const lobby = await addLobbyToEvent(eventName, numberOfGames);

            await interaction.reply({
                content: `Lobby "${lobby.name}" ajouté à l'événement "${eventName}" avec ${numberOfGames} games!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error adding lobby:', error);
            await interaction.reply({
                content: 'Erreur lors de l\'ajout du lobby.',
                ephemeral: true
            });
        }
    },
};
