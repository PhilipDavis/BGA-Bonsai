<?php
// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

require_once('BonsaiMats.php');
require_once('BonsaiEvents.php');

define('BON_DATA_VERSION', 3); // Increment when the JSON data structure changes

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


class BonsaiLogic
{
    private $data;
    private BonsaiEvents $events;


    private function __construct($data, BonsaiEvents $events = null)
    {
        $this->data = $data;
        $this->events = $events;
    }

    static function fromJson($json, BonsaiEvents $events)
    {
        $data = BonsaiLogic::parseJson($json);
        return new BonsaiLogic($data, $events);
    }

    static function parseJson($json)
    {
        $data = json_decode($json);
        if ($data === false)
            throw new Exception('Failed to decode JSON');

        $version = 1;
        if (isset($data->version))
        {
            $version = $data->version;
            unset($data->version);
        }
        else if (isset($data->v))
            $version = $data->v;
            
        if ($version < 2)
        {
            // Start the move number from an invalid value
            // so that I don't mistake an upgraded game
            // to have a valid value.
            $data->move = -100;

            // Shorten name of Tokonoma Variant option
            $data->options->tokonoma = $data->options->tokonomaVariant;
            unset($data->options->tokonomaVariant);

            // Shorten name of Goal Tiles Enabled option
            $data->options->goals = $data->options->goalTiles;
            unset($data->options->goalTiles);

            $version = 2;
        }
            
        if ($version < 3) // Jul 17, 2024
        {
            // Remove the "mirrored" flag.
            // We'll just compute this based on the x-coord of the first wood tile.
            // (0, 0) is the standard setup with the bud on the left
            // (1, 0) is the flipped setup with the bug on the right
            if (!is_array($data->order))
                throw new Exception('data.order is not an array');
            foreach ($data->order as $playerId)
                unset($data->players->$playerId->mirrored);

            $version = 3;
        }

        if ($version < BON_DATA_VERSION)
            throw new Exception('Data upgrade not implemented');

        $data->v = BON_DATA_VERSION;
        return $data;
    }


    //
    // Setup Methods
    //

