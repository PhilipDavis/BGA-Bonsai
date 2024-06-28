<?php
// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

require_once('BonsaiMats.php');
require_once('EventEmitter.php');

// These colour indices correspond to the gameinfos->player_color field
define('BON_PLAYER_GREY', 0);
define('BON_PLAYER_RED', 1);
define('BON_PLAYER_BLUE', 2);
define('BON_PLAYER_PURPLE', 3);

define('DIR_TOP_RIGHT', 0);
define('DIR_RIGHT', 1);
define('DIR_BOTTOM_RIGHT', 2);
define('DIR_BOTTOM_LEFT', 3);
define('DIR_LEFT', 4);
define('DIR_TOP_LEFT', 5);


class BonsaiLogic extends EventEmitter
{
    private $data;

    private function __construct($data)
    {
        $this->data = $data;
    }

    static function fromJson($json)
    {
        return new BonsaiLogic(json_decode($json));
    }


    //
    // Setup Methods
    //

    static function newGame($playerColors, $options)
    {
        // Note: $playerColors is Record<PlayerId, ColorIndex>

        $playerIds = array_keys($playerColors);
        $playerCount = count($playerColors);

        // Set up each player with their color and starting tiles
        $players = (object)[];
        foreach ($playerColors as $playerId => $colorIndex)
        {
            $players->$playerId = (object)[
                'inventory' => (object)[
                    'wood' => 0,
                    'leaf' => 0,
                    'flower' => 0,
                    'fruit' => 0,
                ],
                'color' => $colorIndex,
                'capacity' => 5,
                'canPlay' => (object)[
                    'wood' => 1,
                    'leaf' => 1,
                    'flower' => 0,
                    'fruit' => 0,
                    'wild' => 1,
                ],
                'mirrored' => false, // TODO: allow players to flip the pot
                'played' => (array)[],
                'faceUp' => [], // Face-up cards that have been collected
                'faceDown' => [], // Face-down cards that have been collected
                'claimed' => [], // Goal IDs claimed
                'renounced' => [], // Goal IDs renounced
            ];
        }

        // Step A: Place board in middle of the table
        // Step B: Place bonsai tiles within reach of all players
        BonsaiLogic::setupStepC($players, $options['goalTiles'], $goalTiles);
        BonsaiLogic::setupStepD($players, $options['tokonomaVariant'], $drawPile, $board);
        BonsaiLogic::setupStepE($players);
        BonsaiLogic::setupStepF($playerIds, $players);
        // Step G: Keep the Scoring Pad handy

        return new BonsaiLogic((object)[
            'version' => 1, // Only need to increment for breaking changes after beta release
            'options' => (array)$options,
            'order' => $playerIds,
            'nextPlayer' => 0,
            'players' => $players,
            'drawPile' => $drawPile,
            'board' => $board,
            'goalTiles' => $goalTiles,
            'finalTurns' => null, // Once draw pile is exhausted, this counts down from <# of players> to 0
        ]);
    }

    static function setupStepC($players, $useGoalTiles, &$goalTiles)
    {
        // Choose three colours at random and place the three goal tiles
        // of those colours beside the player board. Leave the unselected
        // tiles in the box. With only 1 or 2 players, use only two tiles
        // per colour (discard the middle one)
        // You may decide not to use goals for inexperienced players.

        $selectedGoalTileTypes = [];
        if ($useGoalTiles)
        {
            $goalTileTypes = array_values(BonsaiMats::$GoalTileTypes);
            shuffle($goalTileTypes);

            array_push($selectedGoalTileTypes, array_shift($goalTileTypes));
            array_push($selectedGoalTileTypes, array_shift($goalTileTypes));
            array_push($selectedGoalTileTypes, array_shift($goalTileTypes));
        }

        $goalTiles = [];
        foreach (BonsaiMats::$GoalTiles as $goalTileId => $goalTile)
        {
            if (array_search($goalTile['type'], $selectedGoalTileTypes) === false)
                continue;
            if (count((array)$players) <= 2 && $goalTile['size'] == GOALSIZE_MEDIUM)
                continue;
            $goalTiles[] = $goalTileId;
        }

        if ($useGoalTiles && count($goalTiles) < 6) {
            throw new Exception('Not enough goals selected: ' . json_encode($selectedGoalTileTypes));
        }
    }

