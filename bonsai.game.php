<?php
 /**
  *------
  * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
  * Bonsai implementation : © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
  * 
  * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
  * See http://en.boardgamearena.com/#!doc/Studio for more information.
  * -----
  */

require_once(APP_GAMEMODULE_PATH.'module/table/table.game.php');
require_once('modules/BonsaiLogic.php');

define('OPT_RULES', 'OPT_RULES');
define('OPT_RULES_STANDARD', 1);
define('OPT_RULES_TOKONOMA', 2);

define('OPT_GOALTILES', 'OPT_GOALTILES');
define('OPT_GOALTILES_YES', 1);
define('OPT_GOALTILES_NO', 2);


class Bonsai extends Table
{
	function __construct()
	{
        // Your global variables labels:
        //  Here, you can assign labels to global variables you are using for this game.
        //  You can use any number of global variables with IDs between 10 and 99.
        //  If your game has options (variants), you also have to associate here a label to
        //  the corresponding ID in gameoptions.inc.php.
        // Note: afterwards, you can get/set the global variables with getGameStateValue/setGameStateInitialValue/setGameStateValue
        parent::__construct();
        
        $this->initGameStateLabels([
            // Game State
            "goalTypes" => 10,
            "gameTurn" => 11,

            // Game Options
            "OPT_RULES" => 100,
            "OPT_GOALTILES" => 101,
        ]);
	}
	
    protected function getGameName()
    {
		// Used for translations and stuff. Please do not modify.
        return "bonsai";
    }	

    protected function getOption($option)
    {
        return $this->getGameStateValue($option);
    }

    protected function setupNewGame($players, $options = [])
    {    
        // Set the colors of the players with HTML color code
        // The default below is red/green/blue/orange/brown
        // The number of colors defined here must correspond to the maximum number of players allowed for the gams
        $gameinfo = $this->getGameinfos();
        $defaultColors = $gameinfo['player_colors'];

        /* KILL: how to get the player order?
        // Choose random starting order
        $playerInitialOrder = array_keys($players);
        shuffle($playerInitialOrder);
		$playerInitialOrder = array_flip($playerInitialOrder);
        */

        // Create players
        $sql = "INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar) VALUES ";
        $values = [];
        foreach ($players as $playerId => $player)
        {
            $color = array_shift($defaultColors);
            $values[] = "(" .
                "'" . $playerId . "'" .
                ", '$color'" .
                ",'" . $player['player_canal'] ."'" .
                ",'" . addslashes($player['player_name']) . "'" .
                ",'" . addslashes($player['player_avatar']) . "'" .
            ")";
        }
        $sql .= implode(',', $values);
        $this->DbQuery($sql);
        $this->reattributeColorsBasedOnPreferences($players, $gameinfo['player_colors']);
        $this->reloadPlayersBasicInfos();
        
        $playerIds = array_keys($players);
        $playerCount = count($playerIds);
        $playerColors = $this->getCollectionFromDB("SELECT player_id, player_color FROM player", true);
        $playerColorIndices = array_map(fn($color) => array_search($color, $gameinfo['player_colors']), $playerColors);

        // In case of a tie, the winner is the tied player who took their first turn last
        $this->DbQuery("UPDATE player SET player_score_aux = player_no"); // TODO: this is wrong... this is table join order, not player order
        
        /************ Start the game initialization *****/

        $this->setGameStateInitialValue('gameTurn', 1);
        
        // Init game statistics
        $this->initStat('player', 'wood_tiles', 0);
        $this->initStat('player', 'leaf_tiles', 0);
        $this->initStat('player', 'flower_tiles', 0);
        $this->initStat('player', 'fruit_tiles', 0);
        $this->initStat('player', 'tool_cards', 0);
        $this->initStat('player', 'growth_cards', 0);
        $this->initStat('player', 'master_cards', 0);
        $this->initStat('player', 'helper_cards', 0);
        $this->initStat('player', 'parchment_cards', 0);
        $this->initStat('player', 'goals_claimed', 0);
        $this->initStat('player', 'goals_renounced', 0);
        $this->initStat('player', 'tiles_discarded', 0);
        $this->initStat('player', 'tiles_remaining', 0);


        $gameOptions = [
            'tokonomaVariant' => $this->getOption(OPT_RULES) == OPT_RULES_TOKONOMA,
            'goalTiles' => $this->getOption(OPT_GOALTILES) == OPT_GOALTILES_YES,
        ];

        $bonsai = BonsaiLogic::newGame($playerColorIndices, $gameOptions);
        $this->initializeGameState($bonsai);

        // Must set the first active player
        $this->activeNextPlayer();
    }

