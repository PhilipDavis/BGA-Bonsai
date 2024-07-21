/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Bonsai implementation : © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

define([
    "dojo",
    "dojo/_base/declare",
    "bgagame/modules/PhilsUtils/PhilsUtils.core.v1",
    "bgagame/modules/PhilsUtils/PhilsUtils.ui.v1",
    "bgagame/modules/BonsaiLogic",
    "bgagame/modules/BonsaiActions",
    "ebg/core/gamegui",
    "ebg/counter",
],
function (
    dojo,
    declare,
    { install, formatBlock, __, createFromTemplate, stringFromTemplate, invokeServerActionAsync },
    { delayAsync, transitionStyleAsync, WorkflowManager, ActionStack, SetClientState, UndoLastAction, reflow },
    { BonsaiLogic, Cards, CardType, ResourceType, ColorNames, makeKey, parseKey, Goals, GoalStatus, TileType, TileTypeName, SoloPointsRequired },
    { FlipPotAction, PlaceTileAction, TakeCardAction, ReceiveTilesAction, RenounceGoalAction, ClaimGoalAction, DiscardExcessTileAction, RemoveTilesAction },
) {
    const BgaGameId = 'bonsai';

    let bonsai; // BonsaiLogic

    // How many milliseconds to hover before showing a tooltip
    const ToolTipDelay = 500;

    const TileTypeLabel = {};

    const Preference = {
        SortedTilesAndCards: 301,
    };


    return declare(`bgagame.${BgaGameId}`, ebg.core.gamegui, {
        constructor() {
            console.log(`${BgaGameId} constructor`);

            // EBG Counters
            this.placed = {};    // Number of tiles each player has in their tree
            this.capacity = {};  // Maximum tiles the player is allowed to have
            this.scoreCounter = {};

            this.resetClientStateArgs();
            this.actionStack = new ActionStack(this, this.lockClient, this.unlockClient);
            this.workflowManager = new WorkflowManager(this, this.actionStack);
        },
        
        setup(gamedata)
        {            
            console.log('Starting game setup', gamedata);

            // Hook into this object and overwrite default BGA functions with enhanced functions
            // Note: on Studio, the complete server state is sent to the client
            install(dojo, this, 'bon_surface', { debug: !!gamedata.state });
            
            const { data, scores } = gamedata;
            bonsai = new BonsaiLogic(data, this.myPlayerId);
            window.bonsai = bonsai; // For convenience during debugging

            this.toolTipText = {
                'bon_goal-set-1-title': __('Bujin-ji Style Goal'),
                'bon_goal-set-2-title': __('Moyogi Style Goal'),
                'bon_goal-set-3-title': __('Chokkan Style Goal'),
                'bon_goal-set-4-title': __('Shakan Style Goal'),
                'bon_goal-set-5-title': __('Kengai Style Goal'),
                'bon_goal-set-1': __('Your bonsai must have *${n}* wood tiles, including the starting bud tile.'),
                'bon_goal-set-2': __('Your bonsai must have *${n}* leaf tiles, adjacent to one another.'),
                'bon_goal-set-3': __('Your bonsai must have *${n}* fruit tiles.'),
                'bon_goal-set-4': __('Your bonsai must have *${n}* flower tiles that protrude from the *same side* of the Pot (it does not matter if it\'s the right or the left side).'),
                'bon_goal-13': __('Your bonsai must have a tile which *protrudes* out of the pot (on the side with the gold crack).'),
                'bon_goal-14': __('Your bonsai must have tiles *protruding* from *both sides* of the pot.'),
                'bon_goal-15': __('Your bonsai must have a tile *protruding* out of the pot on *one side*, and another tile *below* the pot on the *other side* (the specific sides do not matter).'),
                'bon_goal-warning': __('You may only claim *one Goal tile per color*'),
                'bon_goal-status-1': __('You are *not yet eligible* for this goal (*${n}* more)'),
                'bon_goal-status-2': __('You may *claim* this goal'),
                'bon_goal-status-3': __('You have *renounced* this goal'),
                'bon_goal-status-4': __('You have *claimed* this goal'),
                'bon_goal-status-5': __('You have already claimed a goal of this type'),
                'bon_goal-status-6': __('Your opponent claimed this goal'),
                'bon_goal-set-1-short': __('You need *${n}* more wood tiles to qualify'),
                'bon_goal-set-2-short': __('You need *${n}* more adjacent leaf tiles to qualify'),
                'bon_goal-set-3-short': __('You need *${n}* more fruit tiles to qualify'),
                'bon_goal-set-4-short': __('You need *${n}* more flowers on the same side to qualify'),
                'bon_goal-set-5-short': __('You need *${n}* more criteria to qualify'),
                'bon_slot-0-info': __('If you draw the card in this position, you do not take any bonsai tiles.'),
                'bon_slot-1-info': __('If you draw the card in this position, you may take 1 wood *or* 1 leaf tile.'),
                'bon_slot-2-info': __('If you draw the card in this position, you may take 1 wood *and* 1 flower tile.'),
                'bon_slot-3-info': __('If you draw the card in this position, you may take 1 leaf *and* 1 fruit tile.'),
                'bon_seishi-ref-0': __('*Wood* tiles are worth *0* points'),
                'bon_seishi-ref-1': __('*Leafs* tiles /in your bonsai/ are worth *3* points'),
                'bon_seishi-ref-2': __('*Flower* tiles /in your bonsai/ are worth *0 - 5* points || (*1* point for each side not touching any other Bonsai tile)'),
                'bon_seishi-ref-3': __('*Fruit* tiles /in your bonsai/ are worth *7* points'),
                'bon_tile-wood': __('*Wood*: must be placed adjacent to another wood tile.'),
                'bon_tile-leaf': __('*Leaf*: must be placed adjacent to a wood tile.'),
                'bon_tile-flower': __('*Flower*: must be placed adjacent to a leaf tile.'),
                'bon_tile-fruit': __('*Fruit*: must be placed in the space adjacent to two adjacent leaf tiles. *You may not place a fruit adjacent to another fruit.*'),
                'bon_card-type-1-title': _('Tool cards'),
                'bon_card-type-2-title': _('Growth cards'),
                'bon_card-type-3-title': _('Master cards'),
                'bon_card-type-4-title': _('Helper cards'),
                'bon_card-type-5-title': _('Parchment cards'),
                'bon_card-type-1-description': __('Tool cards stay *in front of you for the rest of the game*. For each copy of this card you have, at the end of each turn, you can keep two additional tiles in your personal supply.'),
                'bon_card-type-2-description': __('Growth cards stay *in front of you for the rest of the game*. When you /Cultivate/, you may place all tiles represented on your Growth cards in addition to the ones you can place thanks to your Seishi tile. If you have multiple copies of the same card, their effects add up. Choose freely the order in which you place the tiles. Each placement is optional.'),
                'bon_card-type-3-description': __('Master cards are *activated once* when you take them, then they are kept *face down in a pile* beside your Seishi tile. |||| Take the tiles shown on the card from the common supply. Take these tiles *in addition* to the tiles you would normally take depending on the position of the card on the board. Remember to respect your capacity limit at the end of your turn.'),
                'bon_card-type-4-description': __('Helper cards are *activated once* when you take them, then they are kept *face down in a pile* beside your Seishi tile. |||| Place in your bonsai one tile of your choice, and/or one tile of the type shown, taken from your *personal supply* (you may place tiles you just took along with this card).'),
                'bon_card-type-5-description': __('Parchment cards are kept *face down in a pile* beside your Seishi tile. At the end of the game, each Parchment card awards points depending on the depicted images.'),
                'bon_deck': __('When the last card from the deck is revealed, the game end is triggered: All players, including the one who triggered the end, get one more turn and then the game ends and points are tallied.'),
                'bon_seishi': __('At the start of the game, you only have your Seishi tile to place bonsai tiles. It allows you to place up to *one tile of your choice*, *one wood tile*, and *one leaf tile* during a /Cultivate/ action, in any order. |||| As the game progresses, you can acquire Growth cards that allow you to place more tiles when you choose to /Cultivate/.'),
            };

            TileTypeLabel[TileType.Wood] = _('Wood');
            TileTypeLabel[TileType.Leaf] = _('Leaf');
            TileTypeLabel[TileType.Flower] = _('Flower');
            TileTypeLabel[TileType.Fruit] = _('Fruit');

            // Set up the goals
            for (const goalId of bonsai.allGoals) {
                const claimed = bonsai.data.goalTiles.indexOf(goalId) < 0;
                this.createGoalTilePlaceholder(goalId, claimed);
            }

            const sortMeFirst = (a, b) => {
                if (a[0] == this.myPlayerId) return -1;
                if (b[0] == this.myPlayerId) return 1;
                // For spectator mode, the order doesn't really matter
                return Number(a[0]) - Number(b[0]);
            }

            // Setting up player boards
            const isGameOver = gamedata.gamestate.id == "99";
            for (const [ playerId, player ] of Object.entries(bonsai.players).sort(sortMeFirst)) {
                this.setupPlayer(playerId, player, scores[playerId].total, isGameOver);
            }

            // Create the shared board
            for (let i = 0; i < 4; i++) {
                const cardId = bonsai.board[i];
                document.getElementById(`bon_slot-${i}`).addEventListener('click', () => this.onClickSlot(i));
                if (cardId !== null) {
                    this.createCard(cardId, true, `bon_slot-${i}`);
                }

                const slotInfoId = `bon_slot-${i}-info`;
                this.addTooltipHtml(slotInfoId, this.toolTipText[slotInfoId], ToolTipDelay);
            }
            
            this.updateDeck();
            this.addTooltipHtml('bon_deck', this.toolTipText['bon_deck'], ToolTipDelay);

            if (Object.keys(bonsai.players).length === 1) {
                this.createSoloPanel(bonsai.players[this.myPlayerId]);
            }

            const playerInventoryTilesDiv = document.getElementById(`bon_tiles-${this.myPlayerId}`);
            playerInventoryTilesDiv?.addEventListener('click', e => {
                const { target } = e;
                if (!target.classList.contains('bon_tile')) return;
                if (!target.classList.contains('bon_selectable')) return;
                this.onClickInventoryTile(target.id, parseInt(target.dataset.type, 10));
            });

            this.updateGoalTooltips();

            if (this.gamedatas.gamestate.id == '99') {
                this.animateFinalScoresAsync(scores, false);
            }

            // If the browser window is resized, schedule the trees
            // to be repositioned. Only do the repositioning once
            // the resizing has been idle for a while.
            this.resizeTimerId = null;
            this.resizeObserver = new ResizeObserver(() => {
                clearTimeout(this.resizeTimerId);
                this.resizeTimerId = setTimeout(() => {
                    for (const playerId of bonsai.data.order) {
                        this.adjustTreeSizeAndPosAsync(playerId);
                    }
                }, 200);
            });
            const surfaceDiv = document.getElementById('bon_surface');
            this.resizeObserver.observe(surfaceDiv);

            this.bThisGameSupportsFastReplay = true;
        },

        setupPlayer(playerId, player, score, isGameOver) {
            const playerScoreDiv = document.querySelector(`#player_board_${playerId} .player_score`);
            createFromTemplate('bonsai_Templates.playerSummary', {
                PID: playerId,
            }, playerScoreDiv, { placement: 'afterend' });

            createFromTemplate('bonsai_Templates.player', {
                PID: playerId,
                COLOR: ColorNames[player.color],
            }, playerId == this.myPlayerId ? 'bon_player' : 'bon_opponents');

            if (playerId != this.myPlayerId) {
                const divId = `bon_player-${playerId}`;
                const playerDiv = document.getElementById(divId);
                const nameDiv = playerDiv.querySelector('.bon_player-name');
                nameDiv.innerText = gameui.gamedatas.players[playerId]?.name || '';
            }
    
            // Add the tree tiles of this user (skip the first tile)
            const [ firstWoodTile, ...playerTiles ] = player.played;
            bonsai.trees[playerId].placeTile(firstWoodTile[0], firstWoodTile[1], firstWoodTile[2], firstWoodTile[3]);
            for (const [ type, x, y, r ] of playerTiles) {
                bonsai.trees[playerId].placeTile(type, x, y, r);
                this.createTileInTree(playerId, type, x, y, r);
            }

            // Flip the player's pot, if necessary
            const isFlipped = firstWoodTile[1] == 1;
            if (isFlipped) {
                const treeDivId = `bon_tree-${playerId}`;
                const treeDiv = document.getElementById(treeDivId);
                const potDiv = treeDiv.querySelector('.bon_pot');
                potDiv.style.transform = 'translate(-50%, 0) rotateY(180deg)';
            }

            this.adjustTreeSizeAndPosAsync(playerId);

            this.scoreCounter[playerId] = new ebg.counter();
            this.scoreCounter[playerId].create(`player_score_${playerId}`);
            setTimeout(() => {
                this.scoreCounter[playerId].setValue(score);
            }, 0);

            const placed = {
                [TileType.Wood]: new ebg.counter(),
                [TileType.Leaf]: new ebg.counter(),
                [TileType.Flower]: new ebg.counter(),
                [TileType.Fruit]: new ebg.counter(),
            };
            this.placed[playerId] = placed;

            for (const tileType of Object.values(TileType)) {
                for (let i = 0; i < player.inventory[TileTypeName[tileType]]; i++) {
                    this.createTileInInventory(playerId, tileType);
                }

                placed[tileType].create(`bon_tree-${TileTypeName[tileType]}-${playerId}`);
                this.setPlayerPlaced(playerId, tileType, playerTiles.reduce((sum, t) => sum + (t[0] == tileType ? 1 : 0), 0));
            }

            this.capacity[playerId] = new ebg.counter();
            this.capacity[playerId].create(`bon_capacity-${playerId}`);
            this.setPlayerCapacity(playerId, player.capacity);

            const [ lhs, rhs ] = bonsai.getPlayerSeishi(playerId);
            for (const cardId of lhs) {
                this.createCard(cardId, true, `bon_seishi-lhs-${playerId}`);
            }
            if (gameui.userWantsSorting()) {
                rhs.sort((a, b) => Cards[a].resource - Cards[b].resource);
            }
            for (const cardId of rhs) {
                this.createCard(cardId, true, `bon_seishi-rhs-${playerId}`);
            }

            if (isGameOver) {
                const playerDiv = document.getElementById(`bon_player-${playerId}`);
                const parentId = `bon_reveal-cards-${playerId}`;
                playerDiv.insertAdjacentHTML('beforeend', `<div id="${parentId}" class="bon_reveal-cards"></div>`);

                if (typeof player.faceDown === 'object') { // faceDown will still be a number in an abandoned game
                    for (const cardId of player.faceDown.sort()) {
                        this.createCard(cardId, true, parentId);
                    }
                }
            }
            else {
                const hasFaceDownCards =
                    playerId == this.myPlayerId
                        ? player.faceDown.length
                        : player.faceDown
                const faceDownPileDiv = document.getElementById(`bon_seishi-facedown-${playerId}`);
                if (hasFaceDownCards) {
                    faceDownPileDiv.classList.remove('bon_empty');
                }
                else {
                    faceDownPileDiv.classList.add('bon_empty');
                }

                if (playerId == this.myPlayerId) {
                    faceDownPileDiv.addEventListener('click', () => this.onClickFaceDownPile());
                }
            }

            // Add renounced and claimed goals to the player summary board
            for (const goalId of player.renounced) {
                this.createSummaryGoalTilePlaceholder(playerId, goalId, true, false);
                if (playerId == this.myPlayerId) {
                    // Assuming the goal hasn't been claimed by another player,
                    // show on the main playing surface that it has been renounced. 
                    const goalDiv = document.getElementById(`bon_goal-${goalId}`);
                    goalDiv?.classList.add('bon_renounced');
                }
            }
            for (const goalId of player.claimed) {
                this.createSummaryGoalTilePlaceholder(playerId, goalId, true, true);
                if (playerId == this.myPlayerId) {
                    // Grey out goals of the same type so that the player knows the goal is unavailable1
                    for (const availableGoalId of bonsai.data.goalTiles) {
                        if (Goals[goalId].type === Goals[availableGoalId].type) {
                            const goalDiv = document.getElementById(`bon_goal-${availableGoalId}`);
                            goalDiv?.classList.add('bon_ineligible');
                        }
                    }
                }
            }

            const html = formatBlock('bonsai_Templates.referenceToolTip', {
                TEXT0: this.toolTipText['bon_seishi-ref-0'],
                TEXT1: this.toolTipText['bon_seishi-ref-1'],
                TEXT2: this.toolTipText['bon_seishi-ref-2'],
                TEXT3: this.toolTipText['bon_seishi-ref-3'],
            });
            this.addTooltipHtmlToClass('bon_seishi-reference', html, ToolTipDelay);

            this.addTooltipHtmlToClass('bon_seishi', this.toolTipText['bon_seishi'], ToolTipDelay);
        },

        userWantsSorting() {
            return gameui.getGameUserPreference(Preference.SortedTilesAndCards) == '2';
        },

        createSoloPanel() {
            createFromTemplate('bonsai_Templates.soloObjectivesPanel', {}, 'bon_goals', { placement: 'afterbegin' });

            const msg = stringFromTemplate(_('Score at least ${N} points'), { N: SoloPointsRequired[bonsai.options.solo || 1] });
            createFromTemplate('bonsai_Templates.soloObjective', {
                DIV_ID: 'bon_solo-obj-points',
                TEXT: msg,
            }, 'bon_solo-panel');

            createFromTemplate('bonsai_Templates.soloObjective', {
                DIV_ID: 'bon_solo-obj-goal1',
                TEXT: _('Claim 1st goal'),
            }, 'bon_solo-panel');

            createFromTemplate('bonsai_Templates.soloObjective', {
                DIV_ID: 'bon_solo-obj-goal2',
                TEXT: _('Claim 2nd goal'),
            }, 'bon_solo-panel');

            createFromTemplate('bonsai_Templates.soloObjective', {
                DIV_ID: 'bon_solo-obj-goal3',
                TEXT: _('Claim 3rd goal'),
            }, 'bon_solo-panel');

            this.updateSoloPanel();
        },

        updateSoloPanel() {
            if (!bonsai.isSolo) return;
            const playerId = bonsai.data.order[0];
            const player = bonsai.players[playerId];

            this.updateSoloObjective('bon_solo-obj-points', bonsai.getPlayerScore(playerId) >= SoloPointsRequired[bonsai.options.solo || 1]);

            for (let i = 0; i < 3; i++) {
                this.updateSoloObjective(`bon_solo-obj-goal${i + 1}`, player.claimed.length > i);
            }
        },

        updateSoloObjective(objDivId, met) {
            const objDiv = document.getElementById(objDivId);
            if (!objDiv) return;
            const statusDiv = objDiv.querySelector('.bon_solo-obj-status');
            if (met) {
                objDiv.classList.add('bon_solo-obj-met');
                statusDiv.classList.remove('fa-angle-double-right');
                statusDiv.classList.add('fa-check');
            }
            else {
                objDiv.classList.remove('bon_solo-obj-met');
                statusDiv.classList.remove('fa-check');
                statusDiv.classList.add('fa-angle-double-right');
            }
        },

        async revealFaceDownCardsAsync(playerId, cardIds) {
            // Create a place below the Seishi area to display the hidden cards
            const playerDiv = document.getElementById(`bon_player-${playerId}`);
            const parentId = `bon_reveal-cards-${playerId}`;
            playerDiv.insertAdjacentHTML('beforeend', `<div id="${parentId}" class="bon_reveal-cards"></div>`);

            // Remove the face down pile
            const pileDivId = `bon_seishi-facedown-${playerId}`;
            const pileDiv = document.getElementById(pileDivId);
            pileDiv?.parentElement.removeChild(pileDiv);

            // TODO: animate the cards from the facedown pile into a face up row

            for (const cardId of cardIds.sort()) {
                this.createCard(cardId, true, parentId);
            }
        },

        calculateDeckHeight() {
            const { drawPile } = bonsai.data;
            if (drawPile > 35) return 12;
            if (drawPile > 25) return 11;
            if (drawPile > 20) return 10;
            if (drawPile > 15) return 9;
            if (drawPile > 10) return 8;
            if (drawPile > 7) return 7;
            if (drawPile > 5) return 6;
            if (drawPile > 4) return 5;
            if (drawPile > 3) return 4;
            if (drawPile > 2) return 3;
            if (drawPile > 1) return 2;
            if (drawPile > 0) return 1;
            return 0;
        },

        updateDeck() {
            const desiredDeckSize = this.calculateDeckHeight();
            const deckDiv = document.getElementById('bon_deck');
            let actualDeckSize = deckDiv.childElementCount - 1;
            while (actualDeckSize < desiredDeckSize) {
                createFromTemplate('bonsai_Templates.deckCard', {
                    INDEX: actualDeckSize,
                }, deckDiv, { placement: 'afterbegin' });
                actualDeckSize++;
            }
            while (actualDeckSize > desiredDeckSize) {
                deckDiv.removeChild(deckDiv.firstElementChild);
                actualDeckSize--;
            }
            if (actualDeckSize > 0) {
                deckDiv.classList.remove('bon_empty');
            }
            else {
                deckDiv.classList.add('bon_empty');
            }

            const countDiv = document.getElementById('bon_deck-count');
            countDiv.dataset.count = bonsai.data.drawPile;
        },

        onClickFaceDownPile() {
            if (this.isSpectator) return 0;

            // Group cards of the same type together
            function sortFaceDownCards(cardA, cardB) {
                typeA = Cards[cardA].type;
                typeB = Cards[cardB].type;
                if (typeA !== typeB) return typeA - typeB;
                return cardA - cardB;
            }


            const player = bonsai.players[this.myPlayerId];
            if (!player) return;
            const html = player.faceDown.sort(sortFaceDownCards).reduce((html, cardId) => {
                return html + formatBlock('bonsai_Templates.seishiFaceDownCard', {
                    CARD_ID: cardId,
                });
            }, '');

            const dialog = new ebg.popindialog();
            dialog.create('bon_face-down-pile-revealed');
            dialog.setTitle(_('Your Hidden Cards'));
            dialog.setContent(html);
            dialog.show();
        },


        ///////////////////////////////////////////////////
        //// UI methods

        // Given an (x,y) position in the tree, return the
        // EM coordinates of that tile in the tree.
        // Since the play surface is hex-based, we offset
        // odd rows by -1/2
        emsFromCoords({ x, y }) {
            return {
                xEm: (x - 1) * 4.25 + (y % 2 ? 0 : 2.125),
                yEm: (y - 1) * -3.8 - 2,
            };
        },

        createCard(cardId, faceUp, parentDivId = 'bon_surface') {
            createFromTemplate('bonsai_Templates.card', {
                CARD_ID: cardId,
                DOWN: faceUp ? '' : 'bon_card-face-down',
            }, parentDivId);

            const actualCardId = parseInt(cardId, 10);
            if (!isNaN(actualCardId)) {
                const { type } = Cards[actualCardId];
                const html = formatBlock('bonsai_Templates.cardToolTip', {
                    CARD_ID: actualCardId,
                    TITLE: this.toolTipText[`bon_card-type-${type}-title`],
                    TEXT: this.toolTipText[`bon_card-type-${type}-description`],
                });
                this.addTooltipHtml(`bon_card-${actualCardId}`, html, ToolTipDelay);
            }
        },

        createGoalSet(type) {
            const divId = `bon_goal-set-${type}`;
            if (!document.getElementById(divId)) {
                createFromTemplate('bonsai_Templates.goalSet', {
                    TYPE: type,
                }, 'bon_goals');
            }
            return divId;
        },

        createGoalTilePlaceholder(goalId, claimed) {
            const { type, req, points } = Goals[goalId];

            const setId = this.createGoalSet(type);

            createFromTemplate('bonsai_Templates.goalTilePlaceholder', {
                GOAL_ID: goalId,
            }, setId);
            const placeholderId = `bon_goal-placeholder-${goalId}`;

            if (!claimed) {
                this.createGoalTile(goalId, placeholderId);
            }
        },

        createGoalTile(goalId, parentId) {
            createFromTemplate('bonsai_Templates.goalTile', {
                GOAL_ID: goalId,
            }, parentId);
            const divId = `bon_goal-${goalId}`;
            const goalDiv = document.getElementById(divId);
            goalDiv.addEventListener('click', () => this.onClickGoal(goalId));
        },

        createSummaryGoalTilePlaceholder(playerId, goalId, visible = true, claimed = true) {
            createFromTemplate('bonsai_Templates.summaryGoalTile', {
                GOAL_ID: goalId,
                PID: playerId,
                CLASS: visible ? '' : 'bon_hidden',
            }, `bon_player-summary-goals-${playerId}`);
            const divId = `bon_summary-goal-${playerId}-${goalId}`;
            const goalDiv = document.getElementById(divId);
            if (!claimed) {
                goalDiv.insertAdjacentHTML('beforeend', '<div class="bon_renounced fa fa-close fa-lg"></div>');
            }
            return goalDiv;
        },

        updateGoalTooltips() {
            const statusIcons = {
                [GoalStatus.None]: '',
                [GoalStatus.Ineligible]: 'fa-lock',
                [GoalStatus.Eligible]: 'fa-check',
                [GoalStatus.Renounced]: 'fa-ban',
                [GoalStatus.Claimed]: 'fa-trophy',
                [GoalStatus.ClaimedType]: 'fa-close',
                [GoalStatus.Opponent]: 'fa-close',
            };

            for (const { goalId, status, short } of bonsai.getGoalStatuses()) {
                const { type, req, points } = Goals[goalId];
                const setId = `bon_goal-set-${type}`;
                const className = `bon_goal-${goalId}`;

                const html = formatBlock('bonsai_Templates.goalTooltip', {
                    GOAL_ID: goalId,
                    TITLE: stringFromTemplate(this.toolTipText[`${setId}-title`]),
                    TEXT: stringFromTemplate(this.toolTipText[className] || this.toolTipText[setId], {
                        n: req,
                    }),
                    WARN: this.toolTipText['bon_goal-warning'],
                    STATUS: this.isSpectator ? '' : stringFromTemplate(this.toolTipText[`bon_goal-status-${status}`], {
                        n: short,
                    }),
                    ICON: statusIcons[status],
                    POINTS: stringFromTemplate(__('Value: *${n}* Points'), {
                        n: points,
                    }), 
                });

                // Note: the divId is also used as the class name
                // but we need to use the class name for tool tips
                // because the divId will be different for goals
                // that are in the player summary boards.
                this.addTooltipHtmlToClass(className, html, ToolTipDelay);
            }
        },

        createTile(playerId, tileType, parentDivOrId) {
            const tileId = `${playerId}-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: tileId,
                TYPE: tileType,
                X_EM: 0,
                Y_EM: 0,
                DEG: 0,
            }, parentDivOrId);
            return document.getElementById(`bon_tile-${tileId}`);
        },

        createTileOnSlot(tileId, tileType, slot) {
            const divId = `bon_tile-${tileId}`;
            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: tileId,
                TYPE: tileType,
                X_EM: 2.5,
                Y_EM: 3.25,
                DEG: 0,
            }, `bon_slot-${slot}`);
            this.addTooltipHtml(divId, this.toolTipText[`bon_tile-${TileTypeName[tileType]}`], ToolTipDelay);
            this.placeOnObject(divId, `bon_slot-${slot}`);
            this.raiseElementToBody(divId);
        },

        createTileInTree(playerId, tileType, x, y, r, visible = true) {
            const { xEm, yEm } = this.emsFromCoords({ x, y });

            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: `${playerId}-${x}-${y}`,
                TYPE: tileType,
                X_EM: xEm,
                Y_EM: yEm,
                R: r,
                DEG: Number(r) * 60,
            }, `bon_tree-${playerId}`);
            const tileDiv = document.getElementById(`bon_tile-${playerId}-${x}-${y}`);
            if (!visible) {
                tileDiv.classList.add('bon_hidden');
            }
            return tileDiv;
        },

        createTileInInventory(playerId, tileType) {
            const tileId = `${playerId}-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: tileId,
                TYPE: tileType,
                X_EM: 0,
                Y_EM: 0,
                DEG: 0,
            }, `bon_tiles-${playerId}`);
            const divId = `bon_tile-${tileId}`;
            this.addTooltipHtml(divId, this.toolTipText[`bon_tile-${TileTypeName[tileType]}`], ToolTipDelay);
            return document.getElementById(divId);
        },

        createTilePlaceholderInInventory(playerId, tileType) {
            const hostId = `bon_tiles-${playerId}`;

            // Place tiles in order if the user prefers sorted tiles
            if (this.userWantsSorting()) {
                const hostDiv = document.getElementById(hostId);
                let index = 0;
                let tileDiv = hostDiv.firstElementChild;
                while (tileDiv && tileType >= parseInt(tileDiv.dataset.type, 10)) {
                    index++;
                    tileDiv = tileDiv.nextElementSibling;
                }
                return this.createTilePlaceholderInInventoryAtIndex(playerId, index, tileType);
            }

            // Otherwise, just place the new tile at the end
            const divId = `bon_tile-placeholder-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tileHost', {
                DIV_ID: divId,
                TYPE: tileType,
            }, hostId);
            return document.getElementById(divId);
        },

        createTilePlaceholderInInventoryAtIndex(playerId, index, tileType) {
            const hostDiv = document.getElementById(`bon_tiles-${playerId}`);
            const divId = `bon_tile-placeholder-${Math.random().toString(28).substring(2)}`;
            if (index === 0) {
                createFromTemplate('bonsai_Templates.tileHost', {
                    DIV_ID: divId,
                    TYPE: tileType,
                }, hostDiv, { placement: 'afterbegin' });
            }
            else {
                let sibling = hostDiv.firstElementChild;
                while (--index > 0) {
                    sibling = sibling.nextElementSibling;
                }
                createFromTemplate('bonsai_Templates.tileHost', {
                    DIV_ID: divId,
                    TYPE: tileType,
                }, sibling, { placement: 'afterend' });
            }
            return document.getElementById(divId);
        },

        replaceInventoryTileWithPlaceholder(tileDiv) {
            if (!tileDiv) {
                throw new Error('Missing div');
            }
            const divId = `bon_tile-placeholder-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tileHost', {
                DIV_ID: divId,
                TYPE: tileDiv.dataset.type,
            }, tileDiv, { placement: 'beforeend' });
            const placeholderDiv = document.getElementById(divId);
            placeholderDiv.style.width = '4.25em';
            placeholderDiv.parentElement.removeChild(placeholderDiv);
            tileDiv.replaceWith(placeholderDiv);
            placeholderDiv.appendChild(tileDiv);
            return placeholderDiv;
        },

        createVacancy(playerId, x, y) {
            const divId = `bon_vacancy-${x}-${y}`;
            const existing = document.getElementById(divId);
            if (existing) return existing;

            const { xEm, yEm } = this.emsFromCoords({ x, y });
            createFromTemplate('bonsai_Templates.vacancy', {
                DIV_ID: divId,
                X: x,
                Y: y,
                X_EM: xEm,
                Y_EM: yEm,
            }, `bon_tree-${playerId}`);

            const div = document.getElementById(divId);
            div.addEventListener('click', e => this.onClickVacancy.call(this, e));
            return div;
        },

        //
        // Determine the game coordinates that contain the entire tree.
        // This is used for positioning the tree within the play area.
        //
        calculateBoundingCoords(playerId) {
            let x1 = -1.5; // Left side of pot
            let y1 = 0; // Bottom of the bud (the first wood tile)
            let x2 = 2.5; // Right side of pot
            let y2 = 0; // Top of pot
            
            const { played } = bonsai.players[playerId];
            for (let [ , x, y ] of played) {
                if (y % 2) x -= 0.5; // Adjust for hex grid offsetting of alternating rows
                x1 = Math.min(x1, x);
                y1 = Math.min(y1, y);
                x2 = Math.max(x2, x);
                y2 = Math.max(y2, y);
            }

            return { x1, y1, x2, y2, y1Pot: -1 };
        },

        async adjustTreeSizeAndPosAsync(playerId) {
            if (!playerId) playerId = this.myPlayerId;

            const hostDiv = document.getElementById(`bon_tree-host-${playerId}`);
            if (!hostDiv) return;

            //
            // Create a temporary invisible container and tile to
            // measure the reference size of a tile.
            //
            const hiddenDiv = document.createElement('div');
            hiddenDiv.classList.add('bon_hidden');
            hostDiv.appendChild(hiddenDiv);

            const referenceTileDiv = this.createTile(playerId, TileType.Wood, hiddenDiv);
            const tileRect = referenceTileDiv.getBoundingClientRect();
            const tileWidth = Math.round(tileRect.width);
            const tileHeight = Math.round(tileRect.height);
            const hPadding = 2 * tileWidth;
            const vPadding = tileHeight * .73 + tileHeight;

            // Remove the temporary container and reference tile
            hostDiv.removeChild(hiddenDiv);

            const rect = hostDiv.getBoundingClientRect();

            const { x1, y1, x2, y2, y1Pot } = this.calculateBoundingCoords(playerId);
            const width = (x2 - (x1 - 1) + 1) * tileWidth;
            const paddedWidth = width + hPadding;

            const aboveTableRows = y2 - Math.max(y1, y1Pot) + 1;
            const aboveTableHeight = (aboveTableRows - 1) * tileHeight * .73 + tileHeight;

            const belowTableRows = Math.max(y1, y1Pot) - y1;
            const belowTableHeight = belowTableRows * tileHeight * .73;

            const height = aboveTableHeight + belowTableHeight;
            const paddedHeight = Math.round(height + vPadding);

            // Calculate the horizontal scale that fits the entire tree
            // width in the container rectangle.
            const scale = Math.min(1, rect.width / paddedWidth);

            const threshold = 3;
            if (paddedHeight * scale - rect.height > threshold) {
                console.log(`Growing height to ${paddedHeight}px (scale ${scale})`);
                hostDiv.style.height = `${paddedHeight}px`;
            }
            else if (paddedHeight * scale - rect.height < threshold) {
                console.log(`Shrinking height to ${paddedHeight}px (scale ${scale})`);
                hostDiv.style.height = `${paddedHeight}px`;
            }

            // Shift to the left or the right as the tree grows
            // past either edge of the playable area
            const leftWidth = Math.round(-(x1 - 1) * tileWidth + hPadding / 2);
            const rightWidth = Math.round(x2 * tileWidth + hPadding / 2);
            const hOffset = (rightWidth - leftWidth) / 2;
            const leftOverflow = Math.round(Math.max(0, -((x1 - 1) * tileWidth - hPadding / 2) - rect.width / 2));
            const rightOverflow = Math.round(Math.max(0, (x2 * tileWidth + hPadding / 2) - rect.width / 2));

            const treeDiv = document.getElementById(`bon_tree-${playerId}`);

            function setStyle(style) {
                style.transform = `scale(${scale})`;
    
                // Shift the pot upwards if the tree grows below the pot
                style.bottom = `${belowTableHeight}px`;

                if (leftOverflow || rightOverflow) {
                    style.left = `calc(50% - ${hOffset}px)`;
                }
                else {
                    style.left = '50%';
                }
            }

            if (gameui.instantaneousMode) {
                setStyle(treeDiv.style);
            }
            else {
                await transitionStyleAsync(treeDiv, setStyle);
            }
        },


        ///////////////////////////////////////////////////
        //// Game & client states
        
        onEnteringState(stateName, state)
        {
            if (!this.isCurrentPlayerActive()) {
                const lastTurnDiv = document.getElementById('bon_last-turn');
                lastTurnDiv?.parentElement.removeChild(lastTurnDiv);
                return;
            }

            console.log(`Entering state: ${stateName}`, state);

            document.getElementById('bon_surface').classList.add(`bon_state-${stateName}`);
            
            switch(stateName)
            {
                case 'client_playerTurn': // Used after the player has removed a tile
                    this.destroyAllVacancies();
                    this.updateLegalMoves();
                    this.makeTilesSelectable({ onlyLegal: true });
                    break;
        
                case 'playerTurn':
                    bonsai.startTurn();
                    this.destroyAllVacancies();
                    this.makeTilesSelectable({ onlyLegal: true });
                    this.makeRemovalsSelectable();
                    break;

                case 'client_prune':
                    this.makeTilesUnselectable();
                    break;

                case 'client_meditate':
                    this.makeTilesUnselectable();
                    break;
            }

            if (bonsai.isLastTurn) {
                let lastTurnDiv = document.getElementById('bon_last-turn');
                if (!lastTurnDiv) {
                    const pageTitleDiv = document.getElementById('page-title');
                    pageTitleDiv.insertAdjacentHTML('beforeend', '<div id="bon_last-turn"></div>');
                    lastTurnDiv = document.getElementById('bon_last-turn');
                    lastTurnDiv.innerText = _('This is your last turn!');
                }
            }
        },

        onLeavingState(stateName)
        {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`Leaving state: ${stateName}`);

            document.getElementById('bon_surface').classList.remove(`bon_state-${stateName}`);
        }, 

        onUpdateActionButtons(stateName, args)
        {
            console.log(`onUpdateActionButtons: ${stateName}`, args);

            if (!this.isCurrentPlayerActive()) return;

            switch (stateName)
            {
                case 'client_playerTurn':
                case 'playerTurn':
                    this.updateLegalMoves();
                    if (bonsai.players[this.myPlayerId].played.length === 1) {
                        this.addActionButton('bon_button-flip', _('Flip Pot'), () => this.onClickFlipPot(), null, false, 'gray');
                    }
                    if (this.makeRemovalsSelectable()) {
                        this.addActionButton('bon_button-prune', _('Remove Tiles'), () => this.onClickRemoveTiles(), null, false, 'gray');
                    }
                    else if (this.actionStack.canUndo()) {
                        this.addActionButton('bon_button-remove-undo', _('Undo'), () => this.onClickUndo());
                    }
                    this.addActionButton('bon_button-meditate', _('Meditate (Draw a Card)'), () => this.onClickMeditate());
                    this.addActionButton('bon_button-cultivate', _('Cultivate (Place Tiles)'), () => this.onClickCultivate()); 
                    if (!this.clientStateArgs.hasLegalMoves) {
                        document.getElementById('bon_button-cultivate').classList.add('disabled');
                    }
                    break;
                
                case 'client_prune':
                    this.addActionButton(`bon_button-prune-cancel`, _('Cancel'), () => this.onClickCancel(), null, false, 'red'); 
                    break;

                case 'client_selectInventoryTile':
                    if (this.clientStateArgs.alreadyPlaced) {
                        if (this.actionStack.canUndo()) {
                            this.addActionButton(`bon_button-inventory-tile-undo`, _('Undo'), () => this.onClickUndo()); 
                        }
                        this.addActionButton(`bon_button-inventory-tile-stop`, _('Stop'), () => this.onClickStopPlacingTiles()); 
                    }
                    this.addActionButton(`bon_button-inventory-tile-cancel`, _('Cancel'), () => this.onClickCancel(), null, false, 'red'); 
                    break;

                case 'client_chooseLocation':
                    this.addActionButton(`bon_button-cancel-location`, _('Cancel'), () => this.onClickCancel(), null, false, 'red'); 
                    break;

                case 'client_cultivateConfirm':
                    this.addActionButton('bon_button-cultivate-confirm-end-turn', _('End Turn'), () => this.onClickCultivateEndTurn());
                    if (this.actionStack.canUndo()) {
                        this.addActionButton(`bon_button-inventory-tile-undo`, _('Undo'), () => this.onClickUndo()); 
                    }
                    this.addActionButton('bon_button-cultivate-confirm-cancel', _('Cancel'), () => this.onClickCancelCultivate(), null, false, 'red');
                    break;
                    
                case 'client_meditate':
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red'); 
                    break;
                    
                case 'client_meditateChooseWoodOrLeafTile':
                    this.addTileButton(TileType.Wood);
                    this.addTileButton(TileType.Leaf);
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red'); 
                    break;
                    
                case 'client_meditateChooseMasterTile':
                    this.addTileButton(TileType.Wood);
                    this.addTileButton(TileType.Leaf);
                    this.addTileButton(TileType.Flower);
                    this.addTileButton(TileType.Fruit);
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red');
                    break;

                case 'client_meditateDiscardTiles':
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red'); 
                    break;
                    
                case 'client_meditateConfirm':
                    this.addActionButton('bon_button-meditate-confirm-end-turn', _('End Turn'), () => this.onClickMeditateEndTurn());
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red'); 
                    break;

                case 'client_claimOrRenounceGoal':
                    this.addActionButton('bon_button-claim-goal', _('Claim'), () => this.onClickClaimGoal(true));
                    this.addActionButton('bon_button-renounce-goal', _('Renounce'), () => this.onClickClaimGoal(false)); 
                    this.addActionButton(`bon_button-undo-goal`, _('Undo'), () => this.onClickUndo()); 
                    break;
            }
        },

        addTileButton(tileType) {
            const divId = `bon_button-choose-${tileType}`;
            this.addActionButton(divId, TileTypeLabel[tileType], () => this.onClickChooseTileType(tileType), null, false, 'gray');
            const buttonDiv = document.getElementById(divId);
            buttonDiv.insertAdjacentHTML('afterbegin', `<div id="bon_button-icon-${tileType}" class="bon_button-icon"></div>`);
            return buttonDiv;
        },


        ///////////////////////////////////////////////////
        //// Utility methods

        resetClientStateArgs() {
            this.clientStateArgs = {
                alreadyPlaced: false,
                legalMoves: {},
            };
        },

        lockClient() {
            this.clientStateArgs.locked = true;
        },

        isClientLocked() {
            return this.clientStateArgs.locked;
        },

        unlockClient() {
            this.clientStateArgs.locked = false;
        },

        slideToObjectAsync(item, dest, duration = 500) {
            return new Promise(resolve => {
                const slide = this.slideToObject(item, dest, duration);
                dojo.connect(slide, 'onEnd', this, resolve);
                slide.play();
            });
        },

        // Similar to placeOnObject, except it sets the child of
        // the parent instead of just setting the coordinates.
        placeInElement(childIdOrElement, parentIdOrElement) {
            const child = typeof childIdOrElement === 'string' ? document.getElementById(childIdOrElement) : childIdOrElement;
            const parent = typeof parentIdOrElement=== 'string' ? document.getElementById(parentIdOrElement) : parentIdOrElement;
            child.style.position = '';
            child.style.left = '';
            child.style.top = '';
            child.style.bottom = '';
            child.style.right = '';
            parent.appendChild(child);
        },

        raiseElementToBody(divOrId, parentId = 'page-content') {
            const div = typeof divOrId === 'string' ? document.getElementById(divOrId) : divOrId;
            let cur = div;
            let totalLeft = 0;
            let totalTop = 0;
            //const body = document.getElementsByTagName('body')[0];
            const body = document.getElementById(parentId);
            while (cur && cur !== body) {
                totalLeft += cur.offsetLeft;
                totalTop += cur.offsetTop;
                cur = cur.offsetParent;
            }
            div.style.left = `${totalLeft}px`;
            div.style.top = `${totalTop}px`;
            div.style.right = '';
            div.style.bottom = '';
            div.style.position = 'absolute';
            div.style.zIndex = '100';
            body.appendChild(div);
        },

        adjustPlayerPlaced(playerId, tileType, delta) {
            const placed = this.placed[playerId];
            placed[tileType].setValue(placed[tileType].getValue() + delta);

            const element = document.getElementById(`bon_player-summary-stat-block-${playerId}-${TileTypeName[tileType]}`);
            if (placed[tileType].getValue() > 0) {
                element.classList.remove('bon_zero');
            }
            else {
                element.classList.add('bon_zero');
            }
        },

        setPlayerPlaced(playerId, tileType, value) {
            const placed = this.placed[playerId];
            placed[tileType].setValue(value);

            const element = document.getElementById(`bon_player-summary-stat-block-${playerId}-${TileTypeName[tileType]}`);
            if (Number(value) > 0) {
                element.classList.remove('bon_zero');
            }
            else {
                element.classList.add('bon_zero');
            }
        },

        adjustPlayerCapacity(playerId, delta) {
            const capacity = bonsai.adjustPlayerCapacity(playerId, delta);
            this.capacity[playerId].setValue(capacity);
        },

        setPlayerCapacity(playerId, value) {
            this.capacity[playerId].setValue(value);
        },

        makeTilesSelectable({ onlyLegal = false, scrollIntoView = false, resourceFilter } = {}) {
            // Calculate legal moves, if necessary
            if (onlyLegal) {
                this.clientStateArgs.legalMoves = bonsai.getLegalMoves({ resourceFilter });
            }

            let enabledSome = false;
            const divs = document.querySelectorAll(`#bon_tiles-${this.myPlayerId} .bon_tile`);
            for (const div of divs) {
                const tileType = parseInt(div.dataset.type);
                if (resourceFilter) {
                    if (resourceFilter.indexOf(ResourceType.Wild) < 0 && resourceFilter.indexOf(tileType) < 0) {
                        continue;
                    }
                }
                if (onlyLegal) {
                    // Skip this tile if there are no legal moves for this tile
                    if (!Object.values(this.clientStateArgs.legalMoves[tileType]).length) {
                        continue;
                    }
                }
                if (!this.isSpectator) {
                    div.classList.add('bon_selectable');
                }
                enabledSome = true;
            }

            if (enabledSome && scrollIntoView && !this.isSpectator) {
                const containerDiv = document.getElementById(`bon_tiles-${this.myPlayerId}`);
                containerDiv.scrollIntoView({ block: 'end', inline: 'center', behavior: 'smooth' }); 
            }

            return enabledSome;
        },

        makeTilesUnselectable() {
            const divs = document.querySelectorAll(`#bon_tiles-${this.myPlayerId} .bon_tile.bon_selectable`);
            for (const div of divs) {
                div.classList.remove('bon_selectable');
            }
        },

        makeRemovalsSelectable() {
            const legalRemoves = bonsai.getLegalRemoves();
            this.clientStateArgs.legalRemoves = legalRemoves;
            this.clientStateArgs.hasLegalRemoves = legalRemoves.length > 0;

            for (const removal of legalRemoves) {
                const [ leafKey /*, ...otherKeys */ ] = removal;
                const { x, y } = parseKey(leafKey);
                this.createVacancy(this.myPlayerId, x, y);
            }
            return legalRemoves.length > 0;
        },

        updateLegalMoves() {
            this.clientStateArgs.legalMoves = bonsai.getLegalMoves();
            this.clientStateArgs.hasLegalMoves = Object.values(this.clientStateArgs.legalMoves).some(lm => Object.keys(lm).length > 0);
        },

        showLegalMoves(legalMoves, selectedTileType) {
            this.destroyAllVacancies();

            const playerId = this.getActivePlayerId();
            for (const tileType of Object.values(TileType)) {
                if (selectedTileType && selectedTileType !== tileType) continue;
                for (const key of Object.keys(legalMoves[tileType])) {
                    const { x, y } = parseKey(key);
                    this.createVacancy(playerId, x, y);
                }
            }
        },

        hideAllVacancies() {
            const elements = [ ...document.getElementsByClassName('bon_vacancy') ];
            for (const element of elements) {
                element.classList.add('bon_hidden');
            }
        },

        destroyAllVacancies() {
            const elements = [ ...document.getElementsByClassName('bon_vacancy') ];
            for (const element of elements) {
                element.parentElement.removeChild(element);
            }
        },

        async animateCardToNextSlotAsync(delay, toSlot, cardId) {
            if (!gameui.instantaneousMode) {
                await delayAsync(delay);
            }
            const divId = `bon_card-${cardId}`;
            const destDivId = `bon_slot-${toSlot}`;
            this.raiseElementToBody(divId);
            await this.slideToObjectAsync(divId, destDivId);
            this.placeInElement(divId, destDivId);
        },

        async animateDiscardCardAsync(cardId) {
            const divId = `bon_card-${cardId}`;
            const div = document.getElementById(divId);

            if (!gameui.instantaneousMode) {
                await div.animate({
                    top: [ 0, '-100%' ],
                    opacity: [ 1, 0 ],
                }, {
                    duration: 400,
                    easing: 'ease-out',
                    fill: 'forwards',
                }).finished;
            }

            div.parentElement.removeChild(div);
        },

        async animateCardReplacementAsync(nextCardId) {
            const promises = [];

            let slot;
            for (slot = 3; slot > 0; slot--) {
                if (!bonsai.board[slot]) break;
            }

            // Shift cards to the right
            for (let i = slot; i > 0; i--) {
                const cardId = bonsai.board[i - 1];
                bonsai.board[i] = cardId;
                bonsai.board[i - 1] = null;
                if (cardId) {
                    promises.push(this.animateCardToNextSlotAsync(100 * (slot - i), i, cardId));
                }
            }

            bonsai.board[0] = nextCardId;
            if (nextCardId) {
                bonsai.reduceDrawPile();

                promises.push((async () => {
                    // Wait for the other cards to have started their animations
                    if (!gameui.instantaneousMode) {
                        await delayAsync(slot * 100);
                    }

                    // Change the height of the deck, if necessary
                    this.updateDeck();

                    // Create a new card face down on top of the deck, inside a host element
                    const hostDiv = document.createElement('div');
                    hostDiv.classList.add('bon_card');
                    hostDiv.style.perspective = '10em';

                    hostDiv.id = 'bon_card-host';
                    const deckDiv = document.getElementById('bon_deck');
                    deckDiv.appendChild(hostDiv);

                    this.createCard(nextCardId, false, `bon_card-host`);
                    const cardDiv = document.getElementById(`bon_card-${nextCardId}`);

                    if (bonsai.data.drawPile < 1) {
                        deckDiv.classList.add('bon_empty');
                    }

                    // Slide the card host into the first slot
                    this.raiseElementToBody(hostDiv);
                    cardDiv.style.transition = 'transform 400ms ease-out';
                    reflow();

                    // Start the slide
                    const slidePromise = this.slideToObjectAsync(hostDiv, 'bon_slot-0');

                    // Start flipping the card over
                    const flipPromise = new Promise(async resolve => {
                        if (!gameui.instantaneousMode) {
                            await delayAsync(50);
                        }
                        cardDiv.classList.remove('bon_card-face-down');
                        cardDiv.addEventListener('transitionend', resolve, { once: true });
                    });

                    // Wait for all animations to end
                    await Promise.all([
                        slidePromise,
                        flipPromise,
                    ]);

                    // Clean up
                    cardDiv.style.transition = '';
                    this.placeInElement(cardDiv, 'bon_slot-0');
                    hostDiv.parentElement.removeChild(hostDiv);
                })());
            }

            await Promise.all(promises);
        },

        async animateFinalScoresAsync(scores, animate = true) {
            // Add the empty table and the top-left empty header cell
            createFromTemplate('bonsai_Templates.finalScores', '', 'bon_surface');

            const div = document.getElementById('bon_final-scores');
            div.addEventListener('click', () => div.classList.toggle('bon_minimized'));

            const runningTotals = {};
            for (const playerId of Object.keys(scores)) {
                runningTotals[playerId] = 0;
            }

            // Add the player names along the top
            for (const playerId of Object.keys(scores)) {
                if (animate) {
                    await delayAsync(500);
                }
                const { name, color } = this.gamedatas.players[playerId];
                createFromTemplate('bonsai_Templates.finalScoreHeader', {
                    TEXT: name,
                    COLOR: `#${color}`,
                }, 'bon_final-scores-table');
            }

            // Add blank cells for empty columns
            for (let i = Object.keys(scores).length; i < 4; i++) {
                createFromTemplate('bonsai_Templates.finalScoreHeader', {
                    TEXT: '',
                    COLOR: '#000',
                }, 'bon_final-scores-table');
            }

            //
            // Add a row for each scoring category
            //
            const scoringCategories = [
                'leaf', 'flower', 'fruit', 'parchment', 'goal', 'total'
            ];
            for (const key of scoringCategories) {
                for (const [ playerId, playerScore ] of Object.entries(scores)) {
                    const divId = `bon_final-score-${playerId}-${key}`;
                    createFromTemplate('bonsai_Templates.finalScoreValue', {
                        DIV_ID: divId,
                        TEXT: playerScore[key],
                        COLOR: playerScore[key] ? '#000' : 'rgba(0, 0, 0, .3)',
                        WEIGHT: key === 'total' ? 700 : 400,
                    }, 'bon_final-scores-table');
                }
                for (let i = Object.keys(scores).length; i < 4; i++) {
                    const divId = `bon_final-score_empty${i}-${key}`;
                    createFromTemplate('bonsai_Templates.finalScoreValue', {
                        DIV_ID: divId,
                        TEXT: '',
                        COLOR: '#000',
                    }, 'bon_final-scores-table');
                }
            }

            //
            // Animate the reveal of the scores
            // (Note: We can't reveal as we create the cells
            // because that messes up the layout of the grid)
            //
            for (const key of scoringCategories) {
                if (animate) {
                    await delayAsync(500);
                }
                const rowPromises = Object.keys(scores).map(async (playerId, i) => {
                    if (key !== 'total') {
                        runningTotals[playerId] += scores[playerId][key];
                    }

                    const divId = `bon_final-score-${playerId}-${key}`;
                    const scoreDiv = document.getElementById(divId);
                    if (animate) {
                        await scoreDiv.animate({
                            opacity: [ 0, 1 ],
                        }, {
                            delay: 400 * i,
                            duration: 800,
                            easing: 'ease-out',
                            fill: 'forwards',
                        }).finished;
                    }
                    else {
                        scoreDiv.style.opacity = 1;
                    }
                });
                await Promise.all(rowPromises);
            }

            if (animate) {
                await delayAsync(500);
            }

            // Set the player summary scores
            for (const [ playerId, score ] of Object.entries(runningTotals)) {
                this.scoreCounter[playerId].setValue(score);
            }

            // Highlight the winning score
            const playerId = Object.entries(scores).sort(([ , scoresA ], [ , scoresB ]) => scoresB.total - scoresA.total).map(pair => pair[0]).shift();
            const divId = `bon_final-score-${playerId}-total`;
            const scoreDiv = document.getElementById(divId);
            scoreDiv.classList.add('bon_winner');

            if (animate) {
                await delayAsync(2000);
            }
        },


        ///////////////////////////////////////////////////
        //// Player's action

        async onClickCultivate() {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('cultivate')) return;
            console.log('onClickCultivate()');

            await this.workflowManager.beginAsync(this.cultivateWorkflow());
        },

        async onClickInventoryTile(divId, tileType) {
            const args = {
                tileDivId: divId,
                tileType: tileType,
            };

            // Allow the player to click a tile to immediately jump
            // into the cultivate workflow without first clicking
            // the 'Place a Tile' button.
            await this.workflowManager.advanceOrBeginAsync(this.cultivateWorkflow({ skipSelectPrompt: true }), args);
        },

        async onClickVacancy(e) {
            if (!this.isCurrentPlayerActive()) return;
            e.stopPropagation();
            if (this.isClientLocked()) return;

            const { x, y } = e.currentTarget.dataset;
            console.log(`onClickVacancy(${x}, ${y})`);

            // If a workflow is in progress, it's the Cultivate workflow
            // Otherwise, the vacancy is for tile removal
            await this.workflowManager.advanceOrBeginAsync(this.removeTilesWorkflow({ skipSelectPrompt: true }), {
                locX: parseInt(x, 10),
                locY: parseInt(y, 10),
            });
        },

        async onClickGoal(goalId) {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('cultivate')) return;
            if (this.isClientLocked()) return;
            const goalDiv = document.getElementById(`bon_goal-${goalId}`);
            if (!goalDiv.classList.contains('bon_selectable')) return;

            console.log(`onClickGoal(${goalId})`);

            this.clientStateArgs.claimed = true;
            await this.workflowManager.advanceAsync();
        },

        async onClickCancelCultivate() {
            if (!this.isCurrentPlayerActive()) return;
            console.log('onClickCancelCultivate()');
            await this.workflowManager.abortAsync();
            this.resetClientStateArgs(); // KILL? maybe not needed now?
        },

        async onClickUndo() {
            if (!this.isCurrentPlayerActive()) return;
            console.log('onClickUndo()');

            if (this.workflowManager.isRunning) {
                await this.workflowManager.advanceAsync({ undo: true });
            }
            else {
                // Undo the removal of tiles
                await this.actionStack.undoAllAsync();
                this.resetClientStateArgs();
                this.makeTilesUnselectable();
                this.destroyAllVacancies();
                this.restoreServerGameState();
            }
        },

        //
        // A player may strategically choose to stop placing tiles
        // (e.g. when placing a tile would cause her to lose points)
        //
        async onClickStopPlacingTiles() {
            if (!this.isCurrentPlayerActive()) return;
            console.log('onClickStopPlacingTiles()');
            await this.workflowManager.advanceAsync();
        },

        async onClickCancel() {
            if (!this.isCurrentPlayerActive()) return;
            console.log('onClickCancel()');
            await this.workflowManager.advanceAsync({ canceled: true });
        },

        async onClickCultivateEndTurn() {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`onClickCultivateEndTurn()`);

            const data = this.actionStack.apply();
            let {
                flip,
                remove,
                place,
                renounce,
                claim,
            } = data;

            remove = remove && [ remove ].flatMap(g => g).join();
            place = place?.flatMap(m => m).join();
            renounce = renounce && [ renounce ].flatMap(g => g).join();
            claim = claim && [ claim ].flatMap(g => g).join();
            try {
                // Report what we think the current move is because I'm seeing
                // what looks like multiple requests for a card that has already
                // been taken by the active player. ...but these don't look like
                // automatic retries.
                const m = bonsai.data.move;
                await invokeServerActionAsync('cultivate', { m, flip, remove, place, renounce, claim });
            }
            catch (err) {
                await this.workflowManager.abortAsync();
                this.resetClientStateArgs();
                return;
            }
            await this.workflowManager.advanceAsync();
            this.actionStack.clear();
        },

        * cultivateWorkflow({ skipSelectPrompt = false } = {}) {
            this.destroyAllVacancies();

            delete this.clientStateArgs.placeAnother;
            delete this.clientStateArgs.alreadyPlaced;
            while (true) {
                while (true) {
                    const seishiResources = bonsai.getCanPlayResourceFilter();
                    const placed = yield * this.placeTileWorkflow(_('${you} may place ${RT[*]}'), seishiResources, skipSelectPrompt);

                    // Only allow skipping prompt the first time through
                    // (because the player clicked the tile directly to start
                    // Cultivate mode... but after that we're already in this mode)
                    skipSelectPrompt = false;

                    if (this.clientStateArgs.canceled) return false;
                    if (this.clientStateArgs.undo) {
                        yield new UndoLastAction();
                        if (!this.actionStack.canUndo()) {
                            delete this.clientStateArgs.alreadyPlaced;
                        }
                        continue;
                    }
                    if (!placed) break;
                }

                yield new SetClientState('client_cultivateConfirm', _('${you} must confirm your turn'));

                if (this.clientStateArgs.undo) {
                    yield new UndoLastAction();
                    if (!this.actionStack.canUndo()) {
                        delete this.clientStateArgs.alreadyPlaced;
                    }
                    continue;
                }
                return !this.clientStateArgs.canceled;
            }
        },

        * removeTilesWorkflow({ skipSelectPrompt = false } = {}) {
            while (true) {
                this.makeRemovalsSelectable();
                if (!skipSelectPrompt) {
                    yield new SetClientState('client_prune', _('${you} must select a tile to remove'));
                }
                skipSelectPrompt = false;

                this.destroyAllVacancies();

                if (this.clientStateArgs.canceled) return false;
                if (this.clientStateArgs.undo) {
                    yield new UndoLastAction();
                    continue;
                }

                const { locX, locY } = this.clientStateArgs;
                const leafKey = makeKey(locX, locY);
                const removeTileKeys = this.clientStateArgs.legalRemoves.find(set => set[0] === leafKey);
                const removeTiles = removeTileKeys.map(parseKey);

                yield new RemoveTilesAction(this.myPlayerId, removeTiles);
                break;
            }

            return new SetClientState('client_playerTurn', _('${you} must choose'));
        },

        * meditateWorkflow({ skipSelectPrompt = false } = {}) {
            if (!skipSelectPrompt) {
                yield new SetClientState('client_meditate', _('${you} must select a card'));
            }
            this.makeTilesUnselectable();
            this.destroyAllVacancies();

            const { slot, cardId } = this.clientStateArgs;
            yield new TakeCardAction(this.myPlayerId, cardId, slot);

            // Receive bonus tiles based on the slot of the selected card
            const bonusTiles = [];
            switch (slot) {
                case 0: break; // Player gets no bonus
                case 1:
                    yield new SetClientState('client_meditateChooseWoodOrLeafTile', _('${you} must choose to draw a wood or leaf tile'));
                    bonusTiles.push(this.clientStateArgs.tileType);
                    break;
                case 2:
                    bonusTiles.push(TileType.Wood, TileType.Flower);
                    break;
                case 3:
                    bonusTiles.push(TileType.Leaf, TileType.Fruit);
                    break;
            }
            
            if (bonusTiles.length) {
                yield new ReceiveTilesAction(this.myPlayerId, bonusTiles, slot, 'bonusTiles', slot === 1);
            }

            // Depending on type of card selected, the player may be allowed some
            // additional actions: Master => draw tile(s); Helper => place tile(s)
            const { type, resources } = Cards[cardId];
            if (type === CardType.Master) {
                const receivedTileTypes = [ ...resources ];
                const userChoice = resources[0] === ResourceType.Wild; // Wilds are always single resource
                if (userChoice) {
                    yield new SetClientState('client_meditateChooseMasterTile', _('${you} must choose a tile to draw'));
                    receivedTileTypes[0] = this.clientStateArgs.tileType;
                }

                yield new ReceiveTilesAction(this.myPlayerId, receivedTileTypes, slot, 'master', userChoice);
            }
            else if (type === CardType.Helper) {
                while (true) {
                    // Note: all Helper Cards allow the player to place up to two tiles
                    delete this.clientStateArgs.alreadyPlaced;
                    const firstTileType = yield * this.placeTileWorkflow(_('${you} may place ${RT[0]} and ${RT[1]}'), resources);

                    if (this.clientStateArgs.canceled) return false;

                    // Bail out if the player cannot play a tile
                    if (!firstTileType) break;

                    let index = resources.indexOf(firstTileType);
                    if (index === -1) index = resources.indexOf(ResourceType.Wild);
                    const remainingResources = resources.filter((_, i) => i !== index);
    
                    yield * this.placeTileWorkflow(_('${you} may place ${RT[0]}'), remainingResources);

                    if (this.clientStateArgs.canceled) return false;
                    if (this.clientStateArgs.undo) {
                        yield new UndoLastAction();
                        continue;
                    }
                    break;
                }
            }

            // Discard tiles if necessary
            let discarded = 0;
            while (bonsai.tilesOverCapacity) {
                this.makeTilesSelectable({ scrollIntoView: true });

                const n = bonsai.tilesOverCapacity;
                const msg =
                    discarded
                        ? n === 1
                            ? _('${you} must discard 1 more tile')
                            : _('${you} must discard ${n} more tiles')
                        : n === 1
                            ? _('${you} must discard 1 tile')
                            : _('${you} must discard ${n} tiles');
                yield new SetClientState('client_meditateDiscardTiles', msg, { n });
                
                const { tileDivId, tileType } = this.clientStateArgs;
                yield new DiscardExcessTileAction(this.myPlayerId, tileType, tileDivId);
                discarded++;
            }
            this.makeTilesUnselectable();

            yield new SetClientState('client_meditateConfirm', _('${you} must confirm your turn'));

            if (this.clientStateArgs.canceled) return false;
        },

        * placeTileWorkflow(prompt, resourceFilter = undefined, skipSelectPrompt = false) {
            this.destroyAllVacancies();
            this.makeTilesUnselectable();

            // Show a brief message and skip if the player has no tiles to play
            if (bonsai.getTileCount() === 0) {
                setTimeout(() => this.workflowManager.advanceAsync(), 1500);
                const msg =
                    this.clientStateArgs.alreadyPlaced
                        ? _('${you} have no more tiles to play')
                        : _('${you} have no tiles to play');
                yield new SetClientState('client_meditateNoTilesToPlace', msg);
                return null;
            }
            
            while (true) {
                // Highlight the legal tile selections; bail out if there are none 
                if (!this.makeTilesSelectable({ resourceFilter, scrollIntoView: true, onlyLegal: true })) {
                    // Show a slightly different message if the player
                    // has tiles but can't legally play any of them.
                    setTimeout(() => this.workflowManager.advanceAsync(), 1500);
                    const msg =
                        this.clientStateArgs.alreadyPlaced
                            ? _('${you} are unable to play any more tiles')
                            : _('${you} are unable to play any tiles');
                    yield new SetClientState('client_meditateNoTilesToPlace', msg);
                    return null;
                }

                // Prompt the player to select a tile to play
                if (!skipSelectPrompt) {
                    // Sorry for this ugly code. This sets up the prompt to show resource type icons
                    const args = resourceFilter && {
                        'RT': i => {
                            if (i === '*') {
                                return resourceFilter.reduce((html, _, i) => {
                                    return html + formatBlock('bonsai_Templates.actionBarResourceType', { TYPE: resourceFilter[i] })
                                }, '');
                            }
                            else {
                                return formatBlock('bonsai_Templates.actionBarResourceType', { TYPE: resourceFilter[parseInt(i, 10)] });
                            }
                        },
                    };
                    yield new SetClientState('client_selectInventoryTile', prompt, args);
                }
                // Only skip the select prompt the first time through the loop
                // i.e. if the player undoes an action, we want the prompt to show
                // from that point forward.
                skipSelectPrompt = false;

                // Exit the workflow if the player canceled or chose to Undo
                if (this.clientStateArgs.canceled) return null;
                if (this.clientStateArgs.undo) return null;

                // Collect the selected tile and highlight it
                const { tileDivId, tileType } = this.clientStateArgs;
                if (!tileDivId) return null; // Bail out if player declined to play (i.e. Stop button)
                const tileDiv = document.getElementById(tileDivId);
                tileDiv.classList.add('bon_selected');
                this.makeTilesUnselectable();

                // Prompt the player to place the tile
                const legalMoves = bonsai.getLegalMoves({ resourceFilter });
                this.showLegalMoves(legalMoves, tileType);
                yield new SetClientState('client_chooseLocation', _('${you} must select a location'));

                tileDiv.classList.remove('bon_selected');
                this.destroyAllVacancies();

                // Collect the player's decision; loop back to the start if they canceled
                if (this.clientStateArgs.canceled) continue;
                const { locX, locY } = this.clientStateArgs;
                if (locX === undefined) continue;
                const locR = this.getRotationFromLegalMoves(legalMoves, tileType, locX, locY);

                // Animate the placement and return the tile to the parent workflow
                yield new PlaceTileAction(this.myPlayerId, tileDivId, tileType, locX, locY, locR);
                this.clientStateArgs.alreadyPlaced = true;

                // Check to see if the player is able to claim/renounce any goals
                // as a result of having placed this tile.
                yield * this.claimRenounceGoalsWorkflow();

                // If player clicked Undo after placing a tile and qualifying
                // for a goal, undo the tile placement and prompt them again
                // for their tile placement.
                if (this.clientStateArgs.undo) {
                    yield new UndoLastAction();
                    continue;
                }

                return tileType;
            }
        },

        getRotationFromLegalMoves(legalMoves, tileType, x, y) {
            const key = makeKey(x, y);

            // Place the tile if the player has already selected the type
            const firstLegalDir = legalMoves[tileType][key][0];

            // Select the tile rotation depending on the tile type and the first legal direction
            switch (tileType) {
                case TileType.Wood:
                    return 0;

                case TileType.Leaf: // default leaf-wood connector is in bottom-left position (3)
                    return (firstLegalDir + 3) % 6;

                case TileType.Flower: // default flower-leaf connector is in bottom-left position (3)
                    return (firstLegalDir + 3) % 6;

                case TileType.Fruit: // default fruit-leaf/leaf connector is in bottom-right and bottom-left positions (2,3)
                    return (firstLegalDir + 4) % 6;
            }

            throw new Error('Unknown tileType:', tileType);
        },

        //
        // Goals can be claimed/renounced in both of the two primary turn actions
        // (Meditate and Cultivate). So we define the workflow for managing these
        // decisions as a separate helper workflow.
        //
        * claimRenounceGoalsWorkflow() {
            // Check if eligible to renounce / claim goals
            while (bonsai.eligibleGoals.length) {
                const goalId = bonsai.eligibleGoals[0];
                const goalDiv = document.getElementById(`bon_goal-${goalId}`);
                goalDiv.classList.add('bon_selectable');

                const goalsDiv = document.getElementById('bon_goals');
                goalsDiv.scrollIntoView({ block: 'start', inline: 'start', behavior: 'smooth' });

                yield new SetClientState('client_claimOrRenounceGoal', _('${you} must claim the goal or renounce it'));

                goalDiv.classList.remove('bon_selectable');                
                if (this.clientStateArgs.undo) return;

                const { claimed } = this.clientStateArgs;
                if (claimed) {
                    yield new ClaimGoalAction(this.myPlayerId, goalId);
                }
                else {
                    yield new RenounceGoalAction(this.myPlayerId, goalId);
                }
            }
        },

        async onClickFlipPot() {
            if (!this.isCurrentPlayerActive()) return;
            if (bonsai.players[this.myPlayerId].played.length > 1) return;
            console.log(`onClickFlipPot()`);

            // Flipping the pot is the first possible action...
            // so we can safely assume we're undoing a previous flip
            if (this.actionStack.canUndo()) {
                await this.actionStack.undoAsync();
            }
            else {
                const isFlipped = bonsai.isFlipped(this.myPlayerId);
                await this.actionStack.doAsync(new FlipPotAction(this.myPlayerId, !isFlipped));
            }
            this.updateLegalMoves();
        },

        async onClickRemoveTiles() {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`onClickRemoveTiles()`);

            await this.workflowManager.beginAsync(this.removeTilesWorkflow());
        },

        async onClickMeditate() {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('meditate')) return;
            console.log(`onClickMeditate()`);

            await this.workflowManager.beginAsync(this.meditateWorkflow());
        },

        async onClickSlot(slot) {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('meditate')) return;
            if (this.currentState !== 'playerTurn' && this.currentState !== 'client_playerTurn' && this.currentState != 'client_meditate') return;

            const cardId = bonsai.board[slot];
            if (!cardId) return; // E.g. the slot is empty... either mid-animation or no cards left

            console.log(`onClickSlot(${slot})`);

            const args = {
                slot,
                cardId,
            };
            await this.workflowManager.advanceOrBeginAsync(this.meditateWorkflow({ skipSelectPrompt: true }), args);
        },

        async onClickChooseTileType(tileType) {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`onClickChooseTileType(${tileType})`);

            await this.workflowManager.advanceAsync({ tileType });
        },

        async onClickMeditateEndTurn() {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`onClickMeditateEndTurn()`);

            await this.workflowManager.advanceAsync();

            const data = this.actionStack.apply();
            let {
                flip,
                remove,
                discard,
                take: card,
                bonusTiles,
                master, // 'wild' choice the user made for a Master card
                place,
                renounce,
                claim,
            } = data;

            // TODO: clean this up -- also, check the action parameter types... e.g. array vs numberlist
            //const discard = data.discard.join(',');
            const choice = bonusTiles?.shift();
            remove = remove && [ remove ].flatMap(g => g).join();
            place = place?.flatMap(m => m).join();
            discard = discard && [ discard ].flatMap(d => d).join();
            renounce = renounce && [ renounce ].flatMap(g => g).join();
            claim = claim && [ claim ].flatMap(g => g).join();
            try {
                // Report what we think the current move is because I'm seeing
                // what looks like multiple requests for a card that has already
                // been taken by the active player. ...but these don't look like
                // automatic retries.
                const m = bonsai.data.move;
                await invokeServerActionAsync('meditate', { m, flip, remove, card, choice, master, place, renounce, claim, discard });
            }
            catch (err) {
                await this.workflowManager.abortAsync();
                this.resetClientStateArgs();
                return;
            }
            await this.workflowManager.advanceAsync();
            this.actionStack.clear();
        },

        async onClickCancelMeditate() {
            if (!this.isCurrentPlayerActive()) return;
            console.log('onClickCancelMeditate()');
            await this.workflowManager.abortAsync();
            this.resetClientStateArgs(); // KILL? maybe not needed now?
        },

        async onClickClaimGoal(claimed) {
            if (!this.isCurrentPlayerActive()) return;
            await this.workflowManager.advanceAsync({ claimed });
        },

        
        ///////////////////////////////////////////////////
        //// Reaction to cometD notifications

        async notify_potFlipped({ playerId }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            await new FlipPotAction(playerId).doAsync();
        },

        async notify_tileRemoved({ playerId, x, y, score }) {
            if (playerId != this.myPlayerId || g_archive_mode) {
                await new RemoveTilesAction(playerId, [ { x, y } ]).doAsync();
            }
            
            // Update player score
            this.scoreCounter[playerId].setValue(score);
            this.updateSoloPanel();
        },

        async notify_tilesAdded({ playerId, tiles, score }) {
            if (playerId != this.myPlayerId || g_archive_mode) {
                for (const { type, x, y, r } of tiles) {
                    // Find the first inventory tile of the specified type
                    const tileDiv = document.querySelector(`#bon_tiles-${playerId} .bon_tile-${type}`);
                    if (!tileDiv) continue;
                    await new PlaceTileAction(playerId, tileDiv.id, type, x, y, r).doAsync();
                }
            }

            // Update player score
            this.scoreCounter[playerId].setValue(score);
            this.updateSoloPanel();
        },

        async notify_tilesReceived({ playerId, tileType: tileTypes, slot }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            await new ReceiveTilesAction(playerId, tileTypes, slot, '').doAsync();
        },

        async notify_goalRenounced({ playerId, goal: goalId }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            await new RenounceGoalAction(playerId, goalId).doAsync();
        },

        async notify_goalClaimed({ playerId, goal: goalId, score }) {
            if (playerId != this.myPlayerId || g_archive_mode) {
                await new ClaimGoalAction(playerId, goalId).doAsync();
            }

            // Update player score
            this.scoreCounter[playerId].setValue(score);
            this.updateSoloPanel();
        },

        async notify_cardTaken({ playerId, cardId }) {
            // Only act out the actions for other players because
            // this player's UI has already been updated locally.
            if (playerId != this.myPlayerId || g_archive_mode) {
                const slot = bonsai.board.indexOf(cardId);
                await new TakeCardAction(playerId, cardId, slot).doAsync();
            }

            // Remove any cards that were on the facedown pile
            // after the action completed -- because we don't
            // want this information to continue to be available
            // once it has been hidden
            const faceDownDiv = document.getElementById(`bon_seishi-facedown-${playerId}`);
            faceDownDiv.innerHTML = '';
            faceDownDiv.classList.remove('bon_empty');
        },

        async notify_capacityIncreased({ playerId, delta }) {
            // This notification is just for the log.
            // The actual capacity was already adjusted in notify_cardTaken / TakeCardAction
        },

        async notify_cardRevealed({ cardId }) {
            await this.animateCardReplacementAsync(cardId);
        },

        async notify_lastRound() {
            bonsai.data.finalTurns = bonsai.data.order.length;

            // Just to trigger a refresh of the action bar
            this.restoreServerGameState();
        },

        async notify_tilesDiscarded({ playerId, tileType: tileTypes }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            // Fade out the discarded tiles
            for (const tileType of tileTypes) {
                const tileDiv = document.querySelector(`#bon_tiles-${playerId} .bon_tile-${tileType}`);
                if (tileDiv) {
                    // Fade out the tile
                    await tileDiv.animate({
                        opacity: [ 1, 0 ],
                        transform: [ 'scale(1)', 'scale(.5)' ],
                    }, {
                        duration: 100,
                        easing: 'ease-out',
                        fill: 'forwards',
                    }).finished;

                    tileDiv.parentElement.removeChild(tileDiv);
                }
                bonsai.adjustPlayerInventory(playerId, tileType, -1);
            }
        },

        async notify_cardDiscarded({ cardId }) {
            const slot = bonsai.discardCard(cardId);
            await this.animateDiscardCardAsync(cardId, slot);
        },

        async notify_endTurn({ playerId, score }) {
            bonsai.endTurn();
            this.makeTilesUnselectable();
            this.resetClientStateArgs();
            this.scoreCounter[playerId].setValue(score);
            this.updateSoloPanel();
        },

        async notify_finalScore({ scores, reveal }) {
            await Promise.all(
                Object.entries(reveal).map(async ([ playerId, cardIds ]) => {
                    await this.revealFaceDownCardsAsync(playerId, cardIds);
                }),
            );
            await this.animateFinalScoresAsync(scores, !gameui.instantaneousMode);
        },
    });
});
