<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Bonsai implementation : © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */
require_once(APP_BASE_PATH."view/common/game.view.php");
  
class view_bonsai_bonsai extends game_view
{
    protected function getGameName()
    {
        // Used for translations and stuff. Please do not modify.
        return "bonsai";
    }
    
  	function build_page($viewArgs)
  	{
        // Not Used
  	}
}
