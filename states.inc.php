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

if (!defined('BGA_GAME_START'))
{
    define('BGA_GAME_START', 1);
    define('PLAYER_TURN', 10);
    define('PLAYER_TURN_DISCARD_EXCESS', 15);
    define('END_TURN', 20);
    define('BGA_GAME_END', 99);
}

 
$machinestates = [

    // The initial state. Please do not modify.
    BGA_GAME_START => [
        'name' => 'gameSetup',
        'description' => '',
        'type' => 'manager',
        'action' => 'stGameSetup',
        'transitions' => [
            'begin' => PLAYER_TURN,
        ],
    ],

    PLAYER_TURN => [
        'name' => 'playerTurn',
        'description' => clienttranslate('${actplayer} must play'),
        'descriptionmyturn' => clienttranslate('${you} must choose'),
        'type' => 'activeplayer',
        'possibleactions' => [
            'meditate',
            'cultivate',
            'jsError',
        ],
        'transitions' => [
            'discardExcess' => PLAYER_TURN_DISCARD_EXCESS,
            'endTurn' => END_TURN,
        ],
    ],

    PLAYER_TURN_DISCARD_EXCESS => [
        'name' => 'discardExcess',
        'description' => clienttranslate('${actplayer} must discard excess tiles'),
        'descriptionmyturn' => clienttranslate('${you} must discard excess tiles'),
        'type' => 'activeplayer',
        'possibleactions' => [
            'discard',
            'jsError',
        ],
        'transitions' => [
            'endTurn' => END_TURN,
        ],
    ],

    END_TURN => [
        'name' => 'endTurn',
        'description' => '',
        'type' => 'game',
        'action' => 'stEndTurn',
        'updateGameProgression' => true,
        'transitions' => [
            'nextTurn' => PLAYER_TURN,
            'gameOver' => BGA_GAME_END,
        ],
    ],

    // Final state.
    // Please do not modify (and do not overload action/args methods).
    BGA_GAME_END => [
        'name' => 'gameEnd',
        'description' => clienttranslate('End of game'),
        'type' => 'manager',
        'action' => 'stGameEnd',
        'args' => 'argGameEnd',
    ],
];