    static function setupStepD($players, $tokonomaVariant, &$cards, &$board)
    {
        // Prepare the deck of Zen cards with:
        // 4 players: use all the cards
        // 3 players: remove the cards for 4 players
        // 2 players: remove the cards for 3 and 4 players
        // Shuffle the deck and place it face down on the board in the
        // leftmost space, where a temple is depicted. Draw the top 4
        // cards and place them face up in the spaces of the board.

        $playerCount = count((array)$players);
        $cards = array_keys(array_filter(BonsaiMats::$Cards, fn($card) => $playerCount > $card->minPlayers));

        shuffle($cards);

        if ($tokonomaVariant)
            BonsaiLogic::setupStepD_Tokonoma($cards);

        // Draw top four cards into the slots
        $board = array_splice($cards, 0, 4);
    }

    static function setupStepD_Tokonoma(&$cards)
    {
        // Game Variant: Tokonoma
        // After a few games, you may try this game variant which offers a more
        // controlled experience by putting all Parchment cards in the first half of the
        // deck, encouraging players to concentrate on these cards.
        // Once you have adjusted the deck depending on the number of players, take
        // out all Parchment cards, shuffle half of the remaining deck and put it on
        // the board. Then take the remaining half of the deck and shuffle it together
        // with the Parchment cards. Finally, put this pile of cards on top of the ones
        // on the board. The game plays as usual.

        // Set aside the Parchment cards
        $parchmentCards = array_filter($cards, fn($cardId) => BonsaiMats::$Cards[$cardId]->type == CARDTYPE_PARCHMENT);
        $otherCards = array_filter($cards, fn($cardId) => BonsaiMats::$Cards[$cardId]->type != CARDTYPE_PARCHMENT);

        // Put half the deck into the temporary pile with the Parchment cards
        $halfDeckCount = round(count($otherCards) / 2);
        $cards = [
            ...$parchmentCards,
            ...array_splice($otherCards, 0, $halfDeckCount),
        ];
        shuffle($cards);

        // Add the remaining other cards to the bottom of the draw pile
        $cards = array_merge($cards, $otherCards);
    }

    static function setupStepE($players)
    {
        // Each player receives a Pot tile of their chosen color, a matching Seishi
        // starting tile, and a Summary card, which they place in front of them. Leave
        // unassigned Pot and Seishi tiles as well as unused Summary cards in the box,
        // as they will not be used.

        foreach ($players as $playerId => $player)
            $player->played[] = (array)[ TILETYPE_WOOD, 0, 0, 0 ];
    }

    static function setupStepF($playerIds, $players)
    {
        // The first player is the oldest player. Starting with the first player and
        // proceeding clockwise, each player takes from the common supply the bonsai
        // tiles shown in the following table. Keep these tiles in your personal supply.
        // 1st - 1 wood
        // 2nd - 1 wood, 1 leaf
        // 3rd - 1 wood, 1 leaf, 1 flower
        // 4th - 1 wood, 1 leaf, 1 flower, 1 fruit

        for ($i = 0; $i < count($playerIds); $i++)
        {
            $playerId = $playerIds[$i];
            $player = $players->$playerId;
            $player->inventory->wood++;
            if ($i >= 1) $player->inventory->leaf++;
            if ($i >= 2) $player->inventory->flower++;
            if ($i >= 3) $player->inventory->fruit++;
        }
    }


    //
    // Cultivation Methods
    //

