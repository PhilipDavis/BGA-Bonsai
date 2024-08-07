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
        { type: CardType.Parchment, bonusType: 'tiles', bonus: ResourceType.Wood, points: 1 },
        { type: CardType.Parchment, bonusType: 'tiles', bonus: ResourceType.Leaf, points: 1 },
        { type: CardType.Parchment, bonusType: 'tiles', bonus: ResourceType.Flower, points: 2 },
        { type: CardType.Parchment, bonusType: 'tiles', bonus: ResourceType.Fruit, points: 2 },

        { type: CardType.Parchment, bonusType: 'cards', bonus: CardType.Growth, points: 2 },
        { type: CardType.Parchment, bonusType: 'cards', bonus: CardType.Helper, points: 2 },
        { type: CardType.Parchment, bonusType: 'cards', bonus: CardType.Master, points: 2 },
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

    const SoloPointsRequired = {
        1: 60,
        2: 80,
        3: 100,
        4: 120,
        5: 140,
    };


    class BonsaiLogic {
        constructor(data, myPlayerId) {
            this.myPlayerId = myPlayerId;
            this.isSpectator = data.order.indexOf(myPlayerId) === -1;
            this.data = data;
            this.trees = {};
            for (const [ playerId, player ] of Object.entries(data.players)) {
                // The tree is flipped if the bud is at (1, 0) instead of (0, 0).
                const firstWoodTile = player.played[0];
                const isFlipped = firstWoodTile[1] === 1;
                this.trees[playerId] = new Tree(isFlipped);
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
            const player = this.players[playerId];
            player.played.push([ type, x, y, r ]);
            this.placedThisTurn[type]++;
            return tileId;
        }

        removeTile(playerId, x, y) {
            const { type } = this.trees[playerId].removeTile(x, y);
            // Don't simply subtract because we also remove a tile during
            // a pruning operation which doesn't affect the turn caps.
            this.placedThisTurn[type] = Math.max(0, this.placedThisTurn[type] - 1);
            const player = this.players[playerId];
            player.played = player.played.filter(move => move[1] != x || move[2] != y);
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
            if (this.isSpectator) return 0;
            const { inventory, capacity } = this.data.players[this.myPlayerId];
            return Math.max(0, Object.values(inventory).reduce((over, n) => over + n, -capacity));
        }

        adjustPlayerInventory(playerId, tileType, delta) {
            const tileTypeName = TileTypeName[tileType];
            this.data.players[playerId].inventory[tileTypeName] += delta;
        }

        adjustPlayerCapacity(playerId, delta) {
            const player = this.data.players[playerId];
            player.capacity += delta;
            return player.capacity;
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
            if (this.isSpectator) return {};
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

        canPlaceWood() {
            // Are there any adjacent vacancies to any wood tile?
            const { played } = this.data.players[this.myPlayerId];
            const tree = this.trees[this.myPlayerId];
            const woodTileKeys = played.filter(move => move[0] === TileType.Wood).map(move => makeKey(move[1], move[2]));

            return woodTileKeys.some(key => {
                const adjacentKeys = tree.getAdjacentKeys(key);
                return Object.values(adjacentKeys).some(adjKey => !tree.getNode(adjKey));
            });
        }

        getLegalRemoves() {
            if (this.canPlaceWood()) {
                return [];
            }
            const { played } = this.data.players[this.myPlayerId];
            const tree = this.trees[this.myPlayerId];
            const leafTileKeys = played.filter(move => move[0] === TileType.Leaf).map(move => makeKey(move[1], move[2]));

            const scoredRemoves = leafTileKeys.map(key => {
                const keys = [ key ];
                let score = -3;
                const neighbours = tree.getNeighbours(parseKey(key));
                for (const [ dir, node ] of Object.entries(neighbours)) {
                    const { type, x, y, r } = node;
                    switch (type) {
                        case TileType.Flower:
                            if (dir == r) { // Flower is attached to this leaf
                                // Note: this is an approximation... I'm not checking
                                // to see which of the neighbours were also flowers. 
                                score -= 6 - Object.entries(tree.getNeighbours({ x, y })).length;
                                keys.push(makeKey(x, y));
                            }
                            break;
                        case TileType.Fruit:
                            if (dir == r || dir == (r + 5) % 6 || dir == (r + 1) % 6) { // Fruit is attached to this leaf
                                score -= 7;
                                keys.push(makeKey(x, y));
                            }
                            break;
                    }
                }
                return {
                    keys,
                    score,
                };
            });

            // Find the removals that affect the score the least
            scoredRemoves.sort((a, b) => b.score - a.score);
            const minimalRemoves =
                scoredRemoves
                    .filter(({ score }) => score === scoredRemoves[0].score)
                    .map(({ keys }) => keys);

            return minimalRemoves;
        }

        //
        // Return an array of resources that the player may still
        // play this turn based on their Seishi abilities. Do not
        // consider inventory here.
        //
        getCanPlayResourceFilter() {
            if (this.isSpectator) return false;
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
            if (this.isSpectator) return true;
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
            if (this.isSpectator) return 0;
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
            if (this.isSpectator) return 0;
            const { inventory, capacity } = this.data.players[this.myPlayerId];
            const { wood, leaf, flower, fruit } = inventory;
            const tileCount = wood + leaf + flower + fruit;
            return Math.max(0, tileCount - capacity);
        }
        
        claimGoal(playerId, goalId) {
            this.data.goalTiles = this.data.goalTiles.filter(g => g !== goalId);

            const player = this.data.players[playerId];
            player.claimed.push(goalId);
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
            if (this.isSpectator) return { goalId, status: GoalStatus.None };
            const { renounced, claimed } = this.data.players[this.myPlayerId];

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
            if (renounced.indexOf(goalId) >= 0) {
                return { goalId, status: GoalStatus.Renounced };
            }
            if (claimed.some(g => Goals[g].type === Goals[goalId].type)) {
                return { goalId, status: GoalStatus.ClaimedType };
            }
            
            //
            // Does the player qualify for this goal?
            //
            const short = this.calculatePlayerShortOfGoal(this.myPlayerId, goalId);

            return {
                goalId,
                status: short ? GoalStatus.Ineligible : GoalStatus.Eligible,
                short,
            };
        }

        doesPlayerQualifyForGoal(playerId, goalId) {
            return this.calculatePlayerShortOfGoal(playerId, goalId) === 0;
        }

        calculatePlayerShortOfGoal(playerId, goalId) {
            const { played } = this.data.players[playerId];

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
                            // Needs to protrude out the side opposite the gold crack in the pot
                            const goldCrackSide = this.isFlipped(playerId) ? -1 : 1;
                            count = played.some(move => this.getProtrudingDirection(move) === goldCrackSide) ? 1 : 0;
                            break;

                        case GoalSize.Medium:
                            const protrudingSides = played.map(move => this.getProtrudingDirection(move)).filter(d => d);
                            count += protrudingSides.indexOf(-1) >= 0 ? 1 : 0;
                            count += protrudingSides.indexOf(1) >= 0 ? 1 : 0;
                            break;

                        case GoalSize.Large:
                            const quadrants = played.map(move => this.getPlacementQuadrant(move)).filter(q => !!q);
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
            return Math.max(0, req - count);
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

        get isSolo() {
            return this.data.order.length === 1;
        }

        get options() {
            return this.data.options;
        }

        flip(playerId, isFlipped) {
            const player = this.data.players[playerId];
            player.played[0] = [ 1, isFlipped ? 1 : 0, 0, 0 ];

            this.trees[playerId] = new Tree(isFlipped);
            this.trees[playerId].placeTile(1, isFlipped ? 1 : 0, 0, 0);
        }

        isFlipped(playerId) {
            // Wood tile at (0, 0) is standard
            // Wood tile at (1, 0) is flipped
            const firstWoodTile = this.data.players[playerId].played[0];
            return firstWoodTile[1] == 1;
        }

        playerTree(playerId) {
            return this.trees[playerId];
        }

        discardCard(cardId) {
            const index = this.data.board.indexOf(cardId);
            if (index < 0) {
                throw new Error(`Card ${cardId} not found`);
            }
            this.data.board[index] = null;
            return index;
        }

        reduceDrawPile() {
            if (!this.data.drawPile) throw new Error('Draw pile empty');
            this.data.drawPile--;
        }

        get isLastTurn() {
            return typeof this.data.finalTurns === 'number' && this.data.finalTurns > 0;
        }

        countAdjacentLeafs(leafMoves) {
            let result = 0;
            const visited = {};
            const stack = [];
            const leafKeys = leafMoves.map(move => makeKey(move[1], move[2]));
            const tree = this.trees[this.myPlayerId];
    
            while (leafKeys.length) {
                let leafKey = leafKeys.shift();
                stack.push(leafKey);
    
                let count = 0;
                while (stack.length) {
                    leafKey = stack.pop();

                    if (visited[leafKey]) continue;
                    visited[leafKey] = true;
                    count++;
                    
                    const adjacentKeys = Object.values(tree.getAdjacentKeys(leafKey));
                    const adjacentLeafKeys = adjacentKeys.filter(key => leafKeys.includes(key));
                    stack.push(...adjacentLeafKeys);
                }
                result = Math.max(result, count);
            }
    
            return result;
        }
    
        getFlowerScore(moves) {
            const flowerMoves = moves.filter(move => move[0] == TileType.Flower);
            const tree = this.trees[this.myPlayerId];
            if (!tree) return 0;
    
            // Create a lookup for tiles that exist in the tree
            const filled = {};
            for (const move of moves) {
                const key = makeKey(move[1], move[2]);
                filled[key] = true;
            }
    
            // Test each flower move to see how many adjacent spaces are filled
            let score = 0;
            for (const move of flowerMoves) {
                score += 6;
                const key = makeKey(move[1], move[2]);
                const adjacentKeys = Object.values(tree.getAdjacentKeys(key));
                for (const adjKey of adjacentKeys) {
                    if (filled[adjKey]) {
                        score--;
                    }
                }
            }
    
            return score;
        }
        
        getPlayerScore(playerId) {
            const player = this.data.players[playerId];
            const showFullScore =
                playerId == this.myPlayerId && (
                    this.isSolo ||
                    this.data.finalTurns === 0
                );
    
            const leafMoves = player.played.filter(move => move[0] == TileType.Leaf);
            const flowerMoves = player.played.filter(move => move[0] == TileType.Flower);
    
            const woodTiles = player.played.filter(move => move[0] == TileType.Wood).length;
            const leafTiles = leafMoves.length;
            const flowerTiles = flowerMoves.length;
            const fruitTiles = player.played.filter(move => move[0] == TileType.Fruit).length;
    
            // Face Up
            const growthCards = player.faceUp.filter(cardId => Cards[cardId].type == CardType.Growth);
    
            // Face Down
            const masterCards = showFullScore ? player.faceDown.filter(cardId => Cards[cardId].type == CardType.Master) : 0;
            const helperCards = showFullScore ? player.faceDown.filter(cardId => Cards[cardId].type == CardType.Helper) : 0;
            const parchmentCards = showFullScore ? player.faceDown.filter(cardId => Cards[cardId].type == CardType.Parchment) : 0;
    
            // 3 Points per leaf
            const leafScore = leafTiles * 3;
    
            // 1 Point per space adjacent to a flower
            const flowerScore = this.getFlowerScore(player.played);
    
            // 7 Points per fruit
            const fruitScore = fruitTiles * 7;
    
            // Calculate goals
            let goalScore = 0;
            for (const goalId of player.claimed) {
                goalScore += Goals[goalId].points;
            }
    
            //
            // Score the parchment cards
            //
            let parchmentScore = 0;
            if (showFullScore) {
                for (const cardId of parchmentCards)
                {
                    const card = Cards[cardId];
                    switch (card.bonusType) {
                        case 'tiles':
                            switch (card.bonus)
                            {
                                case TileType.Wood:
                                    parchmentScore += card.points * woodTiles;
                                    break;

                                case TileType.Leaf:
                                    parchmentScore += card.points * leafTiles;
                                    break;
                                    
                                case TileType.Flower:
                                    parchmentScore += card.points * flowerTiles;
                                    break;
                                    
                                case TileType.Fruit:
                                    parchmentScore += card.points * fruitTiles;
                                    break;
                            }
                            break;
                        
                        case 'cards':
                            switch (card.bonus) {
                                case CardType.Growth:
                                    parchmentScore += card.points * growthCards.length;
                                    break;
                                    
                                case CardType.Master:
                                    parchmentScore += card.points * masterCards.length;
                                    break;
                                    
                                case CardType.Helper:
                                    parchmentScore += card.points * helperCards.length;
                                    break;
                            }
                            break;
                    }
                }
            }

            return leafScore + flowerScore + fruitScore + goalScore + parchmentScore;
        }

        countdownFinalTurns() {
            this.data.finalTurns--;
        }

        endTurn() {
            if (this.isLastTurn) {
                this.countdownFinalTurns();
            }
            this.data.move++;
        }

        get turn() {
            return this.data.move;
        }
    }

    return {
        BonsaiLogic,
        ColorNames,
        makeKey,
        parseKey,
        Cards,
        CardType,
        Goals,
        GoalType,
        GoalSize,
        GoalStatus,
        TileType,
        TileTypeName,
        ResourceType,
        Direction,
        SoloPointsRequired,
    };
});
