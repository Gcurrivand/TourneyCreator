const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const Hunters = require('./enums/hunters');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
    throw new Error('DISCORD_TOKEN is missing in .env file');
}

if (!GUILD_ID) {
    throw new Error('GUILD_ID is missing in .env file');
}

async function setupEmojis() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const assetsPath = path.join(__dirname, '../assets/imgs');
        
        // Read all hunter images from the enum
        for (const hunterName of Hunters.VALID_HUNTERS) {
            const imagePath = path.join(assetsPath, `${hunterName}.jpg`);
            
            try {
                // Check if emoji already exists
                const existingEmoji = guild.emojis.cache.find(emoji => emoji.name === hunterName);
                if (existingEmoji) {
                    console.log(`Emoji for ${hunterName} already exists: ${existingEmoji.toString()}`);
                    continue;
                }

                // Create new emoji
                const emoji = await guild.emojis.create({
                    attachment: imagePath,
                    name: hunterName
                });
                console.log(`Created emoji for ${hunterName}: ${emoji.toString()}`);
            } catch (error) {
                console.error(`Failed to create emoji for ${hunterName}:`, error);
            }
        }
    } catch (error) {
        console.error('Error setting up emojis:', error);
    } finally {
        client.destroy();
    }
}

client.once('ready', () => {
    console.log('Bot is ready to setup emojis');
    setupEmojis();
});

// Add error handling
client.on('error', console.error);
client.on('warn', console.warn);

client.login(TOKEN);