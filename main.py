import discord
from discord.ext import commands
import os
from dotenv import load_dotenv
from tournament import Tournament, TourneyState
from datetime import datetime
import sqlite3

# Load environment variables
load_dotenv()
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

# Create bot instance with command prefix '!'
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

tournament_manager = Tournament()

bot.remove_command('help')  # Remove default help command

@bot.event
async def on_ready():
	guild_count = len(bot.guilds)
	
	# Log connected guilds
	for guild in bot.guilds:
		print(f"Connected to guild: {guild.name} (ID: {guild.id})")
	
	print(f"{bot.user.name} is connected to {guild_count} guilds")
	
	# Set bot's status
	await bot.change_presence(activity=discord.Game(name="!help"))

# Add after imports
from tournament import Tournament

# Add after bot creation
tournament_manager = Tournament()

@bot.command(name='players')
async def list_players(ctx):
    """Lists all players in the current tournament"""
    tournament = tournament_manager.get_current_tournament()
    if not tournament:
        await ctx.send("No tournament running")
        return
        
    players = tournament_manager.get_players(tournament['id'])
    if not players:
        await ctx.send("No players registered yet")
        return
        
    # Create messages with a maximum of 20 players each
    messages = []
    current_message = "Registered Players:\n"
    queue_started = False
    player_count = 0
    
    for i, (username, rank, hunters, is_otp, state, queue_position, player_state) in enumerate(players, 1):
        if not state and not queue_started:
            if player_count > 0:  # If there are registered players, start a new message for queue
                messages.append(current_message)
                current_message = "Queue:\n"
            else:
                current_message += "\nQueue:\n"
            queue_started = True
            player_count = 0
        
        otp_status = " (OTP)" if is_otp else ""
        if state:
            status_str = f" [{state}]" if state else ""
            line = f"{i}. {username} ({rank}){status_str} - Hunters: {hunters}{otp_status}\n"
        else:  # Queued player
            line = f"Q{queue_position}. {username} ({rank}) - Hunters: {hunters}{otp_status}\n"
        
        # If adding this line would make the message too long, start a new message
        if len(current_message + line) > 1900:  # Leave some margin for safety
            messages.append(current_message)
            current_message = line
            player_count = 1
        else:
            current_message += line
            player_count += 1
    
    # Add the last message if it's not empty
    if current_message:
        messages.append(current_message)
    
    # Send all messages
    for msg in messages:
        await ctx.send(msg)

@bot.event
async def on_message(message):
	# Ignore messages from the bot itself
	if message.author == bot.user:
		return
		
	# Process commands
	await bot.process_commands(message)

# Error handling
@bot.event
async def on_error(event, *args, **kwargs):
	print(f'Error in {event}:', exc_info=True)

@bot.event
async def on_command_error(ctx, error):
	if isinstance(error, commands.CommandNotFound):
		await ctx.send("Command not found. Try !help to see available commands.")
	else:
		await ctx.send(f"An error occurred: {str(error)}")

@bot.command(name='start')
async def start_tournament(ctx, *, date_string=None):
    """
    Starts a new tournament. 
    Optional: specify number of games, start date, and end date
    Examples:
    !start                           # Starts now, no end date, 3 games
    !start 5                         # Starts now, no end date, 5 games
    !start 5 2024-03-20 18:00       # 5 games, starts at date, no end date
    !start 5 2024-03-20 18:00 2024-03-21 18:00  # 5 games, starts and ends at specified dates
    """
    tournament_start = datetime.now()
    tournament_end = None
    number_of_games = 3  # Default value

    if date_string:
        try:
            # Split the date string into parts
            parts = date_string.split()
            
            # First part should be number of games if it's a number
            if parts and parts[0].isdigit():
                number_of_games = int(parts[0])
                parts = parts[1:]  # Remove the number of games from parts
            
            if len(parts) >= 4:  # Both start and end dates provided
                start_date_str = f"{parts[0]} {parts[1]}"
                end_date_str = f"{parts[2]} {parts[3]}"
                tournament_start = datetime.strptime(start_date_str, "%Y-%m-%d %H:%M")
                tournament_end = datetime.strptime(end_date_str, "%Y-%m-%d %H:%M")
                if tournament_end <= tournament_start:
                    await ctx.send("End date must be after start date")
                    return
            elif len(parts) >= 2:  # Only start date provided
                start_date_str = f"{parts[0]} {parts[1]}"
                tournament_start = datetime.strptime(start_date_str, "%Y-%m-%d %H:%M")
        except ValueError as e:
            if "invalid literal for int()" in str(e):
                await ctx.send("Invalid number of games. Please provide a valid number.")
            else:
                await ctx.send("Invalid date format. Please use: YYYY-MM-DD HH:MM")
            return

    message = tournament_manager.create_tournament(tournament_start, tournament_end, number_of_games)
    await ctx.send(message)

