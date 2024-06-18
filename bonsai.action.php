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
    private function tileLocsFromNumberList($list)
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

    private function intsFromNumberListArg($arg)
    {
        $list = explode(',', $arg);
        return array_map(fn($item) => intval($item), array_filter($list, fn($item) => strlen($item)));
    }

    public function cultivate()
    {
        self::setAjaxMode();

        $remove = explode(',', self::getArg("remove", AT_numberlist, false, ''));
        if (count($remove) && $remove[0] == '') // HACK: empty value was turning into an array of 1 empty string
            array_pop($remove);
        $place = $this->tileLocsFromNumberList(self::getArg("place", AT_numberlist, true));
        $renounce = $this->intsFromNumberListArg(self::getArg("renounce", AT_numberlist, false, ''));
        $claim = $this->intsFromNumberListArg(self::getArg("claim", AT_numberlist, false, ''));

        $this->game->action_cultivate($remove, $place, $renounce, $claim);
        
        self::ajaxResponse();
    }

    public function meditate()
    {
        self::setAjaxMode();

        $drawCardId = intval(self::getArg("card", AT_posint, true));

        // Taking a card in the 2nd slot yields a choice of taking a wood tile or a leaf tile
        $woodOrLeaf = intval(self::getArg("choice", AT_posint, false, 0));

        // Taking a master card sometimes yields a choice of taking any tile
        $masterTiles = $this->intsFromNumberListArg(self::getArg("master", AT_numberlist, false, ''));

        // Helper cards allow the player to place some tiles
        $place = $this->tileLocsFromNumberList(self::getArg("place", AT_numberlist, false, ''));

        // If tiles were placed, the player may have triggered the ability to renounce/claim goals
        $renounce = $this->intsFromNumberListArg(self::getArg("renounce", AT_numberlist, false, ''));
        $claim = $this->intsFromNumberListArg(self::getArg("claim", AT_numberlist, false, ''));

        // The player will have to discard tiles if she has too many
        $discardTiles = $this->intsFromNumberListArg(self::getArg("discard", AT_numberlist, false, ''));

        $this->game->action_meditate($drawCardId, $woodOrLeaf, $masterTiles, $place, $renounce, $claim, $discardTiles);
        
        self::ajaxResponse();
    }
}
