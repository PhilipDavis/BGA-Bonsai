<?php declare(strict_types=1);
require_once('BonsaiLogic.php');
require_once('BonsaiEvents.php');
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
    protected BonsaiEvents $events;

    public function setUp(): void
    {
        # Turn on error reporting
        error_reporting(E_ALL);
    }

    private function createMockEvents()
    {
        $reflection = new \ReflectionClass(BonsaiEvents::class);

        $methods = [];
        foreach($reflection->getMethods() as $method) {
            $methods[] = $method->name;
        }
        return $this->getMockBuilder(BonsaiEvents::class)
            ->onlyMethods($methods)
            ->getMock();
    }

    private function bonsaiFromJson(string $json)
    {
        $this->events = $this->createMockEvents();
        return BonsaiLogic::fromJson($json, $this->events);
    }


    public function testCultivate()
    {
        $events = $this->createMockEvents();
        $bonsai = BonsaiLogic::fromJson(
            '{"board":[29,21,35,30],"order":[2393715,2393716],"options":{"goals":false,"tokonoma":false},"players":{"2393715":{"color":0,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":0,"flower":0},"renounced":[]},"2393716":{"color":1,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[]}},"v":2,"drawPile":[42,36,34,43,23,8,39,12,7,11,44,24,1,40,22,2,15,3,46,37,16,19,32,38,18,45,41,47],"goalTiles":[],"nextPlayer":0}',
            $events
        );
        $playerId = 2393715;
        $removeTile = null;
        $placeTiles = [
            [ 'type' => 1, 'x' => 0, 'y' => 1, 'r' => 0 ],
        ];
        $renounceGoals = [];
        $claimGoals = [];

        $bonsai->cultivate(false, $removeTile, $placeTiles, $renounceGoals, $claimGoals);

        $this->assertTrue(true);
    }

    public function testCultivate2()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"board":[29,21,35,30],"order":[2393715,2393716],"options":{"goals":false,"tokonoma":false},"players":{"2393715":{"color":0,"faceUp":[],"played":[[1,0,0,0],[1,0,1,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":0},"renounced":[]},"2393716":{"color":1,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[]}},"v":2,"drawPile":[42,36,34,43,23,8,39,12,7,11,44,24,1,40,22,2,15,3,46,37,16,19,32,38,18,45,41,47],"goalTiles":[],"nextPlayer":1}'
        );
        $playerId = 2393716;
        $removeTile = null;
        $placeTiles = [
            [ 'type' => 1, 'x' => 1, 'y' => 1, 'r' => 0 ],
            [ 'type' => 2, 'x' => 0, 'y' => 2, 'r' => 5 ],
        ];
        $renounceGoals = [];
        $claimGoals = [];

        $bonsai->cultivate(false, $removeTile, $placeTiles, $renounceGoals, $claimGoals);

        $this->assertTrue(true);
    }

    public function testHelperCard()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"board":[36,29,42,43],"order":[2393716,2393715],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":1,"faceUp":[3],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":7,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":2,"fruit":0,"flower":0},"renounced":[]},"2393716":{"color":0,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[23],"mirrored":false,"inventory":{"leaf":1,"wood":3,"fruit":1,"flower":0},"renounced":[]}},"v":2,"drawPile":[21,46,22,47,45,2,1,7,15,30,32,19,39,11,8,16,44,40,41,37,18,34,12,35,24,38],"goalTiles":[4,6,10,12],"finalTurns":null,"nextPlayer":0}'
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

        $bonsai->meditate(false, null, $drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);

        $this->assertTrue(true);
    }

    public function testHelperCard2()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"board":[2,38,11,23],"order":[2393715,2393716],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":0,"faceUp":[3,15,8],"played":[[1,0,0,0],[1,1,1,0],[2,0,1,4],[2,0,2,5],[4,-1,2,5],[2,1,2,0],[1,2,1,0],[4,1,3,0],[1,3,1,0],[1,3,2,0],[2,4,1,1],[3,4,0,2],[2,4,2,1],[1,4,3,0],[2,4,4,0],[3,5,2,1],[2,3,4,5],[3,4,5,5],[3,5,4,1]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[13],"capacity":7,"faceDown":[44,34,40,22,30,42,32],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":2,"flower":1},"renounced":[10]},"2393716":{"color":1,"faceUp":[7,1,18,16],"played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,2,1,1],[2,2,3,0],[1,2,2,0],[1,0,1,0],[2,1,3,5],[2,0,2,4],[4,1,4,0],[2,3,1,2],[2,3,2,1],[4,4,1,2],[3,4,2,1],[1,-1,1,0],[2,3,3,0]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":1,"flower":1},"claimed":[],"capacity":7,"faceDown":[43,41,29,47,21,35],"mirrored":false,"inventory":{"leaf":1,"wood":0,"fruit":3,"flower":1},"renounced":[4]}},"v":2,"drawPile":[19,39,37,12,45,36,46,24],"goalTiles":[4,6,10,12,15],"finalTurns":null,"nextPlayer":1}'
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

        $bonsai->meditate(false, null, $drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);

        $this->assertTrue(true);
    }

    public function testFlowerScore()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"board":[null,24,46,39],"order":[2393715,2393716],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":0,"faceUp":[3,15,8,2,11],"played":[[1,0,0,0],[1,1,1,0],[2,0,1,4],[2,0,2,5],[4,-1,2,5],[2,1,2,0],[1,2,1,0],[4,1,3,0],[1,3,1,0],[1,3,2,0],[2,4,1,1],[3,4,0,2],[2,4,2,1],[1,4,3,0],[2,4,4,0],[3,5,2,1],[2,3,4,5],[3,4,5,5],[3,5,4,1],[2,5,3,1],[3,6,3,1],[4,5,1,2],[1,2,2,0],[2,3,3,4],[4,2,4,5],[1,2,3,0],[1,1,4,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[13,4,12],"capacity":9,"faceDown":[44,34,40,22,30,42,32,37,36,45],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":1,"flower":2},"renounced":[10]},"2393716":{"color":1,"faceUp":[7,1,18,16,19,12],"played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,2,1,1],[2,2,3,0],[1,2,2,0],[1,0,1,0],[2,1,3,5],[2,0,2,4],[4,1,4,0],[2,3,1,2],[2,3,2,1],[4,4,1,2],[3,4,2,1],[1,-1,1,0],[2,3,3,0],[2,-1,2,5],[2,-2,2,5],[1,-2,1,0],[1,-3,0,0],[2,-2,-1,2],[3,-2,-2,2],[4,0,3,5],[2,-3,2,5],[4,-2,3,0],[4,4,3,1],[1,-4,0,0],[3,-4,2,4]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":2,"flower":1},"claimed":[6,15],"capacity":7,"faceDown":[43,41,29,47,21,35,38,23],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":1,"flower":0},"renounced":[4]}},"v":2,"drawPile":[],"goalTiles":[10],"finalTurns":0,"nextPlayer":1}'
        );

        $scores = $bonsai->getScores();

        $this->assertEquals(16, $scores[2393715]['flower']);
        $this->assertEquals(13, $scores[2393716]['flower']);
    }

    public function testParchmentScore()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"board":[null,24,21,29],"order":[2393716,2393715],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":1,"faceUp":[1,19,12,3,8],"played":[[1,0,0,0],[1,1,1,0],[1,0,1,0],[2,-1,1,4],[1,2,1,0],[1,3,1,0],[2,-1,2,5],[4,-2,2,5],[1,4,1,0],[2,0,2,5],[1,4,0,0],[2,5,-1,2],[3,4,-2,3],[4,0,3,0],[1,4,2,0],[1,4,3,0],[2,5,0,1],[4,6,-1,2],[1,3,3,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":1,"flower":0},"claimed":[15,1],"capacity":9,"faceDown":[23,47,41,36,40,34,42,22,43,45],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":1},"renounced":[13]},"2393716":{"color":0,"faceUp":[15,11,7,18,16,2],"played":[[1,0,0,0],[1,0,1,0],[1,-1,1,0],[2,-2,2,5],[3,-3,2,4],[2,-2,1,4],[3,-3,0,3],[1,-1,2,0],[1,-1,3,0],[3,-3,1,4],[2,-2,4,5],[3,-3,4,4],[3,-2,5,5],[1,0,2,0],[1,1,2,0],[1,2,3,0],[2,1,4,5],[2,2,4,0],[4,2,5,0],[3,3,4,1],[1,2,1,0],[1,3,1,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":1,"flower":2},"claimed":[12],"capacity":7,"faceDown":[35,30,37,39,46,32,44,38],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":0},"renounced":[13,10,1]}},"v":2,"drawPile":[],"goalTiles":[3,10,13],"finalTurns":0,"nextPlayer":0}'
        );

        $this->assertEquals(27, $bonsai->getPlayerScore(2393715)['parchment']);
        $this->assertEquals(10, $bonsai->getPlayerScore(2393716)['parchment']);
    }

    public function testGoalScore()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"board":[null,43,1,7],"order":[2393715,2393716,2393717],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":0,"faceUp":[8,16,2],"played":[[1,0,0,0],[1,0,1,0],[1,-1,2,0],[1,-2,2,0],[2,-2,1,3],[3,-3,0,3],[2,-3,2,4],[2,-2,3,5],[3,-4,2,4],[3,-3,4,5],[1,0,3,0],[1,0,4,0],[2,-1,3,4]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[],"capacity":7,"faceDown":[21,36,29,39,34,37,24,46],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[10]},"2393716":{"color":1,"faceUp":[18,3],"played":[[1,0,0,0],[1,1,1,0],[2,2,1,1],[1,1,2,0],[2,2,2,1],[4,3,1,2],[2,2,3,0],[4,3,3,1],[2,1,3,5],[2,0,2,4],[4,1,4,0],[4,0,3,5],[1,0,1,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":1,"flower":0},"claimed":[8],"capacity":7,"faceDown":[41,38,23,47,40,42,32,44],"mirrored":false,"inventory":{"leaf":1,"wood":2,"fruit":0,"flower":0},"renounced":[7]},"2393717":{"color":2,"faceUp":[11,19,12,15],"played":[[1,0,0,0],[1,1,1,0],[1,1,2,0],[2,0,1,4],[2,0,2,4],[3,-1,1,4],[1,2,3,0],[2,1,3,4],[3,0,3,4],[2,1,4,5],[1,2,4,0],[2,2,5,5],[4,1,5,5],[3,2,6,0]],"canPlay":{"leaf":3,"wild":1,"wood":1,"fruit":1,"flower":1},"claimed":[4],"capacity":5,"faceDown":[22,35,30,45],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":0,"flower":0},"renounced":[]}},"v":2,"drawPile":[],"goalTiles":[5,6,7,9,10,11,12],"finalTurns":0,"nextPlayer":2}'
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
            'tokonoma' => false,
            'goals' => true,
        ];
        $bonsai = BonsaiLogic::newGame($players, $gameOptions, $this->createMockEvents());

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
            'tokonoma' => false,
            'goals' => true,
        ];
        $bonsai = BonsaiLogic::newGame($players, $gameOptions, $this->createMockEvents());

        $this->assertEquals(9, count($bonsai->getGoalTiles()));
    }

    public function testRemovalOfValidTile()
    {
        $bonsai = $this->bonsaiFromJson(
            // TODO: grab real game state... this below was copied from another test above 
            '{
                "board":[2,38,11,23],"order":[2393715,2393716],"options":{"goals":true,"tokonoma":false},
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
                "v":2,"drawPile":[19,39,37,12,45,36,46,24],"goalTiles":[4,6,10,12,15],"finalTurns":null,"nextPlayer":1
            }'
        );

        $tile = null; // TODO

        $bonsai->removeTile($tile);

        $this->assertTrue(true);
    }

    // Bug report #129376
    // '{"board":[35,11,34,8],"order":[90363429,88093060],"options":{"goals":true,"tokonoma":false},"players":{"88093060":{"color":1,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[],"mirrored":false,"inventory":{"leaf":1,"wood":1,"fruit":0,"flower":0},"renounced":[]},"90363429":{"color":3,"faceUp":[],"played":[[1,0,0,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[44],"mirrored":false,"inventory":{"leaf":0,"wood":2,"fruit":0,"flower":1},"renounced":[]}},"v":2,"drawPile":[41,19,29,3,2,23,39,40,42,45,12,18,22,47,37,30,36,16,7,46,24,43,32,21,38,1,15],"goalTiles":[1,3,4,6,10,12],"finalTurns":null,"nextPlayer":1}'

    public function testCheckingGoalEligibilitySkipsRenouncedGoals()
    {
        // This was from a bug I saw where I got an error after
        // finishing a turn where I renounced a goal... the game
        // didn't let me finish my turn because it said a decision
        // was needed for goal 13.

        $bonsai = $this->bonsaiFromJson(
            '{"v":2,"move":26,"board":[2,42,47,30],"order":[2393716,2393715],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":1,"faceUp":[15,19,18,1],"played":[[1,0,0,0],[1,0,1,0],[2,-1,1,4],[1,-1,2,0],[2,-2,2,4],[2,-1,3,5],[4,-2,1,4],[3,-1,4,0],[4,-2,3,5],[2,0,3,0],[1,1,1,0],[3,-3,2,4],[2,0,2,5],[1,2,1,0],[4,1,3,1],[2,2,2,0]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":2,"flower":1},"claimed":[4],"capacity":7,"faceDown":[38,37,44,24,23],"mirrored":false,"inventory":{"leaf":2,"wood":2,"fruit":2,"flower":0},"renounced":[]},"2393716":{"color":0,"faceUp":[12,16,8,3,11],"played":[[1,0,0,0],[1,0,1,0],[2,-1,1,4],[1,-1,2,0],[2,-2,2,4],[4,-2,1,4],[3,-3,2,4],[2,-1,3,5],[3,-2,4,5],[1,1,1,0],[2,0,3,0],[4,-1,4,0],[1,2,1,0],[2,1,2,5],[2,2,2,0]],"canPlay":{"leaf":3,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[],"capacity":7,"faceDown":[36,22,32,45,43],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":2,"flower":0},"renounced":[]}},"drawPile":[41,39,40,34,7,21,46,29,35],"goalTiles":[6,10,12,13,15],"finalTurns":null,"nextPlayer":1}'
        );

        $playerId = 2393715;
        $removeTile = null;
        $placeTiles = [
            [ 'type' => 1, 'x' => 3, 'y' => 1, 'r' => 0 ],
            [ 'type' => 2, 'x' => 3, 'y' => 2, 'r' => 0 ],
            [ 'type' => 4, 'x' => 3, 'y' => 3, 'r' => 0 ],
            [ 'type' => 1, 'x' => 4, 'y' => 1, 'r' => 0 ],
        ];
        $renounceGoals = [ 13 ];
        $claimGoals = [];
        $bonsai->cultivate(false, $removeTile, $placeTiles, $renounceGoals, $claimGoals);

        $this->assertTrue(true);
    }

    public function testHelperCard40()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"v":2,"move":24,"board":[40,41,47,43],"order":[2393715,2393716],"options":{"goals":true,"tokonoma":false},"players":{"2393715":{"color":0,"faceUp":[18,15,7,1,8],"played":[[1,0,0,0],[1,0,1,0],[1,-1,2,0],[2,-1,1,3],[3,-2,1,4],[1,-1,3,0],[2,-2,3,4],[1,-2,4,0],[2,-3,4,4],[1,-2,5,0],[4,-3,3,4]],"canPlay":{"leaf":1,"wild":1,"wood":3,"fruit":1,"flower":1},"claimed":[],"capacity":7,"faceDown":[35,45,39,24,37,36,34],"mirrored":false,"inventory":{"leaf":0,"wood":2,"fruit":1,"flower":0},"renounced":[]},"2393716":{"color":1,"faceUp":[11,3,12,2],"played":[[1,0,0,0],[1,0,1,0],[1,-1,2,0],[2,0,2,0],[2,0,3,0],[1,1,1,0],[2,-1,3,5],[2,-2,2,4],[4,-1,4,0],[2,2,1,1]],"canPlay":{"leaf":3,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":9,"faceDown":[44,22,46,42,23],"mirrored":false,"inventory":{"leaf":3,"wood":2,"fruit":3,"flower":1},"renounced":[]}},"drawPile":[30,29,16,19,38,32,21],"goalTiles":[1,3,7,9,10,12],"finalTurns":null,"nextPlayer":1}'
        );

        $playerId = 2393716;
        $cardId = 40;
        $woodOrLeaf = 0;
        $masterTiles = [];
        $placeTiles = [
            [ 'type' => 4, 'x' => -2, 'y' => 3, 'r' => 5 ],
            [ 'type' => 4, 'x' => 1, 'y' => 3, 'r' => 1 ],
        ];
        $renounceGoals = [ 7 ];
        $claimGoals = [];
        $discardTiles = [];

        $bonsai->meditate(false, null, $cardId, $woodOrLeaf, $masterTiles, $placeTiles, $renounceGoals, $claimGoals, $discardTiles);

        $this->assertTrue(true);
    }

    public function testSlotIsEmptyErrorInSoloGame()
    {
        // table=534831198
        $cardId = 41;
        $playerId = 683709;
        $bonsai = $this->bonsaiFromJson(
            '{"v":2,"move":17,"board":[41,32,3,15],"order":[683709],"options":{"solo":1,"goals":true,"tokonoma":false},"players":{"683709":{"color":0,"faceUp":[8,2,16,18],"played":[[1,0,0,0],[1,0,1,0],[1,-1,1,0],[1,-2,1,0],[1,-3,0,0],[2,-4,0,4],[1,-2,-1,0],[2,-3,-2,3],[1,1,1,0],[1,2,1,0],[3,-2,-3,2],[3,-4,-2,4],[1,3,1,0],[1,4,1,0],[2,-3,2,5],[3,-5,0,4],[3,-4,2,4],[2,3,2,5],[3,-2,3,0],[2,4,2,0],[2,2,2,5],[2,-3,-1,3],[4,-4,-1,4]],"canPlay":{"leaf":1,"wild":1,"wood":2,"fruit":1,"flower":1},"claimed":[1,15,12],"capacity":7,"faceDown":[35,39,34,38,23,30,43,46],"mirrored":false,"inventory":{"leaf":0,"wood":0,"fruit":2,"flower":0},"renounced":[13,10]}},"version":2,"drawPile":[],"goalTiles":[3,10,13],"finalTurns":1,"nextPlayer":0}'
        );

        $bonsai->meditate(false, null, $cardId, 0, [], [], [], [], []);

        $this->assertTrue(true);
    }

    public function testSoloErrorWhenBoardHasEmptySlot()
    {
        $cardId = 40;
        $woodOrLeaf = 2;
        $masterTiles = [];
        $placed = [
            [ "type" => 1, "x" => -3, "y" => -2, "r" => 0 ],
        ];
        $renounced = [];
        $claimed = [ 15 ];
        $discardTiles = [];

        $bonsai = $this->bonsaiFromJson(
            '{"v":2,"move":18,"board":[null,40,1,3],"order":[84162790],"options":{"solo":1,"goals":true,"tokonoma":false},"players":{"84162790":{"color":0,"faceUp":[15,11,7],"played":[[1,0,0,0],[1,0,1,0],[1,-1,1,0],[2,-2,2,5],[1,-2,1,0],[3,-2,3,5],[1,-3,0,0],[2,-1,2,5],[2,0,2,0],[4,0,3,0],[2,-3,2,5],[2,-3,1,4],[4,-4,2,5],[3,-4,0,3],[1,1,1,0],[2,1,2,0],[3,2,3,0],[1,2,1,0],[2,2,2,0],[1,3,1,0],[2,3,2,0],[4,3,3,0],[3,4,3,0],[1,-2,-1,0]],"canPlay":{"leaf":2,"wild":1,"wood":2,"fruit":0,"flower":1},"claimed":[],"capacity":5,"faceDown":[34,35,39,30,42,24,45,41,37],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":1,"flower":1},"renounced":[4,13]}},"drawPile":[],"goalTiles":[4,6,10,12,13,15],"finalTurns":1,"nextPlayer":0}'
        );
        
        $bonsai->meditate(false, null, $cardId, $woodOrLeaf, $masterTiles, $placed, $renounced, $claimed, $discardTiles);

        $this->assertTrue(true);
    }

    public function testFlowerAdjacentToLeaf()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"v":2,"move":9,"board":[24,23,44,30],"order":[2393716,2393715],"options":{"goals":true,"tokonoma":false},"players":{
                "2393715":{"color":1,"faceUp":[11,12],"played":[[1,0,0,0],[1,1,1,0],[2,1,2,0],[1,2,1,0],[2,2,2,0],[4,2,3,0]],"canPlay":{"leaf":3,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":5,"faceDown":[37],"mirrored":false,"inventory":{"leaf":0,"wood":1,"fruit":0,"flower":1},"renounced":[]},
                "2393716":{"color":0,"faceUp":[7,8,3],"played":[[1,0,0,0],[1,0,1,0],[2,-1,1,4]],"canPlay":{"leaf":1,"wild":1,"wood":3,"fruit":0,"flower":0},"claimed":[],"capacity":7,"faceDown":[38],"mirrored":false,"inventory":{"leaf":0,"wood":2,"fruit":1,"flower":1},"renounced":[]}
            },"drawPile":[1,47,29,19,39,21,34,45,35,42,22,32,43,46,41,36,18,16,15,2,40],"goalTiles":[1,3,7,9,13,15],"finalTurns":null,"nextPlayer":0}'
        );

        $playerId = 2393716;
        $removeTile = null;
        $placeTiles = [
            [ 'type' => 1, 'x' => 1, 'y' => 1, 'r' => 0 ],
            [ 'type' => 1, 'x' => 2, 'y' => 1, 'r' => 0 ],
            [ 'type' => 3, 'x' => -2, 'y' => 1, 'r' => 4 ],
        ];
        $renounceGoals = [];
        $claimGoals = [];
        $bonsai->cultivate(false, $removeTile, $placeTiles, $renounceGoals, $claimGoals);

        $this->assertTrue(true);
    }

    public function testRemoveTilesAndMeditate()
    {
        $bonsai = $this->bonsaiFromJson(
            '{"v":2,"move":18,"board":[37,47,16,8],"order":[2393716,2393715],"options":{"goals":true,"tokonoma":false},"players":{
                "2393715":{"color":1,"faceUp":[3],"played":[[1,0,0,0],[2,0,1,5],[3,0,2,0],[1,1,1,0],[2,1,2,0],[2,2,1,1],[3,1,3,5],[4,2,2,1]],"canPlay":{"leaf":1,"wild":1,"wood":1,"fruit":0,"flower":0},"claimed":[],"capacity":7,"faceDown":[30,44,23,34],"mirrored":false,"inventory":{"leaf":1,"wood":3,"fruit":0,"flower":0},"renounced":[]},
                "2393716":{"color":0,"faceUp":[1,12,15],"played":[[1,0,0,0],[3,1,1,1],[2,0,1,5],[3,-1,2,5],[3,-1,1,4]],"canPlay":{"leaf":2,"wild":1,"wood":1,"fruit":0,"flower":1},"claimed":[],"capacity":7,"faceDown":[42,38,22],"mirrored":false,"inventory":{"leaf":0,"wood":3,"fruit":1,"flower":0},"renounced":[]}
            },"drawPile":[29,11,32,45,2,40,36,18,7,35,43,46,19,41,39,21,24],"goalTiles":[1,3,4,6,13,15],"finalTurns":null,"nextPlayer":1}'
        );

        $playerId = 2393715;
        $remove = [ 'x' => 0, 'y' => 1 ];
        $cardId = 16;
        $woodOrLeaf = 0;
        $masterTiles = [];
        $placeTiles = [];
        $renounceGoals = [];
        $claimGoals = [];
        $discardTiles = [];

        $bonsai->meditate(false, $remove, $cardId, $woodOrLeaf, $masterTiles, $placeTiles, $renounceGoals, $claimGoals, $discardTiles);

        $this->assertTrue(true);
    }
}
