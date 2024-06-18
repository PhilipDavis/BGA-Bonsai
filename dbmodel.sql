
-- ------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- Bonsai implementation : © Copyright 2024, Philip Davis (mrphilipadavis AT gmail)
-- 
-- This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
-- See http://en.boardgamearena.com/#!doc/Studio for more information.
-- -----


CREATE TABLE IF NOT EXISTS game_state (
    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    doc JSON NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;
