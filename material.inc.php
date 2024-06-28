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

BonsaiMats::$GoalTiles = [
    1 => [
        'type' => GOALTYPE_WOOD,
        'size' => GOALSIZE_SMALL,
        'req' => 8,
        'points' => 5,
        'log' => clienttranslate('small brown goal'),
    ],
    2 => [
        'type' => GOALTYPE_WOOD,
        'size' => GOALSIZE_MEDIUM,
        'req' => 10,
        'points' => 10,
        'log' => clienttranslate('the medium brown goal'),
    ],
    3 => [
        'type' => GOALTYPE_WOOD,
        'size' => GOALSIZE_LARGE,
        'req' => 12,
        'points' => 15,
        'log' => clienttranslate('the large brown goal'),
    ],

    // Note: The leaf goals require ADJACENT leafs!
    4 => [
        'type' => GOALTYPE_LEAF,
        'size' => GOALSIZE_SMALL,
        'req' => 5,
        'points' => 6,
        'log' => clienttranslate('the small green goal'),
    ],
    5 => [
        'type' => GOALTYPE_LEAF,
        'size' => GOALSIZE_MEDIUM,
        'req' => 7,
        'points' => 9,
        'log' => clienttranslate('the medium green goal'),
    ],
    6 => [
        'type' => GOALTYPE_LEAF,
        'size' => GOALSIZE_LARGE,
        'req' => 9,
        'points' => 12,
        'log' => clienttranslate('the large green goal'),
    ],

    // Fruit goals just require a simple count of fruit
    7 => [
        'type' => GOALTYPE_FRUIT,
        'size' => GOALSIZE_SMALL,
        'req' => 3,
        'points' => 9,
        'log' => clienttranslate('the small orange goal'),
    ],
    8 => [
        'type' => GOALTYPE_FRUIT,
        'size' => GOALSIZE_MEDIUM,
        'req' => 4,
        'points' => 11,
        'log' => clienttranslate('the medium orange goal'),
    ],
    9 => [
        'type' => GOALTYPE_FRUIT,
        'size' => GOALSIZE_LARGE,
        'req' => 5,
        'points' => 13,
        'log' => clienttranslate('the large orange goal'),
    ],

    // Flower goals require the flowers to protrude past the pot sides (and be on the same side)
    10 => [
        'type' => GOALTYPE_FLOWER,
        'size' => GOALSIZE_SMALL,
        'req' => 3,
        'points' => 8,
        'log' => clienttranslate('the small pink goal'),
    ],
    11 => [
        'type' => GOALTYPE_FLOWER,
        'size' => GOALSIZE_MEDIUM,
        'req' => 4,
        'points' => 12,
        'log' => clienttranslate('the medium pink goal'),
    ],
    12 => [
        'type' => GOALTYPE_FLOWER,
        'size' => GOALSIZE_LARGE,
        'req' => 5,
        'points' => 16,
        'log' => clienttranslate('the large pink goal'),
    ],

    13 => [
        'type' => GOALTYPE_PLACEMENT,
        'size' => GOALSIZE_SMALL,
        'req' => 1,
        'points' => 7,
        'log' => clienttranslate('the small cyan goal'),
    ],
    14 => [
        'type' => GOALTYPE_PLACEMENT,
        'size' => GOALSIZE_MEDIUM,
        'req' => 2,
        'points' => 10,
        'log' => clienttranslate('the medium cyan goal'),
    ],
    15 => [
        'type' => GOALTYPE_PLACEMENT,
        'size' => GOALSIZE_LARGE,
        'req' => 2,
        'points' => 14,
        'log' => clienttranslate('the large cyan goal'),
    ],
];
