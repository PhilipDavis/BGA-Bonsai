/**
* © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
*/
define([
    "bgagame/modules/bonsai_tree",
], ({ Tree, TileType, TileTypeName, makeKey, parseKey, Direction }) => {

    const ColorNames = [
        'grey',
        'red',
        'blue',
        'purple',
    ];

    const CardType = {
        Tool: 1,
        Growth: 2,
        Master: 3,
        Helper: 4,
        Parchment: 5,
    };

    const ResourceType = {
        Wild: 0,
        ...TileType,
    };

    // Create a reverse lookup
    const TileTypeByName = Object.entries(TileTypeName).reduce((obj, [ tileType, name ]) => ({ ...obj, [name]: parseInt(tileType, 10) }), {});

    const Cards = [
        {}, // Padding because the first card has ID = 1

        { type: CardType.Tool, capacity: 2 },
        { type: CardType.Tool, capacity: 2 },
        { type: CardType.Tool, capacity: 2 },
        { type: CardType.Tool, capacity: 2 },
        { type: CardType.Tool, capacity: 2 },
        { type: CardType.Tool, capacity: 2 },

        // 7
        { type: CardType.Growth, resource: ResourceType.Wood },
        { type: CardType.Growth, resource: ResourceType.Wood },
        { type: CardType.Growth, resource: ResourceType.Wood },
        { type: CardType.Growth, resource: ResourceType.Wood },

        { type: CardType.Growth, resource: ResourceType.Leaf },
        { type: CardType.Growth, resource: ResourceType.Leaf },
        { type: CardType.Growth, resource: ResourceType.Leaf },
        { type: CardType.Growth, resource: ResourceType.Leaf },

        { type: CardType.Growth, resource: ResourceType.Flower },
        { type: CardType.Growth, resource: ResourceType.Flower },
        { type: CardType.Growth, resource: ResourceType.Flower },

        { type: CardType.Growth, resource: ResourceType.Fruit },
        { type: CardType.Growth, resource: ResourceType.Fruit },
        { type: CardType.Growth, resource: ResourceType.Fruit },

        // 21
        { type: CardType.Master, resources: [ ResourceType.Wild ] },
        { type: CardType.Master, resources: [ ResourceType.Wild ] },

        { type: CardType.Master, resources: [ ResourceType.Wood, ResourceType.Wood ] },

        { type: CardType.Master, resources: [ ResourceType.Wood, ResourceType.Leaf ] },
        { type: CardType.Master, resources: [ ResourceType.Wood, ResourceType.Leaf ] },
        { type: CardType.Master, resources: [ ResourceType.Wood, ResourceType.Leaf ] },

        { type: CardType.Master, resources: [ ResourceType.Wood, ResourceType.Leaf, ResourceType.Flower ] },

        { type: CardType.Master, resources: [ ResourceType.Wood, ResourceType.Leaf, ResourceType.Fruit ] },

        { type: CardType.Master, resources: [ ResourceType.Leaf, ResourceType.Leaf ] },

        { type: CardType.Master, resources: [ ResourceType.Leaf, ResourceType.Flower ] },

        { type: CardType.Master, resources: [ ResourceType.Leaf, ResourceType.Flower, ResourceType.Flower ] },

        { type: CardType.Master, resources: [ ResourceType.Leaf, ResourceType.Fruit ] },

        { type: CardType.Master, resources: [ ResourceType.Wild ] },

        // 34
        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Wood ] },
        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Wood ] },
        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Wood ] },

        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Leaf ] },
        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Leaf ] },

        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Flower ] },

        { type: CardType.Helper, resources: [ ResourceType.Wild, ResourceType.Fruit ] },

        // 41
        { type: CardType.Parchment, bonusType: 'tiles', resource: ResourceType.Wood, points: 1 },
        { type: CardType.Parchment, bonusType: 'tiles', resource: ResourceType.Leaf, points: 1 },
        { type: CardType.Parchment, bonusType: 'tiles', resource: ResourceType.Flower, points: 2 },
        { type: CardType.Parchment, bonusType: 'tiles', resource: ResourceType.Fruit, points: 2 },

        { type: CardType.Parchment, bonusType: 'cards', card: CardType.Growth, points: 2 },
        { type: CardType.Parchment, bonusType: 'cards', card: CardType.Helper, points: 2 },
        { type: CardType.Parchment, bonusType: 'cards', card: CardType.Master, points: 2 },
    ];

    
    class BonsaiLogic {
        constructor(data, myPlayerId) {
            this.myPlayerId = myPlayerId;
            this.data = data;
            this.trees = {};
            for (const [ playerId, player ] of Object.entries(data.players)) {
                this.trees[playerId] = new Tree(player.played);
            }
            this.placedThisTurn = {};
        }

        startTurn() {
            this.placedThisTurn = {
                [TileType.Wood]: 0,
                [TileType.Leaf]: 0,
                [TileType.Flower]: 0,
                [TileType.Fruit]: 0,
            };
        }

        placeTile(playerId, type, x, y, r) {
            const tileId = `${playerId}-${x}-${y}`;
            this.trees[playerId].placeTile(type, x, y, r);
            this.placedThisTurn[type]++;
            return tileId;
        }

        removeTile(playerId, x, y) {
            const { type } = this.trees[playerId].removeTile(x, y);
            // Don't simply subtract because we also remove a tile during
            // a pruning operation which doesn't affect the turn caps.
            this.placedThisTurn[type] = Math.max(0, this.placedThisTurn[type] - 1);
        }

        takeCardFromSlot(playerId, slot) {
            const cardId = bonsai.board[slot];
            bonsai.board[slot] = null;
            const player = this.data.players[playerId];

            const { type, resource } = Cards[cardId];
            const isFaceDown = type !== CardType.Tool && type !== CardType.Growth;

            // Update growth (note: other stats from other card types are adjust elsewhere)
            if (type == CardType.Growth) {
                player.canPlay[TileTypeName[resource]]++;
            }

            if (isFaceDown) {
                if (playerId == this.myPlayerId) {
                    player.faceDown.push(cardId);
                }
                else {
                    player.faceDown++;
                }
            }
            else {
                player.faceUp.push(cardId);
            }
        }

        returnCardToSlot(playerId, cardId, slot) {
            bonsai.board[slot] = cardId;
            const player = this.data.players[playerId];

            const { type } = Cards[cardId];
            const isFaceDown = type !== CardType.Tool && type !== CardType.Growth;

            // Update growth (note: other stats from other card types are adjust elsewhere)
            if (type == CardType.Growth) {
                player.canPlay[TileTypeName[resource]]--;
            }

            if (isFaceDown) {
                if (playerId == this.myPlayerId) {
                    player.faceDown = player.faceDown.filter(c => c !== cardId);
                }
                else {
                    player.faceDown--;
                }
            }
            else {
                player.faceUp = player.faceUp.filter(c => c !== cardId);
            }
        }

        get eligibleGoals() {
            // TODO: return goals available to the current player, sorted by colour and then smallest to largest
            return []; // KILL
        }

        get tilesOverCapacity() {
            const { inventory, capacity } = this.data.players[this.myPlayerId];
            return Math.max(0, Object.values(inventory).reduce((over, n) => over + n, -capacity));
        }

        adjustPlayerInventory(playerId, tileType, delta) {
            const tileTypeName = TileTypeName[tileType];
            this.data.players[playerId].inventory[tileTypeName] += delta;
        }

        adjustPlayerCapacity(playerId, delta) {
            this.data.players[playerId].capacity += delta;
        }

        adjustPlayerTurnCap(playerId, tileType, delta) {
            this.data.players[playerId].canPlay[tileType] += delta;
        }

        getPlayerSeishi(playerId) {
            const player = this.data.players[playerId];
            const lhs = player.faceUp.filter(cardId => Cards[cardId].type === CardType.Tool);
            const rhs = player.faceUp.filter(cardId => Cards[cardId].type === CardType.Growth);
            return [ lhs, rhs ];
        }

        isMasterCardWithWildSymbol(cardId) {
            const card = Cards[cardId];
            return card?.type === CardType.Master && card.resources.indexOf(ResourceType.Wild) >= 0;
        }

        getLegalMoves({ resourceFilter } = {}) {
            const player = this.data.players[this.myPlayerId];
            const { inventory } = player;

            // Calculate legal moves for all tile types the player has and is allowed to play
            const legalMoves = {};
            const tree = this.trees[this.myPlayerId];
            for (const tileType of Object.values(TileType)) {
                legalMoves[tileType] = {};

                // Does the player not have this tile type?
                if (inventory[TileTypeName[tileType]] < 1) continue;

                if (resourceFilter) {
                    // We're checking legal moves for a Helper Card in Meditate mode
                    // Is the player allowed to play this tile type?
                    if (resourceFilter.indexOf(ResourceType.Wild) < 0 && resourceFilter.indexOf(tileType) < 0) continue;
                }
                else {
                    // We're checking legal moves in Cultivate mode
                    // Has the player's Seishi limit been reached for this tile type?
                    if (!this.isPlayerWithinTurnCap(this.myPlayerId, tileType)) continue;
                }

                legalMoves[tileType] = tree.getLegalMoves(tileType);
            }
            return legalMoves;
        }

        //
        // Return an array of resources that the player may still
        // play this turn based on their Seishi abilities. Do not
        // consider inventory here.
        //
        getCanPlayResourceFilter() {
            const canPlay = { ...this.data.players[this.myPlayerId].canPlay };
            for (const tt of Object.values(TileType)) {
                canPlay[TileTypeName[tt]] -= this.placedThisTurn[tt];

                // Borrow from the Wild category if this category is overplayed
                if (canPlay[TileTypeName[tt]] < 0) {
                    canPlay.wild += canPlay[TileTypeName[tt]];
                    canPlay[TileTypeName[tt]] = 0;
                }
            }
            return Object.entries(canPlay).reduce((filter, [ tileTypeName, n ]) => {
                for (let i = 0; i < n; i++) {
                    filter.push(TileTypeByName[tileTypeName] || 0);
                }
                return filter;
            }, []).sort((a, b) => a - b);
        }

        // Is it legal for the player to play the given tile type (only considering Seishi limits)
        isPlayerWithinTurnCap(tileType) {
            const playerTurnCap = this.data.players[this.myPlayerId].canPlay;
            let wildCap = playerTurnCap.wild;
            for (const tt of Object.values(TileType)) {
                const typeCap = playerTurnCap[tt];
                let placed = this.placedThisTurn[tt];
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
        }

        getTileCount(resourceFilter = null) {
            const { inventory } = this.data.players[this.myPlayerId];
            const tileCount = Object.entries(inventory).reduce((sum, [ tileTypeName, n ]) => {
                if (resourceFilter) {
                    if (resourceFilter.indexOf(ResourceType.Wild) >= 0) return sum + n;
                    const tileType = TileTypeByName[tileTypeName];
                    if (resourceFilter.indexOf(tileType) === -1) return sum;
                }
                return sum + n;
            }, 0);
            return tileCount;
        }

        getExcessTileCount() {
            const { inventory, capacity } = this.data.players[this.myPlayerId];
            const tileCount = Object.values(inventory).reduce((sum, n) => sum + n, 0);
            return Math.max(0, tileCount - capacity);
        }
        
        get board() {
            return this.data.board;
        }

        get players() {
            return this.data.players;
        }

        playerTree(playerId) {
            return this.trees[playerId];
        }

        get isLastTurn() {
            return typeof this.data.finalTurns === 'number' && this.data.finalTurns > 0;
        }

        countdownFinalTurns() {
            this.data.finalTurns--;
        }
    }

    return {
        BonsaiLogic,
        ColorNames,
        makeKey,
        parseKey,
        Cards,
        CardType, // TODO: verify if we need all these exports
        TileType,
        TileTypeName,
        ResourceType,
        Direction,
    };
});
