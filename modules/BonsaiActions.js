// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

define([
    "bgagame/modules/PhilsUtils/PhilsUtils.core.v1",
    "bgagame/modules/PhilsUtils/PhilsUtils.ui.v1",
    "bgagame/modules/BonsaiLogic",
], (
    { createFromTemplate },
    { delayAsync, transitionInAsync, transitionOutAsync, getSiblingIndex, Action },
    { Cards, CardType, Goals, TileType },
) => {

class PlaceTileAction extends Action {
    constructor(playerId, tileDivId, tileType, x, y, r) {
        super();
        this.playerId = playerId;
        this.tileType = tileType;
        this.x = x;
        this.y = y;
        this.r = r;
        this.tileId = null;
        this.divId = tileDivId;

        // Determine the tile's position in inventory in case we need to put it back (i.e. undo)
        this.index = getSiblingIndex(tileDivId);
    }

    async doAsync() {
        //
        // Decrement the player's inventory
        //
        bonsai.adjustPlayerInventory(this.playerId, this.tileType, -1);

        //
        // Select the tile from the player's inventory
        //
        const { xEm, yEm } = gameui.emsFromCoords(this);

        // If a tile would rotate more than 180 degrees,
        // switch it to rotate negative degrees. In other
        // words, choose the most efficient rotation.
        const rotation = this.r * 60;
        const deg = rotation > 180 ? rotation - 360 : rotation;

        //
        // Create a new hidden tile in the Tree at the correct location
        // and then make it appear to animate from the inventory slot
        // into the tree.
        //
        const tileDiv = document.getElementById(this.divId);

        const placeholderDiv = gameui.replaceInventoryTileWithPlaceholder(tileDiv);
        const destDiv = gameui.createTileInTree(this.playerId, this.tileType, this.x, this.y, this.r, false);

        const srcRect = tileDiv.getBoundingClientRect();
        const destRect = destDiv.getBoundingClientRect();
        const srcMidX = Math.round(srcRect.left + srcRect.width / 2);
        const srcMidY = Math.round(srcRect.top + srcRect.height / 2);
        const destMidX = Math.round(destRect.left + destRect.width / 2);
        const destMidY = Math.round(destRect.top + destRect.height / 2);
        const deltaX = destMidX - srcMidX;
        const deltaY = destMidY - srcMidY;

        destDiv.style.transform = `translate(calc(${xEm}em - ${deltaX}px - 50%), calc(${yEm}em - ${deltaY}px - 50%)) scale(.975) rotate(0deg)`;
        destDiv.classList.remove('bon_hidden');
        placeholderDiv.innerHTML = '';

        if (!gameui.instantaneousMode) {
            const slidePromise = destDiv.animate({
                transform: [
                    `translate(calc(${xEm}em - ${deltaX}px - 50%), calc(${yEm}em - ${deltaY}px - 50%)) scale(.975) rotate(0deg)`,
                    `translate(calc(${xEm}em - 50%), calc(${yEm}em - 50%)) scale(.975) rotate(${deg}deg)`,
                ],
            }, {
                duration: 500,
                easing: 'ease-out',
                fill: 'forwards',
            }).finished;

            const closeGapPromise = placeholderDiv.animate({
                width: [ 0 ],
            } , {
                delay: 100,
                duration: 200,
                easing: 'ease-out',
                fill: 'forwards',
            });

            await Promise.all([
                slidePromise,
                closeGapPromise,
            ]);
        }

        placeholderDiv.parentElement.removeChild(placeholderDiv);

        //
        // Update tree information
        //
        bonsai.placeTile(this.playerId, this.tileType, this.x, this.y, this.r);
        gameui.adjustPlayerPlaced(this.playerId, this.tileType, 1);

        // Grow the tree / host
        gameui.adjustTreeSizeAndPos(this.playerId);

        // Update the tool tips in case goal progressions changed
        gameui.updateGoalTooltips();
    }

    async undoAsync() {
        //
        // Update tree information
        //
        bonsai.removeTile(this.playerId, this.x, this.y);
        gameui.adjustPlayerPlaced(this.playerId, this.tileType, -1);

        //
        // Open a gap in inventory where the tile came from
        //
        const destDiv = gameui.createTilePlaceholderInInventoryAtIndex(this.playerId, this.index);
        const openGapPromise = destDiv.animate({
            width: [ '4.25em' ], // the width of a tile
        }, {
            delay: 50,
            duration: 50,
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;

        const { xEm, yEm } = gameui.emsFromCoords(this);
        const rotation = this.r * 60;
        const deg = rotation > 180 ? rotation - 360 : rotation;

        //
        // Animate the tile from player's tree back to their inventory
        //
        const tileId = `bon_tile-${this.playerId}-${this.x}-${this.y}`;
        const tileDiv = document.getElementById(tileId);

        const srcRect = tileDiv.getBoundingClientRect();
        const destRect = destDiv.getBoundingClientRect();
        const srcMidX = Math.round(srcRect.left + srcRect.width / 2);
        const srcMidY = Math.round(srcRect.top + srcRect.height / 2);
        const destMidX = Math.round(destRect.left + destRect.width / 2);
        const destMidY = Math.round(destRect.top + destRect.height / 2);
        const deltaX = destMidX - srcMidX;
        const deltaY = destMidY - srcMidY;

        const slidePromise = tileDiv.animate({
            transform: [
                `translate(calc(${xEm}em - 50%), calc(${yEm}em - 50%)) scale(.975) rotate(${deg}deg)`,
                `translate(calc(${xEm}em + ${deltaX}px - 50%), calc(${yEm}em + ${deltaY}px - 50%)) scale(.975) rotate(0deg)`,
            ],
        }, {
            duration: 200,
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;

        await Promise.all([
            slidePromise,
            openGapPromise,
        ]);

        //
        // Remove the placeholder from the DOM
        //
        const newTileDiv = gameui.createTile(this.playerId, this.tileType, destDiv);
        newTileDiv.id = this.divId;
        destDiv.replaceWith(newTileDiv);
        tileDiv.parentElement.removeChild(tileDiv);

        gameui.destroyAllVacancies();

        // Shrink the tree / host
        gameui.adjustTreeSizeAndPos(this.playerId);

        //
        // Increment the player's inventory
        //
        bonsai.adjustPlayerInventory(this.playerId, this.tileType, 1);

        // Update the tool tips in case goal progressions changed
        gameui.updateGoalTooltips();
    }

    isCheckpoint() {
        return true;
    }

    apply(array) {
        return [
            ...array,
            {
                action: 'place',
                data: [ this.tileType, this.x, this.y, this.r ],
            },
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
            if (!gameui.instantaneousMode) {
                await gameui.slideToObjectAsync(cardDivId, hostDivId, 800);
            }

            // Put the card into the card host and update game state
            gameui.placeInElement(cardDivId, hostDivId);

            // Update game state
            bonsai.takeCardFromSlot(this.playerId, this.slot);

            if (isFaceDown) {
                if (!gameui.instantaneousMode) {
                    await delayAsync(200);
                }
                await transitionInAsync(cardDivId, 'bon_card-face-down', 400);
            }
        })();

        await cardPromise; // TODO: collapse

        if (cardType === CardType.Tool) {
            gameui.adjustPlayerCapacity(this.playerId, 2);
        }
    }

    async undoAsync() {
        if (this.cardType === CardType.Tool) {
            gameui.adjustPlayerCapacity(this.playerId, -2);
        }

        //
        // Move the card back to the board
        //
        const cardDivId = `bon_card-${this.cardId}`;
        gameui.raiseElementToBody(cardDivId);
        const cardPromise = (async () => {
            await gameui.slideToObjectAsync(cardDivId, `bon_slot-${this.slot}`, 400);

            if (!gameui.instantaneousMode) {
                await delayAsync(100);
            }
            await transitionOutAsync(cardDivId, 'bon_card-face-down', 200);

            // Put the card into the card host and update gate state
            gameui.placeInElement(cardDivId, `bon_slot-${this.slot}`);

            // Revert the game state
            bonsai.returnCardToSlot(this.playerId, this.cardId, this.slot);

            // Remove the temporary card host
            const hostDivId = `bon_card-host-${this.cardId}`;
            const hostDiv = document.getElementById(hostDivId);
            hostDiv.parentElement.removeChild(hostDiv);

            // TODO: fix up face down pile (empty/not)
            // TODO: fix up face down pile tool tips
        })();

       await cardPromise; // TODO: collapse
    }

    isCheckpoint() { return true; }

    apply(array) {
        return [
            ...array,
            {
                action: 'take',
                data: this.cardId,
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

    async doAsync() {
        await Promise.all(
            this.tileTypes.map(async (tileType, index) => {
                if (!gameui.instantaneousMode) {
                    await delayAsync(100 * index);
                }
                
                const tileId = `${this.randomValue}-${tileType}-${index}`;
                const divId = `bon_tile-${tileId}`;
                createFromTemplate('bonsai_Templates.tile', {
                    TILE_ID: tileId,
                    TYPE: tileType,
                    X_EM: 2.5,
                    Y_EM: 3.25,
                    DEG: 0,
                }, `bon_slot-${this.slot}`);
                gameui.placeOnObject(divId, `bon_slot-${this.slot}`);
                gameui.raiseElementToBody(divId);
                
                // Animate the width of the placeholder growing
                const hostDiv = gameui.createTilePlaceholderInInventory(this.playerId, tileType);
                if (!gameui.instantaneousMode) {
                    await hostDiv.animate({
                        width: [ '4.25em' ], // the width of a tile
                    }, {
                        duration: 100,
                        easing: 'ease-out',
                        fill: 'forwards',
                    }).finished;
                }
                else {
                    hostDiv.style.width = '4.25em';
                }

                // Slide the tile and make room in inventory at the same time
                await gameui.slideToObjectAsync(divId, hostDiv);

                // Remove the placeholder
                const div = document.getElementById(divId);
                hostDiv.replaceWith(div);
                div.style.left = 0;
                div.style.top = 0;

                // Increment inventory when the tile has arrived
                bonsai.adjustPlayerInventory(this.playerId, tileType, 1);
            })
        );
    }

    async undoAsync() {
        await Promise.all(
            this.tileTypes.map(async (tileType, index) => {
                await delayAsync(100 * index);

                const tileId = `${this.randomValue}-${tileType}-${index}`;
                const divId = `bon_tile-${tileId}`;
                const div = document.getElementById(divId);

                const placeholderDiv = gameui.replaceInventoryTileWithPlaceholder(div);
                gameui.raiseElementToBody(div);

                const closeGapPromise = placeholderDiv.animate({
                    width: [ 0 ],
                }, {
                    delay: 100,
                    duration: 100,
                    easing: 'ease-out',
                    fill: 'forwards',
                }).finished;

                // Decrease inventory, and then slide it back to the board slot
                bonsai.adjustPlayerInventory(this.playerId, tileType, -1);
                const slidePromise = gameui.slideToObjectAsync(divId, `bon_slot-${this.slot}`);

                await Promise.all([
                    slidePromise,
                    closeGapPromise,
                ]);

                // Now can destroy the sprite and placeholder
                const tileDiv = document.getElementById(divId);
                tileDiv.parentElement.removeChild(tileDiv);
                placeholderDiv.parentElement.removeChild(placeholderDiv);
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
                    data: this.tileTypes,
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
        if (this.playerId == gameui.myPlayerId) {
            const divId = `bon_goal-${this.goalId}`;
            const goalDiv = document.getElementById(divId);
            goalDiv.classList.add('bon_ineligible');
            goalDiv.classList.remove('bon_selectable');
        }

        bonsai.renounceGoal(this.playerId, this.goalId);
        await this.animateGoalRenouncementAsync();
        gameui.updateGoalTooltips();
    }

    async undoAsync() {
        if (this.playerId == gameui.myPlayerId) {
            const divId = `bon_goal-${this.goalId}`;
            const goalDiv = document.getElementById(divId);
            goalDiv.classList.remove('bon_ineligible');
        }

        bonsai.unrenounceGoal(this.playerId, this.goalId);
        await this.animateGoalUnRenouncementAsync();
        gameui.adaptPlayersPanels();
        gameui.updateGoalTooltips();
    }

    async animateGoalRenouncementAsync() {
        // Create a hidden goal tile on the player summary board
        const tileDiv = gameui.createSummaryGoalTilePlaceholder(this.playerId, this.goalId, true, false);
        gameui.adaptPlayersPanels();

        if (gameui.instantaneousMode) return;

        await tileDiv?.animate({
            opacity: [ 0, 1, 1, 1 ],
            transform: [
                `scale(0)`,
                `scale(1)`,
                `scale(1.15)`,
                `scale(1)`,
            ],
        }, {
            duration: 400,
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;
    }

    async animateGoalUnRenouncementAsync() {
        const tileDiv = document.getElementById(`bon_summary-goal-${this.playerId}-${this.goalId}`);
        await tileDiv.animate({
            opacity: [ 1, 0 ],
            transform: [
                `scale(1)`,
                `scale(0)`,
            ],
        }, {
            duration: 200,
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;
        tileDiv.parentElement.removeChild(tileDiv);
    }

    isCheckpoint() { return false; }

    apply(array) {
        return [
            ...array,
            {
                action: 'renounce',
                data: this.goalId,
            },
        ];
    }
}

class ClaimGoalAction extends Action {
    constructor(playerId, goalId) {
        super();
        this.playerId = playerId;
        this.goalId = goalId;
    }

    async doAsync() {
        const { type, points } = Goals[this.goalId];

        const divId = `bon_goal-${this.goalId}`;
        const goalDiv = document.getElementById(divId);
        goalDiv.classList.remove('bon_selectable');

        await this.animateGoalToPlayerBoardAsync(this.playerId, this.goalId);

        bonsai.claimGoal(this.playerId, this.goalId);
        gameui.updateGoalTooltips();

        gameui.scoreCounter[this.playerId].incValue(points);

        if (this.playerId == gameui.myPlayerId) {
            const setDiv = document.getElementById(`bon_goal-set-${type}`);
            setDiv.classList.add('bon_claimed');
        }
    }

    async undoAsync() {
        await this.animateGoalFromPlayerBoardAsync(this.playerId, this.goalId);
        gameui.adaptPlayersPanels();

        bonsai.unclaimGoal(this.playerId, this.goalId);
        gameui.updateGoalTooltips();

        const { type, points } = Goals[this.goalId];
        gameui.scoreCounter[this.playerId].incValue(-points);

        if (this.playerId == gameui.myPlayerId) {
            const setDiv = document.getElementById(`bon_goal-set-${type}`);
            setDiv.classList.remove('bon_claimed');
        }
    }

    async animateGoalToPlayerBoardAsync(playerId, goalId) {
        // Create a hidden goal tile on the player summary board
        const destDiv = gameui.createSummaryGoalTilePlaceholder(playerId, goalId, false);
        gameui.adaptPlayersPanels();

        // Animate the visible goal tile to the player board
        const goalDiv = document.getElementById(`bon_goal-${goalId}`);
        const goalRect = goalDiv.getBoundingClientRect();
        const destRect = destDiv.getBoundingClientRect();
        const goalMidX = Math.round(goalRect.left + goalRect.width / 2);
        const goalMidY = Math.round(goalRect.top + goalRect.height / 2);
        const destMidX = Math.round(destRect.left + destRect.width / 2);
        const destMidY = Math.round(destRect.top + destRect.height / 2);
        const deltaX = destMidX - goalMidX;
        const deltaY = destMidY - goalMidY;
        const scale = destRect.height / goalRect.height;

        if (gameui.instantaneousMode) {
            goalDiv.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
        }
        else {
            goalDiv.style.zIndex = 100;
            await goalDiv.animate({
                transform: [
                    `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
                ],
            }, {
                duration: 800, // TODO: base on distance
                easing: 'ease-out',
                fill: 'forwards',
            }).finished;
        }

        // Now reveal the hidden goal tile and delete the old one
        destDiv.classList.remove('bon_hidden');
        goalDiv.parentElement.removeChild(goalDiv);
    }

    async animateGoalFromPlayerBoardAsync(playerId, goalId) {
        const destDiv = document.getElementById(`bon_goal-placeholder-${goalId}`);

        // Animate the goal tile from the player board back to the playing surface
        const goalDiv = document.getElementById(`bon_summary-goal-${playerId}-${goalId}`);
        const goalRect = goalDiv.getBoundingClientRect();
        const destRect = destDiv.getBoundingClientRect();
        const goalMidX = Math.round(goalRect.left + goalRect.width / 2);
        const goalMidY = Math.round(goalRect.top + goalRect.height / 2);
        const destMidX = Math.round(destRect.left + destRect.width / 2);
        const destMidY = Math.round(destRect.top + destRect.height / 2);
        const deltaX = destMidX - goalMidX;
        const deltaY = destMidY - goalMidY;
        const scale = destRect.height / goalRect.height;

        goalDiv.style.zIndex = 100;
        await goalDiv.animate({
            transform: [
                `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
            ],
        }, {
            duration: 400, // TODO: base on distance (but twice as fast as the 'do' action)
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;

        // Now swap out the animated goal with a new one
        gameui.createGoalTile(goalId, `bon_goal-placeholder-${goalId}`);
        goalDiv.parentElement.removeChild(goalDiv);
    }

    isCheckpoint() { return false; }

    apply(array) {
        return [
            ...array,
            {
                action: 'claim',
                data: this.goalId,
            },
        ];
    }
}

class DiscardExcessTileAction extends Action {
    constructor(playerId, tileType, tileDivId) {
        super();
        this.playerId = playerId;
        this.tileType = tileType;
        this.tileDivId = tileDivId;

        // Store the index so we can put it back in the same place on an undo
        this.index = getSiblingIndex(tileDivId);
    }

    async doAsync() {
        // Unhighlight all the other tiles
        const tileDiv = document.getElementById(this.tileDivId);
        tileDiv.classList.add('bon_selected');
        const placeholderDiv = gameui.replaceInventoryTileWithPlaceholder(tileDiv);
        gameui.makeTilesUnselectable();

        if (!gameui.instantaneousMode) {
            await delayAsync(100);

            // Fade out the tile
            const fadePromise = tileDiv.animate({
                opacity: [ 1, 0 ],
                transform: [ 'scale(1)', 'scale(.5)' ],
            }, {
                duration: 200,
                easing: 'ease-out',
                fill: 'forwards',
            }).finished;

            const closeGapPromise = placeholderDiv.animate({
                width: [ '4.25em', '0em' ],
            }, {
                delay: 100,
                duration: 200,
                easing: 'ease-out',
                fill: 'forwards',
            }).finished;

            await Promise.all([
                fadePromise,
                closeGapPromise,
            ]);
        }
        
        // Remove the tile
        placeholderDiv.parentElement.removeChild(placeholderDiv);

        // Update internal state
        bonsai.adjustPlayerInventory(this.playerId, this.tileType, -1);
    }

    async undoAsync() {
        // Open a spot for the tile
        const destDiv = gameui.createTilePlaceholderInInventoryAtIndex(this.playerId, this.index);
        await destDiv.animate({
            width: [ '0em', '4.25em' ],
        }, {
            duration: 100,
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;

        // Create the tile and fade it in
        const tileDiv = gameui.createTile(this.playerId, this.tileType, destDiv);
        await tileDiv.animate({
            opacity: [ 0, 1 ],
            transform: [ 'scale(.5)', 'scale(1)' ],
        }, {
            duration: 200,
            easing: 'ease-out',
            fill: 'forwards',
        }).finished;
        tileDiv.id = this.tileDivId;

        // Get rid of the placeholder
        destDiv.replaceWith(tileDiv);

        // Update state
        bonsai.adjustPlayerInventory(this.playerId, this.tileType, 1);
    }

    isCheckpoint() { return false; }

    apply(array) {
        return [
            ...array,
            {
                action: 'discard',
                data: this.tileType,
            },
        ];
    }
}


    return {
        PlaceTileAction,
        TakeCardAction,
        ReceiveTilesAction,
        RenounceGoalAction,
        ClaimGoalAction,
        DiscardExcessTileAction,
    };
});
