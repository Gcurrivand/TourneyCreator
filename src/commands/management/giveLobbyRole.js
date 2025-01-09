const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const lobbiesService = require('../../services/lobbiesService');

module.exports = {
    requiresAuth: true,
    data: new SlashCommandBuilder()
        .setName('givelobbyrole')
        .setDescription('Create and give a role for a lobby')
        .addStringOption(option =>
            option.setName('lobby')
                .setDescription('The name of the lobby')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Custom name for the role (optional)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const lobbyName = interaction.options.getString('lobby');
            const customName = interaction.options.getString('name');
            const roleName = customName || lobbyName;

            // Get the players in the lobby
            const players = await lobbiesService.getPlayers(lobbyName);
            if (players.length === 0) {
                throw new Error('No players found in this lobby');
            }

            // First create the role if it doesn't exist
            let role = interaction.guild.roles.cache.find(r => r.name === roleName);
            if (!role) {
                try {
                    role = await interaction.guild.roles.create({
                        name: roleName,
                        reason: `Lobby role for ${lobbyName}`
                    });
                    await interaction.editReply('✅ Role "' + roleName + '" created successfully');
                } catch (error) {
                    throw new Error('Failed to create role: ' + error.message);
                }
            }
            console.log("ICILA");
            try {
                let assignedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;

                for (const player of players) {
                    if (!player.discordId) {
                        console.log("hasnotId");
                        skippedCount++;
                        continue;
                    }

                    try {
                        const member = await interaction.guild.members.fetch(player.discordId);
                        if (member) {
                            await member.roles.add(role);
                            assignedCount++;
                        } else {
                            skippedCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to assign role to ${player.username}:`, error);
                        errorCount++;
                    }
                }

                let resultMessage = `Role assignment results for "${roleName}":\n`;
                resultMessage += `Successfully assigned: ${assignedCount}\n`;
                if (skippedCount > 0) resultMessage += `⚠️ Skipped (no Discord ID): ${skippedCount}\n`;
                if (errorCount > 0) resultMessage += `❌ Failed: ${errorCount}`;

                await interaction.followUp(resultMessage);

            } catch (error) {
                throw new Error('Failed to assign roles: ' + error.message);
            }

        } catch (error) {
            console.error('Error in givelobbyrole command:', error);
            await interaction.editReply('❌ Error: ' + error.message);
        }
    },
};