    function cultivate($removeTiles, $placeTiles, $renounceGoals, $claimGoals)
    {
        // In end game, reduce the number of final turns left
        if (isset($this->data->finalTurns))
            $this->data->finalTurns--;

        $this->removeTiles($removeTiles);
        $this->placeTiles($placeTiles);
        $this->renounceGoals($renounceGoals);
        $this->claimGoals($claimGoals);

        $score = $this->getPlayerScore($this->getNextPlayerId())['total'];
        $this->data->nextPlayer = ($this->data->nextPlayer + 1) % count($this->data->order);

        return $score;
    }

    function removeTiles($removeTiles)
    {
        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;

        // Note: manual says this is improbable... so can leave the logic for later
        foreach ($removeTiles as $tile)
        {
            $x = $tile[0];
            $y = $tile[1];

            // Does this tile exist in the player tree?
            if (count(array_filter($player->played, fn($move) => $move[1] == $x && $move[2] == $y)) < 1)
                throw new BgaVisibleSystemException('Invalid removal');

            // TODO: only allowed to remove a certain type of tile?
            // TODO: is it valid to remove this tile? (e.g. all parts of tree are still connected to the base)
            
            // TODO: Remove the tile

            $this->emit('tileRemoved', [
                'playerId' => $playerId,
                'x' => $x,
                'y' => $y,
                'score' => $this->getPlayerScore($playerId)['total'],
            ]);
        }
    }

    function placeTiles($placeTiles)
    {
        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;
        $canPlay = json_decode(json_encode($player->canPlay));
        $inventory = $player->inventory;

        foreach ($placeTiles as $tile)
        {
            $type = $tile['type'];
            $x = $tile['x'];
            $y = $tile['y'];
            $r = $tile['r'];

            // Does the player own this tile type? Reduce the counter by 1
            $typeName = BonsaiMats::$TileTypes[$type]['name'];
            if ($inventory->$typeName < 1)
                throw new Exception('Player does not have enough ' . $typeName);
            $inventory->$typeName--;

            // Does the player's Seishi allow this tile type to be played?
            if ($canPlay->$typeName > 0)
                $canPlay->$typeName--;

            // Otherwise, does the player have wild card room left?
            else if ($canPlay->wild > 0)
                $canPlay->wild--;
            else
                throw new Exception('Invalid placement; overplayed');

            // TODO: Is it valid to place this tile at the given location?

            // Add the tile into the tree
            $this->data->players->$playerId->played[] = [ $type, $x, $y, $r ];
        }

        if (count($placeTiles))
        {
            $this->emit('tilesAdded', [
                'playerId' => $playerId,
                'placeTiles' => $placeTiles,
                'score' => $this->getPlayerScore($playerId)['total'],
            ]);
        }
    }

    function renounceGoals($renounceGoals)
    {
        $playerId = $this->getNextPlayerId();

        foreach ($renounceGoals as $goalId)
        {
            // Is this goal still available?
            if (array_search($goalId, $this->data->goalTiles) === false)
                throw new Exception('Goal not available');

            // Is it valid for the player to renounce this goal? (i.e. not claimed and not renounced)
            if (array_search($goalId, $this->data->players->$playerId->renounced))
                throw new Exception('Goal already renounced');
            if (array_search($goalId, $this->data->players->$playerId->claimed))
                throw new Exception('Goal already claimed');

            // Mark the goal as renounced
            $this->data->players->$playerId->renounced[] = $goalId;

            $this->emit('goalRenounced', [
                'playerId' => $playerId,
                'goalId' => $goalId,
            ]);
        }
    }

    function claimGoals($claimGoals)
    {
        $playerId = $this->getNextPlayerId();

        foreach ($claimGoals as $goalId)
        {
            // Is this goal still available?
            if (array_search($goalId, $this->data->goalTiles) === false)
                throw new Exception('Goal not available');

            // TODO: has the player already claimed a goal of the same colour?

            // Has the player already renounced this goal?
            if (array_search($goalId, $this->data->players->$playerId->renounced))
                throw new Exception('Goal already renounced');

            // Mark the goal as claimed
            $this->data->players->$playerId->claimed[] = $goalId;
            $this->data->goalTiles = array_values(array_filter($this->data->goalTiles, fn($g) => $g != $goalId));

            $this->emit('goalClaimed', [
                'playerId' => $playerId,
                'goalId' => $goalId,
                'score' => $this->getPlayerScore($playerId)['total'],
            ]);
        }
    }


