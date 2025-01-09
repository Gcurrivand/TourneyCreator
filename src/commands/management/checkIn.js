const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');
const eventService = require('../../services/eventService');
const PlayerState = require('../../enums/playerState');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkin')
        .setDescription('Check in a player to their lobby')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The username of the player')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const username = interaction.options.getString('username');
            const player = await playerService.getPlayerByUsername(username);

            if (player.discordId && player.discordId !== interaction.user.id) {
                throw new Error("Vous ne pouvez enregistrer que votre propre compte!");
            }

            const isCheckinAllowed = await eventService.isEventInCheckinState(player.lobby.event.id);
            if (!isCheckinAllowed) {
                throw new Error(`Enregistrement non autorisé pour l'événement "${player.lobby.event.name}". L'événement doit être en CHECKIN.`);
            }

            await playerService.setPlayerState(username, PlayerState.CHECKED);
            await interaction.editReply(`✅ Le joueur "${username}" est enregistré!`);
        } catch (error) {
            console.error('Error in checkin command:', error);
            await interaction.editReply({
                content: `❌ Erreur lors de l'enregistrement du player: ${error.message}`,
                ephemeral: true
            });
        }
    },
};