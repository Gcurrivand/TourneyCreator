const { Client, Events, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { isAuthorizedUser } = require('./utils/auth');
require('reflect-metadata');
const AppDataSource = require('./database/datasource');
const { handleAutocomplete } = require('./utils/autocomplete');

// Graceful shutdown handling
function shutdown() {
    console.log('Shutting down...');
    if (client) {
        client.destroy(); // Properly close the Discord connection
    }
    if (AppDataSource.isInitialized) {
        AppDataSource.destroy(); // Close database connection
    }
    process.exit(0);
}

// Handle termination signals
process.on('SIGINT', shutdown);  // Ctrl+C
process.on('SIGTERM', shutdown); // Kill command
process.on('SIGHUP', shutdown);  // Terminal closed

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
if (!TOKEN) {
    throw new Error('DISCORD_TOKEN is missing in .env file');
}
if (!CLIENT_ID) {
    throw new Error('CLIENT_ID is missing in .env file');
}

// Add command collection
client.commands = new Collection();

// Function to recursively get all command files from a directory
function getCommandFiles(dir) {
    const files = fs.readdirSync(dir);
    const commandFiles = [];

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            commandFiles.push(...getCommandFiles(filePath));
        } else if (file.endsWith('.js')) {
            commandFiles.push(filePath);
        }
    }

    return commandFiles;
}

// Command handler setup
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = getCommandFiles(commandsPath);
const commands = [];

for (const filePath of commandFiles) {
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());  // Store command data for deployment
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Loaded commands:', Array.from(client.commands.keys()));
});

async function handleInteraction(interaction) {
    console.log('Received interaction type:', interaction.type);
    console.log('Is command?', interaction.isCommand());
    console.log('Interaction details:', {
        commandName: interaction.commandName,
        options: interaction.options?.data
    });
    
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Cette commande: ${interaction.commandName}, n'existe pas.`);
        console.log('Commandes disponibles:', Array.from(client.commands.keys()));
        return;
    }

    if (command.requiresAuth && !isAuthorizedUser(interaction.user.id)) {
        await interaction.reply({
            content: "Vous n'avez pas les permissions nécessaires pour utiliser cette commande.",
            ephemeral: true
        });
        return;
    }

    try {
        console.log('Attempting to execute command:', interaction.commandName);
        await command.execute(interaction);
        console.log('Command execution completed');
    } catch (error) {
        console.error('Error executing command:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }
}

client.on(Events.InteractionCreate, async interaction => {
    await handleInteraction(interaction);
    await handleAutocomplete(interaction);
});

async function initializeBot() {
    try {
        await AppDataSource.initialize();
        console.log("Database connection established");

        // Deploy commands using the prepared commands array
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        console.log(`Starting command deployment with ${commands.length} commands...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log(`Successfully deployed ${data.length} application (/) commands.`);
        await client.login(TOKEN);
    } catch (error) {
        console.error("Initialization failed:", error);
        process.exit(1);
    }
}

initializeBot();

// Add this to verify the event listener is properly attached
client.on('debug', console.log);
client.on('error', console.error);