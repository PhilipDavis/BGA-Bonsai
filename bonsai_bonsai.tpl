{OVERALL_GAME_HEADER}

<!-- 
--------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- Bonsai implementation : © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
-- 
-- This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
-- See http://en.boardgamearena.com/#!doc/Studio for more information.
-------
-->


<div id="bon_surface">
    <div id="bon_goals">
    </div> 
    <div id="bon_board">
        <div id="bon_deck"></div>
        <div id="bon_slot-0" class="bon_slot"></div>
        <div id="bon_slot-1" class="bon_slot"></div>
        <div id="bon_slot-2" class="bon_slot"></div>
        <div id="bon_slot-3" class="bon_slot"></div>
    </div>
</div>


<script type="text/javascript">

const bonsai_Templates = {
    playerSummary:
        '<div id="bon_player-summary-${PID}" class="bon_player-summary">' +
            '<span id="bon_player-summary-stat-block-${PID}-capacity" class="bon_player-summary-stat-block">' +
                '<span id="bon_capacity-${PID}" class="bon_player-summary-stat">0</span>' +
                '<i class="bon_icon-capacity"></i>' +
                '<span class="bon_hidden">0</span>' +
            '</span>' +
            '<span id="bon_player-summary-stat-block-${PID}-wood" class="bon_player-summary-stat-block">' +
                '<span id="bon_inv-wood-${PID}" class="bon_player-summary-stat">0</span>' +
                '<i class="bon_icon bon_icon-wood"></i>' +
                '<span id="bon_tree-wood-${PID}" class="bon_player-summary-stat">0</span>' +
            '</span>' +
            '<span id="bon_player-summary-stat-block-${PID}-leaf" class="bon_player-summary-stat-block">' +
                '<span id="bon_inv-leaf-${PID}" class="bon_player-summary-stat">0</span>' +
                '<i class="bon_icon bon_icon-leaf"></i>' +
                '<span id="bon_tree-leaf-${PID}" class="bon_player-summary-stat">0</span>' +
            '</span>' +
            '<span id="bon_player-summary-stat-block-${PID}-flower" class="bon_player-summary-stat-block">' +
                '<span id="bon_inv-flower-${PID}" class="bon_player-summary-stat">0</span>' +
                '<i class="bon_icon bon_icon-flower"></i>' +
                '<span id="bon_tree-flower-${PID}" class="bon_player-summary-stat">0</span>' +
            '</span>' +
            '<span id="bon_player-summary-stat-block-${PID}-fruit" class="bon_player-summary-stat-block">' +
                '<span id="bon_inv-fruit-${PID}" class="bon_player-summary-stat">0</span>' +
                '<i class="bon_icon bon_icon-fruit"></i>' +
                '<span id="bon_tree-fruit-${PID}" class="bon_player-summary-stat">0</span>' +
            '</span>' +
        '</div>',

    player:
        '<div id="bon_player-${PID}" class="bon_player bon_color-${COLOR}">' +
            '<div id="bon_tree-${PID}" class="bon_tree">' +
                '<div class="bon_pot"></div>' +
            '</div>' +
            '<div id="bon_tiles-${PID}" class="bon_tiles-host">' +
            '</div>' +
            '<div id="bon_seishi-host-${PID}" class="bon_seishi-host">' +
                '<div id="bon_seishi-${PID}" class="bon_seishi"></div>' +
                '<div id="bon_seishi-facedown-${PID}" class="bon_seishi-facedown"></div>' +
                '<div id="bon_seishi-lhs-${PID}" class="bon_seishi-lhs"></div>' +
                '<div id="bon_seishi-rhs-${PID}" class="bon_seishi-rhs"></div>' +
            '</div>' +
        '</div>',

    tile:
        '<div id="bon_tile-${TILE_ID}" ' +
            'class="bon_tile bon_tile-${TYPE}" ' +
            'style="transform: translate(calc(${X_EM}em - 50%), calc(${Y_EM}em - 50%)) scale(.975) rotate(${DEG}deg)"' +
        '></div>',

    tileHost:
        '<div id="${DIV_ID}" ' +
            'class="bon_tile-placeholder" ' +
        '></div>',

    card:
        '<div id="bon_card-${CARD_ID}" class="bon_card bon_card-${CARD_ID} ${DOWN}">' +
            '<div class="bon_card-face"></div>' +
            '<div class="bon_card-back"></div>' +
        '</div>',

    cardHost:
        '<div id="bon_card-host-${CARD_ID}" class="bon_card-host">' +
        '</div>',

    seishiFaceDownCard:
        '<div class="bon_card bon_card-${CARD_ID}">' +
            '<div class="bon_card-face"></div>' +
        '</div>',

    vacancy:
        '<div ' +
            'id="${ID}" ' +
            'class="bon_vacancy" ' +
            'style="transform: translate(calc(${X_EM}em - 50%), calc(${Y_EM}em - 50%))" ' +
            'data-x="${X}" ' +
            'data-y="${Y}" ' +
        '>' +
            '<svg ' +
                'version="1.1" ' +
                'xmlns="http://www.w3.org/2000/svg" ' +
                'width="4.25em" ' +
                'height="5em" ' +
                'viewBox="0 0 500 577" ' +
            '>' +
                '<path ' +
                    'd="M 243 32 Q250 28 257 32 L 468 154 Q 475 158 475 166 L 475 410 Q 475 418 468 422 L 257 544 Q 250 548 243 544 L 32 422 Q 25 418 25 410 L 25 166 Q 25 158 32 154 Z" ' +
                    'stroke="#000" ' +
                    'fill="transparent" ' +
                    'stroke-opacity=".8" ' +
                    'stroke-width="1em" ' +
                    'stroke-dasharray="32, 16" ' +
                '></path>' +
            '</svg>' +
        '</div>',

    cardIdLog:
        '<div class="bon_log-card bon_log-card-${DATA}"></div>',

    tileTypeLog:
        '<div class="bon_log-tile bon_log-tile-${DATA}"></div>',
};

</script>  

{OVERALL_GAME_FOOTER}
