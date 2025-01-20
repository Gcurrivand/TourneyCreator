const { SlashCommandBuilder } = require('discord.js');
const playerService = require('../../services/playersService');
const eventService = require('../../services/eventService');
const lobbyService = require('../../services/lobbiesService');
const EventState = require('../../enums/eventState');
const Ranks = require('../../enums/rank');
const Hunters = require('../../enums/hunters');
const MaxPlayer = require('../../enums/maxPlayer');
const { formatHuntersWithEmoji } = require('../../utils/hunterDisplay');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register as a player')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your in-game username')
                .setRequired(true))
        .addStringOption(option => {
            const rankOption = option
                .setName('rank')
                .setDescription('Your current rank')
                .setRequired(true);

            Object.entries(Ranks)
                .filter(([key, value]) => typeof value === 'number')
                .forEach(([key]) => {
                    rankOption.addChoices(
                        { name: key.charAt(0) + key.slice(1).toLowerCase(), value: key }
                    );
                });

            return rankOption;
        })
        .addStringOption(option =>
            option.setName('hunters')
                .setDescription('Chasseurs (séparé par un espace)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const username = interaction.options.getString('username');
            const rank = interaction.options.getString('rank');
            const huntersString = interaction.options.getString('hunters');
            const discordId = interaction.user.id;

            if(await playerService.usernameExists(username)){
                player = await playerService.updatePlayer(username, rank, huntersString, discordId);
            }else{
                 player = await playerService.createPlayer(username, rank, huntersString, discordId);
            }
            

            const hunterValidation = Hunters.validateHunters(huntersString);
            if (!hunterValidation.isValid) {
                return await interaction.editReply({
                    content: `❌ ${hunterValidation.message}`,
                    ephemeral: true
                });
            }

            const events = await eventService.getEventsByStates([EventState.CREATED]);

            const currentEvent = events[0];
            if (!currentEvent) {
                return await interaction.editReply({
                    content: `❌ No active events found`,
                    ephemeral: true
                });
            }

            let assignedLobby = currentEvent.lobbies.find(lobby => 
                lobby.players.length < MaxPlayer.SQUAD || 
                lobby.players.some(p => p.username === player.username)
            );
            
            if (!assignedLobby) {
                assignedLobby = await lobbyService.addLobbyToEvent(
                    currentEvent.name,
                    currentEvent.lobbies[0].numberOfGames
                );
            }
            
            await playerService.addPlayerToLobby(assignedLobby.id, player.username);

            const isOtpText = player.isOtp ? ' OTP' : '';
            const formattedHunters = formatHuntersWithEmoji(player.hunters, interaction.guild);

            await interaction.editReply({
                content: `✅ Enregistrement réussi!\n\n` +
                    `Username: ${player.username}\n` +
                    `Rank: ${player.rank}\n` +
                    `Hunters: ${formattedHunters}${isOtpText}\n` +
                    `Lobby: ${assignedLobby.name}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in register command:', error);
            await interaction.editReply({
                content: `❌ Failed to register: ${error.message}`,
                ephemeral: true
            });
        }
    },
};