    static function newGame($playerColors, $options, BonsaiEvents $events)
    {
        // Note: $playerColors is Record<PlayerId, ColorIndex>

        $playerIds = array_keys($playerColors);
        $playerCount = count($playerColors);

        if ($playerCount === 1)
            $options['goals'] = true;

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
                'played' => (array)[],
                'faceUp' => [], // Face-up cards that have been collected
                'faceDown' => [], // Face-down cards that have been collected
                'claimed' => [], // Goal IDs claimed
                'renounced' => [], // Goal IDs renounced
            ];
        }

        // Step A: Place board in middle of the table
        // Step B: Place bonsai tiles within reach of all players
        BonsaiLogic::setupStepC($players, $options['goals'], $goalTiles);
        BonsaiLogic::setupStepD($players, $options['tokonoma'], $drawPile, $board);
        BonsaiLogic::setupStepE($players);
        BonsaiLogic::setupStepF($playerIds, $players);
        // Step G: Keep the Scoring Pad handy

        $events->onGameStart($board);

        foreach ($playerColors as $playerId => $colorIndex)
        {
            $tileTypes = [];
            $inventory = $players->$playerId->inventory;
            for ($i = 0; $i < $inventory->wood; $i++) $tileTypes[] = TILETYPE_WOOD;
            for ($i = 0; $i < $inventory->leaf; $i++) $tileTypes[] = TILETYPE_LEAF;
            for ($i = 0; $i < $inventory->flower; $i++) $tileTypes[] = TILETYPE_FLOWER;
            for ($i = 0; $i < $inventory->fruit; $i++) $tileTypes[] = TILETYPE_FRUIT;
            $events->onPlayerStart($playerId, $tileTypes);
        }

        return new BonsaiLogic((object)[
            'v' => BON_DATA_VERSION,
            'options' => (array)$options,
            'order' => $playerIds,
            'nextPlayer' => 0,
            'players' => $players,
            'drawPile' => $drawPile,
            'board' => $board,
            'goalTiles' => $goalTiles,
            'finalTurns' => null, // Once draw pile is exhausted, this counts down from <# of players> to 0
            'move' => 1,
        ], $events);
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
        $cards = array_keys(array_filter(BonsaiMats::$Cards, fn($card) => $playerCount >= $card->minPlayers));

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

        // In Solo mode, the player starts with 1 wood and 1 leaf

        for ($i = 0; $i < count($playerIds); $i++)
        {
            $playerId = $playerIds[$i];
            $player = $players->$playerId;
            $player->inventory->wood++;
            if ($i >= 1 || count($playerIds) === 1) $player->inventory->leaf++;
            if ($i >= 2) $player->inventory->flower++;
            if ($i >= 3) $player->inventory->fruit++;
        }
    }

    function flip()
    {
        $playerId = $this->getNextPlayerId();
        $played = $this->data->players->$playerId->played;
        if (count($played) > 1)
            throw new Exception('Too late to flip');
        $wasFlipped = $played[0][1] == 1; 
        $this->data->players->$playerId->played = [ [ 1, $wasFlipped ? 0 : 1, 0, 0 ] ];
        $this->events->onPotFlipped($this->data->move, $playerId, !$wasFlipped);
    }


    //
    // Cultivation Methods
    //

    function cultivate($flip, $removeTile, $placeTiles, $renounceGoals, $claimGoals)
    {
        if ($flip)
            $this->flip();

        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;

        $this->removeTile($removeTile);
        $this->placeTiles($placeTiles, $player->canPlay);
        $this->renounceGoals($renounceGoals);
        $this->claimGoals($claimGoals);

        if ($this->isSolo())
        {
            $this->discardCard(3);
            $this->revealCard();
        }
    }

    function canPlaceWood(): bool
    {
        // Are there any vacancies adjacent to any wood tiles?
        $playerId = $this->getNextPlayerId();
        $played = $this->data->players->$playerId->played;
        $isFlipped = $played[0][1] == 1;
        $woodTileMoves = array_values(array_filter($played, fn($move) => $move[0] == TILETYPE_WOOD));

        foreach ($woodTileMoves as $move)
        {
            $key = BonsaiLogic::makeKey($move[1], $move[2]);
            $adjacentKeys = $this->getAdjacentKeys($key, $isFlipped);
            foreach ($adjacentKeys as $adjKey)
            {
                $coords = BonsaiLogic::parseKey($adjKey);
                if (!$this->doesTileExist($playerId, $coords[0], $coords[1]))
                    return true;
            }
        }
        return false;
    }

    function doesTileExist($playerId, $x, $y): bool
    {
        $played = $this->data->players->$playerId->played;
        foreach ($played as $move)
        {
            if ($move[1] == $x && $move[2] == $y)
                return true;
        }
        return false;
    }

    //
    // Given the position of a leaf tile, calculate
    // which other tiles need to be removed if this
    // leaf tile is removed.
    //
    function getTilesForRemoval($pos)
    {
        $playerId = $this->getNextPlayerId();

        $x = $pos['x'];
        $y = $pos['y'];

        $keys = [ $pos ];
        $neighbours = $this->getNeighbours($playerId, $x, $y);

        foreach ($neighbours as $dir => $node)
        {
            switch ($node[0])
            {
                case TILETYPE_FLOWER:
                    if ($dir == $node[3]) { // Flower is attached to this leaf
                        $keys[] = [ 'x' => $node[1], 'y' => $node[2] ];
                    }
                    break;

                case TILETYPE_FRUIT:
                    if ($dir == $node[3] || $dir == ($node[3] + 5) % 6 || $dir == ($node[3] + 1) % 6) { // Fruit is attached to this leaf
                        $keys[] = [ 'x' => $node[1], 'y' => $node[2] ];
                    }
                    break;
            }
        }

        return $keys;
    }

    function removeTile($removeTile)
    {
        if (!isset($removeTile))
            return;

        $playerId = $this->getNextPlayerId();

        if ($this->canPlaceWood())
            throw new Exception('Cannot remove tiles while wood is playable');

        // Calculate all the tiles that need to be removed
        // after having removed $removeTile (e.g. any flower
        // and fruit tiles connected to it) 
        $removeTiles = $this->getTilesForRemoval($removeTile);

        foreach ($removeTiles as $pos)
        {
            $x = $pos['x'];
            $y = $pos['y'];

            // Does this tile exist in the player tree?
            $moves = array_filter($this->data->players->$playerId->played, fn($move) => $move[1] == $x && $move[2] == $y);
            $move = array_shift($moves);
            if (!$move)
                throw new BgaVisibleSystemException('Tile does not exist');
            $tileTypeId = $move[0];

            // Cannot remove a wood
            if ($tileTypeId == TILETYPE_WOOD)
                throw new Exception('Cannot remove wood tile');

            // Remove the tile
            $this->data->players->$playerId->played = array_values(array_filter($this->data->players->$playerId->played, fn($move) => $move[1] != $x || $move[2] != $y));

            $score = $this->getPlayerScore($playerId)['total'];
            $this->events->onTileRemoved($this->data->move, $playerId, $tileTypeId, $x, $y, $score);
        }
    }

    function placeTiles($placeTiles, object $canPlay)
    {
        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;
        $canPlay = clone $canPlay;
        $inventory = $player->inventory;

        foreach ($placeTiles as $tile)
        {
            $tile = (array)$tile; // Only required to make the exception-log-generated unit tests happy
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

            // Is it valid to place this tile at the given location?
            $this->validatePlacement($playerId, $tile);

            // Add the tile into the tree
            $this->data->players->$playerId->played[] = [ $type, $x, $y, $r ];
        }

        if (count($placeTiles))
        {
            $score = $this->getPlayerScore($playerId)['total'];
            $this->events->onTilesAdded($this->data->move, $playerId, $placeTiles, $score);
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

            $this->events->onGoalRenounced($this->data->move, $playerId, $goalId);
        }
    }

    function claimGoals($claimGoals)
    {
        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;

        foreach ($claimGoals as $goalId)
        {
            // Is this goal still available?
            if (array_search($goalId, $this->data->goalTiles) === false)
                throw new Exception('Goal not available');

            // Has the player already claimed a goal of the same type?
            $type = BonsaiMats::$GoalTiles[$goalId]['type'];
            if (count(array_filter($player->claimed, fn($g) => BonsaiMats::$GoalTiles[$g]['type'] === $type)))
                throw new Exception('Goal type already claimed');

            // Has the player already renounced this goal?
            if (array_search($goalId, $player->renounced))
                throw new Exception('Goal already renounced');

            // Does the player meet the requirements of this goal?
            if (!$this->doesPlayerQualifyForGoal($playerId, $goalId))
                throw new Exception('Goal not met');

            // Mark the goal as claimed
            $this->data->players->$playerId->claimed[] = $goalId;
            $this->data->goalTiles = array_values(array_filter($this->data->goalTiles, fn($g) => $g != $goalId));

            $score = $this->getPlayerScore($playerId)['total'];
            $this->events->onGoalClaimed($this->data->move, $playerId, $goalId, $score);
        }

        // Now that goals have been renounced (earlier) and claimed here,
        // Check to make sure that there are no *other* goals that the
        // player is currently eligible for -- because, if they were
        // eligible, then that goal should have appeared in the renounce
        // or claim sets.
        foreach ($this->data->goalTiles as $goalId)
        {
            // Has the player already claimed a goal of the same type?
            $type = BonsaiMats::$GoalTiles[$goalId]['type'];
            if (count(array_filter($player->claimed, fn($g) => BonsaiMats::$GoalTiles[$g]['type'] === $type)))
                continue;

            // Has the player already renounced this goal?
            if (array_search($goalId, $player->renounced) !== false)
                continue;

            // Does the player meet the requirements of this goal?
            if (!$this->doesPlayerQualifyForGoal($playerId, $goalId))
                continue;

            throw new Exception('Decision required for goal ' . strval($goalId));
        }
    }


    //
    // Meditation Methods
    //

    function revealBeforeDiscard()
    {
        return isset($this->data->options->revealBeforeDiscard) && $this->data->options->revealBeforeDiscard;
    }

    function meditate($flip, $removeTile, $drawCardId, $woodOrLeaf, $masterTiles, $placeTiles, $renounceGoals, $claimGoals, $discardTiles)
    {
        if ($flip)
            $this->flip();

        $this->removeTile($removeTile);

        $index = 0;
        $canPlay = (object)[];
        $this->drawCardAndTiles($drawCardId, $woodOrLeaf, $masterTiles, $canPlay, $index);
        $this->placeTiles($placeTiles, $canPlay);
        $this->renounceGoals($renounceGoals);
        $this->claimGoals($claimGoals);

        if (!$this->revealBeforeDiscard())
            $this->discardTiles($discardTiles);

        if ($this->isSolo())
        {
            // Discard the card to the left of the selected card.
            if ($index > 0)
            {
                while ($index > 0 && $this->data->board[--$index] == null);
                if ($this->data->board[$index] !== null)
                    $this->discardCard($index);
                $this->revealCard();
            }
            else
            {
                // If the left-most slot, reveal the next card
                // from the deck and discard it. However, if the
                // draw pile is empty then do nothing
                if ($this->revealCard())
                    $this->discardCard(0);
            }
        }

        $this->revealCard();
    }

    function drawCardAndTiles($drawCardId, $woodOrLeaf, $masterTiles, object &$canPlay, int &$index)
    {
        $playerId = $this->getNextPlayerId();

        // By default, the player is not allowed to place any tiles during Meditate action.
        // Howerver, the Helper cards allow the player to place some tiles.
        $canPlay = (object)[ 'wood' => 0, 'leaf' => 0, 'flower' => 0, 'fruit' => 0, 'wild' => 0 ];

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
        $this->events->onCardTaken($this->data->move, $playerId, $drawCardId);
        switch ($card->type)
        {
            case CARDTYPE_TOOL:
                $this->data->players->$playerId->faceUp[] = $drawCardId;
                $this->data->players->$playerId->capacity += $card->capacity;
                $this->events->onCapacityIncreased($playerId, $card->capacity);
                break;
                
            case CARDTYPE_GROWTH:
                $this->data->players->$playerId->faceUp[] = $drawCardId;
                foreach ($card->resources as $tileTypeId)
                {
                    $tileType = BonsaiMats::$TileTypes[$tileTypeId];
                    $tileTypeName = $tileType['name'];
                    $this->data->players->$playerId->canPlay->$tileTypeName++;
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
                $this->events->onTilesReceived($this->data->move, $playerId, $masterTilesReceived, $index);
                break;

            case CARDTYPE_HELPER:
                $this->data->players->$playerId->faceDown[] = $drawCardId;
                foreach ($card->resources as $tileTypeId)
                {
                    $tileTypeName = BonsaiMats::$TileTypes[$tileTypeId]['name'];
                    $canPlay->$tileTypeName++;
                }
                break;

            case CARDTYPE_PARCHMENT:
                $this->data->players->$playerId->faceDown[] = $drawCardId;
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
                    throw new Exception('Expecting wood or leaf');
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
            $this->events->onTilesReceived($this->data->move, $playerId, $tileTypes, $index);

        $this->data->board[$index] = null;
    }

    function discardCard($slot)
    {
        // For the solo game

        // Does the slot contain a card?
        $cardId = $this->data->board[$slot];
        if ($cardId === null)
            throw new Exception('Slot is empty');

        $this->events->onCardDiscarded($cardId);

        $this->data->board[$slot] = null;
    }

    function revealCard()
    {
        // Make sure there is at least one null
        $index = array_search(null, $this->data->board);
        if ($index === false || $index > 3)
            throw new Exception('Invalid board state');

        //
        // Shift the other cards to the right and draw the next card
        //
        foreach (range(3, 1, -1) as $i)
        {
            if ($this->data->board[$i] === null)
            {
                $prev = $this->data->board[$i - 1];
                $this->data->board[$i] = $prev;
                $this->data->board[$i - 1] = null;
            }
        }
        
        $nextCardId = null;
        if (count($this->data->drawPile))
            $nextCardId = array_shift($this->data->drawPile);

        $this->data->board[0] = $nextCardId;
        $this->events->onCardRevealed($nextCardId);

        return !!$nextCardId;
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

        $this->events->onTilesDiscarded($this->data->move, $playerId, $discards);
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

    public function endTurn()
    {
        // In end game, reduce the number of final turns left
        if ($this->data->finalTurns !== null)
            $this->data->finalTurns--;

        $playerId = $this->getNextPlayerId();
        $score = $this->getPlayerScore($playerId)['total'];
        $this->events->onEndTurn($playerId, $score);

        $this->data->nextPlayer = ($this->data->nextPlayer + 1) % count($this->data->order);
        $this->data->move++;

        if ($this->data->finalTurns === 0)
        {
            $scores = $this->getScores();
            $remainingTiles = $this->getRemainingTileCounts();
            $faceDownCards = $this->getFaceDownCards();
            $wonSoloGame = $this->wonSoloGame();
            $this->events->onGameOver($scores, $remainingTiles, $faceDownCards, $wonSoloGame);
            return;
        }

        $playerId = $this->getNextPlayerId();
        $this->events->onChangeNextPlayer($playerId);
        
        //
        // Check for game-ending condition
        // Allow one more turn for each player if there are no new cards to draw
        //
        if (count($this->data->drawPile) === 0 && $this->data->finalTurns === null)
        {
            $this->data->finalTurns = count($this->data->order);
            $this->events->onLastRound();
        }
    }

    public function getNextPlayerId()
    {
        return $this->data->order[$this->data->nextPlayer];
    }

    public function getGameProgression()
    {
        // I don't know how this could possibly fail... but I'm seeing errors on 
        // servers 3, 6, 10, 14:
        // `count(): Parameter must be an array or an object that implements Countable`
        if (!is_array($this->data->order))
            throw new Exception('data.order is not an array');
        if (!is_array($this->data->drawPile))
            throw new Exception('data.drawPile is not an array');

        // Determine how many cards this game started with and how many are remaining in the draw pile
        $playerCount = count($this->data->order);
        $cards = array_keys(array_filter(BonsaiMats::$Cards, fn($card) => $playerCount >= $card->minPlayers));
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

    public static function getAdjacentKeys($key, $isFlipped)
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
        $adjacentKeys = array_filter($adjacentKeys, function($coords) use ($isFlipped)
        {
            $x = $coords[0];
            $y = $coords[1];
            if ($y === 0)
            {
                if ($x == 0 && !$isFlipped) return true;
                if ($x == 1 && $isFlipped) return true;
                return $x < -2 || $x > 3;
            }
            else if ($y === -1)
                return $x < -1 || $x > 3;
            else if ($y === -2)
                return $x < -1 || $x > 2;
            return true;
        });

        return array_map(fn($coords) => BonsaiLogic::makeKey($coords[0], $coords[1]), $adjacentKeys);
    }

    public function getNeighbours($playerId, $x, $y) {
        $player = $this->data->players->$playerId;
        $isFlipped = $player->played[0][1] == 1;

        $result = (object)[];
        $adjacentCoords = BonsaiLogic::getAdjacentKeys(BonsaiLogic::makeKey($x, $y), $isFlipped);

        foreach ($adjacentCoords as $direction => $key)
        {
            $coords = BonsaiLogic::parseKey($key);
            $neighbors = array_values(array_filter($player->played, fn($move) => $coords[0] == $move[1] && $coords[1] == $move[2]));
            $neighbor = array_shift($neighbors);
            if ($neighbor)
                $result->$direction = $neighbor;
        }
        return $result;
    }

    public function validatePlacement($playerId, $tile)
    {
        $tileType = $tile['type'];
        $x = $tile['x'];
        $y = $tile['y'];
        $rotation = $tile['r'];

        if ($this->doesTileExist($playerId, $x, $y))
            throw new Exception('Tile already exists there');

        $adjacentNodes = $this->getNeighbours($playerId, $x, $y);

        // Wood must be placed adjacent to a Wood
        if ($tileType == TILETYPE_WOOD)
        {
            foreach ($adjacentNodes as $dir => $node)
                if ($node[0] == TILETYPE_WOOD) return;
            throw new Exception('Wood must be adjacent to wood');
        }

        // Leaf must be placed adjacent to a Wood
        else if ($tileType == TILETYPE_LEAF)
        {
            foreach ($adjacentNodes as $dir => $node)
                if ($node[0] == TILETYPE_WOOD) return;
            throw new Exception('Leaf must be adjacent to wood');
        }

        // Flower must be placed adjacent to a Leaf
        else if ($tileType === TILETYPE_FLOWER)
        {
            foreach ($adjacentNodes as $dir => $node)
                if ($node[0] == TILETYPE_LEAF) return true;
            throw new Exception('Flower must be adjacent to leaf');
        }

        // Fruit must be placed adjacent to two adjacent Leaf tiles but not adjacent to another fruit
        else if ($tileType === TILETYPE_FRUIT)
        {
            if (count(array_filter((array)$adjacentNodes, fn($move) => $move[0] == TILETYPE_FRUIT)))
                throw new Exception('Fruit may not be adjacent to fruit');

            $adjKeys = array_keys((array)$adjacentNodes);
            $lastDir = array_pop($adjKeys);
            $prevWasLeaf = $adjacentNodes->$lastDir[0] == TILETYPE_LEAF;
            foreach ($adjacentNodes as $dir => $node)
            {
                if ($node[0] == TILETYPE_LEAF)
                {
                    if ($prevWasLeaf) return true;
                    $prevWasLeaf = true;
                }
                else
                    $prevWasLeaf = false;
            }
            throw new Exception('Fruit must be adjacent to two leaves');
        }

        throw new Exception('Unhandled tile type');
    }

    public static function countAdjacentLeafs($leafMoves, $isFlipped)
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
                
                $adjacentKeys = array_values(BonsaiLogic::getAdjacentKeys($leafKey, $isFlipped));
                $adjacentLeafKeys = array_values(array_filter($adjacentKeys, fn($key) => array_search($key, $leafKeys) !== false));
                array_push($stack, ...$adjacentLeafKeys);
            }
            $result = max($result, $count);
        }

        return $result;
    }

    public static function getFlowerScore($moves, $isFlipped)
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
            $adjacentKeys = array_values(BonsaiLogic::getAdjacentKeys($key, $isFlipped));
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

    public function doesPlayerQualifyForGoal($playerId, $goalId)
    {
        $player = $this->data->players->$playerId;
        $isFlipped = $player->played[0][1] == 1;

        $leafMoves = array_filter($player->played, fn($move) => $move[0] == TILETYPE_LEAF);
        $woodTiles = count(array_filter($player->played, fn($move) => $move[0] == TILETYPE_WOOD));
        $fruitTiles = count(array_filter($player->played, fn($move) => $move[0] == TILETYPE_FRUIT));

        $count = 0;
        $goalTile = BonsaiMats::$GoalTiles[$goalId];
        switch ($goalTile['type'])
        {
            case GOALTYPE_WOOD:
                $count = $woodTiles;
                break;

            case GOALTYPE_LEAF:
                $count = BonsaiLogic::countAdjacentLeafs($leafMoves, $isFlipped);
                break;

            case GOALTYPE_FLOWER:
                // Check the number of flower tiles beyond the pot edges (on the same side)
                $rightSide = count(array_filter($player->played, fn($move) => $move[0] == TILETYPE_FLOWER && BonsaiLogic::getProtrudingDirection($move) === 1));
                $leftSide = count(array_filter($player->played, fn($move) => $move[0] == TILETYPE_FLOWER && BonsaiLogic::getProtrudingDirection($move) === -1));
                $count = max($leftSide, $rightSide);
                // Note: Flower is allowed to be below the pot
                break;
                
            case GOALTYPE_FRUIT:
                $count = $fruitTiles;
                break;

            case GOALTYPE_PLACEMENT:
                switch ($goalTile['size']) {
                    case GOALSIZE_SMALL:
                        // Needs to protrude out the side opposite the gold crack in the pot
                        $isFlipped = $player->played[0][1] == 1;
                        $goldCrackSide = $isFlipped ? -1 : 1;
                        $count = count(array_filter($player->played, fn($move) => BonsaiLogic::getProtrudingDirection($move) === $goldCrackSide));
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
                        if (($quad1 && $quad3) || ($quad2 && $quad4)) $count = 2;
                        break;
                }
                break;
        }

        return $count >= $goalTile['req'];
    }

    public function getPlayerScore($playerId)
    {
        $final = $this->getGameProgression() >= 100;
        if (!isset($this->data->players->$playerId))
            return 0;

        $player = $this->data->players->$playerId;
        $isFlipped = $player->played[0][1] == 1;

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
        $flowerScore = BonsaiLogic::getFlowerScore($player->played, $isFlipped);

        // 7 Points per fruit
        $fruitScore = $fruitTiles * 7;

        // Calculate goals
        $goalScore = 0;
        foreach ($player->claimed as $goalId)
        {
            if ($this->doesPlayerQualifyForGoal($playerId, $goalId))
                $goalScore += BonsaiMats::$GoalTiles[$goalId]['points'];
        }

        //
        // Score the parchment cards
        //
        $parchmentScore = 0;
        if ($final || $this->isSolo())
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
            'goal' => $this->data->options->goals ? $goalScore : '-',
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

    public function isSolo()
    {
        return count($this->data->order) === 1;
    }

    public function wonSoloGame()
    {
        if (!$this->isSolo()) return null;

        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;
        if (count($player->claimed) < 3)
            return false;

        $pointsRequired = [
            '0' => 60, // I saw some cases where `solo` was 0...? Just default to the lowest level
            '1' => 60,
            '2' => 80,
            '3' => 100,
            '4' => 120,
            '5' => 140,
        ][strval($this->data->options->solo)];

        return $this->getPlayerScore($playerId)['total'] >= $pointsRequired;
    }

    public function playZombieTurn()
    {
        $playerId = $this->getNextPlayerId();
        $player = $this->data->players->$playerId;

        $mustDiscardCount = $this->getMustDiscardCount();
        if ($this->revealBeforeDiscard() && $mustDiscardCount > 0)
        {
            // Randomly select tiles to discard.
            // Could make this better by just keeping an array of inventory
            // rather than an object of counts by tile type
            $i = 0;
            $discardTiles = [];
            $inventory = (object)[ ...(array)$player->inventory ];
            while ($mustDiscardCount > 0)
            {
                $tileTypeId = random_int(TILETYPE_WOOD, TILETYPE_FRUIT);
                $tileType = BonsaiMats::$TileTypes[$tileTypeId];
                $tileTypeName = $tileType['name'];
                if ($inventory->$tileTypeName > 0)
                {
                    $inventory->$tileTypeName--;
                    $discardTiles[] = $tileTypeId;
                    $mustDiscardCount--;
                }
                if ($i++ > 1000) throw new Exception('Failed to discard');
            }
            $this->discardTiles($discardTiles);
            return;
        }

        $removeTiles = [];

        // Just pass instead of placing anything
        $placeTiles = [];

        $claimGoals = [];
        $renounceGoals = [];
        foreach ($this->data->goalTiles as $goalId)
        {
            if ($this->doesPlayerQualifyForGoal($playerId, $goalId))
                $renounceGoals[] = $goalId;
        }

        $this->cultivate(false, $removeTiles, $placeTiles, $renounceGoals, $claimGoals);
    }

    function getBoard()
    {
        return $this->data->board;
    }

    //
    // Helper method for debugging errors in Production.
    // The bug state can be loaded into an active game
    // and the game will take on the game state from
    // the table in the bug report. But to make the game
    // playable in Studio, we need to change the player
    // IDs to match our Studio player IDs.
    //
    function debugSwapPlayers($oldPlayerId, $newPlayerId)
    {
        $this->data->order = array_values(array_map(fn($id) => $id == $oldPlayerId ? $newPlayerId : $id, $this->data->order));
        $this->data->players->$newPlayerId = $this->data->players->$oldPlayerId;
        unset($this->data->players->$oldPlayerId);
    } 

    function toJson()
    {
        $json = json_encode($this->data);
        if (!$json)
            throw new Exception('Failed to encode game state to JSON: ' . serialize($this->data));
        return $json;
    }
}
