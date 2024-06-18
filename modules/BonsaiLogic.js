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
        }

        placeTile(playerId, type, x, y, r) {
            const tileId = `${playerId}-${x}-${y}`;
            this.trees[playerId].placeTile(tileId, type, x, y, r);
            return tileId;
        }

        get eligibleGoals() {
            // TODO: return goals available to the current player, sorted by colour and then smallest to largest
            debugger; // KILL
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

        get board() {
            return this.data.board;
        }

        get players() {
            return this.data.players;
        }

        playerTree(playerId) {
            return this.trees[playerId];
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