    //
    // Meditation Methods
    //

    function meditate($drawCardId, $woodOrLeaf, $masterTiles, $placeTiles, $renounceGoals, $claimGoals, $discardTiles)
    {
        // In end game, reduce the number of final turns left
        if ($this->data->finalTurns !== null)
            $this->data->finalTurns--;

        $this->drawCardAndTiles($drawCardId, $woodOrLeaf, $masterTiles);
        $this->placeTiles($placeTiles);
        $this->renounceGoals($renounceGoals);
        $this->claimGoals($claimGoals);
        $this->discardTiles($discardTiles);

        $score = $this->getPlayerScore($this->getNextPlayerId())['total'];
        $this->data->nextPlayer = ($this->data->nextPlayer + 1) % count($this->data->order);

        return $score;
    }

    function drawCardAndTiles($drawCardId, $woodOrLeaf, $masterTiles)
    {
        $playerId = $this->getNextPlayerId();

        // Does the card exist in the available board slots?
        $index = array_search($drawCardId, $this->data->board); 
        if ($index === false)
            throw new Exception('Card unavailable');

        $card = BonsaiMats::$Cards[$drawCardId];

        if (count($masterTiles) && $card->type !== CARDTYPE_MASTER)
            throw new Exception('Not a Master card');
        else if ($card->type === CARDTYPE_MASTER)
        {
            if (count($masterTiles) !== count(array_filter($card->resources, fn($tt) => $tt === TILETYPE_WILD)))
                throw new Exception('Wrong count of wild resources');
        }

        //
        // Give the card to the player
        //
        $this->emit('cardTaken', [ $playerId, $drawCardId ]);
        switch ($card->type)
        {
            case CARDTYPE_TOOL:
                $this->data->players->$playerId->faceUp[] = $drawCardId;
                $this->data->players->$playerId->capacity += $card->capacity;
                $this->emit('capacityIncreased', [ $playerId, $card->capacity ]);
                break;
                
            case CARDTYPE_GROWTH:
                $this->data->players->$playerId->faceUp[] = $drawCardId;
                foreach ($card->resources as $tileTypeId)
                {
                    $tileType = BonsaiMats::$TileTypes[$tileTypeId];
                    $tileTypeName = $tileType['name'];
                    $this->data->players->$playerId->canPlay->$tileTypeName++;
                    // TODO: emit?
                }
                break;

            case CARDTYPE_MASTER:
                $this->data->players->$playerId->faceDown[] = $drawCardId;
                $masterTilesReceived = [];
                // Assign the fixed resources
                foreach ($card->resources as $tileTypeId)
                {
                    if ($tileTypeId == TILETYPE_WILD) continue;
                    $tileType = BonsaiMats::$TileTypes[$tileTypeId];
                    $tileTypeName = $tileType['name'];
                    $this->data->players->$playerId->inventory->$tileTypeName++;
                    $masterTilesReceived[] = $tileTypeId;
                }
                // Assign the chosen resources
                foreach ($masterTiles as $tileTypeId)
                {
                    $tileType = BonsaiMats::$TileTypes[$tileTypeId];
                    $tileTypeName = $tileType['name'];
                    $this->data->players->$playerId->inventory->$tileTypeName++;
                    $masterTilesReceived[] = $tileTypeId;
                }
                $this->emit('tilesReceived', [ $playerId, $masterTilesReceived, $index ]);
                break;

            case CARDTYPE_HELPER:
                $this->data->players->$playerId->faceDown[] = $drawCardId;
                // TODO
                break;

            case CARDTYPE_PARCHMENT:
                $this->data->players->$playerId->faceDown[] = $drawCardId;
                // TODO
                break;
        }

        //                
        // Award bonus tiles to the player (depending on which slot the card came from)
        //
        $tileTypes = [];
        switch ($index)
        {
            case 0: // No tiles drawn for this slot
                break;

            case 1: // You may take 1 wood or 1 leaf tile
                if ($woodOrLeaf != TILETYPE_WOOD && $woodOrLeaf != TILETYPE_LEAF)
                    throw new Exception('Invalid tile draw');
                $tileTypes = [ $woodOrLeaf ];
                break;
            
            case 2: // You may take 1 wood and 1 flower tile
                $tileTypes = [ TILETYPE_WOOD, TILETYPE_FLOWER ];
                break;
            
            case 3: // You may take 1 leaf and 1 fruit tile
                $tileTypes = [ TILETYPE_LEAF, TILETYPE_FRUIT ];
                break;
        }

        // Add the tiles to the player's inventory
        foreach ($tileTypes as $tileTypeId)
        {
            $tileType = BonsaiMats::$TileTypes[$tileTypeId];
            $tileTypeName = $tileType['name'];
            $this->data->players->$playerId->inventory->$tileTypeName++;
        }
        if (count($tileTypes))
            $this->emit('tilesReceived', [ $playerId, $tileTypes, $index ]);


        //
        // Shift the other cards to the right and draw the next card
        //
        array_splice($this->data->board, $index, 1);
        if (count($this->data->drawPile))
        {
            $nextCardId = array_shift($this->data->drawPile);
            array_unshift($this->data->board, $nextCardId);

            $this->emit('cardRevealed', [ $nextCardId ]);
        }
        else {
            array_unshift($this->data->board, null);

            $this->emit('cardRevealed', [ null ]);
        }
    
        //
        // Check for game-ending condition
        // Allow one more turn for each player if there are no new cards to draw
        //
        if (count($this->data->drawPile) === 0 && $this->data->finalTurns === null)
        {
            $this->data->finalTurns = count($this->data->order);
            $this->emit('lastRound');
        }
    }

