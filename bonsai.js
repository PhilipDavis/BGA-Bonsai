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
    { delayAsync, WorkflowManager, ActionStack, SetClientState, UndoLastAction, reflow },
    { BonsaiLogic, Cards, CardType, ResourceType, ColorNames, makeKey, parseKey, Goals, GoalType, GoalSize, GoalStatus, TileType, TileTypeName, Direction },
    { PlaceTileAction, TakeCardAction, ReceiveTilesAction, RenounceGoalAction, ClaimGoalAction, DiscardExcessTileAction },
) {
    const BgaGameId = 'bonsai';

    let bonsai; // BonsaiLogic

    // How many milliseconds to hover before showing a tooltip
    const ToolTipDelay = 500;

    const TileTypeLabel = {};


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
                'bon_goal-13': __('Your bonsai must have a tile which *protrudes* out of the pot (on the side shown by the symbol).'),
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
            }
            
            this.updateDeck();

            // TODO: allow player to flip their pot? (maybe only at the start...?)
            // TODO: game preference to sort Seishi cards by type or not
            // TODO: have variable speeds... 

            const playerInventoryTilesDiv = document.getElementById(`bon_tiles-${this.myPlayerId}`);
            playerInventoryTilesDiv?.addEventListener('click', e => {
                const { target } = e;
                if (!target.classList.contains('bon_tile')) return;
                if (!target.classList.contains('bon_selectable')) return;
                this.onClickInventoryTile(target.id, parseInt(target.dataset.type, 10));
            });

            this.updateGoalTooltips();
        },

        setupPlayer(playerId, player, score, isGameOver) {
            const playerScoreDiv = document.querySelector(`#player_board_${playerId} .player_score`);
            createFromTemplate('bonsai_Templates.playerSummary', {
                PID: playerId,
            }, playerScoreDiv, 'afterend');

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

            // Add the tree tiles of this user
            const playerTiles = player.played;
            for (const [ type, x, y, r ] of playerTiles) {
                bonsai.trees[playerId].placeTile(type, x, y, r);
                if (x != 0 || y != 0) {
                    this.createTileInTree(playerId, type, x, y, r);
                }
            }
            this.adjustTreeSizeAndPos(playerId);

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
            this.setPlayerCapacity(playerId, 5);

            const [ lhs, rhs ] = bonsai.getPlayerSeishi(playerId);
            for (const cardId of lhs) {
                this.createCard(cardId, true, `bon_seishi-lhs-${playerId}`);
            }
            for (const cardId of rhs) {
                this.createCard(cardId, true, `bon_seishi-rhs-${playerId}`);
            }

            if (isGameOver) {
                const playerDiv = document.getElementById(`bon_player-${playerId}`);
                const parentId = `bon_reveal-cards-${playerId}`;
                playerDiv.insertAdjacentHTML('beforeend', `<div id="${parentId}" class="bon_reveal-cards"></div>`);

                for (const cardId of player.faceDown.sort()) {
                    this.createCard(cardId, true, parentId);
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
            if (drawPile > 35) return 9;
            if (drawPile > 25) return 8;
            if (drawPile > 15) return 7;
            if (drawPile > 10) return 6;
            if (drawPile > 7) return 5;
            if (drawPile > 5) return 4;
            if (drawPile > 3) return 3;
            if (drawPile > 1) return 2;
            if (drawPile > 0) return 1;
            return 0;
        },

        updateDeck() {
            const desiredDeckSize = this.calculateDeckHeight();
            const deckDiv = document.getElementById('bon_deck');
            let actualDeckSize = deckDiv.childElementCount;
            while (actualDeckSize < desiredDeckSize) {
                createFromTemplate('bonsai_Templates.deckCard', {
                    INDEX: actualDeckSize,
                }, deckDiv);
                actualDeckSize++;
            }
            while (actualDeckSize > desiredDeckSize) {
                deckDiv.removeChild(deckDiv.lastElementChild);
                actualDeckSize--;
            }
            if (actualDeckSize > 0) {
                deckDiv.classList.remove('bon_empty');
            }
            else {
                deckDiv.classList.add('bon_empty');
            }
        },

        onClickFaceDownPile() {
            // Group cards of the same type together
            function sortFaceDownCards(cardA, cardB) {
                typeA = Cards[cardA].type;
                typeB = Cards[cardB].type;
                if (typeA !== typeB) return typeA - typeB;
                return cardA - cardB;
            }

            const html = bonsai.players[this.myPlayerId].faceDown.sort(sortFaceDownCards).reduce((html, cardId) => {
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

        createCard(cardId, faceUp, divId = 'bon_surface') {
            createFromTemplate('bonsai_Templates.card', {
                CARD_ID: cardId,
                DOWN: faceUp ? '' : 'bon_card-face-down',
            }, divId);
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

            /* KILL - there is an issue here I still need to investigate
            if (!goalDiv) {
                debugger; // KILL
            }
            */

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

        createTileInTree(playerId, tileType, x, y, r, visible = true) {
            const { xEm, yEm } = this.emsFromCoords({ x, y });

            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: `${playerId}-${x}-${y}`,
                TYPE: tileType,
                X_EM: xEm,
                Y_EM: yEm,
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
            return document.getElementById(`bon_tile-${tileId}`);
        },

        createTilePlaceholderInInventory(playerId, tileType) {
            // TODO: depending on preference, place in order or at the end
            let hostId = `bon_tiles-${playerId}`;
            const divId = `bon_tile-placeholder-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tileHost', {
                DIV_ID: divId,
            }, hostId);
            return document.getElementById(divId);
        },

        createTilePlaceholderInInventoryAtIndex(playerId, index) {
            const hostDiv = document.getElementById(`bon_tiles-${playerId}`);
            const divId = `bon_tile-placeholder-${Math.random().toString(28).substring(2)}`;
            if (index === 0) {
                createFromTemplate('bonsai_Templates.tileHost', {
                    DIV_ID: divId,
                }, hostDiv, { placement: 'afterbegin' });
            }
            else {
                let sibling = hostDiv.firstElementChild;
                while (--index > 0) {
                    sibling = sibling.nextElementSibling;
                }
                createFromTemplate('bonsai_Templates.tileHost', {
                    DIV_ID: divId,
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
            }, tileDiv, { placement: 'beforeend' });
            const placeholderDiv = document.getElementById(divId);
            placeholderDiv.style.width = '4.25em'; // TODO: how was placeholder null?
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
        // Determine the minimum rectangle that contains the entire tree
        // Note: we can't do this on the tree container element directly
        // because the pot and tiles have absolute positioning.
        //
        calculateBoundingRect(playerId) {
            let minX = Number.MAX_SAFE_INTEGER;
            let minY = Number.MAX_SAFE_INTEGER;
            let maxX = 0;
            let maxY = 0;

            const treeDiv = document.getElementById(`bon_tree-${playerId}`);
            for (const childDiv of treeDiv.children) {
                const rect = childDiv.getBoundingClientRect();
                if (!rect) continue;
                const { x, y, width, height } = rect;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + width - 1);
                maxY = Math.max(maxY, y + height - 1);
            }

            return {
                x: Math.floor(minX),
                y: Math.floor(minY),
                width: Math.ceil(maxX - minX + 1),
                height: Math.ceil(maxY - minY + 1),
            };
        },

        adjustTreeSizeAndPos(playerId) {
            if (!playerId) playerId = this.myPlayerId;

            const hostDiv = document.getElementById(`bon_tree-host-${playerId}`);
            if (!hostDiv) return;
            const rect = hostDiv.getBoundingClientRect();

            const { x, y, width, height } = this.calculateBoundingRect(playerId);

            // Make the minimum height of the space for the tree equal
            // to twice the height of the pot.
            const potDiv = hostDiv.querySelector('.bon_pot');
            const potRect = potDiv.getBoundingClientRect();
            const minHeight = Math.ceil(potRect.height * 2);
            const extentBelowPot = Math.max(0, (y + height - 1) - (potRect.y + potRect.height - 1));

            //console.log(x, y, width, height); // KILL

            if (height > rect.height) {
                console.log('Growing height');
                hostDiv.style.height = `${height}px`;
            }
            else if (height < rect.height && rect.height > minHeight) {
                console.log('Shrinking height');
                hostDiv.style.height = `${Math.max(minHeight, height)}px`;
            }

            const treeDiv = document.getElementById(`bon_tree-${playerId}`);
            treeDiv.style.bottom = `${extentBelowPot}px`;

// TODO: try a new strategy where we make a div be exactly the size
// of the bounding box of the tree and allow the browser to center it

            // Reposition the pot horizonally when the tree grows to within one tile-width of the sides
            const aTileDiv = hostDiv.querySelector('.bon_tile');
            if (!aTileDiv) {
                // The game just started if there are no tiles,
                // so we don't need to reposition the tree.
                return;
            }

            const tileWidth = Math.round(aTileDiv.getBoundingClientRect().width);
            const x1 = x - tileWidth;
            const x2 = x + width + tileWidth - 1;
            const leftOverflow = Math.round(Math.max(0, rect.x - x1));
            const rightOverflow = Math.round(Math.max(0, x2 - rect.right));
            if (rightOverflow && !leftOverflow) { // TODO: instead of !leftOverflow, should check roomToShiftLeft
                // We're too close to the right edge; shift left
                treeDiv.style.left = `calc(50% - ${rightOverflow}px)`;
            }
            else if (leftOverflow && !rightOverflow) {
                treeDiv.style.left = `calc(50% + ${leftOverflow}px)`;
            }
            else if (leftOverflow && rightOverflow) {
                treeDiv.style.left = `50%`;
                // TODO: scale the image down to fit exactly (minus the one-tile padding)
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
                case 'playerTurn':
                    bonsai.startTurn();
                    this.destroyAllVacancies();
                    this.makeTilesSelectable({ onlyLegal: true });
                    break;

                case 'client_meditate':
                    this.makeTilesUnselectable();
                    break;
            }

            if (bonsai.isLastTurn) {
                const pageTitleDiv = document.getElementById('page-title');
                pageTitleDiv.insertAdjacentHTML('beforeend', '<div id="bon_last-turn"></div>');
                const lastTurnDiv = document.getElementById('bon_last-turn');
                lastTurnDiv.innerText = _('This is your last turn!');
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
            const playerId = this.getActivePlayerId();

            switch (stateName)
            {
                case 'playerTurn':
                    this.updateLegalMoves();
                    this.addActionButton('bon_button-meditate', _('Draw a Card'), () => this.onClickMeditate());
                    this.addActionButton('bon_button-cultivate', _('Place Tiles'), () => this.onClickCultivate()); 
                    if (!this.clientStateArgs.hasLegalMoves) {
                        document.getElementById('bon_button-cultivate').classList.add('disabled');
                    }
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

        // KILL?
        slideToObjectAsync(item, dest, duration = 500) {
            // TODO: can make animation speed a game preference
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
            placed[tileType].incValue(delta);

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
            this.capacity[playerId].incValue(delta);
            bonsai.adjustPlayerCapacity(playerId, delta);
        },

        setPlayerCapacity(playerId, value) {
            this.capacity[playerId].setValue(value);
        },

        makeTilesSelectable({ onlyLegal = false, resourceFilter } = {}) {
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
                div.classList.add('bon_selectable');
                enabledSome = true;
            }
            return enabledSome;
        },

        makeTilesUnselectable() {
            const divs = document.querySelectorAll(`#bon_tiles-${this.myPlayerId} .bon_tile.bon_selectable`);
            for (const div of divs) {
                div.classList.remove('bon_selectable');
            }
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
            await delayAsync(delay);
            const divId = `bon_card-${cardId}`;
            const destDivId = `bon_slot-${toSlot}`;
            this.raiseElementToBody(divId);
            await this.slideToObjectAsync(divId, destDivId);
            this.placeInElement(divId, destDivId);
        },

        async animateCardReplacementAsync(nextCardId) {
            const promises = [];

            // TODO: move board cycling and slot determination into game logic

            let slot;
            for (slot = 3; slot > 0; slot--) {
                if (!bonsai.board[slot]) break;
            }

            // Shift cards to the right
            for (let i = slot; i > 0; i--) {
                const cardId = bonsai.board[i - 1];
                bonsai.board[i] = cardId;
                bonsai.board[i - 1] = null;
                promises.push(this.animateCardToNextSlotAsync(100 * (slot - i), i, cardId));
            }

            bonsai.board[0] = nextCardId;
            if (nextCardId) {
                bonsai.data.drawPile--;

                promises.push((async () => {
                    // Wait for the other cards to have started their animations
                    await delayAsync(slot * 100);

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
                        await delayAsync(50);
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

        async animateFinalScoresAsync(scores) {
            // Add the empty table and the top-left empty header cell
            createFromTemplate('bonsai_Templates.finalScores', '', 'bon_surface');

            const runningTotals = {};
            for (const playerId of Object.keys(scores)) {
                runningTotals[playerId] = 0;
                this.scoreCounter[playerId].setValue(0);
            }
            // Delay to allow score counters to set to 0
            await delayAsync(100);

            // Add the player names along the top
            for (const playerId of Object.keys(scores)) {
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

            await delayAsync(200);

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
                const rowPromises = Object.keys(scores).map(async (playerId, i) => {
                    if (key !== 'total') {
                        runningTotals[playerId] += scores[playerId][key];
                    }

                    const divId = `bon_final-score-${playerId}-${key}`;
                    const scoreDiv = document.getElementById(divId);
                    await scoreDiv.animate({
                        opacity: [ 0, 1 ],
                    }, {
                        delay: 200 + 200 * i,
                        duration: 400,
                        easing: 'ease-out',
                        fill: 'forwards',
                    }).finished;
                });
                await Promise.all(rowPromises);
                await delayAsync(200);
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

            await delayAsync(2000);
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
            if (!this.checkAction('cultivate')) return;
            if (this.isClientLocked()) return;

            const { x, y } = e.currentTarget.dataset;
            console.log(`onClickVacancy(${x}, ${y})`);

            await this.workflowManager.advanceAsync({
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
            await this.workflowManager.advanceAsync({ undo: true });
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
                await invokeServerActionAsync('cultivate', { remove, place, renounce, claim });
            }
            catch (err) {
                return;
            }
            await this.workflowManager.advanceAsync();
            this.actionStack.clear();
        },

        * cultivateWorkflow({ skipSelectPrompt = false } = {}) {
            // TODO: check to see if there are no possible moves (allow player to remove a tile... see rule book)

            delete this.clientStateArgs.placeAnother;
            delete this.clientStateArgs.alreadyPlaced;
            while (true) {
                let prompt = null;
                if (!skipSelectPrompt) {
                    prompt = _('${you} may place ${RT[*]}');
                }
                skipSelectPrompt = false; // Only allow skipping the first time in the loop

                const seishiResources = bonsai.getCanPlayResourceFilter();
                const placed = yield * this.placeTileWorkflow(prompt, seishiResources);

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

            // TODO: allow player to confirm / cancel (unless preference says not to)
            yield new SetClientState('client_cultivateConfirm', _('${you} must confirm your turn'));

            if (this.clientStateArgs.canceled) return false;
        },

        // TODO: formalize the starting of a workflow; checking to see if one exists; advancing it; etc.
        // TODO: probably need a mechanism for cancelling a workflow... (or just delete the workflow?)
        // TODO: what about how to short circuit certain elements? (e.g. might already start with a selected card)

        * meditateWorkflow({ skipSelectPrompt = false } = {}) {
            if (!skipSelectPrompt) {
                yield new SetClientState('client_meditate', _('${you} must select a card'));
            }

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

                yield new ReceiveTilesAction(this.myPlayerId, receivedTileTypes, slot, 'masterCardTiles', userChoice);
            }
            else if (type === CardType.Helper) {
                while (true) {
                    // Note: all Helper Cards allow the player to place up to two tiles
                    delete this.clientStateArgs.alreadyPlaced;
                    const firstTileType = yield * this.placeTileWorkflow(_('${you} may place ${RT[0]} and ${RT[1]}'), resources);

                    if (this.clientStateArgs.canceled) return false;
                    if (this.clientStateArgs.undo) {
                        yield new UndoLastAction();
                        continue;
                    }

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
                this.makeTilesSelectable();

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

            // TODO: allow player to confirm / cancel (unless preference says not to)
            yield new SetClientState('client_meditateConfirm', _('${you} must confirm your turn'));

            if (this.clientStateArgs.canceled) return false;
        },

        * placeTileWorkflow(prompt, resourceFilter = undefined) {
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
                if (!this.makeTilesSelectable({ resourceFilter, onlyLegal: true })) {
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
                if (prompt) {
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

                if (this.clientStateArgs.undo) return null;

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

                if (this.clientStateArgs.undo) {
                    return;
                }

                const { claimed } = this.clientStateArgs;
                if (claimed) {
                    yield new ClaimGoalAction(this.myPlayerId, goalId);
                }
                else {
                    yield new RenounceGoalAction(this.myPlayerId, goalId);
                }
            }
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
            if (this.currentState !== 'playerTurn' && this.currentState != 'client_meditate') return;

            const cardId = bonsai.board[slot];
            if (!cardId) return; // E.g. the slot is empty... either mid-animation or no cards left

            console.log(`onClickSlot(${slot})`);

            this.makeTilesUnselectable(); // TODO: perhaps should be in the workflow / action

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
                discard,
                take: card,
                bonusTiles,
                masterCardTiles: master,
                place,
                renounce,
                claim,
            } = data;

            // TODO: clean this up -- also, check the action parameter types... e.g. array vs numberlist
            //const discard = data.discard.join(',');
            const choice = bonusTiles?.shift();
            place = place?.flatMap(m => m).join();
            discard = discard && [ discard ].flatMap(d => d).join();
            renounce = renounce && [ renounce ].flatMap(g => g).join();
            claim = claim && [ claim ].flatMap(g => g).join();
            try {
                await invokeServerActionAsync('meditate', { card, choice, master, place, renounce, claim, discard });
            }
            catch (err) {
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

        async notify_tileRemoved({ playerId, x, y, score }) {
            if (playerId != this.myPlayerId || g_archive_mode) {
                bonsai.removeTile(playerId, x, y);

                // TODO: remove the tile from the UI
                // TODO: await RemoveTileAction(playerId, x, y).doAsync();
            }
            
            // Update player score
            this.scoreCounter[playerId].setValue(score);
        },

        async notify_tilesAdded({ playerId, tiles, score }) {
            if (bonsai.isLastTurn) {
                bonsai.countdownFinalTurns();
            }

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
        },

        async notify_tilesReceived({ playerId, tileType: tileTypes, slot }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            await new ReceiveTilesAction(playerId, tileTypes, slot, '').doAsync();
        },

        async notify_goalRenounced({ playerId, goalId }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            await new RenounceGoalAction(playerId, goalId).doAsync();
        },

        async notify_goalClaimed({ playerId, goal: goalId, score }) {
            if (playerId != this.myPlayerId || g_archive_mode) {
                await new ClaimGoalAction(playerId, goalId).doAsync();
            }

            // Update player score
            this.scoreCounter[playerId].setValue(score);
        },

        async notify_cardTaken({ playerId, cardId }) {
            if (bonsai.isLastTurn) {
                bonsai.countdownFinalTurns();
            }

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
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            this.adjustPlayerCapacity(playerId, delta);
        },

        async notify_cardRevealed({ cardId }) {
            await this.animateCardReplacementAsync(cardId);
        },

        async notify_lastRound() {
            bonsai.data.finalTurns = bonsai.data.order.length;
        },

        async notify_tilesDiscarded({ playerId, tileType: tileTypes }) {
            if (playerId == this.myPlayerId && !g_archive_mode) return;

            const adjustments =
                Object.values(tileTypes)
                    .reduce((obj, tileType) => ({ ...obj, [tileType]: (obj[tileType] || 0) - 1 }), {});

            // Fade out the discarded tiles
            for (const [ tileType, delta ] of Object.entries(adjustments)) {
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
                bonsai.adjustPlayerInventory(playerId, tileType, delta);
            }
        },

        async notify_finalScore({ scores, reveal }) {
            await Promise.all(
                Object.entries(reveal).map(async ([ playerId, cardIds ]) => {
                    await this.revealFaceDownCardsAsync(playerId, cardIds);
                }),
            );
            await this.animateFinalScoresAsync(scores);
        },
    });
});
