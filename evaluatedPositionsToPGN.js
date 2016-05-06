var Chess    = require('./chess').Chess;
var _ = require('lodash');

// Private helper fun
function weaveEvalsIn(pgnText, positions) {

	var parts = pgnText.split(" ");
	//console.log(parts);

	// First is move number, then white move, then black move
	var currIndex = -1;
	var currPositionIndex = -1;

	var newParts = _.map(parts, function(part) {
		currIndex++;
		if (currIndex % 3 === 0) return part;
		currPositionIndex++;

		var evaluation = positions[currPositionIndex].eval;
		if (!isNaN(evaluation)) {
			evaluation = (evaluation/100).toFixed(2);
		}
		

		// This defines comment syntax!!!
		return part + " {" + evaluation + "," + positions[currPositionIndex].bestmove + "}";
	});

	return newParts;

}

function producePgnWithEvals(gamePositions) {
	console.log("PGN PRODUCTION STARTS");
			//console.log(gamePositions);

			var chess = new Chess();

			// Apply moves and get pgn
			_.each(gamePositions, function(posObject) {
				// Play the move
				chess.move(posObject.move);

				// Also fix at the same time evaluation sign
				if (posObject.color === 'w') {
					if (!isNaN(posObject.eval)) {
						//console.log("Change sign");
						posObject.eval = posObject.eval * -1;
					}
				}
			});
			//console.log(chess.history());
			var pgn = chess.pgn({newline_char: '\n'});

			//console.warn("FINAL PGN");

			return weaveEvalsIn(pgn, gamePositions).join(" ");

			
}


module.exports = producePgnWithEvals;		