    function discardTiles($discards)
    {
        $playerId = $this->getNextPlayerId();

        $mustDiscardCount = $this->getMustDiscardCount();
        if ($mustDiscardCount == 0)
            return;

        if (count($discards) < $mustDiscardCount)
            throw new Exception('Must discard ' . $mustDiscardCount);

        foreach ($discards as $tileTypeId)
        {
            $tileType = BonsaiMats::$TileTypes[$tileTypeId];
            $tileTypeName = $tileType['name'];
            if (--$this->data->players->$playerId->inventory->$tileTypeName < 0)
                throw new Exception('Failed to discard ' . $tileTypeName);
        }

        $this->emit('tilesDiscarded', [ $playerId, $discards ]);
    }


    //
    // Helper Methods
    //

    function getMustDiscardCount()
    {
        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;
        $inventory = $player->inventory;
        return max(0, $inventory->wood + $inventory->leaf + $inventory->flower + $inventory->fruit - $player->capacity);
    }


    //
    // General Methods
    //

    public function getNextPlayerId()
    {
        return $this->data->order[$this->data->nextPlayer];
    }

    public function getGameProgression()
    {
        // Determine how many cards this game started with and how many are remaining in the draw pile
        $playerCount = count($this->data->order);
        $cards = array_keys(array_filter(BonsaiMats::$Cards, fn($card) => $playerCount > $card->minPlayers));
        $startingCardCount = count($cards) - 4; // Four are revealed already
        $currentCardCount = count($this->data->drawPile);

        // Set up the parts of the game progression to total 100
        $percentPerFinalTurn = 2;
        $maxFinalTurnProgression = $playerCount * $percentPerFinalTurn;
        $maxCardProgression = 100 - $maxFinalTurnProgression;

        $cardProgression = $maxCardProgression - round($maxCardProgression * $currentCardCount / $startingCardCount);

        $finalTurnProgression =
            isset($this->data->finalTurns)
                ? $maxFinalTurnProgression - $this->data->finalTurns * $percentPerFinalTurn
                : 0
        ;

        return $cardProgression + $finalTurnProgression;
    }

