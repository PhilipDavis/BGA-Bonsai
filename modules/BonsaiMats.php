<?php
// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define('clienttranslate', '');

if (!defined('BON_MATS'))
{
    define('BON_MATS', true);

	define('TILETYPE_WILD', 0);
	define('TILETYPE_WOOD', 1);
	define('TILETYPE_LEAF', 2);
	define('TILETYPE_FLOWER', 3);
	define('TILETYPE_FRUIT', 4);

	define('GOALTYPE_WOOD', 1);
	define('GOALTYPE_LEAF', 2);
	define('GOALTYPE_FLOWER', 3);
	define('GOALTYPE_FRUIT', 4);
	define('GOALTYPE_PLACEMENT', 5);

    define('GOALSIZE_SMALL', 1);
	define('GOALSIZE_MEDIUM', 2);
	define('GOALSIZE_LARGE', 3);

	define('CARDTYPE_TOOL', 'tool');
	define('CARDTYPE_GROWTH', 'growth');
	define('CARDTYPE_MASTER', 'master');
	define('CARDTYPE_HELPER', 'helper');
	define('CARDTYPE_PARCHMENT', 'parchment');

    BonsaiMats::initialize();
}


class BonsaiMats
{
    static array $TileTypes = [
        // Note: Do not put WILD tile type in this collection!
        TILETYPE_WOOD => [
            'id' => TILETYPE_WOOD,
            'name' => 'wood',
        ],
        TILETYPE_LEAF => [
            'id' => TILETYPE_LEAF,
            'name' => 'leaf',
        ],
        TILETYPE_FLOWER => [
            'id' => TILETYPE_FLOWER,
            'name' => 'flower',
        ],
        TILETYPE_FRUIT => [
            'id' => TILETYPE_FRUIT,
            'name' => 'fruit',
        ],
    ];

    // Populated from the material.inc.php file to work around
    // the stupid limitation of not being able to use the
    // clienttranslate() wrapper in a static declaration.
    static array $GoalTiles = [];

    static array $GoalTileTypes = [
        GOALTYPE_WOOD,
        GOALTYPE_LEAF,
        GOALTYPE_FLOWER,
        GOALTYPE_FRUIT,
        GOALTYPE_PLACEMENT,
    ];

    static array $CardTypes = [
        // Tool Cards (1 - 6)
        [
            'type' => CARDTYPE_TOOL,
            'capacity' => 2, // +2 capacity to Seishi
            'qty' => [ 3, 3, 5, 6 ],
        ],

        // Growth Cards (7 - 20)
        [ // 7 - 10
            'type' => CARDTYPE_GROWTH,
            'resources' => [ TILETYPE_WOOD ],
            'qty' => [ 2, 2, 3, 4 ],
        ],
        [ // 11 - 14
            'type' => CARDTYPE_GROWTH,
            'resources' => [ TILETYPE_LEAF ],
            'qty' => [ 2, 2, 4, 4 ],
        ],
        [ // 15 - 17
            'type' => CARDTYPE_GROWTH,
            'resources' => [ TILETYPE_FLOWER ],
            'qty' => [ 2, 2, 3, 3 ],
        ],
        [ // 18 - 20
            'type' => CARDTYPE_GROWTH,
            'resources' => [ TILETYPE_FRUIT ],
            'qty' => [ 2, 2, 2, 3 ],
        ],

        // Master Cards (21 - 33)
        [
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_WILD ],
            'qty' => [ 2, 2, 2, 2 ],
        ],
        [
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_WOOD, TILETYPE_WOOD ],
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_WOOD, TILETYPE_LEAF ],
            'qty' => [ 1, 1, 3, 3 ],
        ],
        [ // 27
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_WOOD, TILETYPE_LEAF, TILETYPE_FLOWER ],
            'qty' => [ 0, 0, 1, 1 ],
        ],
        [ // 28
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_WOOD, TILETYPE_LEAF, TILETYPE_FRUIT ],
            'qty' => [ 0, 0, 1, 1 ],
        ],
        [ // 29
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_LEAF, TILETYPE_LEAF ],
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 30
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_LEAF, TILETYPE_FLOWER ],
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 31
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_LEAF, TILETYPE_FLOWER, TILETYPE_FLOWER ],
            'qty' => [ 0, 0, 0, 1 ],
        ],
        [ // 32
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_LEAF, TILETYPE_FRUIT ],
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 33
            'type' => CARDTYPE_MASTER,
            'resources' => [ TILETYPE_WILD ],
            'qty' => [ 0, 0, 1, 1 ],
        ],

        // Helper Cards (34 - 40)
        [ // 34 - 36
            'type' => CARDTYPE_HELPER,
            'resources' => [ TILETYPE_WILD, TILETYPE_WOOD ],
            'qty' => [ 3, 3, 3, 3 ],
        ],
        [ // 37 - 38
            'type' => CARDTYPE_HELPER,
            'resources' => [ TILETYPE_WILD, TILETYPE_LEAF ],
            'qty' => [ 2, 2, 2, 2 ],
        ],
        [ // 39
            'type' => CARDTYPE_HELPER,
            'resources' => [ TILETYPE_WILD, TILETYPE_FLOWER ],
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 40
            'type' => CARDTYPE_HELPER,
            'resources' => [ TILETYPE_WILD, TILETYPE_FRUIT ],
            'qty' => [ 1, 1, 1, 1 ],
        ],

        // Parchment Cards (41 - 47)
        [ // 41
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ TILETYPE_WOOD ],
            'points' => 1,
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 42
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ TILETYPE_LEAF ],
            'points' => 1,
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 43
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ TILETYPE_FLOWER ],
            'points' => 2,
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 44
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ TILETYPE_FRUIT ],
            'points' => 2,
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 45
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ CARDTYPE_GROWTH ],
            'points' => 2,
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 46
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ CARDTYPE_HELPER ],
            'points' => 2,
            'qty' => [ 1, 1, 1, 1 ],
        ],
        [ // 47
            'type' => CARDTYPE_PARCHMENT,
            'resources' => [ CARDTYPE_MASTER ],
            'points' => 2,
            'qty' => [ 1, 1, 1, 1 ],
        ],
    ];


    static array $Cards = [];
    
    public static function initialize()
    {
        $cardId = 1;
        foreach (BonsaiMats::$CardTypes as $cardType)
        {
            $prevQty = 0;
            for ($i = 0; $i < 4; $i++)
            {
                $qty = $cardType['qty'][$i];
                for ($j = $prevQty + 1; $j <= $qty; $j++)
                {
                    $card = json_decode(json_encode($cardType));
                    unset($card->qty);
                    $card->minPlayers = $i + 1;
                    BonsaiMats::$Cards[$cardId] = $card;
                    $cardId++;
                }
                $prevQty = $qty;
            }
        }
    }
}
