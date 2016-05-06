var Chess    = require('./chess').Chess;
var _ = require('lodash');

module.exports = function(pgn) {


	console.log("NN: " + pgn.split('\n\n').length);
	console.log("RN: " + pgn.split('\r\n').length);
	console.log("R: " + pgn.split('\r').length);
	console.log("N: " + pgn.split('\n').length);

	//pgn = pgn.replace(new RegExp('\r\n', 'g'), '\n');
	var chess = new Chess();
	var succ = chess.load_pgn(pgn);	


	//succ ? console.log('true') : console.error('false');	
	if (!succ) {
		   	var parts = pgn.split(" ");
		   	var nge7 = parts.indexOf('Nge7');
		   	var nge2 = parts.indexOf('Nge2');

		   	if (nge7 !== -1 || nge2 !== -1) {
		   		if (nge7 !== -1) parts[nge7] = 'Ne7';
		   		if (nge2 !== -1) parts[nge2] = 'Ne2';
		   	} else {
		   		throw 'Chess.js pgn parse failed';
		   	}


		   	pgn = parts.join(" ");
		   	console.log(pgn);
		   	chess = new Chess();
		    succ = chess.load_pgn(pgn);	
		    if (!succ) {
		    	// Did not help
		    	throw 'Chess.js pgn parse failed';
		    }
	}




	// Get fens for the game
	return getPositions(chess.history({verbose: true}));

}

function getPositions(moves) {
	// moves has 1st move at index 0
	var moveNum = 1;
	var newchess = new Chess(); // Temporary Chess instance to apply moves to

	// Applying moves one by one and collecting positions
	var positions = _.map(moves, function(move) {
		newchess.move(move);
		return {move: move.san, color: move.color, fen: newchess.fen(), eval: '?', movenum: moveNum++, bestmove: "?"};
	});

	return positions;
}