    public function getFaceDownCards()
    {
        $result = [];
        foreach ($this->data->players as $playerId => $player)
            $result[$playerId] = $player->faceDown;

        return $result;
    }

    // Return only the public data and the data private to the given player 
    public function getPlayerData($playerId)
    {
        $isGameOver = $this->getGameProgression() >= 100;
        $data = json_decode(json_encode($this->data));
        foreach ($this->data->players as $id => $player)
        {
            // Only return array counts instead of the card IDs for private player data
            // (unless the game is over! -- then we want to reveal the cards)
            if ($id != $playerId && !$isGameOver)
                $data->players->$id->faceDown = count($player->faceDown);
        }

        // Remove private information about the cards in the deck
        $data->drawPile = count($data->drawPile);

        return $data;
    }

    public static function makeKey($x, $y)
    {
        return strval($x) . ',' . strval($y);
    }

    public static function parseKey($key)
    {
        return array_map(fn($s) => intval($s), explode(',', $key));
    }

    public static function getAdjacentKeys($key)
    {
        $coords = BonsaiLogic::parseKey($key);
        $x = $coords[0];
        $y = $coords[1];
        $adjacentKeys = $y % 2
            ? [
                DIR_TOP_RIGHT => [ $x, $y + 1 ],
                DIR_RIGHT => [ $x + 1, $y ],
                DIR_BOTTOM_RIGHT => [ $x, $y - 1 ],
                DIR_BOTTOM_LEFT => [ $x - 1, $y - 1 ],
                DIR_LEFT => [ $x - 1, $y ],
                DIR_TOP_LEFT => [ $x - 1, $y + 1 ],
            ]
            : [
                DIR_TOP_RIGHT => [ $x + 1, $y + 1 ],
                DIR_RIGHT => [ $x + 1, $y ],
                DIR_BOTTOM_RIGHT => [ $x + 1, $y - 1 ],
                DIR_BOTTOM_LEFT => [ $x, $y - 1 ],
                DIR_LEFT => [ $x - 1, $y ],
                DIR_TOP_LEFT => [ $x, $y + 1 ],
            ];

        // Remove keys that are invalid (i.e. correspond to locations occupied by the pot)
        $adjacentKeys = array_filter($adjacentKeys, function($key)
        {
            $x = $key[0];
            $y = $key[1];
            if ($y === 0)
                return $x < -2 || $x > 3;
            else if ($y === -1)
                return $x < -1 || $x > 3;
            else if ($y === -2)
                return $x < -1 || $x > 2;
            return true;
        });

        return array_map(fn($coords) => BonsaiLogic::makeKey($coords[0], $coords[1]), $adjacentKeys);
    }

    public static function countAdjacentLeafs($leafMoves)
    {
        $result = 0;
        $visited = (object)[];
        $stack = [];
        $leafKeys = array_values(array_map(fn($move) => BonsaiLogic::makeKey($move[1], $move[2]), $leafMoves));

        while (count($leafKeys) > 0)
        {
            $leafKey = array_shift($leafKeys);
            array_push($stack, $leafKey);

            $count = 0;
            while (count($stack) > 0)
            {
                $leafKey = array_pop($stack);
                
                if (isset($visited->$leafKey)) continue;
                $visited->$leafKey = true;
                $count++;
                
                $adjacentKeys = array_values(BonsaiLogic::getAdjacentKeys($leafKey));
                $adjacentLeafKeys = array_values(array_filter($adjacentKeys, fn($key) => array_search($key, $leafKeys) !== false));
                array_push($stack, ...$adjacentLeafKeys);
            }
            $result = max($result, $count);
        }

        return $result;
    }

