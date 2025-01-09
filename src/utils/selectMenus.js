const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Hunters = require('../enums/hunters');
const TeamBuildingMethod = require('../enums/teamBuildingMethod');

async function handleHunterSelect(interaction) {
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('hunter_select')
                .setPlaceholder('Select your hunters')
                .setMinValues(1)
                .setMaxValues(Hunters.getAllHunters().length)
                .addOptions(
                    Hunters.getAllHunters().map(hunter => ({
                        label: hunter.charAt(0).toUpperCase() + hunter.slice(1).toLowerCase(),
                        value: hunter.toLowerCase()
                    }))
                )
        );

    const response = await interaction.editReply({
        content: 'Please select your hunters:',
        components: [row],
        ephemeral: true
    });

    try {
        const collectorFilter = i => i.user.id === interaction.user.id;
        const selection = await response.awaitMessageComponent({ filter: collectorFilter, time: 30000 });
        
        // Acknowledge the select menu interaction
        await selection.deferUpdate();
        
        // Clear the select menu
        await interaction.editReply({
            content: 'Hunters selected!',
            components: [],
            ephemeral: true
        });

        return selection.values.join(' ');
    } catch (error) {
        await interaction.editReply({
            content: 'Selection timed out or failed. Please try again.',
            components: [],
            ephemeral: true
        });
        throw new Error('Hunter selection timed out');
    }
}

async function handleExclusionSelect(interaction, players) {
    const ITEMS_PER_PAGE = 20;
    const pages = Math.ceil(players.length / ITEMS_PER_PAGE);
    let currentPage = 0;
    let selectedPlayers = new Set();

    // Create navigation buttons
    const navigationButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('previous_page')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pages <= 1),
        new ButtonBuilder()
            .setCustomId('confirm_exclusion')
            .setLabel('Confirm Exclusions')
            .setStyle(ButtonStyle.Success)
    );

    const generateMenu = () => {
        const startIdx = currentPage * ITEMS_PER_PAGE;
        const endIdx = startIdx + ITEMS_PER_PAGE;
        const pagePlayers = players.slice(startIdx, endIdx);

        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('exclude_players')
                .setPlaceholder(`Select players (Page ${currentPage + 1}/${pages})`)
                .setMinValues(0)
                .setMaxValues(ITEMS_PER_PAGE)
                .addOptions([
                    {
                        label: 'None - Clear all selections',
                        value: 'none',
                        description: 'Deselect all players'
                    },
                    ...pagePlayers.map(player => ({
                        label: player.username,
                        value: player.username,
                        default: selectedPlayers.has(player.username)
                    }))
                ])
        );
    };

    const reply = await interaction.editReply({
        content: 'Select players to exclude:',
        components: [generateMenu(), navigationButtons]
    });

    return new Promise((resolve, reject) => {
        const collector = reply.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id,
            time: 300000
        });

        collector.on('collect', async i => {
            if (i.isStringSelectMenu()) {
                // Handle select menu interactions
                const values = i.values;
                
                if (values.includes('none')) {
                    selectedPlayers.clear();
                } else {
                    values.forEach(value => selectedPlayers.add(value));
                    selectedPlayers.delete('none');
                }

                await i.deferUpdate();
            }

            if (i.isButton()) {
                switch (i.customId) {
                    case 'previous_page':
                        currentPage = Math.max(0, currentPage - 1);
                        break;
                    case 'next_page':
                        currentPage = Math.min(pages - 1, currentPage + 1);
                        break;
                    case 'confirm_exclusion':
                        collector.stop('confirmed');
                        return;
                }

                // Update navigation buttons state
                navigationButtons.components[0].setDisabled(currentPage === 0);
                navigationButtons.components[1].setDisabled(currentPage === pages - 1);

                // Update the message with new components
                await i.update({
                    components: [generateMenu(), navigationButtons]
                });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'confirmed') {
                await interaction.editReply({
                    content: 'Processing exclusions...',
                    components: []
                });
                resolve(Array.from(selectedPlayers).join(' '));
            } else {
                await interaction.editReply({
                    content: 'Exclusion selection cancelled or timed out',
                    components: []
                });
                resolve('');  // Return empty string if not confirmed
            }
        });
    });
}

async function handleMethodSelect(interaction) {
    const methods = Object.values(TeamBuildingMethod);

    const select = new StringSelectMenuBuilder()
        .setCustomId('method_select')
        .setPlaceholder('Select team building method')
        .addOptions(methods);

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.editReply({ content: 'Select team building method:', components: [row] });

    const response = await interaction.fetchReply();
    const selection = await response.awaitMessageComponent({ 
        filter: i => i.user.id === interaction.user.id,
        time: 60000 
    });
    await selection.deferUpdate();
    return selection.values[0];
}

async function handleTeamParamsSelect(interaction) {
    const response = await interaction.fetchReply();
    const filter = i => i.user.id === interaction.user.id && 
                       (i.customId === 'teams_select' || i.customId === 'players_select');
    
    return new Promise((resolve, reject) => {
        const collector = response.createMessageComponentCollector({ 
            filter, 
            time: 60000,
            max: 2
        });

        const selections = {};
        
        collector.on('collect', async i => {
            try {
                await i.deferUpdate();
                selections[i.customId] = i.values[0];
                
                if (Object.keys(selections).length === 2) {
                    collector.stop();
                    resolve(`${selections.teams_select}|${selections.players_select}`);
                }
            } catch (error) {
                reject(error);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && Object.keys(selections).length < 2) {
                reject(new Error('Team parameters selection timed out'));
            }
        });
    });
}

// Update the exports
module.exports = {
    handleSelect: async (interaction, selectType, additionalData) => {
        try {
            const selectHandlers = {
                hunter: handleHunterSelect,
                exclude: (i) => handleExclusionSelect(i, additionalData.players),
                team_params: handleTeamParamsSelect,
                method: handleMethodSelect
            };

            if (selectHandlers[selectType]) {
                return await selectHandlers[selectType](interaction);
            }
        } catch (error) {
            console.error('Select Menu Error:', error);
            throw error;
        }
    },
};