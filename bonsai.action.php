<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Bonsai implementation : © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
 *
 * This code has been produced on the BGA studio platform for use on https://boardgamearena.com.
 * See http://en.doc.boardgamearena.com/Studio for more information.
 * -----
 */  
  
class action_bonsai extends APP_GameAction
{ 
    // Constructor: please do not modify
    public function __default()
    {
        if (self::isArg('notifwindow'))
        {
            $this->view = "common_notifwindow";
            $this->viewArgs['table'] = self::getArg("table", AT_posint, true);
        }
        else
        {
            $this->view = "bonsai_bonsai";
            self::trace("Complete reinitialization of board game");
        }
    } 

    // Data exchange helper
    private function tileMovesFromNumberList($list)
    {
        $ints = $this->intsFromNumberListArg($list);
        $untypedChunks = array_chunk($ints, 4);
        return array_map(fn($chunk) => [
            'type' => intval($chunk[0]),
            'x' => intval($chunk[1]),
            'y' => intval($chunk[2]),
            'r' => intval($chunk[3]),
        ], $untypedChunks);
    }

    private function tileLocsFromNumberList($list)
    {
        $ints = $this->intsFromNumberListArg($list);
        $untypedChunks = array_chunk($ints, 2);
        return array_map(fn($chunk) => [
            'x' => intval($chunk[0]),
            'y' => intval($chunk[1]),
        ], $untypedChunks);
    }

    private function intsFromNumberListArg($arg)
    {
        $list = explode(',', $arg);
        return array_map(fn($item) => intval($item), array_filter($list, fn($item) => strlen($item)));
    }

    public function cultivate()
    {
        $this->setAjaxMode();

        $flip = self::getArg("flip", AT_num, false, 0);
        $removeTiles = $this->tileLocsFromNumberList(self::getArg("remove", AT_numberlist, false, ''));
        $remove = array_shift($removeTiles);

        $place = $this->tileMovesFromNumberList(self::getArg("place", AT_numberlist, true));
        $renounce = $this->intsFromNumberListArg(self::getArg("renounce", AT_numberlist, false, ''));
        $claim = $this->intsFromNumberListArg(self::getArg("claim", AT_numberlist, false, ''));

        $this->game->action_cultivate($flip, $remove, $place, $renounce, $claim);
        
        $this->ajaxResponse();
    }

    public function meditate()
    {
        $this->setAjaxMode();

        $flip = self::getArg("flip", AT_num, false, 0);
        $removeTiles = $this->tileLocsFromNumberList(self::getArg("remove", AT_numberlist, false, ''));
        $remove = array_shift($removeTiles);

        $drawCardId = intval(self::getArg("card", AT_posint, true));

        // Taking a card in the 2nd slot yields a choice of taking a wood tile or a leaf tile
        $woodOrLeaf = intval(self::getArg("choice", AT_posint, false, 0));

        // Taking a master card sometimes yields a choice of taking any tile
        $masterTiles = $this->intsFromNumberListArg(self::getArg("master", AT_numberlist, false, ''));

        // Helper cards allow the player to place some tiles
        $place = $this->tileMovesFromNumberList(self::getArg("place", AT_numberlist, false, ''));

        // If tiles were placed, the player may have triggered the ability to renounce/claim goals
        $renounce = $this->intsFromNumberListArg(self::getArg("renounce", AT_numberlist, false, ''));
        $claim = $this->intsFromNumberListArg(self::getArg("claim", AT_numberlist, false, ''));

        // The player will have to discard tiles if she has too many
        $discardTiles = $this->intsFromNumberListArg(self::getArg("discard", AT_numberlist, false, ''));

        $this->game->action_meditate($flip, $remove, $drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);
        
        $this->ajaxResponse();
    }

    public function jsError()
    {
        $this->setAjaxMode();

        $userAgent = $_POST['ua'];
        $url = $_POST['url'];
        $msg = $_POST['msg'];
        $line = $_POST['line'];
        $this->game->action_jsError($msg, $url, $line, $userAgent);

        $this->ajaxResponse();
    }
}
