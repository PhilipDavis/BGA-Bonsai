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
require_once('modules/BonsaiEvents.php');

define('OPT_RULES', 'OPT_RULES');
define('OPT_RULES_STANDARD', 1);
define('OPT_RULES_TOKONOMA', 2);

define('OPT_GOALTILES', 'OPT_GOALTILES');
define('OPT_GOALTILES_YES', 1);
define('OPT_GOALTILES_NO', 2);

define('OPT_SOLO_DIFFICULTY', 'OPT_SOLO_DIFFICULTY');


class Bonsai extends Table implements BonsaiEvents
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

            // Game Options
            "OPT_RULES" => 100,
            "OPT_GOALTILES" => 101,
            "OPT_SOLO_DIFFICULTY" => 102,
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
            'tokonoma' => $this->getOption(OPT_RULES) == OPT_RULES_TOKONOMA,
            'goals' => $this->getOption(OPT_GOALTILES) == OPT_GOALTILES_YES,
        ];

        if ($playerCount === 1)
            $gameOptions['solo'] = intval($this->getOption(OPT_SOLO_DIFFICULTY));

        $bonsai = BonsaiLogic::newGame($playerColorIndices, $gameOptions, $this);
        $this->initializeGameState($bonsai);

        // Must set the first active player
        $this->activeNextPlayer();
    }

    protected function getAllDatas()
    {
        $currentPlayerId = $this->getCurrentPlayerId();
        $bonsai = $this->loadGameState();        
        $result = [
            'data' => $bonsai->getPlayerData($currentPlayerId),
            'scores' => $bonsai->getScores(),
        ];
        if ($this->getBgaEnvironment() == 'studio')
            $result['state'] = $bonsai->toJson();
        return $result;
    }

    //
    // Compute and return the current game progression. The number returned must be
    // an integer beween 0 (the game just started) and 100 (the game is finished).
    //
    function getGameProgression()
    {
        $bonsai = $this->loadGameState();
        $stateBefore = $bonsai->toJson();
        try
        {
            return $bonsai->getGameProgression();
        }
        catch (Throwable $e)
        {
            $refId = uniqid();
            $test = implode(' ', [
                '/***** Exception: ' . $e->getMessage() . ' *****/',
                'public function testGameProgressionRef' . $refId . '() {',
                '    $bonsai = $this->bonsaiFromJson(',
                '        \'' . $stateBefore . '\'',
                '    );',
                '    $bonsai->getGameProgression();',
                '    $this->assertTrue(true);',
                '}',
                '/*' . '**********/',
            ]);
            $this->error($test);
            throw $e;
        }
    }


    //////////////////////////////////////////////////////////////////////////////
    //////////// Database functions
    //////////// 

    protected function initializeGameState(BonsaiLogic $bonsai)
    {
        $json = $bonsai->toJson();
        $this->DbQuery("INSERT INTO game_state (doc) VALUES ('$json')");
    }

    protected function loadGameState()
    {
        $json = '';
        try
        {
            $json = $this->getObjectFromDB("SELECT id, doc FROM game_state LIMIT 1")['doc'];
        }
        catch (Throwable $e)
        {
            $this->error('Failed to read from game_state table: ' . $e->getMessage());
            throw $e;
        }

        if ($json === null)
            throw new Exception('Failed to read game state or value was NULL');        

        try
        {
            return BonsaiLogic::fromJson($json, $this);
        }
        catch (Throwable $e)
        {
            $this->error('Failed to parse game state: ' . $e->getMessage() . PHP_EOL . 'JSON: ' . $json . PHP_EOL);
            throw $e;
        }
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
            throw new BgaVisibleSystemException(clienttranslate("It is not your turn"));

        return $activePlayerId;
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Player actions
//////////// 

    public function action_cultivate($flip, $removeTile, $placeTiles, $renounceGoals, $claimGoals)
    {
        $activePlayerId = $this->validateCaller();

        $bonsai = $this->loadGameState();
        $stateBefore = $bonsai->toJson();
        try
        {
            $bonsai->cultivate($flip, $removeTile, $placeTiles, $renounceGoals, $claimGoals);
        }
        catch (Throwable $e)
        {
            $refId = uniqid();
            $test = implode(' ', [
                '/***** Exception: ' . $e->getMessage() . ' *****/',
                'public function testCultivateRef' . $refId . '() {',
                '    $bonsai = $this->bonsaiFromJson(',
                '        \'' . $stateBefore . '\'',
                '    );',
                '    $playerId = ' . $activePlayerId . ';',
                '    $i = json_decode(\'' . json_encode([
                        'flip' => $flip,
                        'remove' => $removeTile,
                        'place' => $placeTiles,
                        'renounce' => $renounceGoals,
                        'claim' => $claimGoals,
                    ]) . '\');',
                '    $bonsai->cultivate($i->flip, $i->remove, $i->place, $i->renounce, $i->claim);',
                '    $this->assertTrue(true);',
                '}',
                '/*' . '**********/',
            ]);
            $this->error($test);
            throw new BgaVisibleSystemException("Invalid operation; please reload - Ref #" . $refId);
        }

        $this->saveGameState($bonsai);

        $this->gamestate->nextState('endTurn');
    }

    function onPotFlipped($move, $playerId)
    {
        $this->notifyAllPlayers('potFlipped', '', [
            'playerId' => $playerId,
            'm' => $move,
            'preserve' => [ 'playerId', 'm' ],
        ]);
    }

    function onTileRemoved($move, $playerId, $tileTypeId, $x, $y, $score)
    {
        $this->notifyAllPlayers('tileRemoved', clienttranslate('${playerName} removes a tile'), [
            'i18n' => [ '_tile' ],
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            '_tile' => clienttranslate('a tile'),
            'tile' => $tileTypeId,
            'x' => $x,
            'y' => $y,
            'score' => $score,
            'm' => $move,
            'preserve' => [ 'playerId', 'tile', 'x', 'y', 'score', 'm' ],
        ]);
    }

    function onTilesAdded($moveNumber, $playerId, $placeTiles, $score)
    {
        $msg =
            count($placeTiles) == 1
                ? clienttranslate('${playerName} adds ${n} tile: ${_tileType}')
                : clienttranslate('${playerName} adds ${n} tiles: ${_tileType}');

        $logParts = [];
        $args = [];
        $tileTypes = [];
        $i = 1;
        foreach ($placeTiles as $move)
        {
            $argName = 'tile' . strval($i);
            $argValue = BonsaiMats::$ResourceLabels[$move['type']];
            $logParts[] = '${' . $argName . '}';
            $args['i18n'][] = $argName;
            $args[$argName] = $argValue;
            $tileTypes[] = $move['type'];
            $i++;
        }

        $this->notifyAllPlayers('tilesAdded', $msg, [
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            'n' => count($placeTiles),
            '_tileType' => [
                'log' => implode(', ', $logParts),
                'args' => $args,
            ],
            'tileType' =>$tileTypes,
            'tiles' => $placeTiles,
            'score' => $score,
            'm' => $moveNumber,
            'preserve' => [ 'playerId', 'score', 'tiles', 'tileType', 'm' ],
        ]);
    }

    function onGoalRenounced($move, $playerId, $goalId)
    {
        $this->incStat(1, 'goals_renounced', $playerId);

        $goal = BonsaiMats::$GoalTiles[$goalId];

        $this->notifyAllPlayers('goalRenounced', clienttranslate('${playerName} renounces ${_goal}'), [
            'i18n' => [ '_goal' ],
            '_goal' => $goal['log'],
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            'goal' => $goalId,
            'm' => $move,
            'preserve' => [ 'playerId', 'goal', 'm' ],
        ]);
    }

    function onGoalClaimed($move, $playerId, $goalId, $score)
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
            'm' => $move,
            'preserve' => [ 'playerId', 'goal', 'score', 'm' ],
        ]);
    }

    public function action_meditate($flip, $removeTile, $drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles)
    {
        $activePlayerId = $this->validateCaller();

        $bonsai = $this->loadGameState();
        $stateBefore = $bonsai->toJson();
        try
        {
            $bonsai->meditate($flip, $removeTile, $drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);
        }
        catch (Throwable $e)
        {
            $refId = uniqid();
            $test = implode(' ', [
                '/***** Exception: ' . $e->getMessage() . ' *****/',
                'public function testMeditateRef' . $refId . '() {',
                '    $bonsai = $this->bonsaiFromJson(',
                '        \'' . $stateBefore . '\'',
                '    );',
                '    $playerId = ' . $activePlayerId . ';',
                '    $i = json_decode(\'' . json_encode([
                        'flip' => $flip,
                        'remove' => $removeTile,
                        'card' => $drawCardId,
                        'choice' => $woodOrLeaf,
                        'master' => $masterTiles,
                        'place' => $place,
                        'renounce' => $renounce,
                        'claim' => $claim,
                        'discard' => $discardTiles, 
                    ]) . '\');',
                '    $bonsai->meditate($i->flip, $i->remove, $i->card, $i->choice, $i->master, $i->place, $i->renounce, $i->claim, $i->discard);',
                '    $this->assertTrue(true);',
                '}',
                '/*' . '**********/',
            ]);
            $this->error($test);
            throw new BgaVisibleSystemException("Invalid operation; please reload - Ref #" . $refId);
        }

        $this->saveGameState($bonsai);

        $this->gamestate->nextState('endTurn');
    }

    function onCardTaken($move, $playerId, $cardId)
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
            '_cardId' => $card->label,
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'cardId' => $cardId,
            'm' => $move,
            'preserve' => [ 'playerId', 'cardId', 'm' ],
        ]);
    }

    function onCapacityIncreased($playerId, $delta)
    {
        $this->notifyAllPlayers('capacityIncreased', clienttranslate('${playerName} capacity increases by ${delta}'), [
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'delta' => $delta,
            'preserve' => [ 'playerId' ],
        ]);
    }

    function onTilesReceived($move, $playerId, $tileTypes, $slot)
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
            'm' => $move,
            'preserve' => [ 'playerId', 'tileType', 'slot', 'm' ],
        ]);
    }

    function onCardDiscarded($cardId)
    {
        $card = BonsaiMats::$Cards[$cardId];
        $this->notifyAllPlayers('cardDiscarded', '${_cardId} is discarded', [
            'i18n' => [ '_cardId' ],
            '_cardId' => $card->label,
            'cardId' => $cardId,
            'preserve' => [ 'cardId' ],
        ]);
    }

    function onCardRevealed($cardId)
    {
        // We use a null $cardId when there are no cards left.
        // In this case, the client code still needs to animate
        // the shifting of the remaining cards.
        $msg = $cardId ? clienttranslate('${_cardId} is revealed from the deck') : '';
        $card = $cardId ? BonsaiMats::$Cards[$cardId] : null;
        $this->notifyAllPlayers('cardRevealed', $msg, [
            'i18n' => [ '_cardId' ],
            '_cardId' => $card ? $card->label : 0,
            'cardId' => $cardId,
            'preserve' => [ 'cardId' ],
        ]);
    }

    function onLastRound()
    {
        $this->notifyAllPlayers('lastRound', clienttranslate('The draw pile is empty! This is the Last round.'), []);
    }

    function onTilesDiscarded($move, $playerId, $tiles, $inventory)
    {
        $this->incStat(count($tiles), 'tiles_discarded', $playerId);
        
        $this->notifyAllPlayers('tilesDiscarded', clienttranslate('${playerName} discards ${_tileType}'), [
            'i18n' => [ '_tileType' ],
            '_tileType' => clienttranslate('tiles'),
            'playerName' => $this->getPlayerNameById($playerId),
            'playerId' => $playerId,
            'tileType' => $tiles,
            'inventory' => $inventory,
            'm' => $move,
            'preserve' => [ 'playerId', 'tileType', 'inventory', 'm' ],
        ]);
    }

    function onEndTurn($playerId, $score)
    {
        $this->notifyAllPlayers('endTurn', '', [
            'score' => $score,
            'playerId' => $playerId,
            'preserve' => [ 'score', 'playerId' ],
        ]);
    }

    function onGameStart($cardIds)
    {
        $cardsParams = [
            'log' => clienttranslate('${_cardId1}, ${_cardId2}, ${_cardId3}, and ${_cardId4}'),
            'args' => [
                'i18n' => [ '_cardId1', '_cardId2', '_cardId3', '_cardId4' ],
                'preserve' => [ 'cardId1', 'cardId2', 'cardId3', 'cardId4' ],
            ],
        ];

        $i = 1;
        foreach ($cardIds as $cardId)
        {
            $card = BonsaiMats::$Cards[$cardId];
            $cardsParams['args']['_cardId' . strval($i)] = $card->label;
            $cardsParams['args']['cardId' . strval($i)] = $cardId;
            $i++;
        }

        $this->notifyAllPlayers('gameStart', clienttranslate('The board begins with ${cards}'), [
            'i18n' => [ 'cards' ],
            'cards' => $cardsParams,
        ]);
    }

    public function onPlayerStart($playerId, $tiles)
    {
        $logParts = [];
        $args = [];
        $tileTypes = [];
        $i = 1;
        foreach ($tiles as $tileType)
        {
            $argName = 'tile' . strval($i);
            $argValue = BonsaiMats::$ResourceLabels[$tileType];
            $logParts[] = '${' . $argName . '}';
            $args['i18n'][] = $argName;
            $args[$argName] = $argValue;
            $tileTypes[] = $tileType;
            $i++;
        }

        $this->notifyAllPlayers('playerStart', clienttranslate('${playerName} begins with ${_tileType}'), [
            'playerId' => $playerId,
            'playerName' => $this->getPlayerNameById($playerId),
            '_tileType' => [
                'log' => implode(', ', $logParts),
                'args' => $args,
            ],
            'tileType' => $tileTypes,
            'tiles' => $tiles,
            'preserve' => [ 'playerId', 'tiles', 'tileType' ],
        ]);
    }

    public function action_jsError($msg, $url, $line, $userAgent)
    {
        $this->error(implode(PHP_EOL, [
            '##### Client Error #####',
            '- error: ' . $msg,
            '- url: ' . $url,
            '- line: ' . $line,
            '- ua: ' . $userAgent,
            '########################',
        ]));
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Game state actions
////////////

    function stEndTurn()
    {
        $bonsai = $this->loadGameState();

        $bonsai->endTurn();
        
        $this->saveGameState($bonsai);
    }

    function onGameOver($scores, $remainingTiles, $faceDownCards, $wonSoloGame)
    {
        // Update game stats
        foreach ($remainingTiles as $playerId => $tileCount)
            $this->setStat($tileCount, 'tiles_remaining', $playerId);

        // Record the final scores in the database.
        // For a Solo game that is won and multi-
        // player games, record the score as normal.
        // Record a zero for a Solo game that was lost.
        foreach ($scores as $playerId => $score)
        {
            if ($wonSoloGame === false)
                $this->setPlayerScore($playerId, 0);
            else
                $this->setPlayerScore($playerId, $score['total']);
        }

        // Report the final scores to the players
        $this->notifyAllPlayers('finalScore', '', [
            'scores' => $scores,
            'reveal' => $faceDownCards,
            'preserve' => [ 'scores', 'reveal' ],
        ]);

        $this->gamestate->nextState('gameOver');
    }

    function onChangeNextPlayer($playerId)
    {
        $this->giveExtraTime($playerId);
        $this->gamestate->changeActivePlayer($playerId);
        $this->gamestate->nextState('nextTurn');
    }


//////////////////////////////////////////////////////////////////////////////
//////////// Debug functions
////////////

    function debug_setState(string $state) {
        $bonsai = new BonsaiLogic($state);
        $this->saveGameState($bonsai);
    }

    public function loadBugReportSQL(int $reportId, array $studioPlayers): void
    {
        $this->trace('** DEBUG - Loading bug report ' . $reportId);
        
        $prodPlayers = $this->getObjectListFromDb("SELECT `player_id` FROM `player`", true);
        $prodCount = count($prodPlayers);
        $studioCount = count($studioPlayers);
        if ($prodCount != $studioCount) {
            throw new BgaVisibleSystemException("Incorrect player count (bug report has $prodCount players, studio table has $studioCount players)");
        }

        $bonsai = $this->loadGameState();

        // SQL specific to your game
        // For example, reset the current state if it's already game over
        $sql = [
            "UPDATE `global` SET `global_value` = 10 WHERE `global_id` = 1 AND `global_value` = 99"
        ];
        foreach ($prodPlayers as $index => $prodPlayerId) {
            $studioPlayerId = $studioPlayers[$index];
            // SQL common to all games
            $sql[] = "UPDATE `player` SET `player_id` = $studioPlayerId WHERE `player_id` = $prodPlayerId";
            $sql[] = "UPDATE `global` SET `global_value` = $studioPlayerId WHERE `global_value` = $prodPlayerId";
            $sql[] = "UPDATE `stats` SET `stats_player_id` = $studioPlayerId WHERE `stats_player_id` = $prodPlayerId";
            $bonsai->debugSwapPlayers($prodPlayerId, $studioPlayerId);
        }
        foreach ($sql as $q) {
            $this->DbQuery($q);
        }

        $this->saveGameState($bonsai);
    }

    
//////////////////////////////////////////////////////////////////////////////
//////////// Zombie
////////////

    function zombieTurn($state, $activePlayerId)
    {
    	$stateName = $state['name'];

        if ($state['type'] !== "activeplayer")
            throw new feException("Zombie mode not supported at this game state: " . $stateName); // NOI18N


        $bonsai = $this->loadGameState();
    	
        switch ($stateName) {
            case PLAYER_TURN:
                $bonsai->playZombieTurn();
                break;
        }

        $this->saveGameState($bonsai);

        $this->gamestate->nextState('endTurn');
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
