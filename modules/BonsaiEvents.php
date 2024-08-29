<?php
// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

interface BonsaiEvents
{
    function onGameStart(array $cardIds);
    function onPlayerStart(string $playerId, array $tileTypes);
    function onPotFlipped(int $move, string $playerId);
    function onTileRemoved(int $move, int $playerId, int $tileType, int $x, int $y, int $score);
    function onTilesAdded(int $move, int $playerId, array $placeTiles, int $score);
    function onGoalRenounced(int $move, int $playerId, int $goalId);
    function onGoalClaimed(int $move, int $playerId, int $goalId, int $score);
    function onCardTaken(int $move, int $playerId, int $cardId);
    function onCardDiscarded(int $cardId); // For solo game
    function onCapacityIncreased(int $playerId, int $delta);
    function onTilesReceived(int $move, int $playerId, array $tileTypes, int $slot);
    function onCardRevealed(/* TODO: int | null */ $cardId);
    function onTilesDiscarded(int $move, int $playerId, array $tiles);
    function onEndTurn(int $playerId, int $score);
    function onLastRound();
    function onChangeNextPlayer(int $playerId);
    function onGameOver($scores, $remainingTiles, $faceDownCards, /* TODO: bool | null */ $wonSoloGame);
}
