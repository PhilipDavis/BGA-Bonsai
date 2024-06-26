<?php declare(strict_types=1);
require_once('BonsaiLogic.php');
function clienttranslate($x) { return $x; }
include __DIR__ . '/../material.inc.php';

use PHPUnit\Framework\TestCase;

//
// This is not typically how I write unit tests.
// 
// These are actually more like regression tests. The way I've been working with
// BGA game development is to playtest in the browser... and when I run into a
// bug, I grab the game state JSON and create a test case with it. Then, I solve
// the problem and leave the test here, which forms the regression test suite.
//

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

    public function testHelperCard2()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[2,38,11,23],"order":[2393715,2393716],"options":{"goalTiles":true,"tokonomaVariant":false},"players":{"2393715":{"color":0,"faceUp":[3,15,8],"played":[[1,0,0,0],[1,1,1,0],[2,0,1,4],[2,0,2,5],[4,-1,2,5],[2,1,2,0],[1,2,1,0],[4,1,3,0],[1,3,1,0],[1,3,2,0],[2,4,1,1],[3,4,0,2],[2,4,2,1],[1,4,3,0],[2,4,4,0],[3,5,2,1],[2,3,4,5],[3,4,5,5],[3,5,4,1]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[13],"capacity":7,"faceDown":[44,34,40,22,30,42,32],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":2,"flower":1},"renounced":[10]},"2393716":{"color":1,"faceUp":[7,1,18,16],"played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,2,1,1],[2,2,3,0],[1,2,2,0],[1,0,1,0],[2,1,3,5],[2,0,2,4],[4,1,4,0],[2,3,1,2],[2,3,2,1],[4,4,1,2],[3,4,2,1],[1,-1,1,0],[2,3,3,0]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":1,"flower":1},"claimed":[],"capacity":7,"faceDown":[43,41,29,47,21,35],"mirrored":false,"inventory":{"leaf":1,"wood":0,"fruit":3,"flower":1},"renounced":[4]}},"version":1,"drawPile":[19,39,37,12,45,36,46,24],"goalTiles":[4,6,10,12,15],"finalTurns":null,"nextPlayer":1}'
        );
        $drawCardId = 38;
        $woodOrLeaf = 2;
        $masterTiles = [];
        $place = [
            [ 'type' => 2, 'x' => -1, 'y' => 2, 'r' => 5 ],
            [ 'type' => 2, 'x' => -2, 'y' => 2, 'r' => 5 ],
        ];
        $renounce = [];
        $claim = [ 6 ];
        $discardTiles = [];

        $bonsai->meditate($drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);

        $this->assertTrue(true);
    }

    public function testFlowerScore()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[null,24,46,39],"order":[2393715,2393716],"options":{"goalTiles":true,"tokonomaVariant":false},"players":{"2393715":{"color":0,"faceUp":[3,15,8,2,11],"played":[[1,0,0,0],[1,1,1,0],[2,0,1,4],[2,0,2,5],[4,-1,2,5],[2,1,2,0],[1,2,1,0],[4,1,3,0],[1,3,1,0],[1,3,2,0],[2,4,1,1],[3,4,0,2],[2,4,2,1],[1,4,3,0],[2,4,4,0],[3,5,2,1],[2,3,4,5],[3,4,5,5],[3,5,4,1],[2,5,3,1],[3,6,3,1],[4,5,1,2],[1,2,2,0],[2,3,3,4],[4,2,4,5],[1,2,3,0],[1,1,4,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[13,4,12],"capacity":9,"faceDown":[44,34,40,22,30,42,32,37,36,45],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":1,"flower":2},"renounced":[10]},"2393716":{"color":1,"faceUp":[7,1,18,16,19,12],"played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,2,1,1],[2,2,3,0],[1,2,2,0],[1,0,1,0],[2,1,3,5],[2,0,2,4],[4,1,4,0],[2,3,1,2],[2,3,2,1],[4,4,1,2],[3,4,2,1],[1,-1,1,0],[2,3,3,0],[2,-1,2,5],[2,-2,2,5],[1,-2,1,0],[1,-3,0,0],[2,-2,-1,2],[3,-2,-2,2],[4,0,3,5],[2,-3,2,5],[4,-2,3,0],[4,4,3,1],[1,-4,0,0],[3,-4,2,4]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":2,"flower":1},"claimed":[6,15],"capacity":7,"faceDown":[43,41,29,47,21,35,38,23],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":1,"flower":0},"renounced":[4]}},"version":1,"drawPile":[],"goalTiles":[10],"finalTurns":0,"nextPlayer":1}'
        );

        $scores = $bonsai->getScores();

        $this->assertEquals(16, $scores[2393715]['flower']);
        $this->assertEquals(13, $scores[2393716]['flower']);
    }

    public function testParchmentScore()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[null,24,21,29],"order":[2393716,2393715],"options":{"goalTiles":true,"tokonomaVariant":false},"players":{"2393715":{"color":1,"faceUp":[1,19,12,3,8],"played":[[1,0,0,0],[1,1,1,0],[1,0,1,0],[2,-1,1,4],[1,2,1,0],[1,3,1,0],[2,-1,2,5],[4,-2,2,5],[1,4,1,0],[2,0,2,5],[1,4,0,0],[2,5,-1,2],[3,4,-2,3],[4,0,3,0],[1,4,2,0],[1,4,3,0],[2,5,0,1],[4,6,-1,2],[1,3,3,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":1,"flower":0},"claimed":[15,1],"capacity":9,"faceDown":[23,47,41,36,40,34,42,22,43,45],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":1},"renounced":[13]},"2393716":{"color":0,"faceUp":[15,11,7,18,16,2],"played":[[1,0,0,0],[1,0,1,0],[1,-1,1,0],[2,-2,2,5],[3,-3,2,4],[2,-2,1,4],[3,-3,0,3],[1,-1,2,0],[1,-1,3,0],[3,-3,1,4],[2,-2,4,5],[3,-3,4,4],[3,-2,5,5],[1,0,2,0],[1,1,2,0],[1,2,3,0],[2,1,4,5],[2,2,4,0],[4,2,5,0],[3,3,4,1],[1,2,1,0],[1,3,1,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":1,"flower":2},"claimed":[12],"capacity":7,"faceDown":[35,30,37,39,46,32,44,38],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":0},"renounced":[13,10,1]}},"version":1,"drawPile":[],"goalTiles":[3,10,13],"finalTurns":0,"nextPlayer":0}'
        );

        $this->assertEquals(27, $bonsai->getPlayerScore(2393715)['parchment']);
        $this->assertEquals(10, $bonsai->getPlayerScore(2393716)['parchment']);
    }

    public function testGoalScore()
    {
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[null,43,1,7],"order":[2393715,2393716,2393717],"options":{"goalTiles":true,"tokonomaVariant":false},"players":{"2393715":{"color":0,"faceUp":[8,16,2],"played":[[1,0,0,0],[1,0,1,0],[1,-1,2,0],[1,-2,2,0],[2,-2,1,3],[3,-3,0,3],[2,-3,2,4],[2,-2,3,5],[3,-4,2,4],[3,-3,4,5],[1,0,3,0],[1,0,4,0],[2,-1,3,4]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[],"capacity":7,"faceDown":[21,36,29,39,34,37,24,46],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[10]},"2393716":{"color":1,"faceUp":[18,3],"played":[[1,0,0,0],[1,1,1,0],[2,2,1,1],[1,1,2,0],[2,2,2,1],[4,3,1,2],[2,2,3,0],[4,3,3,1],[2,1,3,5],[2,0,2,4],[4,1,4,0],[4,0,3,5],[1,0,1,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":1,"flower":0},"claimed":[8],"capacity":7,"faceDown":[41,38,23,47,40,42,32,44],"mirrored":false,"inventory":{"leaf":1,"wood":2,"fruit":0,"flower":0},"renounced":[7]},"2393717":{"color":2,"faceUp":[11,19,12,15],"played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,0,1,4],[2,0,2,4],[3,-1,1,4],[1,2,3,0],[2,1,3,4],[3,0,3,4],[2,1,4,5],[1,2,4,0],[2,2,5,5],[4,1,5,5],[3,2,6,0]],"canPlay":{"leaf":3,"wild":1,"wood":1,"fruit":1,"flower":1},"claimed":[4],"capacity":5,"faceDown":[22,35,30,45],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":0},"renounced":[]}},"version":1,"drawPile":[],"goalTiles":[5,6,7,9,10,11,12],"finalTurns":0,"nextPlayer":2}'
        );

        //$this->assertEquals(0, $bonsai->getPlayerScore(2393715)['goal']);
        //$this->assertEquals(11, $bonsai->getPlayerScore(2393716)['goal']);
        $this->assertEquals(6, $bonsai->getPlayerScore(2393717)['goal']);
    }

    public function testTwoPlayersHaveSixGoals()
    {
        $players = [
            2393715 => 0,
            2393716 => 1,
        ];
        $gameOptions = [
            'tokonomaVariant' => false,
            'goalTiles' => true,
        ];
        $bonsai = BonsaiLogic::newGame($players, $gameOptions);

        $this->assertEquals(6, count($bonsai->getGoalTiles()));

        // TODO: assert that none of the goals are medium goals
    }

    public function testThreePlayersHaveNineGoals()
    {
        $players = [
            2393715 => 0,
            2393717 => 1,
            2393716 => 2,
        ];
        $gameOptions = [
            'tokonomaVariant' => false,
            'goalTiles' => true,
        ];
        $bonsai = BonsaiLogic::newGame($players, $gameOptions);

        $this->assertEquals(9, count($bonsai->getGoalTiles()));
    }

    public function testRemovalOfValidTile()
    {
        $bonsai = BonsaiLogic::fromJson(
            // TODO: grab real game state... this below was copied from another test above 
            '{
                "board":[2,38,11,23],"order":[2393715,2393716],"options":{"goalTiles":true,"tokonomaVariant":false},
                "players":{
                    "2393715":{
                        "color":0,"faceUp":[3,15,8],
                        "played":[[1,0,0,0],[1,1,1,0],[2,0,1,4],[2,0,2,5],[4,-1,2,5],[2,1,2,0],[1,2,1,0],[4,1,3,0],[1,3,1,0],[1,3,2,0],[2,4,1,1],[3,4,0,2],[2,4,2,1],[1,4,3,0],[2,4,4,0],[3,5,2,1],[2,3,4,5],[3,4,5,5],[3,5,4,1]],
                        "canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[13],"capacity":7,"faceDown":[44,34,40,22,30,42,32],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":2,"flower":1},"renounced":[10]
                    },
                    "2393716":{
                        "color":1,"faceUp":[7,1,18,16],
                        "played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,2,1,1],[2,2,3,0],[1,2,2,0],[1,0,1,0],[2,1,3,5],[2,0,2,4],[4,1,4,0],[2,3,1,2],[2,3,2,1],[4,4,1,2],[3,4,2,1],[1,-1,1,0],[2,3,3,0]],
                        "canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":1,"flower":1},"claimed":[],"capacity":7,"faceDown":[43,41,29,47,21,35],"mirrored":false,"inventory":{"leaf":1,"wood":0,"fruit":3,"flower":1},"renounced":[4]}
                    },
                "version":1,"drawPile":[19,39,37,12,45,36,46,24],"goalTiles":[4,6,10,12,15],"finalTurns":null,"nextPlayer":1
            }'
        );

        $tiles = []; // TODO

        $bonsai->removeTiles($tiles);

        $this->assertTrue(true);
    }
}