    public static function getFlowerScore($moves)
    {
        $flowerMoves = array_filter($moves, fn($move) => $move[0] == TILETYPE_FLOWER);

        // Create a lookup for tiles that exist in the tree
        $filled = (object)[];
        foreach ($moves as $move)
        {
            $key = BonsaiLogic::makeKey($move[1], $move[2]);
            $filled->$key = true;
        }

        // Test each flower move to see how many adjacent spaces are filled
        $score = 0;
        foreach ($flowerMoves as $move)
        {
            $score += 6;
            $key = BonsaiLogic::makeKey($move[1], $move[2]);
            $adjacentKeys = array_values(BonsaiLogic::getAdjacentKeys($key));
            foreach ($adjacentKeys as $adjKey)
            {
                if (isset($filled->$adjKey))
                    $score--;
            }
        }

        return $score;
    }

    public static function getProtrudingDirection($move)
    {
        $x = $move[1];
        $y = $move[2];
        if ($y % 2 && $x > 3) return 1;
        if ($y % 2 && $x < -1) return -1;
        if ($y % 2 == 0 && $x >= 3) return 1;
        if ($y % 2 == 0 && $x < -1) return -1; 
    }

    public static function getPlacementQuadrant($move)
    {
        $x = $move[1];
        $y = $move[2];
        $side = BonsaiLogic::getProtrudingDirection($move);

        $isBelow = $y <= -2;
        if ($side > 0) {
            return $isBelow ? 4 : 1;
        }
        else if ($side < 0) {
            return $isBelow ? 3 : 2;
        }
        return null; // We only want to consider protruding outside the pot
    }

