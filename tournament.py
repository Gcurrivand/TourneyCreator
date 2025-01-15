import sqlite3
from enum import Enum, IntEnum
from datetime import datetime
import requests  # Add at the top with other imports
from itertools import combinations
import random
import unicodedata

class TourneyState(Enum):
    REGISTERING = "registering"
    CHECKIN = "checkin"
    RUNNING = "running"
    ENDED = "ended"

# Add this new Enum for ranks
class Rank(IntEnum):
    BRONZE = 1
    SILVER = 2
    GOLD = 3
    PLAT = 4
    DIAMOND = 5
    MASTER = 6
    GM = 7
    LEGEND = 8

    @classmethod
    def get_rank_weight(cls, rank_name: str) -> int:
        try:
            return cls[rank_name.upper()].value
        except KeyError:
            return None

class ValidHunter:
    HUNTERS = {
        'brall', 'jin', 'ghost', 'joule', 'myth', 'shiv', 'shrike', 
        'bishop', 'kingpin', 'felix', 'oath', 'elluna', 'zeph', 
        'celeste', 'hudson', 'void', 'beebo'
    }

    @staticmethod
    def normalize_string(s: str) -> str:
        """Remove accents and convert to lowercase"""
        # Normalize to NFKD form and remove diacritics
        normalized = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('ASCII')
        return normalized.lower()

    @classmethod
    def is_valid(cls, hunter: str) -> bool:
        return cls.normalize_string(hunter) in cls.HUNTERS

    @classmethod
    def get_all(cls) -> set:
        return cls.HUNTERS.copy()

