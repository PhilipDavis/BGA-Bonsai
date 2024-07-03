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

    const GoalType = {
        TotalWood: 1,
        AdjacentLeafs: 2,
        TotalFruit: 3,
        AlignedFlowers: 4,
        Placement: 5,
    };

    const GoalSize = {
        Small: 0,
        Medium: 1,
        Large: 2,
    };

    const GoalStatus = {
        None: 0,         // Goal is not in play this game
        Ineligible: 1,   // Is available but player does not meet the requirements
        Eligible: 2,     // Is available and player meets the requirements
        Renounced: 3,    // Is available but player has renounced this goal
        Claimed: 4,      // Player has claimed this goal
        ClaimedType: 5, // Player has claimed a different goal of the same colour
        Opponent: 6,     // An opponent has claimed this goal
    };

    const Goals = {
        1: {
            type: GoalType.TotalWood,
            size: GoalSize.Small,
            req: 8,
            points: 5,
        },
        2: {
            type: GoalType.TotalWood,
            size: GoalSize.Medium,
            req: 10,
            points: 10,
        },
        3: {
            type: GoalType.TotalWood,
            size: GoalSize.Large,
            req: 12,
            points: 15,
        },

        // Note: The leaf goals require ADJACENT leafs!
        4: {
            type: GoalType.AdjacentLeafs,
            size: GoalSize.Small,
            req: 5,
            points: 6,
        },
        5: {
            type: GoalType.AdjacentLeafs,
            size: GoalSize.Medium,
            req: 7,
            points: 9,
        },
        6: {
            type: GoalType.AdjacentLeafs,
            size: GoalSize.Large,
            req: 9,
            points: 12,
        },

        // Fruit goals just require a simple count of fruit
        7: {
            type: GoalType.TotalFruit,
            size: GoalSize.Small,
            req: 3,
            points: 9,
        },
        8: {
            type: GoalType.TotalFruit,
            size: GoalSize.Medium,
            req: 4,
            points: 11,
        },
        9: {
            type: GoalType.TotalFruit,
            size: GoalSize.Large,
            req: 5,
            points: 13,
        },

        // Flower goals require the flowers to protrude past the pot sides (and be on the same side)
        10: {
            type: GoalType.AlignedFlowers,
            size: GoalSize.Small,
            req: 3,
            points: 8,
        },
        11: {
            type: GoalType.AlignedFlowers,
            size: GoalSize.Medium,
            req: 4,
            points: 12,
        },
        12: {
            type: GoalType.AlignedFlowers,
            size: GoalSize.Large,
            req: 5,
            points: 16,
        },

        13: {
            type: GoalType.Placement,
            size: GoalSize.Small,
            req: 1,
            points: 7,
        },
        14: {
            type: GoalType.Placement,
            size: GoalSize.Medium,
            req: 2,
            points: 10,
        },
        15: {
            type: GoalType.Placement,
            size: GoalSize.Large,
            req: 2,
            points: 14,
        },
    };

    
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
            this.players[playerId].played.push([ type, x, y, r ]);
            this.placedThisTurn[type]++;
            return tileId;
        }

        removeTile(playerId, x, y) {
            const { type } = this.trees[playerId].removeTile(x, y);
            // Don't simply subtract because we also remove a tile during
            // a pruning operation which doesn't affect the turn caps.
            this.placedThisTurn[type] = Math.max(0, this.placedThisTurn[type] - 1);
            this.players[playerId].played = this.players[playerId].played.filter(move => move[1] !== x || move[2] !== y);
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

            const { type, resource } = Cards[cardId];
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
        
        claimGoal(playerId, goalId) {
            this.data.players[playerId].claimed.push(goalId);
            this.data.goalTiles = this.data.goalTiles.filter(g => g !== goalId);
        }

        unclaimGoal(playerId, goalId) {
            const player = this.data.players[playerId];
            player.claimed = player.claimed.filter(g => g !== goalId);
            this.data.goalTiles.push(goalId);
            this.data.goalTiles.sort();
        }
        
        renounceGoal(playerId, goalId) {
            this.data.players[playerId].renounced.push(goalId);
        }

        unrenounceGoal(playerId, goalId) {
            const player = this.data.players[playerId];
            player.renounced = player.renounced.filter(g => g !== goalId);
        }

        get allGoals() {
            const allGoals = [ ...this.data.goalTiles ];
            for (const { claimed } of Object.values(this.data.players)) {
                allGoals.push(...claimed);
            }
            allGoals.sort();
            return allGoals;
        }

        getGoalStatuses() {
            return this.allGoals.map(goalId => this.getGoalStatus(goalId));
        }

        getGoalStatus(goalId) {
            const { renounced, claimed, played } = this.data.players[this.myPlayerId];

            //
            // Is the goal absent from the available set?
            //
            if (this.data.goalTiles.indexOf(goalId) === -1) {
                if (claimed.indexOf(goalId) >= 0) {
                    return { goalId, status: GoalStatus.Claimed };
                }
                for (const [ playerId, { claimed } ] of Object.entries(this.data.players)) {
                    if (claimed.indexOf(goalId) === -1) continue;
                    if (playerId == this.myPlayerId) continue;
                    return { goalId, status: GoalStatus.Opponent };
                }
                return { goalId, status: GoalStatus.None }; // Not found
            }

            //
            // Has the player already claimed a goal of the same type
            // or renounced this goal?
            //
            if (claimed.some(g => Goals[g].type === Goals[goalId].type)) {
                return { goalId, status: GoalStatus.ClaimedType };
            }
            if (renounced.indexOf(goalId) >= 0) {
                return { goalId, status: GoalStatus.Renounced };
            }
            
            //
            // Does the player qualify for this goal?
            //
            const { type, req, size } = Goals[goalId];
            let count = 0;
            switch (type) {
                case GoalType.TotalWood:
                    count = played.reduce((sum, move) => sum + (move[0] === TileType.Wood ? 1 : 0), 0);
                    break;

                case GoalType.AdjacentLeafs:
                    const leafs = played.filter(move => move[0] === TileType.Leaf);
                    count = this.countAdjacentLeafs(leafs);
                    break;
                    
                case GoalType.TotalFruit:
                    count = played.reduce((sum, move) => sum + (move[0] === TileType.Fruit ? 1 : 0), 0);
                    break;
                    
                case GoalType.AlignedFlowers:
                    const flowers = played.filter(move => move[0] === TileType.Flower);
                    const leftFlowers = flowers.filter(move => this.getProtrudingDirection(move) === -1).filter(d => d);
                    const rightFlowers = flowers.filter(move => this.getProtrudingDirection(move) === 1).filter(d => d);
                    count = Math.max(leftFlowers.length, rightFlowers.length);
                    break;

                case GoalType.Placement:
                    switch (size) {
                        case GoalSize.Small:
                            count = played.some(move => this.getProtrudingDirection(move)) ? 1 : 0;
                            break;

                        case GoalSize.Medium:
                            const protrudingSides = played.map(move => this.getProtrudingDirection(move)).filter(d => d);
                            count += protrudingSides.indexOf(-1) ? 1 : 0;
                            count += protrudingSides.indexOf(1) ? 1 : 0;
                            break;

                        case GoalSize.Large:
                            const quadrants = played.map(move => this.getPlacementQuadrant(move)).filter(q => q != 0);
                            if (quadrants.length > 0) count++;
                            if ((quadrants.some(q => q === 1) && quadrants.some(q => q === 3)) ||
                                (quadrants.some(q => q === 2) && quadrants.some(q => q === 4))
                            ) {
                                count++;
                            }
                            break;
                    }
                    break;
            }

            return {
                goalId,
                status: count >= req ? GoalStatus.Eligible : GoalStatus.Ineligible,
                short: Math.max(0, req - count),
            };
        }

        get eligibleGoals() {
            return (
                this.data.goalTiles
                    .map(goalId => this.getGoalStatus(goalId))
                    .filter(s => s.status === GoalStatus.Eligible)
                    .map(s => s.goalId)
                    .sort()
            );
        }

        getProtrudingDirection(move) {
            const [ tileType, x, y, r ] = move;
            if (y % 2 && x > 3) return 1;
            if (y % 2 && x < -1) return -1;
            if (y % 2 == 0 && x >= 3) return 1;
            if (y % 2 == 0 && x < -1) return -1; 
        }

        getPlacementQuadrant(move) {
            const [ tileType, x, y, r ] = move;
            const side = this.getProtrudingDirection(move);

            const isBelow = y <= -2;
            if (side > 0) {
                return isBelow ? 4 : 1;
            }
            else if (side < 0) {
                return isBelow ? 3 : 2;
            }
            return null; // We only want to consider protruding outside the pot
        }

        countAdjacentLeafs(leafMoves) {
            let result = 0;
            const visited = {};
            const stack = [];
            const leafKeys = leafMoves.map(([ tt, x, y, r ]) => makeKey(x, y));

            while (leafKeys.length) {
                const leafKey = leafKeys.shift();
                stack.push(leafKey);

                let count = 0;
                while (stack.length) {
                    const leafKey = stack.pop();
                    
                    if (visited[leafKey]) continue;
                    visited[leafKey] = true;
                    count++;

                    const adjacentKeys = Object.values(this.trees[this.myPlayerId].getAdjacentKeys(leafKey));
                    const adjacentLeafKeys = adjacentKeys.filter(key => leafKeys.indexOf(key) >= 0); 
                    stack.push(...adjacentLeafKeys);
                }
                result = Math.max(result, count);
            }
            return result;
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
        Goals,
        GoalType,
        GoalSize,
        GoalStatus,
        TileType,
        TileTypeName,
        ResourceType,
        Direction,
    };
});