@bot.command(name='current')
async def current_tournament(ctx):
	"""Shows information about the current tournament"""
	tournament = tournament_manager.get_current_tournament()
	if not tournament:
		await ctx.send("No tournament running")
	else:
		info = f"Tournament Info:\n"
		info += f"State: {tournament['state']}\n"
		info += f"Start Date: {tournament['start_date']}\n"
		info += f"Players: {tournament['player_count']}/{Tournament.MAX_PLAYERS}"
		if tournament['queue_count'] > 0:
			info += f" (Queue: {tournament['queue_count']})"
		if tournament['average_rank'] and tournament['player_count'] > 0:
			info += f"\nAverage Rank: {tournament['average_rank']}"
		await ctx.send(info)

@bot.command(name='register')
async def register_player(ctx, *, registration_text):
    """Registers multiple players for the current tournament"""
    if not registration_text:
        await ctx.send("Please provide registrations in format: !register username rank hunters [OTP]")
        return

    # Split the text by newlines to handle multiple registrations
    registrations = registration_text.split('\n')
    responses = []

    for reg in registrations:
        # Skip empty lines
        if not reg.strip():
            continue

        # Split into words
        parts = reg.strip().split()
        if len(parts) < 3:
            responses.append(f"Invalid registration format: {reg}")
            continue

        # Find the rank position by looking for a valid rank
        rank_pos = -1
        for i, part in enumerate(parts):
            if part.lower() in tournament_manager.VALID_RANKS:
                rank_pos = i
                break

        if rank_pos == -1:
            responses.append(f"No valid rank found in: {reg}")
            continue

        # Username is everything before the rank
        username = ' '.join(parts[:rank_pos])
        rank = parts[rank_pos]
        # Hunters is everything after the rank
        hunters = ' '.join(parts[rank_pos + 1:])
        
        message = tournament_manager.register_player(username, rank, hunters)
        responses.append(message)

    # Send all responses in one message
    await ctx.send('\n'.join(responses))

@bot.command(name='randomize')
async def randomize_teams(ctx):
    """Create balanced teams from checked-in players"""
    result = tournament_manager.create_balanced_teams()
    
    if not isinstance(result, list):
        # If result is not a list of teams, it's an error message
        await ctx.send(result)
        return
    
    # Save the teams
    tournament_manager.save_teams(result)
    
    # Create and send team information
    messages = []
    current_message = "**Teams have been created!**\n\n"
    
    for team in result:
        team_text = f"**Team {team['number']}** (Average Rank: {team['average_rank']})\n"
        for player in team['players']:
            otp_status = " (OTP)" if player['is_otp'] else ""
            team_text += f"• {player['username']} ({player['rank']}) - {player['hunters']}{otp_status}\n"
        team_text += "\n"
        
        # Check if adding this team would exceed Discord's message limit
        if len(current_message + team_text) > 1900:
            messages.append(current_message)
            current_message = team_text
        else:
            current_message += team_text
    
    if current_message:
        messages.append(current_message)
    
    # Send all messages
    for msg in messages:
        await ctx.send(msg)

@bot.command(name='teams')
async def show_teams(ctx):
    """Shows the current teams"""
    success, result = tournament_manager.get_teams()
    
    if not success:
        await ctx.send(result)
        return

    messages = []
    current_message = "**Current Teams:**\n\n"
    
    for team in result:
        team_text = f"**Team {team['number']}** (Average: {team['average_rank']})\n"
        for player in team['players']:
            otp_status = " (OTP)" if player['is_otp'] else ""
            team_text += f"• {player['username']} ({player['rank']}) - {player['hunters']}{otp_status}\n"
        team_text += "\n"
        
        if len(current_message + team_text) > 1900:
            messages.append(current_message)
            current_message = team_text
        else:
            current_message += team_text
    
    if current_message:
        messages.append(current_message)
    
    for msg in messages:
        await ctx.send(msg)
        
@bot.command(name='end')
async def end_tournament(ctx):
    """Ends the current tournament and computes final results"""
    tournament_manager.end_tournament()

@bot.command(name='results')
async def show_results(ctx, tournament_id):
    """Shows tournament results sorted by points, including team players"""
    results = tournament_manager.get_tournament_results(tournament_id)
    
    # Sort results by points in descending order
    sorted_results = sorted(results, key=lambda x: x['points'], reverse=True)
    
    messages = []
    current_message = "**Tournament Results**\n\n"
    
    for i, team in enumerate(sorted_results, 1):
        team_text = (
            f"**#{i} - Team {team['team_number']}** "
            f"Points: {team['points']}/"
            f"K/D: {team['kills']}/{team['deaths']}/"
            f"Damage: {team['damage_dealt']:,}/"
            f"Matches: {team['matches']}\n"
            f"Players:\n"
        )
        
        # Add player information
        for player in team['players']:
            team_text += f"• {player['username']} ({player['rank']})\n"
        
        team_text += "\n"
        
        # Check if adding this team would exceed Discord's message limit
        if len(current_message + team_text) > 1900:
            messages.append(current_message)
            current_message = team_text
        else:
            current_message += team_text
    
    if current_message:
        messages.append(current_message)
    
    # Send all messages
    for msg in messages:
        await ctx.send(msg)