class Tournament:
    MAX_PLAYERS = 40
    TEAM_SIZE = 4
    POINTS = {
            1: 15, 2: 12, 3: 10, 4: 8, 5: 6,
            6: 4, 7: 2, 8: 1
        }

    def __init__(self, db_path="tournament.db"):
        self.db_path = db_path
        self.setup_database()
        
        # Generate VALID_RANKS from Rank enum
        self.VALID_RANKS = {r.name.lower(): r.value for r in Rank}

    def setup_database(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # Create tournaments table
        c.execute('''CREATE TABLE IF NOT EXISTS tournaments
                    (id INTEGER PRIMARY KEY,
                     start_date TEXT,
                     end_date TEXT,
                     state TEXT,
                     number_of_games INTEGER DEFAULT 3)''')
        
        # Add team_id to players table
        c.execute('''CREATE TABLE IF NOT EXISTS players
                    (id INTEGER PRIMARY KEY,
                     tournament_id INTEGER,
                     username TEXT,
                     rank TEXT,
                     rank_weight INTEGER,
                     hunters TEXT,
                     is_otp BOOLEAN,
                     team_id INTEGER,
                     state TEXT,
                     FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
                     FOREIGN KEY (team_id) REFERENCES teams (id))''')
        
        # Add queue table
        c.execute('''CREATE TABLE IF NOT EXISTS queue
                    (id INTEGER PRIMARY KEY,
                     tournament_id INTEGER,
                     username TEXT,
                     rank TEXT,
                     rank_weight INTEGER,
                     hunters TEXT,
                     is_otp BOOLEAN,
                     queue_position INTEGER,
                     FOREIGN KEY (tournament_id) REFERENCES tournaments (id))''')
        
        # Add teams table
        c.execute('''CREATE TABLE IF NOT EXISTS teams
                    (id INTEGER PRIMARY KEY,
                     tournament_id INTEGER,
                     team_number INTEGER,
                     average_rank_weight FLOAT,
                     FOREIGN KEY (tournament_id) REFERENCES tournaments (id))''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS match_results
                    (id INTEGER PRIMARY KEY,
                     tournament_id INTEGER,
                     match_id TEXT,
                     placement INTEGER,
                     team_number INTEGER,
                     points INTEGER DEFAULT 0,
                     team_damage INTEGER DEFAULT 0,
                     tanked_damage INTEGER DEFAULT 0,
                     kills INTEGER DEFAULT 0,
                     deaths INTEGER DEFAULT 0,
                     FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
                     UNIQUE(tournament_id, match_id, team_number))''')
        
        conn.commit()
        conn.close()

    def create_tournament(self, start_date, end_date=None, number_of_games=3):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute("SELECT id FROM tournaments WHERE state != ?", (TourneyState.ENDED.value,))
            if c.fetchone():
                return "A tournament is already in progress"

            start_date_str = start_date.strftime("%Y-%m-%d %H:%M:%S")
            end_date_str = end_date.strftime("%Y-%m-%d %H:%M:%S") if end_date else None
            
            c.execute("""INSERT INTO tournaments (start_date, end_date, state, number_of_games) 
                        VALUES (?, ?, ?, ?)""", 
                     (start_date_str, end_date_str, TourneyState.REGISTERING.value, number_of_games))
            conn.commit()
            
            response = f"Tournament created!\nStart: {start_date_str}\nNumber of games: {number_of_games}"
            if end_date_str:
                response += f"\nEnd: {end_date_str}"
            
            return response
        except Exception as e:
            conn.rollback()
            return f"Error creating tournament: {str(e)}"
        finally:
            conn.close()

    def end_tournament(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, msg, None
            
            self.set_tournament_matches(tournament['id'])
            self.set_tournament_state(tournament['id'], TourneyState.ENDED)
            
            conn.commit()
            return True, "Tournament ended!", None
        except Exception as e:
            conn.rollback()
            return False, f"Error ending tournament: {str(e)}", None
        finally:
            conn.close()

    def get_current_tournament(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute("""
                SELECT t.id, t.start_date, t.end_date, t.state, t.number_of_games,
                       COUNT(DISTINCT p.id) as player_count,
                       COUNT(DISTINCT CASE WHEN p.state = 'registered' THEN p.id END) as registered_count,
                       COUNT(DISTINCT q.id) as queue_count,
                       AVG(CASE WHEN p.state = 'registered' THEN p.rank_weight END) as avg_rank
                FROM tournaments t
                LEFT JOIN players p ON p.tournament_id = t.id
                LEFT JOIN queue q ON q.tournament_id = t.id
                WHERE t.state != ?
                GROUP BY t.id
                ORDER BY t.id DESC
                LIMIT 1
            """, (TourneyState.ENDED.value,))
            
            tournament = c.fetchone()
            if not tournament:
                return False, "No tournament currently running", None
            
            # Convert rank weight to rank name
            avg_rank = None
            if tournament[8]:  # avg_rank index
                avg_rank_weight = round(tournament[8])
                rank_names = {v: k for k, v in self.VALID_RANKS.items()}
                avg_rank = rank_names.get(avg_rank_weight, "Unknown")
            
            result = {
                'id': tournament[0],
                'start_date': tournament[1],
                'end_date': tournament[2],
                'state': tournament[3],
                'number_of_games': tournament[4],
                'player_count': tournament[5],
                'registered_count': tournament[6],
                'queue_count': tournament[7],
                'average_rank': avg_rank
            }
            
            return True, "Tournament found", result
        except Exception as e:
            return False, f"Error fetching tournament: {str(e)}", None
        finally:
            conn.close()

    def validate_hunters(self, hunters):
        if not hunters:
            return False, "Pas de chasseur: !register pseudo#XXXX rang chasseur"   
        invalid_hunters = [h for h in hunters if h not in ValidHunter.HUNTERS]
        if len(invalid_hunters) > 0:
            return False, f"Chasseur: {', '.join(invalid_hunters)} invalide\nChasseur disponibles: {', '.join(sorted(ValidHunter.get_all()))}\nSéparé par des espaces\nSi le pseudo à un espace alors écrire entre guillemets, exemple \"unimork#0001\"\nOTP automatique si 1 seul chasseur"
        return True, hunters

    def validate_rank(self, rank):
        rank_lower = rank.lower()
        if rank_lower not in self.VALID_RANKS:
            return False, 0, None
        return True, self.VALID_RANKS[rank_lower], rank_lower

    def register_player(self, username, rank, hunters_entry):
        print(f"register_player: {username} {rank} {hunters_entry}")
        is_valid_rank, rank_weight, normalized_rank = self.validate_rank(rank)
        if not is_valid_rank:
            return False, f"Rang: {rank} invalide.\nRangs disponibles: {', '.join(self.VALID_RANKS.keys())}\nSi le pseudo à un espace alors écrire entre guillemets, exemple \"unimork#0001\"", None

        is_valid_hunters, hunters = self.validate_hunters(hunters_entry)
        if not is_valid_hunters:
            return False, hunters, None
        is_otp = len(hunters) == 1;

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()   
        try:
            # Get current tournament
            c.execute("""
                SELECT id, state 
                FROM tournaments 
                WHERE state != ? 
                ORDER BY id DESC 
                LIMIT 1
            """, (TourneyState.ENDED.value,))
            
            tournament = c.fetchone()
            if not tournament:
                return False, "No tournament running", None
            
            tournament_id, tournament_state = tournament
            
            if tournament_state not in [TourneyState.REGISTERING.value, TourneyState.CHECKIN.value]:
                return False, "Tournament is not in registration phase", None

            # Check if player is already registered or in queue
            c.execute("""SELECT 
                            CASE 
                                WHEN EXISTS (SELECT 1 FROM players WHERE tournament_id = ? AND LOWER(username) = LOWER(?)) THEN 'registered'
                                WHEN EXISTS (SELECT 1 FROM queue WHERE tournament_id = ? AND LOWER(username) = LOWER(?)) THEN 'queued'
                                ELSE 'none'
                            END""", 
                     (tournament_id, username, tournament_id, username))
            status = c.fetchone()[0]
            if status == 'registered':
                return False, "Player already registered", None
            elif status == 'queued':
                return False, "Player already in queue", None

            player_count = self.get_player_count(tournament_id)

            if player_count < self.MAX_PLAYERS:
                # Register player with initial state
                c.execute("""INSERT INTO players 
                            (tournament_id, username, rank, rank_weight, hunters, is_otp, state) 
                            VALUES (?, ?, ?, ?, ?, ?, 'registered')""",
                         (tournament_id, username, normalized_rank, rank_weight, 
                          '/'.join(hunters), is_otp))
                conn.commit()
                otp_status = " (OTP)" if is_otp else ""
                return True, f"Player {username} registered successfully with rank {normalized_rank} and hunters: {', '.join(hunters)}{otp_status}", None
            else:
                # Add to queue
                queue_position = self.get_next_queue_position(tournament_id)
                c.execute("""INSERT INTO queue 
                            (tournament_id, username, rank, rank_weight, hunters, is_otp, queue_position) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)""",
                         (tournament_id, username, normalized_rank, rank_weight, 
                          '/'.join(hunters), is_otp, queue_position))
                conn.commit()
                return True, f"Tournament full! Player {username} added to queue (position {queue_position})", None
        except Exception as e:
            conn.rollback()
            return False, f"Error registering player: {str(e)}", None
        finally:
            conn.close()

    def get_player_count(self, tournament_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM players WHERE tournament_id = ?", (tournament_id,))
        count = c.fetchone()[0]
        conn.close()
        return count

    def get_next_queue_position(self, tournament_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT MAX(queue_position) FROM queue WHERE tournament_id = ?", (tournament_id,))
        max_pos = c.fetchone()[0]
        conn.close()
        return (max_pos or 0) + 1

    def get_players(self, tournament_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute("""
                SELECT 
                    username, rank, hunters, is_otp, state,
                    queue_position,
                    CASE 
                        WHEN state = 'registered' THEN state
                        ELSE NULL
                    END as player_state
                FROM (
                    SELECT username, rank, hunters, is_otp, rank_weight,
                        state, 0 as queue_position
                    FROM players 
                    WHERE tournament_id = ?
                    
                    UNION ALL
                    
                    SELECT username, rank, hunters, is_otp, rank_weight,
                        NULL as state, queue_position
                    FROM queue
                    WHERE tournament_id = ?
                )
                ORDER BY 
                    CASE WHEN state IS NOT NULL THEN 1 ELSE 2 END,
                    username,
                    queue_position DESC
            """, (tournament_id, tournament_id))
            
            players = c.fetchall()
            return True, "Players retrieved successfully", players
        except Exception as e:
            return False, f"Error retrieving players: {str(e)}", None
        finally:
            conn.close()

    def get_registered_players(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, msg, None
            
            c.execute("""
                SELECT username, rank_weight, hunters, is_otp, state
                FROM players 
                WHERE tournament_id = ? AND state = 'registered'
            """, (tournament["id"],))
            
            players = c.fetchall()
            return True, "Registered players retrieved", players
        except Exception as e:
            return False, f"Error retrieving registered players: {str(e)}", None
        finally:
            conn.close()
    
    def get_checked_players(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, msg, None
            
            c.execute("""
                SELECT username, rank_weight, hunters, is_otp, state
                FROM players 
                WHERE tournament_id = ? AND state = 'checked'
            """, (tournament["id"],))
            
            players = c.fetchall()
            return True, "Checked players retrieved", players
        except Exception as e:
            return False, f"Error retrieving checked players: {str(e)}", None
        finally:
            conn.close()

    def set_tournament_state(self, tournament_id, new_state):
        print(f"setting state to {new_state.value}")
        print(f"tournament_id: {tournament_id}")
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute("""
                UPDATE tournaments 
                SET state = ? 
                WHERE id = ?
            """, (new_state.value, tournament_id))
            
            conn.commit()
            return True, f"Tournament state updated to {new_state.value}", None
        except Exception as e:
            conn.rollback()
            return False, f"Error updating tournament state: {str(e)}", None
        finally:
            conn.close()

    def create_balanced_teams(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, "No tournament running", None
            if tournament['state'] != TourneyState.CHECKIN.value:
                return False, "Tournament is not in checkin phase", None
            
            # Get count of all players and checked players
            c.execute("""
                SELECT 
                    COUNT(*) as total_players,
                    SUM(CASE WHEN state = 'checked' THEN 1 ELSE 0 END) as checked_players
                FROM players 
                WHERE tournament_id = ?
            """, (tournament['id'],))
            
            result = c.fetchone()
            total_players, checked_players = result
            
            if total_players == 0:
                return False, "No players registered in the tournament", None
            
            if checked_players < total_players:
                # Get list of unchecked players
                c.execute("""
                    SELECT username 
                    FROM players 
                    WHERE tournament_id = ? AND state != 'checked'
                    ORDER BY username
                """, (tournament['id'],))
                unchecked = [row[0] for row in c.fetchall()]
                return False, f"Not all players are checked in. Waiting for:\n{', '.join(unchecked)}", None
            
            success, msg, players = self.get_checked_players()
            if not success:
                return False, "No players checked", None

            total_players = len(players)
            if total_players < self.MAX_PLAYERS:
                return False, f"Not enough players. Need at least {self.MAX_PLAYERS} players.", None
            player_data = []
            for username, rank_weight, hunters, is_otp, state in players:
                hunters_list = hunters.split('/')
                player_data.append({
                    'username': username,
                    'rank_weight': rank_weight,
                    'hunters': hunters_list,
                    'is_otp': is_otp
                })

            num_teams = total_players // self.TEAM_SIZE

            best_teams = None
            best_variance = float('inf')
            attempts = 100

            def calculate_team_variance(teams):
                team_avgs = [sum(p['rank_weight'] for p in team) / len(team) for team in teams]
                return max(team_avgs) - min(team_avgs)

            for attempt in range(attempts):
                # Create empty teams
                current_teams = [[] for _ in range(num_teams)]
                available_players = player_data.copy()
                random.shuffle(available_players)

                # Distribute players while checking only OTP conflicts
                for player in available_players:
                    placed = False
                    # Try each team in random order
                    team_indices = list(range(num_teams))
                    random.shuffle(team_indices)
                    
                    for team_idx in team_indices:
                        if len(current_teams[team_idx]) >= self.TEAM_SIZE:
                            continue

                        # Check OTP conflicts
                        has_otp_conflict = False
                        if player['is_otp']:
                            for team_player in current_teams[team_idx]:
                                if team_player['is_otp'] and any(h in player['hunters'] for h in team_player['hunters']):
                                    has_otp_conflict = True
                                    break
                        
                        if not has_otp_conflict:
                            current_teams[team_idx].append(player)
                            placed = True
                            break
                    
                    if not placed:
                        # If we couldn't place due to OTP conflicts, just put in first available team
                        for team_idx in range(num_teams):
                            if len(current_teams[team_idx]) < self.TEAM_SIZE:
                                current_teams[team_idx].append(player)
                                break

                # Calculate variance only once all teams are formed
                variance = calculate_team_variance(current_teams)
                
                if variance < best_variance:
                    best_variance = variance
                    best_teams = [team[:] for team in current_teams]
                    print(f"New best variance: {best_variance}")
                attempt += 1

            rank_names = {v: k.lower() for k, v in {r.name: r.value for r in Rank}.items()}
            result = []
            for i, team in enumerate(best_teams, 1):
                team_avg = sum(p['rank_weight'] for p in team) / len(team)
                team_info = {
                    'number': i,
                    'average_rank': rank_names[round(team_avg)],
                    'average_weight': team_avg,
                    'players': [{
                        'username': p['username'],
                        'rank': rank_names[p['rank_weight']],
                        'rank_weight': p['rank_weight'],
                        'hunters': '/'.join(p['hunters']),
                        'is_otp': p['is_otp']
                    } for p in team]
                }
                result.append(team_info)

            return True, "Teams created successfully", result

        except Exception as e:
            print(f"Error creating balanced teams: {str(e)}")
            return False, f"Error creating balanced teams: {str(e)}", None

    def save_teams(self, teams):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, msg, None
            
            # Clear any existing teams for this tournament
            c.execute("UPDATE players SET team_id = NULL WHERE tournament_id = ?", (tournament['id'],))
            c.execute("DELETE FROM teams WHERE tournament_id = ?", (tournament['id'],))

            # Get rank weights for all players
            c.execute("""SELECT username, rank_weight FROM players 
                        WHERE tournament_id = ?""", (tournament["id"],))
            player_weights = dict(c.fetchall())

            # Save new teams
            for team_data in teams:
                team_players = team_data['players']
                avg_weight = sum(player_weights[p['username']] for p in team_players) / len(team_players)
                
                # Insert team
                c.execute("""INSERT INTO teams (tournament_id, team_number, average_rank_weight)
                            VALUES (?, ?, ?)""", 
                         (tournament["id"], team_data['number'], avg_weight))
                team_id = c.lastrowid
                
                # Update player records with team_id
                for player in team_players:
                    c.execute("""UPDATE players 
                               SET team_id = ? 
                               WHERE tournament_id = ? AND username = ?""",
                             (team_id, tournament["id"], player['username']))

            # Update tournament state to RUNNING
            c.execute("""UPDATE tournaments 
                        SET state = ? 
                        WHERE id = ?""", 
                     (TourneyState.RUNNING.value, tournament["id"]))
            
            conn.commit()
            return True, "Teams saved and tournament started", None
            
        except Exception as e:
            conn.rollback()
            return False, f"Error saving teams: {str(e)}", None
        finally:
            conn.close()

    def get_teams(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, msg, None
            
            c.execute("""
                SELECT t.team_number, t.average_rank_weight,
                       p.username, p.rank, p.hunters, p.is_otp
                FROM teams t
                JOIN players p ON p.team_id = t.id
                WHERE t.tournament_id = ?
                ORDER BY t.team_number, p.rank_weight DESC
            """, (tournament['id'],))
            
            rows = c.fetchall()
            if not rows:
                return False, "No teams found", None
            
            teams = {}
            rank_names = {v: k.lower() for k, v in {r.name: r.value for r in Rank}.items()}
            
            for row in rows:
                team_num, avg_weight, username, rank, hunters, is_otp = row
                
                if team_num not in teams:
                    teams[team_num] = {
                        'number': team_num,
                        'average_rank': rank_names[round(avg_weight)],
                        'players': []
                    }
                
                teams[team_num]['players'].append({
                    'username': username,
                    'rank': rank,
                    'hunters': hunters,
                    'is_otp': is_otp
                })
            
            return True, "Teams retrieved successfully", list(teams.values())
            
        except Exception as e:
            return False, f"Error retrieving teams: {str(e)}", None
        finally:
            conn.close()

    def get_player_id(self, username):
        formatted_username = f"{username.replace('#', '-')}"
        print(f"formatted_username: {formatted_username}")
        try:
            response = requests.get(f"https://supervive.io/api/player/{formatted_username}.json")
            if response.status_code == 200:
                data = response.json()
                print(f"data: {data}")
                return data.get('id')
        except Exception as e:
            print(f"Error fetching player ID: {str(e)}")
        return None

    def set_tournament_matches(self, tournament_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute("""
                SELECT t.start_date, t.end_date, t.number_of_games, p.username 
                FROM tournaments t 
                JOIN players p ON t.id = p.tournament_id 
                WHERE t.id = ? 
                LIMIT 1
            """, (tournament_id,))
            
            result = c.fetchone()
            if not result:
                return False, "Tournament not found"
            
            start_date, end_date, number_of_games, username = result
            print(f"start_date: {start_date}, end_date: {end_date}, number_of_games: {number_of_games}, username: {username}")
            try:
                start_timestamp = datetime.fromisoformat(start_date.replace('Z', '+00:00')).timestamp()
            except ValueError:
                try:
                    start_timestamp = datetime.strptime(start_date, "%Y-%m-%d %H:%M:%S").timestamp()
                except ValueError:
                    print(f"Invalid start date format: {start_date}")
                    return False, f"Invalid start date format: {start_date}"
                
            if end_date:
                try:
                    end_timestamp = datetime.fromisoformat(end_date.replace('Z', '+00:00')).timestamp()
                except ValueError:
                    try:
                        end_timestamp = datetime.strptime(end_date, "%Y-%m-%d %H:%M:%S").timestamp()
                    except ValueError:
                        print(f"Invalid end date format: {end_date}")
                        return False, f"Invalid end date format: {end_date}"
            else:
                end_timestamp = datetime.now().timestamp()
            
            #player_id = self.get_player_id(username)
            #if not player_id:
            #    print("player_id not found")
            #    return False, "Could not fetch player ID"
            
            # Get matches
            print(f"yolo: {username}")
            try:
                #player_id = player_id.replace('-', '')
                tournament_matches = []
                current_page = 1
                print(f"number_of_games: {number_of_games}")
                while len(tournament_matches) < number_of_games:
                    print(f"https://supervive.op.gg/api/players/5592bed7a202429999a03d0b30915172/matches?page={current_page}")
                    response = requests.get(f"https://supervive.op.gg/api/players/5592bed7a202429999a03d0b30915172/matches?page={current_page}")
                    if response.status_code != 200:
                        return False, "Could not fetch matches"
                    
                    matches_data = response.json()
                    matches = matches_data.get('data', [])
                    
                    if not matches:
                        break
                    
                    for match in matches:
                        if match.get('queue_id') == "customgame":
                            try:
                                match_time = datetime.fromisoformat(match['match_start'].replace('Z', '+00:00')).timestamp()
                                if start_timestamp <= match_time <= end_timestamp:
                                    print(f"https://supervive.op.gg/api/matches/{match['match_id']}")
                                    match_response = requests.get(f"https://supervive.op.gg/api/matches/{match['match_id']}")
                                    if match_response.status_code == 200:
                                        match_data = match_response.json()
                                        results = self.process_match_data(match_data)
                                        self.save_match_results(tournament_id, match['match_id'], results)
                                        tournament_matches.append(match['match_id'])
                                        if len(tournament_matches) >= number_of_games:
                                            return True, "Matches saved successfully"
                            except (ValueError, KeyError) as e:
                                print(f"Error parsing match: {e}")
                                continue
                    current_page += 1
                
                if tournament_matches:
                    return True, f"Saved {len(tournament_matches)} matches"
                return False, "No matches found in the specified time period"
                
            except Exception as e:
                return False, f"Error fetching matches: {str(e)}"
            
        finally:
            conn.close()
            
    def process_match_data(self, match_data):
        print("processing match data")
        try:
            teams = {}
            for player in match_data:
                try:
                    team_id = player['team_id']
                    if team_id not in teams:
                        teams[team_id] = {
                            'survival_duration': 0,
                            'team_damage': 0,
                            'tanked_damage': 0,
                            'kills': 0,
                            'deaths': 0,
                            'players': []
                        }
                    
                    team = teams[team_id]
                    team['survival_duration'] = max(team['survival_duration'], player.get('survival_duration', 0))
                    team['team_damage'] += player.get('stats', {}).get('HeroDamageDone', 0)
                    team['kills'] += player.get('stats', {}).get('Kills', 0)
                    team['deaths'] += player.get('stats', {}).get('Deaths', 0)
                    team['players'].append(player)

                except KeyError as e:
                    print(f"Error processing player data: {str(e)}")
                    continue

            if not teams:
                raise ValueError("No valid team data found")

            sorted_teams = sorted(teams.items(), key=lambda x: x[1]['survival_duration'], reverse=True)
            
            # Prepare results
            results = []
            for placement, (team_id, team_data) in enumerate(sorted_teams, 1):
                points = self.POINTS.get(placement, 0) + team_data['kills']
                results.append({
                    'team_id': int(team_id) + 1,
                    'points': points,
                    'team_damage': round(team_data['team_damage']),
                    'tanked_damage': round(team_data['tanked_damage']),
                    'kills': team_data['kills'],
                    'deaths': team_data['deaths'],
                    'placement': placement
                })
            return results

        except Exception as e:
            print(f"Error processing match data: {str(e)}")
            exit

    def save_match_results(self, tournament_id: str, match_id: str, results: list):
        print("saving match results")
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            # Sort results by points to determine placement
            sorted_results = sorted(results, key=lambda x: x['points'], reverse=True)
            
            for result in sorted_results:
                c.execute("""
                    REPLACE INTO match_results 
                    (tournament_id, match_id, team_number, placement, points, 
                     team_damage, tanked_damage, kills, deaths)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (tournament_id,
                     match_id,
                     result['team_id'],
                     result['placement'],
                     result['points'],
                     result['team_damage'],
                     result['tanked_damage'],
                     result['kills'],
                     result['deaths'])
                )
            
            conn.commit() 
            
        except Exception as e:
            conn.rollback()
            exit
            return f"Error saving match results: {str(e)}"
        finally:
            conn.close()

    def _get_match_results(self, tournament_id):
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("""
                SELECT team_number, points, team_damage, tanked_damage, 
                       kills, deaths, match_id
                FROM match_results 
                WHERE tournament_id = ?
            """, (tournament_id,))
            return c.fetchall()
        except sqlite3.Error as e:
            print(f"Database error retrieving match results: {str(e)}")
            return None

    def get_tournament_results(self, tournament_id):
        try:
            matches = self._get_match_results(tournament_id)
            if not matches:
                return False, "No matches found for this tournament", None
            
            team_stats = self._compute_team_statistics(matches, tournament_id)
            if not team_stats:
                return False, "No team statistics available", None
            
            return True, "Tournament results retrieved successfully", team_stats
        except Exception as e:
            return False, f"Error retrieving tournament results: {str(e)}", None

    def _compute_team_statistics(self, match_results, tournament_id):   
        team_stats = {}
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            for result in match_results:
                team_number = result[0]
                if team_number not in team_stats:
                    # Get players for this team
                    c.execute("""
                        SELECT p.username, p.rank
                        FROM players p
                        JOIN teams t ON p.team_id = t.id
                        WHERE t.team_number = ? AND p.tournament_id = ?
                    """, (team_number, tournament_id))
                    players = [{'username': row[0], 'rank': row[1]} for row in c.fetchall()]
                    
                    team_stats[team_number] = {
                        'team_number': team_number,
                        'points': 0,
                        'damage_dealt': 0,
                        'damage_taken': 0,
                        'kills': 0,
                        'deaths': 0,
                        'matches': 0,
                        'players': players  # Add players to the stats
                    }
                
                stats = team_stats[team_number]
                stats['points'] += result[1]
                stats['damage_dealt'] += result[2]
                stats['damage_taken'] += result[3]
                stats['kills'] += result[4]
                stats['deaths'] += result[5]
                stats['matches'] += 1

            return list(team_stats.values())
            
        except Exception as e:
            print(f"Error computing team statistics: {str(e)}")
            return None
        finally:
            conn.close()

    def checkin_player(self, username):
        """
        Changes a player's state from registered to checked.
        Returns a tuple (success, message)
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, "No tournament running", None
            
            if tournament['state'] != TourneyState.CHECKIN.value:
                return False, "Tournament is not in check-in phase", None
            
            c.execute("""
                UPDATE players 
                SET state = 'checked' 
                WHERE tournament_id = ? 
                AND LOWER(username) = LOWER(?)
                AND state = 'registered'
                """, (tournament['id'], username))
            
            if c.rowcount == 0:
                c.execute("""
                    SELECT state 
                    FROM players 
                    WHERE tournament_id = ? 
                    AND LOWER(username) = LOWER(?)
                    """, (tournament['id'], username))
                result = c.fetchone()
                
                if not result:
                    return False, f"Player {username} is not registered for this tournament", None
                elif result[0] == 'checked':
                    return False, f"Player {username} is already checked in", None
                else:
                    return False, f"Could not check in player {username}", None
            else:
                conn.commit()
                return True, f"Player {username} has been checked in", None
            
        except Exception as e:
            conn.rollback()
            return False, f"checkin error: {str(e)}", None
        finally:
            conn.close()

    def start_checkin_phase(self):
        success, msg, tournament = self.get_current_tournament()
        if not success:
            return False, "No tournament running", None
        
        if tournament['state'] != TourneyState.REGISTERING.value:
            return False, "Tournament must be in registration phase to start check-ins", None
        
        success, msg, _ = self.set_tournament_state(tournament['id'], TourneyState.CHECKIN)
        if not success:
            return False, msg, None
        
        return True, "Check-in phase has started! Players can now check in.", None

    def swap_players(self, username1, username2):
        """
        Swaps two players between teams.
        Returns a tuple (success, message)
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, "No tournament running", None
            
            if tournament['state'] != TourneyState.RUNNING.value:
                return False, "Teams haven't been created yet", None
            
            # Get team IDs for both players
            c.execute("""
                SELECT username, team_id 
                FROM players 
                WHERE tournament_id = ? 
                AND LOWER(username) IN (LOWER(?), LOWER(?))
            """, (tournament['id'], username1, username2))
            
            players = c.fetchall()
            
            if len(players) != 2:
                missing_players = []
                found_players = {p[0].lower() for p in players}
                if username1.lower() not in found_players:
                    missing_players.append(username1)
                if username2.lower() not in found_players:
                    missing_players.append(username2)
                return False, f"Player(s) not found: {', '.join(missing_players)}", None
            
            # Get current team IDs
            team_id1 = next(p[1] for p in players if p[0].lower() == username1.lower())
            team_id2 = next(p[1] for p in players if p[0].lower() == username2.lower())
            
            # Swap team IDs
            c.execute("""
                UPDATE players 
                SET team_id = CASE
                    WHEN LOWER(username) = LOWER(?) THEN ?
                    WHEN LOWER(username) = LOWER(?) THEN ?
                END
                WHERE tournament_id = ? 
                AND LOWER(username) IN (LOWER(?), LOWER(?))
            """, (username1, team_id2, username2, team_id1, tournament['id'], username1, username2))
            
            # Update team average ranks
            for team_id in (team_id1, team_id2):
                c.execute("""
                    UPDATE teams 
                    SET average_rank_weight = (
                        SELECT AVG(CAST(rank_weight AS FLOAT))
                        FROM players
                        WHERE team_id = ?
                    )
                    WHERE id = ?
                """, (team_id, team_id))
            
            conn.commit()
            return True, f"Successfully swapped {username1} and {username2}", None
            
        except Exception as e:
            conn.rollback()
            return False, f"swap error: {str(e)}", None
        finally:
            conn.close()

    def remove_player(self, username):
        """
        Removes a player from the tournament and their team if assigned.
        Returns a tuple (success, message)
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, "No tournament running", None
            
            # Check if player exists and get their team info
            c.execute("""
                SELECT id, team_id 
                FROM players 
                WHERE tournament_id = ? 
                AND LOWER(username) = LOWER(?)
            """, (tournament['id'], username))
            
            player = c.fetchone()
            if not player:
                # Check if player is in queue
                c.execute("""
                    DELETE FROM queue 
                    WHERE tournament_id = ? 
                    AND LOWER(username) = LOWER(?)
                """, (tournament['id'], username))
                
                if c.rowcount > 0:
                    conn.commit()
                    return True, f"Player {username} removed from queue", None
                return False, f"Player {username} not found in tournament", None
            
            player_id, team_id = player
            
            # Remove player from players table
            c.execute("""
                DELETE FROM players 
                WHERE id = ?
            """, (player_id,))
            
            # If player was in a team, update team's average rank
            if team_id is not None:
                c.execute("""
                    UPDATE teams 
                    SET average_rank_weight = (
                        SELECT AVG(CAST(rank_weight AS FLOAT))
                        FROM players
                        WHERE team_id = ?
                    )
                    WHERE id = ?
                """, (team_id, team_id))
                
                # Check if team is now empty
                c.execute("SELECT COUNT(*) FROM players WHERE team_id = ?", (team_id,))
                if c.fetchone()[0] == 0:
                    c.execute("DELETE FROM teams WHERE id = ?", (team_id,))
            
            # If there are players in queue, move the first one to registered
            if tournament['state'] == TourneyState.REGISTERING.value:
                c.execute("""
                    SELECT username, rank, rank_weight, hunters, is_otp 
                    FROM queue 
                    WHERE tournament_id = ? 
                    ORDER BY queue_position 
                    LIMIT 1
                """, (tournament['id'],))
                
                queued_player = c.fetchone()
                if queued_player:
                    username, rank, rank_weight, hunters, is_otp = queued_player
                    c.execute("""
                        INSERT INTO players (tournament_id, username, rank, rank_weight, hunters, is_otp, state)
                        VALUES (?, ?, ?, ?, ?, ?, 'registered')
                    """, (tournament['id'], username, rank, rank_weight, hunters, is_otp))
                    
                    c.execute("""
                        DELETE FROM queue 
                        WHERE tournament_id = ? 
                        AND LOWER(username) = LOWER(?)
                    """, (tournament['id'], username))
            
            conn.commit()
            return True, f"Player {username} removed from tournament", None
            
        except Exception as e:
            conn.rollback()
            return False, f"remove error: {str(e)}", None
        finally:
            conn.close()

    def promote_from_queue(self, username=None):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, "No tournament running", None
            
            if username:
                c.execute("""
                    SELECT username, rank, rank_weight, hunters, is_otp, queue_position
                    FROM queue 
                    WHERE tournament_id = ? AND LOWER(username) = LOWER(?)
                """, (tournament['id'], username))
            else:
                c.execute("""
                    SELECT username, rank, rank_weight, hunters, is_otp, queue_position
                    FROM queue 
                    WHERE tournament_id = ? 
                    ORDER BY queue_position 
                    LIMIT 1
                """, (tournament['id'],))

            queued_player = c.fetchone()
            if not queued_player:
                return False, "No players in queue", None

            username, rank, rank_weight, hunters, is_otp, queue_position = queued_player
            team_id = None
            team_number = None

            # If tournament is running, find a team with space
            if tournament['state'] == TourneyState.RUNNING.value:
                c.execute("""
                    SELECT t.id, t.team_number, COUNT(p.id) as player_count
                    FROM teams t
                    LEFT JOIN players p ON t.id = p.team_id
                    WHERE t.tournament_id = ?
                    GROUP BY t.id, t.team_number
                    HAVING player_count < ?
                    ORDER BY player_count ASC
                    LIMIT 1
                """, (tournament['id'], self.TEAM_SIZE))
                
                team = c.fetchone()
                print(f"team: {team}")
                if team:
                    team_id = team[0]
                    team_number = team[1]
                else:
                    return False, "No available team spots", None

            # Add player to players table
            initial_state = 'checked' if tournament['state'] == TourneyState.RUNNING.value else 'registered'
            c.execute("""
                INSERT INTO players 
                (tournament_id, username, rank, rank_weight, hunters, is_otp, team_id, state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (tournament['id'], username, rank, rank_weight, hunters, is_otp, team_id, initial_state))

            # Remove from queue
            c.execute("""
                DELETE FROM queue 
                WHERE tournament_id = ? AND LOWER(username) = LOWER(?)
            """, (tournament['id'], username))

            # Update team average rank if assigned to a team
            if team_id:
                c.execute("""
                    UPDATE teams 
                    SET average_rank_weight = (
                        SELECT AVG(CAST(rank_weight AS FLOAT))
                        FROM players
                        WHERE team_id = ?
                    )
                    WHERE id = ?
                """, (team_id, team_id))
                
                message = f"Player {username} promoted from queue and added to Team {team_number}"
            else:
                message = f"Player {username} promoted from queue"

            conn.commit()
            return True, message, team_id is not None

        except Exception as e:
            conn.rollback()
            return False, f"promote error: {str(e)}", None
        finally:
            conn.close()

    def checkall_players(self):
        """
        Checks in all registered players at once.
        Returns tuple (success, message, data)
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            success, msg, tournament = self.get_current_tournament()
            if not success:
                return False, msg, None
            
            if tournament['state'] != TourneyState.CHECKIN.value:
                return False, "Tournament is not in check-in phase", None
            
            c.execute("""
                UPDATE players 
                SET state = 'checked' 
                WHERE tournament_id = ? 
                AND state = 'registered'
            """, (tournament['id'],))
            
            updated_count = c.rowcount
            
            if updated_count == 0:
                return False, "No players to check in", None
            
            conn.commit()
            return True, f"{updated_count} players have been checked in", None
            
        except Exception as e:
            conn.rollback()
            return False, f"checkall error: {str(e)}", None
        finally:
            conn.close()