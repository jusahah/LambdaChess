var fs = require('fs');
var Chess    = require('./chess').Chess;
var _ = require('lodash');

var analyzer = require('./analyze');

var ALTERNATIVE_SEPARATORS = ['\n\n', '\n\r'];

/*
$.get('pgns/test.pgn', function(pgnText) {
   console.log(pgnText);

   var chess = new Chess();
   var succ = chess.load_pgn(pgnText);
   console.log("Game below");
   console.log(succ);
}, 'text');

$.get('pgns/smalltest.pgn', parsePgns, 'text');

function getPositions(moves) {
	// moves has 1st move at index 0

	var newchess = new Chess(); // Temporary Chess instance to apply moves to

	// Applying moves one by one and collecting positions
	var positions = _.map(moves, function(move) {
		newchess.move(move);
		return {move: move.san, color: move.color, fen: newchess.fen(), eval: Math.random().toFixed(2)};
	});

	return positions;
}
*/
/*
var pgnFile = fs.readFileSync('smalltest.pgn', 'utf8');
var gameObjects = parsePgns(pgnFile);
var onlyGame = gameObjects[0];
*/

//analyzer.handler(onlyGame, producePgnWithEvals);

function parsePgns(pgnsText) {

	//console.log(pgnsText);

	var separatorsLeftToTry = _.slice(ALTERNATIVE_SEPARATORS); // Array
	var parsedResults; // Array (to be)

	// Local helper fun - tries to split the pgn text mass by selected line separator
	var trySeparator = function(separator) {
		parsedPgnsText = pgnsText.split(separator);
		if (parsedPgnsText.length <= 1) {
			// Separator clearly was not found
			return null;
		}
		return parsedPgnsText;	
	}

	// try each separator and stop we find one that matches
	_.find(ALTERNATIVE_SEPARATORS, function(separator) {
		var result = trySeparator(separator);
		if (result) {
			parsedResults = result;
			return true;
		}
		return false;

	});

	// parsedResults now contains pgns as array
	//console.log("PARSED RESULTS IS");
	//console.log(parsedResults);
	//console.log("Parsed len: " + parsedResults.length);


	/*
	var gameObjects = _.map(parsedResults, function(pgnPart) {
		//console.log("PART IS:");
		
		if (pgnPart.trim().charAt(0) !== '[') {
			//console.log("LOADING TO CHESS.JS");
			//console.log(pgnPart);
			pgnPart = pgnPart.split('\n').join(" ");
		   var chess = new Chess();
		   var succ = chess.load_pgn(pgnPart);	
		   //succ ? console.log('true') : console.error('false');	
		   if (!succ) {
		   	// Now the fucked up part
		   	// As it happens some pgn generators spit out invalid pgn yet think its valid. 
		   	// Here we try some heuristics to find out whether pgn was invalid in very
		   	// specific way
		   	var parts = pgnPart.split(" ");
		   	var nge7 = parts.indexOf('Nge7');
		   	var nge2 = parts.indexOf('Nge7');

		   	if (nge7 !== -1 || nge2 !== -1) {
		   		if (nge7 !== -1) parts[nge7] = 'Ne7';
		   		if (nge2 !== -1) parts[nge2] = 'Ne2';
		   	} else {
		   		return false;
		   	}


		   	pgnPart = parts.join(" ");
		   	chess = new Chess();
		    succ = chess.load_pgn(pgnPart);	
		    if (!succ) {
		    	// Did not help
		    	return false;
		    }
		   	

		   // Get fens for the game
		   return getPositions(chess.history({verbose: true}));


		}
	});
	*/
	// Filter away those which did not load_pgn correctly
	gameObjects = _.filter(gameObjects);

	return gameObjects;

	console.log(gameObjects);

	var gamePositions = gameObjects[0];

	var newPgn = producePgnWithEvals(gamePositions);


	$('body').empty().append(newPgn);

}