@bot.command(name='checkin')
async def checkin_player(ctx, *, username):
    """Checks in a registered player for the tournament"""
    success, message = tournament_manager.checkin_player(username)
    await ctx.send(message)

@bot.command(name='checkinphase')
async def start_checkin(ctx):
    """Starts the check-in phase of the tournament"""
    success, message = tournament_manager.start_checkin_phase()
    await ctx.send(message)

@bot.command(name='swap')
async def swap_players(ctx, player1: str, player2: str):
    """Swaps two players between teams"""
    success, message = tournament_manager.swap_players(player1, player2)
    if success:
        await ctx.send(message)
        # Show updated teams after swap
        await show_teams(ctx)
    else:
        await ctx.send(message)

@bot.command(name='remove')
async def remove_player(ctx, *, username):
    """Removes a player from the tournament"""
    success, message = tournament_manager.remove_player(username)
    await ctx.send(message)
    
    # If player was removed successfully and was in a team, show updated teams
    if success and "removed from tournament" in message:
        tournament = tournament_manager.get_current_tournament()
        if tournament and tournament['state'] == TourneyState.RUNNING.value:
            await show_teams(ctx)

@bot.command(name='queue')
async def promote_queue(ctx, username: str = None):
    """
    Promotes a player from queue to the tournament.
    If no username is provided, promotes the first player in queue.
    """
    success, message, team_updated = tournament_manager.promote_from_queue(username)
    await ctx.send(message)
    
    # If player was added to a team, show updated teams
    if success and team_updated:
        await show_teams(ctx)

@bot.command(name='help')
async def help_command(ctx, command_name=None):
    """Shows help information for commands"""
    
    # Dictionary of command categories and their commands
    commands = {
        "Tournament Management": {
            "start": "Start a new tournament\n"
                    "Usage: !start [games] [start_date start_time] [end_date end_time]\n"
                    "Examples:\n"
                    "!start                           # 3 games, starts now\n"
                    "!start 5                         # 5 games, starts now\n"
                    "!start 5 2024-03-20 18:00       # 5 games, starts at date\n"
                    "!start 5 2024-03-20 18:00 2024-03-21 18:00  # 5 games, with end date",
            "end": "End the current tournament",
            "current": "Show information about the current tournament",
            "results": "Show tournament results\nUsage: !results <tournament_id>"
        },
        "Player Management": {
            "register": "Register player(s) for the tournament\n"
                       "Usage: !register username rank hunters [OTP]\n"
                       "Example: !register PlayerName gold shiv/oath OTP",
            "remove": "Remove a player from the tournament\n"
                     "Usage: !remove <username>",
            "players": "List all registered players and queue",
            "queue": "Promote player from queue\n"
                    "Usage: !queue [username]"
        },
        "Check-in System": {
            "checkinphase": "Start the check-in phase",
            "checkin": "Check in a player\n"
                      "Usage: !checkin <username>"
        },
        "Team Management": {
            "randomize": "Create balanced teams from checked-in players",
            "teams": "Show current teams",
            "swap": "Swap two players between teams\n"
                   "Usage: !swap <player1> <player2>"
        }
    }

    if command_name:
        # Show help for specific command
        command_found = False
        for category, cmds in commands.items():
            if command_name.lower() in cmds:
                embed = discord.Embed(
                    title=f"Help: !{command_name.lower()}",
                    description=cmds[command_name.lower()],
                    color=discord.Color.blue()
                )
                command_found = True
                break
        
        if not command_found:
            await ctx.send(f"Command '{command_name}' not found. Use !help to see all commands.")
            return
    else:
        # Show all commands grouped by category
        embed = discord.Embed(
            title="Tournament Bot Commands",
            description="Use !help <command> for more details about a specific command",
            color=discord.Color.blue()
        )
        
        for category, cmds in commands.items():
            # Create a field for each category
            field_value = ""
            for cmd_name, cmd_desc in cmds.items():
                # Get just the first line of the description
                short_desc = cmd_desc.split('\n')[0]
                field_value += f"**!{cmd_name}** - {short_desc}\n"
            embed.add_field(
                name=category,
                value=field_value,
                inline=False
            )

    await ctx.send(embed=embed)

# Run the bot
try:
	bot.run(DISCORD_TOKEN)
except discord.errors.LoginFailure:
	print("Failed to login: Invalid token")
except Exception as e:
	print(f"An error occurred: {str(e)}")