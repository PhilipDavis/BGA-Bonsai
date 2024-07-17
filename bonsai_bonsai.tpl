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
    <div id="bon_goals"></div> 
    <div id="bon_board">
        <div id="bon_slot-0-info" class="bon_slot-info"></div>
        <div id="bon_slot-1-info" class="bon_slot-info"></div>
        <div id="bon_slot-2-info" class="bon_slot-info"></div>
        <div id="bon_slot-3-info" class="bon_slot-info"></div>
        <div id="bon_deck"><div id="bon_deck-count"></div></div>
        <div id="bon_slot-0" class="bon_slot"></div>
        <div id="bon_slot-1" class="bon_slot"></div>
        <div id="bon_slot-2" class="bon_slot"></div>
        <div id="bon_slot-3" class="bon_slot"></div>
    </div>
    <div id="bon_player"></div>
    <div id="bon_opponents"></div>
</div>


<script type="text/javascript">

const bonsai_Templates = {
    playerSummary:
        '<div id="bon_player-summary-${PID}" class="bon_player-summary">' +
            '<div class="bon_stats">' +
                '<span id="bon_player-summary-stat-block-${PID}-capacity" class="bon_player-summary-stat-block">' +
                    '<i class="bon_icon-capacity"></i>' +
                    '<span id="bon_capacity-${PID}" class="bon_player-summary-stat">0</span>' +
                '</span>' +
                '<span id="bon_player-summary-stat-block-${PID}-wood" class="bon_player-summary-stat-block bon_zero">' +
                    '<i class="bon_icon bon_icon-wood"></i>' +
                    '<span id="bon_tree-wood-${PID}" class="bon_player-summary-stat">0</span>' +
                '</span>' +
                '<span id="bon_player-summary-stat-block-${PID}-leaf" class="bon_player-summary-stat-block bon_zero">' +
                    '<i class="bon_icon bon_icon-leaf"></i>' +
                    '<span id="bon_tree-leaf-${PID}" class="bon_player-summary-stat">0</span>' +
                '</span>' +
                '<span id="bon_player-summary-stat-block-${PID}-flower" class="bon_player-summary-stat-block bon_zero">' +
                    '<i class="bon_icon bon_icon-flower"></i>' +
                    '<span id="bon_tree-flower-${PID}" class="bon_player-summary-stat">0</span>' +
                '</span>' +
                '<span id="bon_player-summary-stat-block-${PID}-fruit" class="bon_player-summary-stat-block bon_zero">' +
                    '<i class="bon_icon bon_icon-fruit"></i>' +
                    '<span id="bon_tree-fruit-${PID}" class="bon_player-summary-stat">0</span>' +
                '</span>' +
            '</div>' +
            '<div id="bon_player-summary-goals-${PID}" class="bon_player-summary-goals">' +
            '</div>' +
        '</div>',

    player:
        '<div id="bon_player-${PID}" class="bon_player bon_color-${COLOR}">' +
            '<div class="bon_player-name">${NAME}</div>' +
            '<div id="bon_tree-host-${PID}" class="bon_tree-host">' +
                '<div id="bon_tree-${PID}" class="bon_tree">' +
                    '<div class="bon_pot"></div>' +
                '</div>' +
            '</div>' +
            '<div id="bon_tiles-${PID}" class="bon_tiles-host">' +
            '</div>' +
            '<div id="bon_seishi-host-${PID}" class="bon_seishi-host">' +
                '<div id="bon_seishi-${PID}" class="bon_seishi"></div>' +
                '<div id="bon_seishi-facedown-${PID}" class="bon_seishi-facedown bon_empty"></div>' +
                '<div id="bon_seishi-reference-${PID}" class="bon_seishi-reference"></div>' +
                '<div id="bon_seishi-lhs-${PID}" class="bon_seishi-lhs"></div>' +
                '<div id="bon_seishi-rhs-${PID}" class="bon_seishi-rhs"></div>' +
            '</div>' +
        '</div>',

    cardToolTip:
        '<div id="bon_card-tooltip" class="bon_tooltip">' +
            '<div class="bon_card bon_card-${CARD_ID}">' +
                '<div class="bon_card-face"></div>' +
            '</div>' +
            '<div class="bon_tooltip-title">${TITLE}</div>' +
            '<div class="bon_description">${TEXT}</div>' +
        '</div>',

    referenceToolTip:
        '<div id="bon_reference-tooltip">' +
            '<div class="bon_reference-card"></div>' +
            '<div class="bon_seishi-ref-0">${TEXT0}</div>' +
            '<div class="bon_seishi-ref-1">${TEXT1}</div>' +
            '<div class="bon_seishi-ref-2">${TEXT2}</div>' +
            '<div class="bon_seishi-ref-3">${TEXT3}</div>' +
        '</div>',

    goalTilePlaceholder:
        '<div id="bon_goal-placeholder-${GOAL_ID}" ' +
            'class="bon_goal-placeholder" ' +
        '></div>',

    goalSet:
        '<div id="bon_goal-set-${TYPE}" ' +
            'class="bon_goal-set" ' +
        '></div>',

    goalTile:
        '<div id="bon_goal-${GOAL_ID}" ' +
            'class="bon_goal bon_goal-${GOAL_ID}" ' +
        '></div>',

    summaryGoalTile:
        '<div id="bon_summary-goal-${PID}-${GOAL_ID}" ' +
            'class="bon_goal bon_goal-${GOAL_ID} ${CLASS}" ' +
        '></div>',

    goalTooltip:
        '<div class="bon_tooltip">' +
            '<div class="bon_tooltip-title">' +
                '${TITLE}' +
            '</div>' +
            '<p class="bon_tooltip-text">' +
                '${TEXT}' +
            '</p>' +
            '<p class="bon_tooltip-text">' +
                '${POINTS}' +
            '</p>' +
            '<p class="bon_tooltip-warning">' +
                '${WARN}' +
            '</p>' +
            '<p class="bon_tooltip-status">' +
                '<span class="fa fa-md ${ICON}"></span>' +
                '${STATUS}' +
            '</p>' +
        '</div>',

    tile:
        '<div id="bon_tile-${TILE_ID}" ' +
            'class="bon_tile bon_tile-${TYPE}" ' +
            'data-type="${TYPE}" ' +
            'data-r="${R}" ' +
            'style="transform: translate(calc(${X_EM}em - 50%), calc(${Y_EM}em - 50%)) scale(.975) rotate(${DEG}deg)"' +
        '></div>',

    tileHost:
        '<div id="${DIV_ID}" ' +
            'class="bon_tile-placeholder" ' +
            'data-type="${TYPE}" ' +
        '></div>',

    deckCard:
        '<div id="bon_deck-card-${INDEX}" class="bon_card bon_card-face-down">' +
            '<div class="bon_card-back"></div>' +
        '</div>',

    card:
        '<div '+
            'id="bon_card-${CARD_ID}" ' +
            'class="bon_card bon_card-${CARD_ID} ${DOWN}" ' +
            'data-cardId="${CARD_ID}" ' +
        '>' +
            '<div class="bon_card-face"></div>' +
            '<div class="bon_card-back"></div>' +
        '</div>',

    cardHost:
        '<div ' +
            'id="bon_card-host-${CARD_ID}" ' +
            'class="bon_card-host" ' +
        '>' +
        '</div>',

    seishiFaceDownCard:
        '<div class="bon_card bon_card-${CARD_ID}">' +
            '<div class="bon_card-face"></div>' +
        '</div>',

    vacancy:
        '<div ' +
            'id="${DIV_ID}" ' +
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

    actionBarResourceType:
        '<span ' +
            'class="bon_resource bon_resource-${TYPE}" ' +
            'data-type="${TYPE}" ' +
        '></span>',

    cardIdLog:
        '<div id="${_UNIQUEID}" class="bon_log-card bon_log-card-${DATA}"></div>',

    tileTypeLog:
        '<div class="bon_log-tile bon_log-tile-${DATA}"></div>',

    goalLog:
        '<div id="${_UNIQUEID}" class="bon_log-goal bon_goal-${DATA}"></div>',

    soloObjectivesPanel:
        '<div id="bon_solo-panel">' +
        '</div>',

    soloObjective:
        '<div id="${DIV_ID}" class="bon_solo-obj">' +
            '<span class="bon_solo-obj-status fa fa-md fa-angle-double-right"></span>' +
            '<span class="bon_solo-obj-text">${TEXT}</span>' +
        '</div>',

    finalScores:
        '<div id="bon_final-scores">' +
            '<div id="bon_final-scores-table">' +
            '</div>' +
        '</div>',

    finalScoreHeader:
        '<div '+
            'class="bon_final-score-header" ' +
            'style="color: ${COLOR};" ' +
        '>' +
            '${TEXT}' +
        '</div>',

    finalScoreValue:
        '<div '+
            'id="${DIV_ID}" ' +
            'class="bon_final-score-value" ' +
            'style="color: ${COLOR}; font-weight: ${WEIGHT};" ' +
        '>' +
            '${TEXT}' +
        '</div>',
};

</script>  

{OVERALL_GAME_FOOTER}