    public function getPlayerScore($playerId)
    {
        $final = $this->getGameProgression() >= 100;

        $player = $this->data->players->$playerId;

        $leafMoves = array_filter($player->played, fn($move) => $move[0] == TILETYPE_LEAF);
        $flowerMoves = array_filter($player->played, fn($move) => $move[0] == TILETYPE_FLOWER);

        $woodTiles = count(array_filter($player->played, fn($move) => $move[0] == TILETYPE_WOOD));
        $leafTiles = count($leafMoves);
        $flowerTiles = count($flowerMoves);
        $fruitTiles = count(array_filter($player->played, fn($move) => $move[0] == TILETYPE_FRUIT));

        // Face Up
        $growthCards = array_filter($player->faceUp, fn($cardId) => BonsaiMats::$Cards[$cardId]->type == CARDTYPE_GROWTH);

        // Face Down
        $masterCards = array_filter($player->faceDown, fn($cardId) => BonsaiMats::$Cards[$cardId]->type == CARDTYPE_MASTER);
        $helperCards = array_filter($player->faceDown, fn($cardId) => BonsaiMats::$Cards[$cardId]->type == CARDTYPE_HELPER);
        $parchmentCards = array_filter($player->faceDown, fn($cardId) => BonsaiMats::$Cards[$cardId]->type == CARDTYPE_PARCHMENT);

        // 3 Points per leaf
        $leafScore = $leafTiles * 3;

        // 1 Point per space adjacent to a flower
        $flowerScore = BonsaiLogic::getFlowerScore($player->played);

        // 7 Points per fruit
        $fruitScore = $fruitTiles * 7;

        // Calculate goals
        $goalScore = 0;
        foreach ($player->claimed as $goalId)
        {
            $count = 0;
            $goalTile = BonsaiMats::$GoalTiles[$goalId];
            switch ($goalTile['type'])
            {
                case GOALTYPE_WOOD:
                    $count = $woodTiles;
                    break;

                case GOALTYPE_LEAF:
                    $count = BonsaiLogic::countAdjacentLeafs($leafMoves);
                    break;

                case GOALTYPE_FLOWER:
                    // Check the number of flower tiles beyond the pot edges (on the same side)
                    $rightSide = array_filter($player->played, fn($move) => $move[0] == TILETYPE_FLOWER && BonsaiLogic::getProtrudingDirection($move) === 1);
                    $leftSide = array_filter($player->played, fn($move) => $move[0] == TILETYPE_FLOWER && BonsaiLogic::getProtrudingDirection($move) === -1);
                    $count = max($leftSide, $rightSide);
                    break;
                    
                case GOALTYPE_FRUIT:
                    $count = $fruitTiles;
                    break;

                case GOALTYPE_PLACEMENT:
                    switch ($goalTile['size']) {
                        case GOALSIZE_SMALL:
                            $count = count(array_filter($player->played, fn($move) => BonsaiLogic::getProtrudingDirection($move)));
                            break;

                        case GOALSIZE_MEDIUM:
                            $protrudingSides = array_map(fn($move) => BonsaiLogic::getProtrudingDirection($move), $player->played);
                            $count += array_search(-1, $protrudingSides) === false ? 0 : 1;
                            $count += array_search(1, $protrudingSides) === false ? 0 : 1;
                            break;

                        case GOALSIZE_LARGE:
                            $quadrants = array_values(array_map(fn($move) => BonsaiLogic::getPlacementQuadrant($move), $player->played));
                            $quad1 = count(array_filter($quadrants, fn($q) => $q === 1)) > 0;
                            $quad2 = count(array_filter($quadrants, fn($q) => $q === 2)) > 0;
                            $quad3 = count(array_filter($quadrants, fn($q) => $q === 3)) > 0;
                            $quad4 = count(array_filter($quadrants, fn($q) => $q === 4)) > 0;
                            if (count($quadrants)) $count = 1;
                            if (($quad1 && $quad3) || ($quad3 && $quad4)) $count = 2;
                            break;
                    }
                    break;
            }

            if ($count >= $goalTile['req'])
                $goalScore += $goalTile['points'];
        }

        //
        // Score the parchment cards
        //
        $parchmentScore = 0;
        if ($final)
        {
            foreach ($parchmentCards as $cardId)
            {
                $card = BonsaiMats::$Cards[$cardId];
                switch ($card->resources[0])
                {
                    case TILETYPE_WOOD:
                        $parchmentScore += $card->points * $woodTiles;
                        break;

                    case TILETYPE_LEAF:
                        $parchmentScore += $card->points * $leafTiles;
                        break;
                        
                    case TILETYPE_FLOWER:
                        $parchmentScore += $card->points * $flowerTiles;
                        break;
                        
                    case TILETYPE_FRUIT:
                        $parchmentScore += $card->points * $fruitTiles;
                        break;
                        
                    case CARDTYPE_GROWTH:
                        $parchmentScore += $card->points * count($growthCards);
                        break;
                        
                    case CARDTYPE_MASTER:
                        $parchmentScore += $card->points * count($masterCards);
                        break;
                        
                    case CARDTYPE_HELPER:
                        $parchmentScore += $card->points * count($helperCards);
                        break;
                }
            }
        }

        return [
            'leaf' => $leafScore,
            'flower' => $flowerScore,
            'fruit' => $fruitScore,
            'goal' => $this->data->options->goalTiles ? $goalScore : '-',
            'parchment' => $parchmentScore,
            'total' => $leafScore + $flowerScore + $fruitScore + $goalScore + $parchmentScore,
        ];
    }

    public function getGoalTiles()
    {
        return $this->data->goalTiles;
    }

    public function getScores()
    {
        $scores = [];
        foreach ($this->data->order as $playerId)
            $scores[$playerId] = $this->getPlayerScore($playerId);

        return $scores;
    }

    public function getRemainingTileCounts()
    {
        $counts = [];
        foreach ($this->data->order as $playerId)
        {
            $inventory = $this->data->players->$playerId->inventory;
            $counts[$playerId] = $inventory->wood + $inventory->leaf + $inventory->flower + $inventory->fruit;
        }
        return $counts;
    }

    function toJson()
    {
        return json_encode($this->data);
    }
}
