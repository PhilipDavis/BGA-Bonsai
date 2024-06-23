<?php declare(strict_types=1);
require_once('BonsaiLogic.php');

use PHPUnit\Framework\TestCase;


final class BonsaiLogicTest extends TestCase
{
    public function setUp(): void
    {
        # Turn on error reporting
        error_reporting(E_ALL);
    }

    public function testCultivate()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[29,21,35,30],"order":[2393715,2393716],"options":{"goalTiles":false,"tokonomaVariant":false},"players":{"2393715":{"color":0,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":0,"flower":0},"renounced":[]},"2393716":{"color":1,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[]}},"version":1,"drawPile":[42,36,34,43,23,8,39,12,7,11,44,24,1,40,22,2,15,3,46,37,16,19,32,38,18,45,41,47],"goalTiles":[],"nextPlayer":0}'
        );
        $playerId = 2393715;
        $removeTiles = [];
        $placeTiles = [
            [ 'type' => 1, 'x' => 0, 'y' => 1, 'r' => 0 ],
        ];
        $renounceGoals = [];
        $claimGoals = [];

        $bonsai->cultivate($removeTiles, $placeTiles, $renounceGoals, $claimGoals);

        $this->assertTrue(true);
    }

    public function testCultivate2()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[29,21,35,30],"order":[2393715,2393716],"options":{"goalTiles":false,"tokonomaVariant":false},"players":{"2393715":{"color":0,"faceUp":[],"played":[[1,0,0,0],[1,0,1,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":0},"renounced":[]},"2393716":{"color":1,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[]}},"version":1,"drawPile":[42,36,34,43,23,8,39,12,7,11,44,24,1,40,22,2,15,3,46,37,16,19,32,38,18,45,41,47],"goalTiles":[],"nextPlayer":1}'
        );
        $playerId = 2393716;
        $removeTiles = [];
        $placeTiles = [
            [ 'type' => 1, 'x' => 1, 'y' => 1, 'r' => 0 ],
            [ 'type' => 2, 'x' => 0, 'y' => 2, 'r' => 5 ],
        ];
        $renounceGoals = [];
        $claimGoals = [];

        $bonsai->cultivate($removeTiles, $placeTiles, $renounceGoals, $claimGoals);

        $this->assertTrue(true);
    }

    public function testHelperCard()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[36,29,42,43],"order":[2393716,2393715],"options":{"goalTiles":true,"tokonomaVariant":false},"players":{"2393715":{"color":1,"faceUp":[3],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":7,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":2,"fruit":0,"flower":0},"renounced":[]},"2393716":{"color":0,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[23],"mirrored":false,"inventory":{"leaf":1,"wood":3,"fruit":1,"flower":0},"renounced":[]}},"version":1,"drawPile":[21,46,22,47,45,2,1,7,15,30,32,19,39,11,8,16,44,40,41,37,18,34,12,35,24,38],"goalTiles":[4,6,10,12],"finalTurns":null,"nextPlayer":0}'
        );
        $drawCardId = 36;
        $woodOrLeaf = 0;
        $masterTiles = [];
        $place = [
            [ 'type' => 1, 'x' => 1, 'y' => 1, 'r' => 0 ],
            [ 'type' => 1, 'x' => 1, 'y' => 2, 'r' => 0 ],
        ];
        $renounce = [];
        $claim = [];
        $discardTiles = [];

        $bonsai->meditate($drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);

        $this->assertTrue(true);
    }
}