    protected function getAllDatas()
    {
        $currentPlayerId = $this->getCurrentPlayerId();
        $bonsai = $this->loadGameState();        
        return [
            'data' => $bonsai->getPlayerData($currentPlayerId),
            'scores' => $bonsai->getScores(),
        ];
    }

    //
    // Compute and return the current game progression. The number returned must be
    // an integer beween 0 (the game just started) and 100 (the game is finished).
    //
    function getGameProgression()
    {
        $bonsai = $this->loadGameState();
        return $bonsai->getGameProgression();
    }


    //////////////////////////////////////////////////////////////////////////////
    //////////// Database functions
    //////////// 

    protected function initializeGameState(BonsaiLogic $bonsai)
    {
        $json = $bonsai->toJson();
        $this->DbQuery("INSERT INTO game_state (doc) VALUES ('$json')");
    }

    protected function loadGameState(array $events = [])
    {
        $json = $this->getObjectFromDB("SELECT id, doc FROM game_state LIMIT 1")['doc'];
        $bonsai = BonsaiLogic::fromJson($json);

        // TODO: wire up automatically using reflection
        foreach ($events as $eventName)
            $bonsai->on($eventName, [ $this, 'notify_' . $eventName ]);

        return $bonsai;
    }

    protected function saveGameState(BonsaiLogic $bonsai)
    {
        $json = $bonsai->toJson();
        $this->DbQuery("UPDATE game_state SET doc = '$json'");
    }