function getPositions(moves) {
	// moves has 1st move at index 0

	var newchess = new Chess(); // Temporary Chess instance to apply moves to

	// Applying moves one by one and collecting positions
	var positions = _.map(moves, function(move) {
		newchess.move(move);
		return {move: move.san, color: move.color, fen: newchess.fen(), eval: Math.random().toFixed(2)};
	});

	return positions;
}

function producePgnWithEvals(gamePositions) {

	//console.log(gamePositions);

	var chess = new Chess();

	// Apply moves and get pgn
	_.each(gamePositions, function(posObject) {
		// Play the move
		chess.move(posObject.move);

		// Also fix at the same time evaluation sign
		if (posObject.color === 'b') {
			if (!isNaN(posObject.eval)) {
				//console.log("Change sign");
				posObject.eval = posObject.eval * -1;
			}
		}
	});

	var pgn = chess.pgn({newline_char: '\n'});

	console.warn("FINAL PGN");

	var finalPGN = weaveEvalsIn(pgn, gamePositions).join(" ");

	console.log(finalPGN);

}

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
		evaluation = (evaluation/100).toFixed(2);

		// This defines comment syntax!!!
		return part + " {" + evaluation + "," + positions[currPositionIndex].bestmove + "}";
	});

	return newParts;

}


exports.handler = function(event, context, callback) {

	var depth = event.depth || 12;
	var token = event.token; 

	if (event.type === 'position') {
		// POSITION ANALYSIS
		var fen = event.fen;
		console.log("FEN IS: " + fen + ", token is " + token);
		analyzer.fenHandler(fen, handleFenResult, depth, true);


	} else if (event.type === 'multiple') {
		//Max is four
		var fens = _.take(event.fens, 4);
		var fenResults = [];

		var currMoveNum = -1;
		var currMove = 0;

		var moveToNextFen = function(resultObj) {

			if (resultObj) {
				resultObj.movenum = currMoveNum;
				resultObj.move    = currMove;
				fenResults.push(resultObj);
			}
			if (fens.length === 0) {
				return handleMultipleResults(fenResults);
			}
			var posObject = fens.pop();
			var nextFen = posObject.fen;
			currMove = posObject.move;
			currMoveNum = posObject.movenum;

			console.log("Next fen going in: " + nextFen);
			analyzer.fenHandler(nextFen, moveToNextFen, depth, true);
		}

		console.log("MULTIPLE ANALYZE, NUM OF FENS IS " + fens.length);
		
		moveToNextFen();

	} else {
		// GAME ANALYSIS
		var pgn = event.pgn;
		var gameObjects = parsePgns(pgn);
		var onlyGame = gameObjects[0];
		console.log("Starting pgn engine part");
		analyzer.pgnHandler(onlyGame, producePgnWithEvals, depth);

	}	

	// Callbacks to pass to analyzing layer

	function handleMultipleResults(fenResults) {

		var results = _.map(fenResults, function(resultObj) {
			var evaluation = resultObj.fen.split(" ")[1] === 'b' ? (resultObj.eval * -1) : resultObj.eval;
			return {
				fen: resultObj.fen,
				eval: evaluation,
				bestmove: resultObj.bestmove,
				token: event.token,
				depth: resultObj.depth,
				movenum: resultObj.movenum,
				move: resultObj.move
			}

		});

		if (context) {
			return context.done(null, results);
		}		

	}

	function handleFenResult(resultObj) {

		var evaluation = resultObj.fen.split(" ")[1] === 'b' ? (resultObj.eval * -1) : resultObj.eval;
		
		if (context) {
			return context.done(null, {
				fen: resultObj.fen,
				eval: evaluation,
				bestmove: resultObj.bestmove,
				token: event.token,
				depth: resultObj.depth,
				movenum: resultObj.movenum
			});
		}
	}


	function producePgnWithEvals(gamePositions) {

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

			var pgn = chess.pgn({newline_char: '\n'});

			//console.warn("FINAL PGN");

			var finalPGN = weaveEvalsIn(pgn, gamePositions).join(" ");
			console.log("---FINAL OUTPUT for token: " + token + "---");
			console.log(finalPGN);

			if (context) {
				return context.done(null, {token: token, pgn: finalPGN});
			}
			
	}	

}
