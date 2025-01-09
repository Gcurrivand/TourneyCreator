const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const playerService = require('../../services/playersService');
const eventService = require('../../services/eventService');
const lobbyService = require('../../services/lobbiesService');
const EventState = require('../../enums/eventState');
const Ranks = require('../../enums/rank');
const Hunters = require('../../enums/hunters');
const MaxPlayer = require('../../enums/maxPlayer');
const { formatHuntersWithEmoji } = require('../../utils/hunterDisplay');
const selectMenus = require('../../utils/selectMenus');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register as a player')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your in-game username')
                .setRequired(true)
                .setAutocomplete(true))
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
        }),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const username = interaction.options.getString('username');
            const rank = interaction.options.getString('rank');
            const discordId = interaction.user.id;

            // Get hunters using the select menu handler
            const huntersString = await selectMenus.handleSelect(interaction, 'hunter');

            // Create or update player with the selected hunters
            let player;
            if(await playerService.usernameExists(username)){
                player = await playerService.updatePlayer(username, rank, huntersString, discordId);
            } else {
                player = await playerService.createPlayer(username, rank, huntersString, discordId);
            }

            // Continue with the rest of your registration logic
            const hunterValidation = Hunters.validateHunters(huntersString);
            if (!hunterValidation.isValid) {
                return await interaction.editReply({
                    content: `❌ ${hunterValidation.message}`,
                    components: [],
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

            // Add role assignment logic
            try {
                let role = interaction.guild.roles.cache.find(r => r.name === assignedLobby.name);
                if (!role) {
                    role = await interaction.guild.roles.create({
                        name: assignedLobby.name,
                        reason: `Lobby role for ${assignedLobby.name}`,
                        permissions: []
                    });
                }

                const member = await interaction.guild.members.fetch(discordId);
                if (member) {
                    console.log(`Adding role ${role.name} to ${member.user.username}`);
                    try {
                        await member.roles.add(role);
                    } catch (error) {
                        console.error('Role assignment error:', error);
                        await interaction.followUp({
                            content: `⚠️ Failed to assign lobby role. Please ensure the bot has "Manage Roles" permission and its role is above the lobby roles in server settings.`,
                            ephemeral: true
                        });
                    }
                }
            } catch (error) {
                console.error('Error assigning role:', error);
            }

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
                components: [],
                ephemeral: true
            });
        }
    },
};
