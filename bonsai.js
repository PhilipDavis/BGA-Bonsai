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
    "bgagame/modules/PhilsUtils.core.v1",
    "bgagame/modules/PhilsUtils.ui.v1",
    "bgagame/modules/BonsaiLogic",
    "ebg/core/gamegui",
    "ebg/counter",
],
function (
    dojo,
    declare,
    { install, formatBlock, createFromTemplate, invokeServerActionAsync },
    { transitionInAsync, transitionOutAsync },
    { BonsaiLogic, Cards, CardType, ResourceType, ColorNames, makeKey, parseKey, TileType, TileTypeName, Direction },
) {
    const BgaGameId = 'bonsai';

    let bonsai; // BonsaiLogic

    const TileTypeLabel = {};

    class Action {
        constructor() {
            this.fnDo = () => {};
            this.fnUndo = () => {};
            this.fnApply = obj => obj;
        }
        async doAsync() {
            return this.fnDo();
        }
        async undoAsync() {
            return this.fnUndo();
        }
        apply(obj) {
            return this.fnApply(obj);
        }
    }

    class ActionStack {
        constructor(context, fnLock, fnUnlock) {
            this.stack = [];
            this.context = context;
            this.fnLock = fnLock;
            this.fnUnlock = fnUnlock;
        }
        async doAsync(action) {
            this.fnLock.call(this.context);
            try {
                this.stack.push(action);
                await action.doAsync();
            }
            finally {
                this.fnUnlock.call(this.context);
            }
        }
        async undoAllAsync() {
            while (this.stack.length) {
                await this.undoAsync();
            }
        }
        async undoAsync() {
            try {
                this.fnLock.call(this.context);
                while (true) {
                    const action = this.stack.pop();
                    await action.undoAsync();
                    if (action.isCheckpoint()) {
                        break;
                    }
                }
            }
            finally {
                this.fnUnlock.call(this.context);
            }
        }
        canUndo() {
            return this.stack.length > 0;
        }
        // Serialize the action data into an array for sending to the server
        apply() {
            // TODO: collapse into an object... collapse duplicate keys into an array
            return this.stack.reduce((array, action) => action.apply(array), []);
        }
        clear() {
            this.stack.splice(0, this.stack.length);
        }
    }

    class PlaceTileAction extends Action {
        constructor(playerId, tileType, x, y, r) {
            super();
            this.playerId = playerId;
            this.tileType = tileType;
            this.x = x;
            this.y = y;
            this.r = r;
            this.tileId = null;
            this.divId = null;
        }

        async doAsync() {
            //
            // Decrement the player's tile type counter
            //
            gameui.adjustPlayerInventory(this.playerId, this.tileType, -1);

            //
            // Generate a tile sprite and place it on the player's summary board
            // ...actually, put it right on the stat block for that tile type
            //
            this.tileId = `client-${this.x}-${this.y}`;
            this.divId = `bon_tile-${this.tileId}`;
            const { xEm, yEm } = gameui.emsFromCoords(this);
            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: this.tileId,
                TYPE: TileTypeName[this.tileType],
                X_EM: xEm,
                Y_EM: yEm,
                DEG: this.r * 60,
            }, `player_board_${this.playerId}`);
            gameui.placeOnObject(this.divId, `bon_player-summary-stat-block-${this.playerId}-${TileTypeName[this.tileType]}`);

            //
            // Animate the tile from player's summary board to their tree
            //
            const destDivId = `bon_vacancy-${this.x}-${this.y}`;
            if (this.playerId != gameui.player_id) {
                // When playing this action for another player,
                // the vacancies won't exist on the board. So
                // need to create one here as a hack.
                gameui.createVacancy(this.playerId, this.x, this.y);
            }
            const slide = gameui.slideToObject(this.divId, destDivId, 500);
            await new Promise(resolve => {
                dojo.connect(slide, 'onEnd', this, () => {
                    const tileDiv = document.getElementById(this.divId);
                    tileDiv.style.bottom = '';
                    tileDiv.style.right = '';
                    tileDiv.style.left = '50%';
                    // TODO: verify these coords!
                    tileDiv.style.top = '50%';
                    //tileDiv.style.transform = `translate(calc(${xEm}em - 6.375em - 50%), calc(${yEm}em + 2.5em - 50%)) scale(.975) rotate(${this.r * 60}deg)`;
                    tileDiv.style.transform = `translate(calc(${xEm}em - 50%), calc(${yEm}em - 50%)) scale(.975) rotate(${this.r * 60}deg)`;
                    //tileDiv.style.transform = `translate(${xEm}em, ${yEm}) scale(.975) rotate(${this.r * 60}deg)`;
                    const treeDivId = `bon_tree-${this.playerId}`;
                    const treeDiv = document.getElementById(treeDivId);
                    treeDiv.appendChild(tileDiv);
                    resolve();
                });
                slide.play();
            });

            //
            // Update tree information
            //
            const tree = bonsai.trees[this.playerId];
            tree.placeTile(this.tileId, this.tileType, this.x, this.y, this.r);
            gameui.adjustPlayerPlaced(this.playerId, this.tileType, 1);

            //
            // Increment the played count for this type
            //
            await gameui.adjustPlayerTileTypePlayedThisTurnAsync(this.playerId, this.tileType, 1);

            //
            // Update game state
            //
            delete gameui.clientStateArgs.tileType;
            delete gameui.clientStateArgs.locX;
            delete gameui.clientStateArgs.locY;
            delete gameui.clientStateArgs.locR;
        }

        async undoAsync() {
            //
            // Update tree information
            //
            const tree = bonsai.trees[this.playerId];
            tree.removeTile(this.tileId);
            gameui.adjustPlayerPlaced(this.playerId, this.tileType, -1);

            //
            // Decrement the played count for this type
            //
            await gameui.adjustPlayerTileTypePlayedThisTurnAsync(this.playerId, this.tileType, -1);

            //
            // Animate the tile from player's tree back to their summary board
            //
            const destDivId = `bon_player-summary-stat-block-${this.playerId}-${TileTypeName[this.tileType]}`;
            await gameui.slideToObjectAsync(this.divId, destDivId, 500);

            //
            // Remove the tile from the DOM
            //
            const tileDiv = document.getElementById(this.divId);
            tileDiv.parentElement.removeChild(tileDiv);

            //
            // Increment the tile type counter
            //
            gameui.adjustPlayerInventory(this.playerId, this.tileType, 1);
        }

        isCheckpoint() {
            return true;
        }

        apply(array) {
            return [
                ...array,
                {
                    action: 'place',
                    type: this.tileType,
                    x: this.x,
                    y: this.y,
                    r: this.r,
                },
            ];
        }
    }

    class RotateTileAction extends Action {
        constructor(playerId, divId, r) {
            super();
            this.playerId = playerId;
            this.divId = divId;
            this.r = r;
        }

        async doAsync() {
            //
            // Set the tile rotation via CSS
            //
            const div = document.getElementById(this.divId);
            for (let r = 0; r < 6; r++) {
                if (r !== this.r) {
                    const className = `bon_rot-${r}`;
                    if (div.classList.contains(className)) {
                        this.oldClassName = className;
                    }
                    div.classList.remove(className);
                }
            }
            div.classList.add(`bon_rot-${this.r}`);
// TODO: add rotation as a separate element so it can be controlled independently from scaling and translating
        }

        async undoAsync() {
            const div = document.getElementById(this.divId);
            div.classList.remove(`bon_rot-${this.r}`);
            div.classList.add(this.oldClassName);
        }

        isCheckpoint() { return false; }

        apply(array) {
            // change rotation of last element in the array
            // (we know it's a tile because can only rotate after placing a tile)
            const lastData = array.pop();
            lastData.r = this.r;
            return [
                ...array,
                lastData,
            ];
        }
    }

    class TakeCardAction extends Action {
        constructor(playerId, cardId, slot) {
            super();
            this.playerId = playerId;
            this.cardId = cardId;
            this.slot = slot;
            this.tileTypes = [];

            // Slot 0 yields nothing and Slot 1 offers the player
            // a choice, which is resovled in a separate action.
            if (slot === 2) {
                this.tileTypes.push(TileType.Wood, TileType.Flower);
            }
            else if (slot === 3) {
                this.tileTypes.push(TileType.Leaf, TileType.Fruit);
            }
        }

        async doAsync() {
            //
            // Create a div in place that will hold the card.
            // We need this as an animation target so that the
            // card slides to the correct place.
            //
            const hostDivId = `bon_card-host-${this.cardId}`;
            const cardType = Cards[this.cardId].type;
            const destDivId =
                cardType === CardType.Tool
                    ? `bon_seishi-lhs-${this.playerId}`
                    : cardType === CardType.Growth
                        ? `bon_seishi-rhs-${this.playerId}`
                        : `bon_seishi-facedown-${this.playerId}`
            ;
            const isFaceDown = cardType !== CardType.Tool && cardType !== CardType.Growth;
            createFromTemplate('bonsai_Templates.cardHost', {
                CARD_ID: this.cardId,
            }, destDivId);
            gameui.placeInElement(hostDivId, destDivId); // TODO: game pref to order cards or not
            const cardDivId = `bon_card-${this.cardId}`;
            gameui.raiseElementToBody(cardDivId);

            //
            // Move the card to the Player's Seishi or face down
            // depending on the type of card
            //
            const cardPromise = (async () => {
                await gameui.slideToObjectAsync(cardDivId, hostDivId, 800);

                // Put the card into the card host and update game state
                gameui.placeInElement(cardDivId, hostDivId);
                bonsai.board[this.slot] = null;
                // TODO: add card to player game state

                if (isFaceDown) {
                    await gameui.delayAsync(200);
                    await transitionInAsync(cardDivId, 'bon_card-face-down', 400);

                    if (this.playerId == gameui.player_id) {
                        gameui.setSeishiFaceDownToolTip();
                    }
                }
            })();

            // TODO: Add stat area for Master, Helper, and Parchment cards

            /* KILL
            //
            // Depending on card slot, animate tiles to the Player
            // inventory.
            //
            const tilePromises = this.tileTypes.map(async (tileType, i) => {
                // Stagger the creation of subsequent tiles
                await gameui.delayAsync(100 * i + 200);

                const tileId = `client-${tileType}`;
                const divId = `bon_tile-${tileId}`;
                createFromTemplate('bonsai_Templates.tile', {
                    TILE_ID: tileId,
                    TYPE: TileTypeName[tileType],
                    X_EM: 0,
                    Y_EM: 0,
                    DEG: 0,
                }, `bon_slot-${this.slot}`);
                gameui.placeOnObject(divId, `bon_slot-${this.slot}`);
                gameui.raiseElementToBody(divId);

                // Leave the tile there briefly so player can see it from creation
                // and then slide it to their inventory stat block
                await gameui.delayAsync(50);
                await gameui.slideToObjectAsync(divId, `bon_player-summary-stat-block-${this.playerId}-${TileTypeName[tileType]}`);

                // Remove the sprite
                const div = document.getElementById(divId);
                div.parentElement.removeChild(div);

                // Increment inventory stat when the tile has arrived
                gameui.adjustPlayerInventory(this.playerId, tileType, 1);
            });

            // Wait for all the animations to end
            await Promise.all([
                cardPromise,
                ...tilePromises,
            ]);
            */
            await cardPromise; // TODO: collapse
        }

        async undoAsync() {
            //
            // Move the card back to the board
            //
            const cardDivId = `bon_card-${this.cardId}`;
            gameui.raiseElementToBody(cardDivId);
            const cardPromise = (async () => {
                await gameui.slideToObjectAsync(cardDivId, `bon_slot-${this.slot}`, 400);

                await gameui.delayAsync(100);
                await transitionOutAsync(cardDivId, 'bon_card-face-down', 200);

                // Put the card into the card host and update gate state
                gameui.placeInElement(cardDivId, `bon_slot-${this.slot}`);
                bonsai.board[this.slot] = this.cardId;
                // TODO: remove card from player game state

                // Remove the temporary card host
                const hostDivId = `bon_card-host-${this.cardId}`;
                const hostDiv = document.getElementById(hostDivId);
                hostDiv.parentElement.removeChild(hostDiv);

                // TODO: fix up face down pile (empty/not)
                // TODO: fix up face down pile tool tips
            })();

            /* KILL
            // Animate the tiles back to the board
            const tilePromises = this.tileTypes.map(async (tileType, i) => {
                // Stagger the creation of subsequent tiles
                await gameui.delayAsync(100 * i + 200);

                // Create a tile sprite on top of the player stat block for that tile type
                const tileId = `client-${tileType}`;
                const divId = `bon_tile-${tileId}`;
                const statDivId = `bon_player-summary-stat-block-${this.playerId}-${TileTypeName[tileType]}`;
                createFromTemplate('bonsai_Templates.tile', {
                    TILE_ID: tileId,
                    TYPE: TileTypeName[tileType],
                    X_EM: 0,
                    Y_EM: 0,
                    DEG: 0,
                }, statDivId);
                gameui.raiseElementToBody(divId);

                // Leave the tile there briefly so player can see it from creation,
                // decrease the stat, and then slide it back to the board slot
                await gameui.delayAsync(50);
                gameui.adjustPlayerInventory(this.playerId, tileType, -1);
                await gameui.slideToObjectAsync(divId, `bon_slot-${this.slot}`);

                // Now can destroy the sprite
                const tileDiv = document.getElementById(divId);
                tileDiv.parentElement.removeChild(tileDiv);
            });

            // Wait for all anumations to complete
            await Promise.all([
                cardPromise,
                ...tilePromises,
            ]);
            */
           await cardPromise; // TODO: collapse
        }

        isCheckpoint() { return true; }

        apply(array) {
            return [
                ...array,
                {
                    action: 'take',
                    cardId: this.cardId,
                },
            ];
        }
    }

    class ReceiveTilesAction extends Action {
        constructor(playerId, tileTypes, slot, name, userChose = false) {
            super();
            this.playerId = playerId;
            this.tileTypes = tileTypes;
            this.slot = slot;
            this.name = name;
            this.userChose = userChose;
            this.randomValue = Math.random().toString(28).substring(2);
        }

        /* KILL
        async doAsync() {
            await Promise.all(
                this.tileTypes.map(async (tileType, index) => {
                    await gameui.delayAsync(100 * index);

                    const tileId = `client-${tileType}-${index}`;
                    const divId = `bon_tile-${tileId}`;
                    createFromTemplate('bonsai_Templates.tile', {
                        TILE_ID: tileId,
                        TYPE: TileTypeName[tileType],
                        X_EM: 0,
                        Y_EM: 0,
                        DEG: 0,
                    }, `bon_slot-${this.slot}`);
                    gameui.placeOnObject(divId, `bon_slot-${this.slot}`);
                    gameui.raiseElementToBody(divId);

                    // Leave the tile there briefly so player can see it from creation
                    // and then slide it to their inventory stat block
                    await gameui.delayAsync(50);
                    await gameui.slideToObjectAsync(divId, `bon_player-summary-stat-block-${this.playerId}-${TileTypeName[tileType]}`);

                    // Remove the sprite
                    const div = document.getElementById(divId);
                    div.parentElement.removeChild(div);

                    // Increment inventory stat when the tile has arrived
                    gameui.adjustPlayerInventory(this.playerId, tileType, 1);
                })
            );
        }

        async undoAsync() {
            await Promise.all(
                this.tileTypes.map(async (tileType, index) => {
                    await gameui.delayAsync(100 * index);

                    // Create a tile sprite on top of the player stat block for that tile type
                    const tileId = `client-${tileType}-${index}`;
                    const divId = `bon_tile-${tileId}`;
                    const statDivId = `bon_player-summary-stat-block-${this.playerId}-${TileTypeName[tileType]}`;
                    createFromTemplate('bonsai_Templates.tile', {
                        TILE_ID: tileId,
                        TYPE: TileTypeName[tileType],
                        X_EM: 0,
                        Y_EM: 0,
                        DEG: 0,
                    }, statDivId);
                    gameui.placeOnObject(divId, statDivId);

                    // Leave the tile there briefly so player can see it from creation,
                    // decrease the stat, and then slide it back to the board slot
                    await gameui.delayAsync(50);
                    gameui.adjustPlayerInventory(this.playerId, tileType, -1);
                    await gameui.slideToObjectAsync(divId, `bon_slot-${this.slot}`);

                    // Now can destroy the sprite
                    const tileDiv = document.getElementById(divId);
                    tileDiv.parentElement.removeChild(tileDiv);
                })
            );
        }
        */
        async doAsync() {
            await Promise.all(
                this.tileTypes.map(async (tileType, index) => {
                    await gameui.delayAsync(100 * index);

                    const tileId = `${this.randomValue}-${tileType}-${index}`;
                    const divId = `bon_tile-${tileId}`;
                    createFromTemplate('bonsai_Templates.tile', {
                        TILE_ID: tileId,
                        TYPE: TileTypeName[tileType],
                        X_EM: 2.5,
                        Y_EM: 3.25,
                        DEG: 0,
                    }, `bon_slot-${this.slot}`);
                    gameui.placeOnObject(divId, `bon_slot-${this.slot}`);
                    gameui.raiseElementToBody(divId);
                    
                    // Animate the width of the placeholder growing
                    const hostDiv = gameui.createTilePlaceholderInInventory(this.playerId, tileType);
                    await hostDiv.animate({
                        width: [ '4.25em' ], // the width of a tile
                    }, {
                        duration: 100,
                        easing: 'ease-out',
                        fill: 'forwards',
                    }).finished;

                    // Slide the tile and make room in inventory at the same time
                    await gameui.slideToObjectAsync(divId, hostDiv);

                    // Remove the placeholder
                    const div = document.getElementById(divId);
                    hostDiv.replaceWith(div);
                    div.style.left = 0;
                    div.style.top = 0;

                    // Increment inventory stat when the tile has arrived
                    gameui.adjustPlayerInventory(this.playerId, tileType, 1);
                })
            );
        }

        async undoAsync() {
            await Promise.all(
                this.tileTypes.map(async (tileType, index) => {
                    await gameui.delayAsync(100 * index);

                    // Create a tile sprite on top of the player stat block for that tile type
                    const tileId = `${this.randomValue}-${tileType}-${index}`;
                    const divId = `bon_tile-${tileId}`;
                    const div = document.getElementById(divId);
                    gameui.raiseElementToBody(div); // TODO: could replace with placeholder and animate shrinking width

                    // Decrease the stat, and then slide it back to the board slot
                    gameui.adjustPlayerInventory(this.playerId, tileType, -1);
                    await gameui.slideToObjectAsync(divId, `bon_slot-${this.slot}`);

                    // Now can destroy the sprite
                    const tileDiv = document.getElementById(divId);
                    tileDiv.parentElement.removeChild(tileDiv);
                })
            );
        }

        isCheckpoint() { return false; }

        apply(array) {
            // Only apply this action's data if the user had to make a choice
            // (because that choice needs to be sent to the server. All other
            // data can be computed on the server).
            if (this.userChose) {
                return [
                    ...array,
                    {
                        action: this.name,
                        tileTypes: this.tileTypes,
                    },
                ];
            }
            else {
                return array;
            }
        }
    }

    class RenounceGoalAction extends Action {
        constructor(playerId, goalId) {
            super();
            this.playerId = playerId;
            this.goalId = goalId;
        }

        async doAsync() {
            // TODO
        }

        async undoAsync() {
            // TODO
        }

        isCheckpoint() { return false; }

        apply(array) {
            return array;
        }
    }

    class ClaimGoalAction extends Action {
        constructor(playerId, goalId) {
            super();
            this.playerId = playerId;
            this.goalId = goalId;
        }

        async doAsync() {
            // TODO
        }

        async undoAsync() {
            // TODO
        }

        isCheckpoint() { return false; }

        apply(array) {
            return array;
        }
    }

    class DiscardExcessTileAction extends Action {
        constructor(playerId, tileType /* TODO: id? */) {
            super();
            this.playerId = playerId;
            this.tileType = tileType;
            // TODO? remember the relative position in the on-screen set
        }

        async doAsync() {
            // TODO: animate the tile out of the on-screen set
        }

        async undoAsync() {
            // TODO: animate the tile back into place
        }

        isCheckpoint() { return false; }

        apply(array) {
            // TODO: return the discard info... (allow the action stack to group discards)
            return array;
        }
    }


    // Helper class to simplify workflow generators
    class SetClientState {
        constructor(name, description, args = {}) {
            this.name = name;
            this.description = description;
            this.args = args;
        }
    }


    // TODO: move into core
    // Helper function to put HTML markup into translated strings
    function __(text) {
        return bga_format(_(text), {
            '/': t => `<i>${t}</i>`,
            '*': t => `<b>${t}</b>`,
            '_': t => `<u>${t}</u>`,
            '|': t => `<br/>`,
        });
    };

    return declare(`bgagame.${BgaGameId}`, ebg.core.gamegui, {
        constructor() {
            console.log(`${BgaGameId} constructor`);

            /* KILL?
            //
            // Intercept calls for string substitution so we can inject rich content into log entries
            //
            // TODO: move into core
            aspect.before(dojo.string, 'substitute', (template, map, transform) => {
                if (typeof map === 'object') {
                    for (const [ key, value ] of Object.entries(map)) {
                        const match = /^_(?<dataKey>\D+)(?<index>\d*)$/.exec(key);
                        if (match) {
                            // This key/value pair is strictly for the replay logs, which don't have access
                            // to the images, CSS, nor JavaScript of the game page. We want to replace them
                            // with rich content for the in-game log.  Strip the leading underscore to find
                            // the name of the data key (which must have been sent from server side) and we
                            // replace the old key with the rich content.
                            const { dataKey, index } = match.groups;
                            const dataValue = map[`${dataKey}${index}`];
                            if (dataValue !== undefined) {
                                if (typeof dataValue === 'object' && typeof dataValue.length === 'number') {
                                    map[key] = dataValue.reduce((html, d) => html + formatBlock(`${BgaGameId}_Templates.${dataKey}Log`, {
                                        DATA: d.toString(),
                                        INDEX: index,
                                        TEXT: value.toString(),
                                    }), '');
                                }
                                else {
                                    map[key] = formatBlock(`${BgaGameId}_Templates.${dataKey}Log`, {
                                        DATA: dataValue.toString(),
                                        INDEX: index,
                                        TEXT: value.toString(),
                                    });
                                }
                            }
                        }
                    }
                }
                return [ template, map, transform, this ];
            });
            */

            // TODO: move to clientStateArgs
            // KILL: this.slots = {};     // cardId of the card in each board slot 
            //this.trees = {};     // Tree instance for each player

            // EBG Counters
            this.placed = {};    // Number of tiles each player has in their tree
            this.inventory = {}; // Tiles each player has
            this.capacity = {};  // Maximum tiles the player is allowed to have

            // TODO: move to core
            Object.defineProperties(this, {
                currentState: {
                    get() {
                        return this.gamedatas.gamestate.name;
                    },
                },
            });

            this.resetClientStateArgs();
            this.actionStack = new ActionStack(this, this.lockClient, this.unlockClient);
        },
        
        setup(gamedata)
        {            
            // Hook into this object and overwrite default BGA functions with enhanced functions
            install(dojo, this, { debug: true }); // TODO: turn off debug

            console.log('Starting game setup', gamedata);
            
            this.myPlayerId = this.player_id;
            this.initPreferencesObserver();

            const { data, scores } = gamedata;
            bonsai = new BonsaiLogic(data, this.myPlayerId);
            window.bonsai = bonsai; // For convenience during debugging

            this.toolTipText = {
                // TODO
            };

            TileTypeLabel[TileType.Wood] = _('Wood');
            TileTypeLabel[TileType.Leaf] = _('Leaf');
            TileTypeLabel[TileType.Flower] = _('Flower');
            TileTypeLabel[TileType.Fruit] = _('Fruit');

            // Setting up player boards
            this.setupPlayer(this.myPlayerId, bonsai.players[this.myPlayerId]);
            for (const [ playerId, player ] of Object.entries(bonsai.players)) {
                if (playerId == this.myPlayerId) continue;
                this.setupPlayer(playerId, player);
            }

            for (let i = 0; i < 4; i++) {
                const cardId = bonsai.board[i];
                document.getElementById(`bon_slot-${i}`).addEventListener('click', () => this.onClickSlot(i));
                this.createCard(cardId, true, `bon_slot-${i}`);
            }
            
            if (gamedata.deck == 0) {
                const deckDiv = document.getElementById('bon_deck');
                deckDiv.classList.add('bon_deck-empty');
            }

            // TODO: allow player to flip their pot? (maybe only at the start...?)
            // TODO: game preference to sort Seishi cards by type or not
            // TODO: have variable speeds... 
            // TODO: make the undo action faster than the do action

            this.setupNotifications();
        },

        // TODO: move into core
        initPreferencesObserver() {
            dojo.query('.preference_control').on('change', e => {
                const match = e.target?.id.match(/^preference_[cf]ontrol_(\d+)$/);
                if (!match) return;
                const prefId = match[1];
                const { value } = e.target;
                this.prefs[prefId].value = parseInt(value, 10);
                this.onPreferenceChange(this.prefs[prefId]);
            });
        },
        
        // TODO: move into core
        onPreferenceChange(pref) {
            // Apply the CSS of the chosen preference value
            // (Unless it's a default pref, which appears to be
            // delivered as an array and without CSS class names)
            if (typeof pref.values === 'object' && typeof pref.values.length === 'number') return;
            const html = document.getElementsByTagName('html')[0];
            for (const [ value, settings ] of Object.entries(pref.values)) {
                if (typeof settings.cssPref !== 'string') continue;
                if (value == pref.value) {
                    html.classList.add(settings.cssPref);
                }
                else {
                    html.classList.remove(settings.cssPref);
                }
            }
        },

        setupPlayer(playerId, player) {
            const playerScoreDiv = document.querySelector(`#player_board_${playerId} .player_score`);
            createFromTemplate('bonsai_Templates.playerSummary', {
                PID: playerId,
            }, playerScoreDiv, 'afterend');

            createFromTemplate('bonsai_Templates.player', {
                PID: playerId,
                COLOR: ColorNames[player.color],
            }, 'bon_surface');

            /* KILL
            this.turnCap[playerId] = {
                [TileType.Wood]: Number(player['wood_cap']),
                [TileType.Leaf]: Number(player['leaf_cap']),
                [TileType.Flower]: Number(player['flower_cap']),
                [TileType.Fruit]: Number(player['fruit_cap']),
                wild: Number(player['wild_cap']),
            };
            */

            // Add the tree tiles of this user
            const playerTiles = player.played;
            for (const [ type, x, y, r ] of playerTiles) {
                const tileId = bonsai.placeTile(playerId, type, x, y, r);
                if (x != 0 || y != 0) {
                    this.createTileInTree(playerId, tileId);
                }
            }

            const inventory = {
                [TileType.Wood]: new ebg.counter(),
                [TileType.Leaf]: new ebg.counter(),
                [TileType.Flower]: new ebg.counter(),
                [TileType.Fruit]: new ebg.counter(),
            };
            this.inventory[playerId] = inventory;

            const placed = {
                [TileType.Wood]: new ebg.counter(),
                [TileType.Leaf]: new ebg.counter(),
                [TileType.Flower]: new ebg.counter(),
                [TileType.Fruit]: new ebg.counter(),
            };
            this.placed[playerId] = placed;

            for (const tileType of Object.values(TileType)) {
                inventory[tileType].create(`bon_inv-${TileTypeName[tileType]}-${playerId}`);
                const count = player.inventory[TileTypeName[tileType]];
                this.setPlayerInventory(playerId, tileType, count);

                for (let i = 0; i < count; i++) {
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

            const hasFaceDownCards =
                playerId == this.myPlayerId
                    ? bonsai.players[playerId].faceDown.length
                    : bonsai.players[playerId].faceDown
            const faceDownPileDiv = document.getElementById(`bon_seishi-facedown-${playerId}`);
            if (hasFaceDownCards) {
                faceDownPileDiv.classList.remove('bon_empty');
            }
            else {
                faceDownPileDiv.classList.add('bon_empty');
            }

            this.setSeishiFaceDownToolTip();
        },

        setSeishiFaceDownToolTip() {
            // Group cards of the same type together
            function sortFaceDownCards(cardA, cardB) {
                typeA = Cards[cardA].type;
                typeB = Cards[cardB].type;
                if (typeA !== typeB) return typeA - typeB;
                return cardA - cardB;
            }

            const divId = `bon_seishi-facedown-${this.myPlayerId}`;
            this.removeTooltip(divId);
            const { faceDown } = bonsai.players[this.myPlayerId];
            const html = faceDown.sort(sortFaceDownCards).reduce((html, cardId) => {
                return html + formatBlock('bonsai_Templates.seishiFaceDownCard', {
                    CARD_ID: cardId,
                });
            }, '<div class="bon_seishi-facedown-tooltip">') + '</div>';
            gameui.addTooltipHtml(divId, html, 200);
        },


        ///////////////////////////////////////////////////
        //// UI methods

        emsFromCoords({ x, y }) {
            return {
                xEm: (x - 1) * 4.25 + (y % 2 ? 0 : 2.125),
                yEm: (y - 1) * -3.8,
            };
        },

        createCard(cardId, faceUp, divId = 'bon_surface') {
            createFromTemplate('bonsai_Templates.card', {
                CARD_ID: cardId,
                DOWN: faceUp ? '' : 'bon_card-face-down',
            }, divId);
        },

        createTileInTree(playerId, tileId) {
            const { type, r, ...coords } = bonsai.playerTree(playerId).getNode(tileId);
            const { xEm, yEm } = this.emsFromCoords(coords);

            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: tileId,
                TYPE: TileTypeName[type],
                X_EM: xEm,
                Y_EM: yEm,
                DEG: Number(r) * 60,
            }, `bon_tree-${playerId}`);
        },

        createTileInInventory(playerId, tileType) {
            const tileId = `${playerId}-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tile', {
                TILE_ID: tileId,
                TYPE: TileTypeName[tileType],
                X_EM: 0,
                Y_EM: 0,
                DEG: 0,
            }, `bon_tiles-${playerId}`);
        },

        createTilePlaceholderInInventory(playerId, tileType) {
            // TODO: depending on preference, place in order or at the end
            const hostDiv = document.getElementById(`bon_tiles-${playerId}`);
            const divId = `bon_tile-placeholder-${Math.random().toString(28).substring(2)}`;
            createFromTemplate('bonsai_Templates.tileHost', {
                DIV_ID: divId,
            }, hostDiv);
            return document.getElementById(divId);
        },

        createVacancy(playerId, x, y) {
            const { xEm, yEm } = this.emsFromCoords({ x, y });
            const divId = `bon_vacancy-${x}-${y}`;
            createFromTemplate('bonsai_Templates.vacancy', {
                ID: divId,
                X: x,
                Y: y,
                X_EM: xEm,
                Y_EM: yEm,
            }, `bon_tree-${playerId}`);

            const div = document.getElementById(divId);
            div.addEventListener('click', e => this.onClickVacancy.call(this, e));
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
                    this.destroyAllVacancies();
                    this.resetPlayerTileTypesPlayedThisTurn();
                    break;

                case 'client_meditate':
                    break;

                case 'client_cultivate':
                    break;

                case 'client_cultivateLocation':
                    break;

                case 'client_cultivateConfirmPlacement':
                    break;

                case 'client_meditate':
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
            
            switch (stateName)
            {
                case 'client_meditate':
                    break;

                case 'client_cultivate':
                    break;

                case 'client_cultivateLocation':
                    this.destroyAllVacancies();
                    break;
            }               
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
                
                case 'client_cultivate':
                    this.updateLegalMoves();
                    for (const tileType of Object.values(TileType)) {
                        const tileTypeName = TileTypeLabel[tileType].toLowerCase();
                        if (bonsai.players[playerId].inventory[tileTypeName] > 0) {
                            this.addActionButton(`bon_button-cultivate-${tileType}`, _(TileTypeLabel[tileType]), () => this.onClickCultivateTile(tileType));
                            if (!Object.keys(this.clientStateArgs.legalMoves[tileType]).length) {
                                document.getElementById(`bon_button-cultivate-${tileType}`).classList.add('disabled');
                            }
                        }
                    }
                    if (this.clientStateArgs.alreadyPlaced) {
                        this.addActionButton(`bon_button-cultivate-cancel`, _('Cancel'), () => this.onClickCancelAnotherCultivate(), null, false, 'red'); 
                    }
                    else {
                        this.addActionButton(`bon_button-cultivate-cancel`, _('Cancel'), () => this.onClickCancelCultivate(), null, false, 'red'); 
                    }
                    break;
            
                case 'client_cultivateLocation':
                    this.addActionButton(`bon_button-cultivate-location-cancel`, _('Cancel'), () => this.onClickCancelLocation(), null, false, 'red'); 
                    break;

                case 'client_cultivateConfirmPlacement':
                    this.updateLegalMoves();

                    this.addActionButton('bon_button-cultivate-confirm-place-another', _('Place Another'), () => this.onClickPlaceAnother());
                    if (!this.clientStateArgs.hasLegalMoves) {
                        document.getElementById('bon_button-cultivate-confirm-place-another').classList.add('disabled');
                    }
                    
                    this.addActionButton('bon_button-cultivate-confirm-undo', _('Undo'), () => this.onClickUndo());
                    if (!this.actionStack.canUndo()) {
                        document.getElementById('bon_button-cultivate-confirm-undo').classList.add('disabled');
                    }

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

                case 'client_meditatePlaceFirstTile':
                    this.updateLegalMoves(); // TODO: need to represent that can only play certain tile types
                    for (const tileType of Object.values(TileType)) {
                        const tileTypeName = TileTypeLabel[tileType].toLowerCase();
                        if (bonsai.players[playerId].inventory[tileTypeName] > 0) {
                            this.addActionButton(`bon_button-cultivate-${tileType}`, _(TileTypeLabel[tileType]), () => this.onClickCultivateTile(tileType));
                            if (!Object.keys(this.clientStateArgs.legalMoves[tileType]).length) {
                                document.getElementById(`bon_button-cultivate-${tileType}`).classList.add('disabled');
                            }
                        }
                    }
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red');
                    break;

                case 'client_meditatePlaceSecondTile':
                    this.updateLegalMoves(); // TODO: need to represent that can only play certain tile types
                    for (const tileType of Object.values(TileType)) {
                        const tileTypeName = TileTypeLabel[tileType].toLowerCase();
                        if (bonsai.players[playerId].inventory[tileTypeName] > 0) {
                            this.addActionButton(`bon_button-cultivate-${tileType}`, _(TileTypeLabel[tileType]), () => this.onClickCultivateTile(tileType));
                            if (!Object.keys(this.clientStateArgs.legalMoves[tileType]).length) {
                                document.getElementById(`bon_button-cultivate-${tileType}`).classList.add('disabled');
                            }
                        }
                    }
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red');
                    break;

                case 'client_meditateDiscard':
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red'); 
                    break;
                    
                case 'client_meditateConfirm':
                    this.addActionButton('bon_button-meditate-confirm-end-turn', _('End Turn'), () => this.onClickMeditateEndTurn());
                    this.addActionButton(`bon_button-meditate-cancel`, _('Cancel'), () => this.onClickCancelMeditate(), null, false, 'red'); 
                    break;
            }
        },

        addTileButton(tileType) {
            const divId = `bon_button-choose-${tileType}`;
            this.addActionButton(divId, TileTypeLabel[tileType], () => this.onClickChooseTile(tileType), null, false, 'gray');
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
                placedThisTurn: {
                    [TileType.Wood]: 0,
                    [TileType.Leaf]: 0,
                    [TileType.Flower]: 0,
                    [TileType.Fruit]: 0,
                },
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

        delayAsync(duration) {
            return new Promise(resolve => setTimeout(resolve, duration));
        },

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

        raiseElementToBody(divOrId) {
            const div = typeof divOrId === 'string' ? document.getElementById(divOrId) : divOrId;
            let cur = div;
            let totalLeft = 0;
            let totalTop = 0;
            const body = document.getElementsByTagName('body')[0];
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

        adjustPlayerInventory(playerId, tileType, delta) {
            const inventory = this.inventory[playerId];
            inventory[tileType].incValue(delta);

            let element = document.getElementById(`bon_player-summary-stat-block-${playerId}-${TileTypeName[tileType]}`);
            if (inventory[tileType].getValue() > 0) {
                element.classList.remove('bon_zero');
            }
            else {
                element.classList.add('bon_zero');
            }

            bonsai.adjustPlayerInventory(playerId, tileType, delta);
        },

        setPlayerInventory(playerId, tileType, value) {
            const inventory = this.inventory[playerId];
            inventory[tileType].setValue(value);

            let element = document.getElementById(`bon_player-summary-stat-block-${playerId}-${TileTypeName[tileType]}`);
            if (Number(value) > 0) {
                element.classList.remove('bon_zero');
            }
            else {
                element.classList.add('bon_zero');
            }
        },

        adjustPlayerPlaced(playerId, tileType, delta) {
            const placed = this.placed[playerId];
            placed[tileType].incValue(delta);

            let element = document.getElementById(`bon_tree-${TileTypeName[tileType]}-${playerId}`);
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

            let element = document.getElementById(`bon_tree-${TileTypeName[tileType]}-${playerId}`);
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

        resetPlayerTileTypesPlayedThisTurn() {
            for (const tileType of Object.values(TileType)) {
                this.clientStateArgs.placedThisTurn[tileType] = 0;
            }
        },

        async adjustPlayerTileTypePlayedThisTurnAsync(playerId, tileType, delta) {
            const placed = this.clientStateArgs.placedThisTurn[tileType];
            this.clientStateArgs.placedThisTurn[tileType] = placed + delta;

            // TODO: show on the Seishi (for the current player)
        },

        // Is it legal for the player to play the given tile type (only considering Seishi limits)
        isPlayerWithinTurnCap(playerId, tileType) {
            const playerTurnCap = bonsai.players[playerId].canPlay;
            let wildCap = playerTurnCap.wild;
            for (const tt of Object.values(TileType)) {
                const typeCap = playerTurnCap[tt];
                let placed = this.clientStateArgs.placedThisTurn[tt];
                if (tt == tileType) {
                    placed++;
                }
                if (placed > typeCap) {
                    wildCap -= placed - typeCap;
                    if (wildCap < 0) {
                        return false;
                    }
                }
            }
            return true;
        },

        getActivePlayerExcessTileCount() {
            const playerId = this.getActivePlayerId();
            const inventory = this.inventory[playerId];
            const tileCount = Object.values(TileType).reduce((sum, tileType) => sum + inventory[tileType].getValue(), 0);
            return Math.max(0, tileCount - this.capacity[playerId].getValue());
        },

        makeTilesSelectable() {
            const divs = document.querySelectorAll(`#bon_tiles-${this.myPlayerId} .bon_tile`);
            for (const div of divs) {
                div.classList.add('bon_selectable');
            }
        },

        makeTilesUnselectable() {
            const divs = document.querySelectorAll(`#bon_tiles-${this.myPlayerId} .bon_tile.bon_selectable`);
            for (const div of divs) {
                div.classList.remove('bon_selectable');
            }
        },

        // TODO: Clean this up
        updateLegalMoves() {
            const playerId = this.getActivePlayerId();

            let hasLegalMoves = false;
            const inventory = this.inventory[playerId];

            // TODO: move into logic class

            // Calculate legal moves for all tile types the player has and is allowed to play
            const tree = bonsai.trees[playerId];
            for (const tileType of Object.values(TileType)) {
                this.clientStateArgs.legalMoves[tileType] = {};

                // Does the player not have this tile type?
                if (inventory[tileType].getValue() < 1) continue;

                // Has the player's Seishi limit been reached for this tile type?
                if (!this.isPlayerWithinTurnCap(playerId, tileType)) continue;

                const legalMoves = tree.getLegalMoves(tileType);
                this.clientStateArgs.legalMoves[tileType] = legalMoves;
                hasLegalMoves |= Object.keys(legalMoves).length > 0;
            }
            this.clientStateArgs.hasLegalMoves = hasLegalMoves;
        },

        showLegalMoves(selectedTileType) {
            this.destroyAllVacancies();

            const playerId = this.getActivePlayerId();
            for (const tileType of Object.values(TileType)) {
                if (selectedTileType && selectedTileType !== tileType) continue;
                for (const key of Object.keys(this.clientStateArgs.legalMoves[tileType])) {
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
            await this.delayAsync(delay);
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
                promises.push((async () => {
                    // Wait for the other cards to have started their animations
                    await this.delayAsync(slot * 100);

                    // Create a new card face down on top of the deck, inside a host element
                    const hostDiv = document.createElement('div');
                    hostDiv.classList.add('bon_card');
                    hostDiv.style.perspective = '10em';

                    hostDiv.id = 'bon_card-host';
                    const deckDiv = document.getElementById('bon_deck');
                    deckDiv.appendChild(hostDiv);

                    this.createCard(nextCardId, false, `bon_card-host`);
                    const cardDiv = document.getElementById(`bon_card-${nextCardId}`);

                    // Slide the card host into the first slot
                    this.raiseElementToBody(hostDiv);
                    cardDiv.style.transition = 'transform 400ms ease-out';
                    gameui.reflow();

                    // Start the slide
                    const slidePromise = this.slideToObjectAsync(hostDiv, 'bon_slot-0');

                    // Start flipping the card over
                    const flipPromise = new Promise(async resolve => {
                        await this.delayAsync(50);
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
            else {
                // Indicate that the deck is now empty
                const deckDiv = document.getElementById('bon_deck');
                deckDiv.classList.add('bon_deck-empty');
            }

            await Promise.all(promises);
        },

        reflow(element = document.documentElement) {
            void(element.offsetHeight);
        },


        ///////////////////////////////////////////////////
        //// Player's action

        async onClickCultivate() {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('cultivate')) return;

            // TODO: clean this up... how much can be hidden?
            this.clientStateArgs.workflow = this.cultivateWorkflow();
            await this.advanceWorkflow();
        },

        onClickCultivateTile(tileType) {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('cultivate')) return;
            if (this.isClientLocked()) return;
            console.log(`onClickCultivateTile(${tileType})`);

            // Otherwise, store the tile type and update the display of legal moves
            this.clientStateArgs.tileType = tileType;

            // KILL: (move to workflow(s))
            this.updateLegalMoves();
            this.showLegalMoves(tileType);

            // Prompt the player for a location
            this.setClientState('client_cultivateLocation', {
                descriptionmyturn: _('${you} must select a location'),
            });
        },

        async onClickVacancy(e) {
            if (!this.isCurrentPlayerActive()) return;
            e.stopPropagation();
            if (!this.checkAction('cultivate')) return;
            if (this.isClientLocked()) return;

            const { x, y } = e.currentTarget.dataset;
            console.log(`onClickVacancy(${x}, ${y})`);
            const key = makeKey(x, y);

            // Place the tile if the player has already selected the type
            const { tileType, legalMoves } = this.clientStateArgs;
            const firstLegalDir = legalMoves[tileType][key][0];

            // Select the tile rotation depending on the tile type and the first legal direction
            let rotation = 0;
            switch (tileType) {
                case TileType.Wood: break;
                case TileType.Leaf: // default leaf-wood connector is in bottom-left position (3)
                    rotation = (firstLegalDir + 3) % 6;
                    break;
                case TileType.Flower: // default flower-leaf connector is in bottom-left position (3)
                    rotation = (firstLegalDir + 3) % 6;
                    break;
                case TileType.Fruit: // default fruit-leaf/leaf connector is in bottom-right and bottom-left positions (2,3)
                    rotation = (firstLegalDir + 4) % 6;
                    break;
            }

            /* KILL
            const playerId = this.getActivePlayerId();
            await this.actionStack.doAsync(new PlaceTileAction(playerId, tileType, x, y, rotation));

            this.clientStateArgs.alreadyPlaced = true; // KILL

            gameui.setClientState('client_cultivateConfirmPlacement', {
                descriptionmyturn: _('${you} must ...'), // TODO: what must they do?...
            });
            */
            await this.advanceWorkflow();
        },

        onClickPlaceAnother() {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('cultivate')) return;
            this.setClientState('client_cultivate', {
                descriptionmyturn: _('${you} may place a tile'),
            });
        },

        onClickUndo() {
            if (!this.isCurrentPlayerActive()) return;
            this.actionStack.undoAsync();
        },

        onClickCancelCultivatePlacement() {
            if (!this.isCurrentPlayerActive()) return;
            this.setClientState('client_cultivate', {
                descriptionmyturn: _('${you} may place a tile'),
            });
        },

        onClickCancelCultivate() {
            if (!this.isCurrentPlayerActive()) return;
            this.actionStack.undoAllAsync();
            this.resetClientStateArgs();
            this.restoreServerGameState();
        },

        onClickCancelAnotherCultivate() {
            if (!this.isCurrentPlayerActive()) return;
            gameui.setClientState('client_cultivateConfirmPlacement', {
                descriptionmyturn: _('${you} must ...'), // TODO: what must they do?...
            });
    },

        onClickCancelLocation() {
            if (!this.isCurrentPlayerActive()) return;
            this.destroyAllVacancies();
            this.setClientState('client_cultivate', {
                descriptionmyturn: _('${you} may place a tile'),
            });
        },

        async onClickCultivateEndTurn() {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`onClickCultivateEndTurn()`);

            // TODO: check for goal eligibility
            // TODO: go to goal state per each qualifying goal type

            const data = this.actionStack.apply();
            const remove =
                data.filter(d => d.action === 'remove')
                    .map(d => d.tileId)
                    .join(',');
            const place =
                data.filter(d => d.action === 'place')
                    .map(d => [ d.type, d.x, d.y, d.r ].join(','))
                    .join(',');
            const renounce = ''; // TODO
            const claim = ''; // TODO
            try {
                await invokeServerActionAsync('cultivate', { remove, place, renounce, claim });
                this.clientStateArgs.alreadyPlaced = false;
                this.actionStack.clear();
            }
            catch (err) {}
        },

        * cultivateWorkflow() {
            // TODO: check to see if there are no possible moves (allow player to remove a tile... see rule book)

            delete this.clientStateArgs.placeAnother;
            do {
                yield new SetClientState('client_cultivate', _('${you} may place a tile'));

                const { tileType } = this.clientStateArgs;
                this.updateLegalMoves(); // KILL
                this.showLegalMoves(tileType);
                const { legalMoves } = this.clientStateArgs; // TODO: assign directly from bonsai.getLegalMoves()

                // Prompt the player for a location
                yield new SetClientState('client_cultivateLocation', _('${you} must select a location'));

                const { x, y } = e.currentTarget.dataset;
                console.log(`onClickVacancy(${x}, ${y})`);
                const key = makeKey(x, y);

                // Place the tile if the player has already selected the type
                const firstLegalDir = legalMoves[tileType][key][0];

                // Select the tile rotation depending on the tile type and the first legal direction
                let rotation = 0;
                switch (tileType) {
                    case TileType.Wood:
                        break;
                    case TileType.Leaf: // default leaf-wood connector is in bottom-left position (3)
                        rotation = (firstLegalDir + 3) % 6;
                        break;
                    case TileType.Flower: // default flower-leaf connector is in bottom-left position (3)
                        rotation = (firstLegalDir + 3) % 6;
                        break;
                    case TileType.Fruit: // default fruit-leaf/leaf connector is in bottom-right and bottom-left positions (2,3)
                        rotation = (firstLegalDir + 4) % 6;
                        break;
                }

                const playerId = this.getActivePlayerId();
                yield new PlaceTileAction(playerId, tileType, x, y, rotation);

                this.clientStateArgs.alreadyPlaced = true;

                yield new SetClientState('client_cultivateConfirmPlacement', _('${you} must complete your turn'));
            }
            while (this.clientStateArgs.placeAnother); // TODO: && bonsai.canPlaceAnother

            yield * this.claimRenounceGoalsWorkflow();
        },

        // TODO: formalize the starting of a workflow; checking to see if one exists; advancing it; etc.
        // TODO: probably need a mechanism for cancelling a workflow... (or just delete the workflow?)
        // TODO: what about how to short circuit certain elements? (e.g. might already start with a selected card)

        * meditateWorkflow({ skipSelectPrompt = false } = {}) {
            if (!skipSelectPrompt) {
                yield new SetClientState('client_meditate', _('${you} may select a card'));
            }

            const { slot, cardId } = this.clientStateArgs;
            yield new TakeCardAction(this.myPlayerId, cardId, slot);

            // Receive bonus tiles based on the slot of the selected card
            const bonusTiles = [];
            switch (slot) {
                case 0: break; // Player gets no bonus
                case 1:
                    yield new SetClientState('client_meditateChooseWoodOrLeafTile', _('${you} must choose to draw a wood or leaf tile'));
                    bonusTiles.push(this.clientStateArgs.woodOrLeaf);
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
                    receivedTileTypes[0] = this.clientStateArgs.masterTile;
                }

                yield new ReceiveTilesAction(this.myPlayerId, receivedTileTypes, slot, 'masterCardTiles', userChoice);
            }
            else if (type === CardType.Helper) {
                // Note: All the helper cards allow the player to place up to two tiles (and one is always wild)
                this.makeTilesSelectable();
                yield new SetClientState('client_meditatePlaceFirstTile', _('${you} may place up to two tiles'));

                const { helperPlacement1 } = this.clientStateArgs;
                if (helperPlacement1) {
                    const [ tileType, x, y, rotation ] = helperPlacement1;
                    yield new PlaceTileAction(playerId, tileType, x, y, rotation);

                    // TODO: make eligible tiles selectable
                    yield new SetClientState('client_meditatePlaceSecondTile', _('${you} may place one more tile'));

                    const { helperPlacement2 } = this.clientStateArgs;
                    if (helperPlacement2) {
                        const [ tileType, x, y, rotation ] = helperPlacement2;
                        yield new PlaceTileAction(playerId, tileType, x, y, rotation);
                    }

                    yield * this.claimRenounceGoalsWorkflow();
                }
            }

            // Discard tiles if necessary
            while (bonsai.tilesOverCapacity) {
                this.makeTilesSelectable();

                const n = bonsai.tilesOverCapacity;
                const msg = n === 1 ? _('${you} must discard 1 tile') : _('${you} must discard ${n} tiles');
                yield new SetClientState('client_meditateDiscardTiles', msg, { n });
                
                const { discard } = this.clientStateArgs; // TODO: check the property name
                yield new DiscardExcessTileAction(playerId, discard);
                delete this.clientStateArgs.discard;
            }
            this.makeTilesUnselectable();

            // TODO: allow player to confirm / cancel (unless preference says not to)
            yield new SetClientState('client_meditateConfirm', _('${you} must confirm your turn'));
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
                yield new SetClientState('client_meditateClaimOrRenounce', _('${you} must claim or renounce this goal'));

                const { claimed } = this.clientStateArgs;
                if (claimed) {
                    yield new ClaimGoalAction(this.myPlayerId, goalId);
                }
                else {
                    yield new RenounceGoalAction(this.myPlayerId, goalId);
                }
            }
        },

        // TODO: move this
        async advanceWorkflow() {
            //
            // Iterate through workflow logic until input is required from the player.
            //
            while (this.clientStateArgs.workflow) {
                const { value, done } = this.clientStateArgs.workflow.next();
                if (done) {
                    delete this.clientStateArgs.workflow;
                    break;
                }
                if (value instanceof Action) {
                    await this.actionStack.doAsync(value);
                }
                else if (value instanceof SetClientState) {
                    const { name, description, args } = value;
                    this.setClientState(name, {
                        descriptionmyturn: description,
                        args,
                    });
                    break;
                }
            }
        },

        async onClickMeditate() {
            if (this.clientStateArgs.alreadyPlaced) return;
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('meditate')) return;
            console.log(`onClickMeditate()`);

            // TODO: clean this up... how much can be hidden?
            this.clientStateArgs.workflow = this.meditateWorkflow();
            await this.advanceWorkflow();
        },

        async onClickSlot(slot) {
            // KILL? if (this.clientStateArgs.alreadyPlaced) return;
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('meditate')) return;

            const cardId = bonsai.board[slot];
            if (!cardId) return; // E.g. the slot is empty... either mid-animation or no cards left

            console.log(`onClickSlot(${slot})`);

            this.clientStateArgs.slot = slot;
            this.clientStateArgs.cardId = cardId;

            // TODO: clean this up... how much can be hidden?
            if (!this.clientStateArgs.workflow) {
                this.clientStateArgs.workflow = this.meditateWorkflow({ skipSelectPrompt: true });
            }            
            await this.advanceWorkflow();
        },

        async onClickChooseTile(tileType) {
            if (!this.isCurrentPlayerActive()) return;
            if (!this.checkAction('meditate')) return;
            console.log(`onClickChooseTile(${tileType})`);

            switch (this.currentState) {
                case 'client_meditateChooseWoodOrLeafTile':
                    this.clientStateArgs.woodOrLeaf = tileType;
                    break;

                case 'client_meditateChooseMasterTile':
                    this.clientStateArgs.masterTile = tileType;
                    break;
                
                default:
                    throw new Error('not implemented');
            }

            await this.advanceWorkflow();
        },

        async onClickMeditateEndTurn() {
            if (!this.isCurrentPlayerActive()) return;
            console.log(`onClickMeditateEndTurn()`);

            const data = this.actionStack.apply();
            const discard =
                data.filter(d => d.action === 'remove')
                    .map(d => d.type)
                    .join(',');
            const card = data.filter(d => d.action === 'take').shift()?.cardId;
            const choice = data.filter(d => d.action === 'bonusTiles').shift()?.tileTypes[0];
            const master = data.filter(d => d.action === 'masterCardTiles').shift()?.tileTypes;
            const place = []; // TODO
            const renounce = []; // TODO
            const claim = []; // TODO
            try {
                await invokeServerActionAsync('meditate', { card, choice, master, place, renounce, claim, discard });
                this.actionStack.clear();
            }
            catch (err) {}
        },

        onClickCancelMeditate() {
            if (!this.isCurrentPlayerActive()) return;
            delete this.clientStateArgs.workflow;
            this.actionStack.undoAllAsync();
            this.restoreServerGameState();
        },

        
        ///////////////////////////////////////////////////
        //// Reaction to cometD notifications

        // TODO: move to core
        setupNotifications() {
            console.log('notifications subscriptions setup');
            const eventNames = Object.getOwnPropertyNames(this.__proto__).reduce((all, name) => {
                const match = /^notify_(.+?)$/.exec(name);
                match && all.push(match[1]);
                return all;
            }, []);
            for (const eventName of eventNames) {
                dojo.subscribe(eventName, this, async data => {
                    const fnName = `notify_${eventName}`;
                    console.log(`Entering ${fnName}`, data.args);
                    await this[fnName].call(this, data.args);
                    console.log(`Exiting ${fnName}`);
                    this.notifqueue.setSynchronousDuration(0);
                });
                this.notifqueue.setSynchronous(eventName);
            }
            console.log(`Registered ${eventNames.length} event handlers`);
        },

        notify_tilesRemoved({ playerId, tileIds }) {
            if (playerId == this.player_id) return;

            // TODO
        },

        async notify_tilesAdded({ playerId, tiles }) {
            if (playerId == this.player_id) return;

            for (const { type, x, y, r } of tiles) {
                await this.actionStack.doAsync(new PlaceTileAction(playerId, type, x, y, r));
            }
            this.actionStack.clear();
        },

        notify_goalRenounced({ playerId, goalId }) {
            if (playerId == this.player_id) return;

            // TODO
        },

        notify_goalClaimed({ playerId, goalId }) {
            if (playerId == this.player_id) return;

            // TODO
        },

        async notify_cardTaken({ playerId, cardId }) {
            // Only act out the actions for other players because
            // this player's UI has already been updated locally.
            if (playerId != this.player_id) {
                const slot = bonsai.board.indexOf(cardId);
                // KILL? action stack should just be for this player 
                await this.actionStack.doAsync(new TakeCardAction(playerId, cardId, slot));

                /* TODO: find another way to represent this animation... remember there are other possible extra actions depending on the card... but these will come from the server separately
                // tileType is only set when the card was in slot 1
                if (slot === 1 && tileType) {
                    await this.actionStack.doAsync(new ReceiveTilesAction(playerId, [ tileType ]));
                }
                */
                this.actionStack.clear();
            }
        },

        async notify_capacityIncreased({ playerId, delta }) {
            this.adjustPlayerCapacity(playerId, delta);
        },

        async notify_cardRevealed({ cardId }) {
            await this.animateCardReplacementAsync(cardId);
        },

        async notify_lastTurn() {
            // TODO: put up banner bar
        },

        notify_tilesDiscarded({ playerId, discards }) {
            if (playerId == this.player_id) return;

            const adjustments =
                Object.values(discards)
                    .reduce((obj, tileType) => ({ ...obj, [tileType]: (obj[tileType] || 0) - 1 }), {});
            for (const [ tileType, delta ] of Object.entries(adjustments)) {
                this.adjustPlayerInventory(playerId, tileType, delta);
            }
        },
    });
});
