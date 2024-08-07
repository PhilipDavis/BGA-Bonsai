/**
* © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
*/
define([], () => {
    class Node {
        constructor(type, x, y, r) {
            if (typeof type !== 'number') throw new Error('Invalid tile type');
            this.type = Number(type);
            this.x = Number(x);
            this.y = Number(y);
            this.r = Number(r);
        }
    }
    
    const makeKey = (x, y) => `${x},${y}`;
    const parseKey = key => {
        const match = /^(-?\d+),(-?\d+)$/.exec(key);
        if (!match) return null;
        return {
            x: Number(match[1]),
            y: Number(match[2]),
        };
    };
    
    const TileType = {
        Wood: 1,
        Leaf: 2,
        Flower: 3,
        Fruit: 4,
    };
    
    // Used for CSS class names, etc... not for UI display
    const TileTypeName = {
        [TileType.Wood]: 'wood',
        [TileType.Leaf]: 'leaf',
        [TileType.Flower]: 'flower',
        [TileType.Fruit]: 'fruit',
    };

    const Direction = {
        TopRight: 0,
        Right: 1,
        BottomRight: 2,
        BottomLeft: 3,
        Left: 4,
        TopLeft: 5,
    };
    
    class Tree {
        constructor(isFlipped) {
            this.nodes = {};

            // Mark the area used by the pot as invalid
            this.invalidKeys = {};

            for (let y = -2; y <= 0; y++) {
                const x1 = y % 2 ? -1 : -2;
                for (let x = x1; x <= 3; x++) {
                    if (!isFlipped && x === 0 && y === 0) continue;
                    if (isFlipped && x === 1 && y === 0) continue;
                    this.invalidKeys[makeKey(x, y)] = true;
                }
            }
            delete this.invalidKeys['-2,-2']; // Allowed to place tile at bottom left foot of pot
            delete this.invalidKeys['3,-2'];  // Allowed to place tile at bottom right foot of pot
        }

        getAllKeys() {
            return Object.keys(this.nodes);
        }

        getAllVacantKeys() {
            const allVacantKeys = {};
            const nodeKeys = Object.keys(this.nodes);
            for (const key of nodeKeys) {
                const vacantNeighbourKeys = Object.values(this.getAdjacentKeys(key)).filter(k => !this.nodes[k]);
                vacantNeighbourKeys.forEach(key => allVacantKeys[key] = true);
            }
            return Object.keys(allVacantKeys);
        }

        getAdjacentKeys(nodeOrKey) {
            const { x, y } = typeof nodeOrKey === 'string' ? parseKey(nodeOrKey) : nodeOrKey;
            const adjacentKeys = y % 2
                ? {
                    [Direction.TopRight]: makeKey(x, y + 1),
                    [Direction.Right]: makeKey(x + 1, y),
                    [Direction.BottomRight]: makeKey(x, y - 1),
                    [Direction.BottomLeft]: makeKey(x - 1, y - 1),
                    [Direction.Left]: makeKey(x - 1, y),
                    [Direction.TopLeft]: makeKey(x - 1, y + 1),
                }
                : {
                    [Direction.TopRight]: makeKey(x + 1, y + 1),
                    [Direction.Right]: makeKey(x + 1, y),
                    [Direction.BottomRight]: makeKey(x + 1, y - 1),
                    [Direction.BottomLeft]: makeKey(x, y - 1),
                    [Direction.Left]: makeKey(x - 1, y),
                    [Direction.TopLeft]: makeKey(x, y + 1),
                };

            // Remove keys that are invalid (i.e. correspond to locations occupied by the pot)
            for (const [dir, key] of Object.entries(adjacentKeys)) {
                if (this.invalidKeys[key]) {
                    delete adjacentKeys[dir];
                }
            }
            return adjacentKeys;
        }

        getNeighbours(nodeOrKey) {
            return (
                Object.entries(this.getAdjacentKeys(nodeOrKey))
                    .reduce((result, [direction, key]) => {
                        const neighbor = this.nodes[key];
                        if (neighbor) {
                            result[direction] = neighbor;
                        }
                        return result;
                    }, {})
            );
        }

        getLegalMoves(tileType) {
            const allOrientations = Object.values(Direction);
            const legalPlacements = {};

            for (const vacantKey of this.getAllVacantKeys()) {
                const adjacentNodes = this.getNeighbours(vacantKey);

                // Wood must be placed adjacent to a Wood
                if (tileType === TileType.Wood) {
                    if (Object.values(adjacentNodes).some(n => n.type === TileType.Wood)) {
                        legalPlacements[vacantKey] = allOrientations;
                    }
                }

                // Leaf must be placed adjacent to a Wood
                else if (tileType === TileType.Leaf) {
                    const placements = Object.entries(adjacentNodes)
                        .filter(([, node]) => node.type === TileType.Wood)
                        .map(([dir,]) => Number(dir));
                    if (Object.keys(placements).length) {
                        legalPlacements[vacantKey] = placements;
                    }
                }

                // Flower must be placed adjacent to a Leaf
                else if (tileType === TileType.Flower) {
                    const placements = Object.entries(adjacentNodes)
                        .filter(([, node]) => node.type === TileType.Leaf)
                        .map(([dir,]) => Number(dir));
                    if (Object.keys(placements).length) {
                        legalPlacements[vacantKey] = placements;
                    }
                }

                // Fruit must be placed adjacent to two adjacent Leaf tiles but not adjacent to another fruit
                else if (tileType === TileType.Fruit) {
                    if (Object.values(adjacentNodes).some(n => n.type === TileType.Fruit)) {
                        continue;
                    }
                    const placements = Object.entries(adjacentNodes)
                        .filter(([dir, node]) => node.type === TileType.Leaf && adjacentNodes[(Number(dir) + 1) % 6]?.type === TileType.Leaf)
                        .map(([dir,]) => Number(dir));
                    if (Object.keys(placements).length) {
                        legalPlacements[vacantKey] = placements;
                    }
                }
            }
            return legalPlacements;
        }

        placeTile(tileType, x, y, r) {
            // We don't validate here... assume the input is valid.
            // We already show only legal moves in the UI and the server
            // also validates legality of moves.
            const key = makeKey(x, y);
            if (this.nodes[key]) {
                throw new Error(`Tile already exists at (${x}, ${y})`);
            }
            this.nodes[key] = new Node(tileType, x, y, r);
        }

        removeTile(x, y) {
            const key = makeKey(x, y);
            const node = this.nodes[key];
            if (!node) throw new Error(`No tile at ${x}, ${y}`);
            delete this.nodes[key];
            return node;
        }

        getNode(key) {
            return this.nodes[key];
        }
        
        getTileScore() {
            return this.getAllKeys().reduce((score, key) => {
                const node = this.nodes[key];
                switch (node.type) {
                    case TileType.Wood: // 0 Points
                        return score;
                    case TileType.Leaf: // 3 Points
                        return score + 3;
                    case TileType.Flower: // 1 Point per vacant side
                        return score + 6 - Object.keys(this.getNeighbours(node)).length;
                    case TileType.Fruit: // 7 Points
                        return score + 7;
                }
            }, 0);
        }
    }

    return {
        Tree,
        makeKey,
        parseKey,
        TileType,
        TileTypeName,
        Direction,
    };
});