    protected function setPlayerScore($playerId, $score)
    {
        $this->DbQuery(<<<SQL
            UPDATE player
            SET player_score = '$score'
            WHERE player_id = '$playerId'
        SQL);
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Utility functions
//////////// 

    protected function validateCaller()
    {
        // Get the function name of the caller -- https://stackoverflow.com/a/11238046
        $fnName = debug_backtrace(!DEBUG_BACKTRACE_PROVIDE_OBJECT | DEBUG_BACKTRACE_IGNORE_ARGS, 2)[1]['function'];
        $actionName = explode('_', $fnName)[1];
        $this->checkAction($actionName);

        // Active player is whose turn it is
        $activePlayerId = $this->getActivePlayerId();

        // Current player is who made the AJAX call to us
        $currentPlayerId = $this->getCurrentPlayerId();

        // Bail out if the current player is not the active player
        if ($activePlayerId != $currentPlayerId)
            throw new BgaVisibleSystemException($this->_("It is not your turn"));

        return $activePlayerId;
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Player actions
//////////// 

    public function action_cultivate($removeTiles, $placeTiles, $renounceGoals, $claimGoals)
    {
        $activePlayerId = $this->validateCaller();

        $bonsai = $this->loadGameState([ 'tileRemoved', 'tilesAdded', 'goalRenounced', 'goalClaimed' ]);
        $stateBefore = $bonsai->toJson();
        try
        {
            $score = $bonsai->cultivate($removeTiles, $placeTiles, $renounceGoals, $claimGoals);
            $this->setPlayerScore($activePlayerId, $score);
        }
        catch (Throwable $e)
        {
            $refId = uniqid();
            $this->trace(implode(', ', [
                'Ref #' . $refId . ': cultivate failed',
                'player: ' . $activePlayerId,
                'inputs: ' . json_encode([ $removeTiles, $placeTiles, $renounceGoals, $claimGoals ]),
                'state: ' . $stateBefore,
                'ex:' . $e,
            ]));
            throw new BgaVisibleSystemException("Invalid operation - Ref #" . $refId); // NOI18N
        }

        $this->saveGameState($bonsai);

        $this->gamestate->nextState('endTurn');
    }

    function notify_tileRemoved($playerId, $tileId, $x, $y, $score)
    {
        $this->notifyAllPlayers('tileRemoved', clienttranslate('${playerName} removes a tile'), [
            'i18n' => [ '_tile' ],
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            '_tile' => _('a tile'),
            'tile' => $tileId,
            'x' => $x,
            'y' => $y,
            'score' => $score,
            'preserve' => [ 'playerId', 'tile', 'x', 'y', 'score' ],
        ]);
    }

    function notify_tilesAdded($playerId, $placeTiles, $score)
    {
        // TODO: stats

        $msg =
            count($placeTiles) == 1
                ? clienttranslate('${playerName} adds ${n} tile')
                : clienttranslate('${playerName} adds ${n} tiles');

        $this->notifyAllPlayers('tilesAdded', $msg, [
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            'n' => count($placeTiles),
            'tiles' => $placeTiles,
            'score' => $score,
            'preserve' => [ 'playerId', 'tiles', 'score' ],
        ]);
    }

    function notify_goalRenounced($playerId, $goalId)
    {
        $this->incStat(1, 'goals_renounced', $playerId);

        $goal = BonsaiMats::$GoalTiles[$goalId];

        $this->notifyAllPlayers('goalRenounced', clienttranslate('${playerName} renounces ${_goal}'), [
            'i18n' => [ '_goal' ],
            '_goal' => $goal['log'],
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            'goal' => $goalId,
            'preserve' => [ 'playerId', 'goal' ],
        ]);
    }

    function notify_goalClaimed($playerId, $goalId, $score)
    {
        $this->incStat(1, 'goals_claimed', $playerId);

        $goal = BonsaiMats::$GoalTiles[$goalId];

        $this->notifyAllPlayers('goalClaimed', clienttranslate('${playerName} claims ${_goal}'), [
            'i18n' => [ '_goal' ],
            '_goal' => $goal['log'],
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            'goal' => $goalId,
            'score' => $score,
            'preserve' => [ 'playerId', 'goal', 'score' ],
        ]);
    }

    public function action_meditate($drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles)
    {
        $activePlayerId = $this->validateCaller();

        $bonsai = $this->loadGameState([ 'cardTaken', 'capacityIncreased', 'tilesReceived', 'tilesAdded', 'tilesDiscarded', 'cardRevealed', 'lastRound' ]);
        $stateBefore = $bonsai->toJson();
        try
        {
            $score = $bonsai->meditate($drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);
            $this->setPlayerScore($activePlayerId, $score);
        }
        catch (Throwable $e)
        {
            $refId = uniqid();
            $this->trace(implode(', ', [
                'Ref #' . $refId . ': meditate failed',
                'player: ' . $activePlayerId,
                'inputs: ' . json_encode([ $drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles ]),
                'state: ' . $stateBefore,
                'ex:' . $e,
            ]));
            throw new BgaVisibleSystemException("Invalid operation - Ref #" . $refId); // NOI18N
        }

        $this->saveGameState($bonsai);

        $this->gamestate->nextState('endTurn');
    }

    function notify_cardTaken($playerId, $cardId)
    {
        $card = BonsaiMats::$Cards[$cardId];
        switch ($card->type)
        {
            case CARDTYPE_TOOL:
                $this->incStat(1, 'tool_cards', $playerId);
                break;
            case CARDTYPE_GROWTH:
                $this->incStat(1, 'growth_cards', $playerId);
                break;
            case CARDTYPE_MASTER:
                $this->incStat(1, 'master_cards', $playerId);
                break;
            case CARDTYPE_HELPER:
                $this->incStat(1, 'helper_cards', $playerId);
                break;
            case CARDTYPE_PARCHMENT:
                $this->incStat(1, 'parchment_cards', $playerId);
                break;
        }

        $this->notifyAllPlayers('cardTaken', clienttranslate('${playerName} draws ${_cardId}'), [
            'i18n' => [ '_cardId' ],
            '_cardId' => clienttranslate('a card'), // TODO? improve the details?
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'cardId' => $cardId,
            'preserve' => [ 'playerId', 'cardId' ],
        ]);
    }

    function notify_capacityIncreased($playerId, $delta)
    {
        $this->notifyAllPlayers('capacityIncreased', clienttranslate('${playerName} capacity increases by ${delta}'), [
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'delta' => $delta,
            'preserve' => [ 'playerId' ],
        ]);
    }

    function notify_tilesReceived($playerId, $tileTypes, $slot)
    {
        foreach ($tileTypes as $tileType)
        {
            switch ($tileType)
            {
                case TILETYPE_WOOD:
                    $this->incStat(1, 'wood_tiles', $playerId);
                    break;
                case TILETYPE_LEAF:
                    $this->incStat(1, 'leaf_tiles', $playerId);
                    break;
                case TILETYPE_FLOWER:
                    $this->incStat(1, 'flower_tiles', $playerId);
                    break;
                case TILETYPE_FRUIT:
                    $this->incStat(1, 'fruit_tiles', $playerId);
                    break;
            }
        }
        
        $this->notifyAllPlayers('tilesReceived', clienttranslate('${playerName} receives ${_tileType}'), [
            'i18n' => [ '_tileType' ],
            '_tileType' => clienttranslate('tiles'),
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'tileType' => $tileTypes,
            'slot' => $slot,
            'preserve' => [ 'playerId', 'tileType', 'slot' ],
        ]);
    }

    function notify_cardRevealed($cardId)
    {
        // We use a null $cardId when there are no cards left.
        // In this case, the client code still needs to animate
        // the shifting of the remaining cards.
        $msg = $cardId ? clienttranslate('The next card is ${_cardId}') : '';
        $this->notifyAllPlayers('cardRevealed', $msg, [
            'i18n' => [ '_cardId' ],
            '_cardId' => clienttranslate('a card'), // TODO: description of the card
            'cardId' => $cardId,
            'preserve' => [ 'cardId' ],
        ]);
    }

    function notify_lastRound()
    {
        $this->notifyAllPlayers('lastRound', clienttranslate('The draw pile is empty! This is the Last round.'), []);
    }

    function notify_tilesDiscarded($playerId, $tiles)
    {
        $this->incStat(count($tiles), 'tiles_discarded', $playerId);
        
        $this->notifyAllPlayers('tilesDiscarded', clienttranslate('${playerName} discards ${_tileType}'), [
            'i18n' => [ '_tileType' ],
            '_tileType' => clienttranslate('tiles'),
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'tileType' => $tiles,
            'preserve' => [ 'playerId', 'tileType' ],
        ]);
    }

    
//////////////////////////////////////////////////////////////////////////////
//////////// Game state arguments
////////////

    /*
        Here, you can create methods defined as "game state arguments" (see "args" property in states.inc.php).
        These methods function is to return some additional information that is specific to the current
        game state.
    */


//////////////////////////////////////////////////////////////////////////////
//////////// Game state actions
////////////

    function stEndTurn()
    {
        $gameTurn = $this->getGameStateValue('gameTurn');
        $this->setGameStateValue('gameTurn', $gameTurn + 1);

        $bonsai = $this->loadGameState();
        if ($bonsai->getGameProgression() >= 100)
        {
            // Update game stats
            foreach ($bonsai->getRemainingTileCounts() as $playerId => $tileCount)
                $this->setStat($tileCount, 'tiles_remaining', $playerId);

            // Record the final scores in the database
            $scores = $bonsai->getScores();
            foreach ($scores as $playerId => $score)
                $this->setPlayerScore($playerId, $score['total']);

            // Report the final scores to the players
            $this->notifyAllPlayers('finalScore', '', [
                'scores' => $scores,
                'reveal' => $bonsai->getFaceDownCards(),
                'preserve' => [ 'scores', 'reveal' ],
            ]);

            $this->gamestate->nextState('gameOver');
            return;
        }

        $this->giveExtraTime($this->getCurrentPlayerId());
        $this->activeNextPlayer();
        $this->gamestate->nextState('nextTurn');
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Debug functions
////////////

    function debug_setState(string $state) {
        $bonsai = new BonsaiLogic($state);
        $this->saveGameState($bonsai);
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Zombie
////////////

    function zombieTurn($state, $active_player)
    {
    	$stateName = $state['name'];

        // TODO: note, for now there is no zombie mode
//        if ($state['type'] !== "activeplayer")
            throw new feException("Zombie mode not supported at this game state: " . $stateName); // NOI18N


        $bonsai = $this->loadGameState();
    	
        switch ($stateName) {
            case PLAYER_TURN:
                // Coin toss between taking a card or placing tiles
                if (random_int(0, 1))
                {
                    // TODO: draw a card... but what about the choices?...
                }
                else
                {
                    // Randomly choose a legal tile placement
                    /* TODO: implement legal move logic on server side
                    $legalMoves = $bonsai->getLegalMoves();
                    shuffle($legalMoves);
                    $move = array_pop($legalMoves);
                    */
                }
                break;
        }
    }
    
///////////////////////////////////////////////////////////////////////////////////:
////////// DB upgrade
//////////

    /*
        upgradeTableDb:
        
        You don't have to care about this until your game has been published on BGA.
        Once your game is on BGA, this method is called everytime the system detects a game running with your old
        Database scheme.
        In this case, if you change your Database scheme, you just have to apply the needed changes in order to
        update the game database and allow the game to continue to run with your new version.
    
    */
    
    function upgradeTableDb($from_version)
    {
        // UNUSED
    }    
}
