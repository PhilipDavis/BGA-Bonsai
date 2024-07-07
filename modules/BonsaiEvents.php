<?php
// © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)

interface BonsaiEvents
{
    function onTileRemoved(int $playerId, int $tileType, int $x, int $y, int $score);
    function onTilesAdded(int $playerId, array $placeTiles, int $score);
    function onGoalRenounced(int $playerId, int $goalId);
    function onGoalClaimed(int $playerId, int $goalId, int $score);
    function onCardTaken(int $playerId, int $cardId);
    function onCardDiscarded(int $cardId); // For solo game
    function onCapacityIncreased(int $playerId, int $delta);
    function onTilesReceived(int $playerId, array $tileTypes, int $slot);
    function onCardRevealed(int | null $cardId);
    function onTilesDiscarded(int $playerId, array $tiles);
    function onEndTurn(int $playerId, int $score);
    function onLastRound();
    function onChangeNextPlayer(int $playerId);
    function onGameOver($scores, $remainingTiles, $faceDownCards, bool | null $wonSoloGame);
}
