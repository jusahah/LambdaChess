//process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

var _ = require('lodash');
var spawn = require('child_process').spawn;
var logs = '';


function runStockfish(gamePositions, cb, depth) {
	
	if (gamePositions.length > 240) {
		throw "Too many game positions - max number is 240 (120 move pairs)";
	}

	// Some heuristics to decide if user inputted depth can be executed before AWS timeout
	if (gamePositions.length <= 80) {
		// Depth between 10 and 18, default 17
		depth = (Number.isInteger(depth) && depth > 9 && depth < 19) ? depth : 17;	
	} else if (gamePositions.length <= 120) {
		// Depth between 10 and 17, default 16
		depth = (Number.isInteger(depth) && depth > 9 && depth < 18) ? depth : 16;		
	} else {
		// Depth between 10 and 15, default 15
		depth = (Number.isInteger(depth) && depth > 9 && depth < 15) ? depth : 15;	
	}


	var stockfish = spawn('./Stockfish2/src/stockfish');

	var lastStartTime;
	var currentEval = '?';
	var currentlyAnalysing = null;

	console.log("Stockfish depth is " + depth);

	var analysingFuns = _.map(gamePositions, function(position) {
		//console.log(position.fen);
		// First of all decorate with selected ply depth
		position.ply = depth;
		return function() {
			// Set state vars
			lastStartTime = Date.now();
			currentEval = '?';
			//console.log("Setting position: " + position.fen);
			currentlyAnalysing = position;
			stockfish.stdin.write('ucinewgame\n');
			stockfish.stdin.write('position fen ' + position.fen + '\n');
			stockfish.stdin.write('go depth ' + depth + '\n');			

		}
	});

	function analysisDone() {
		console.log("Analysis over");
		stockfish.stdin.end();
		setTimeout(function() {
			cb(gamePositions);
		}, 0)
	}

	function nextPos() {
		//console.log("Next pos");
		if (analysingFuns.length === 0) {
			return analysisDone();
		}

		var f = analysingFuns.pop();
		f();

	}
	
	stockfish.stdout.on('data', function(data) {

		var msg = data.toString('utf8');
		//console.log(msg);
		

		var nparts = msg.split('\n');

		_.each(nparts, function(part) {

			if (part.trim() === '') return;

			//console.log(part);

			var parts = part.split(" ");

			// check for score info
			var scoreIndex = parts.indexOf('score');
			if (scoreIndex !== -1) {
				//console.log("Changing eval: " + currentEval);
				currentEval = parts[scoreIndex+2];
			}

			// check for bestmove info
			var bestMoveIndex = parts.indexOf('bestmove');
			if (bestMoveIndex !== -1) {
				var duration = Date.now() - lastStartTime;
				//console.log("Eval is " + currentEval + ", bestmove is " + parts[bestMoveIndex+1] + ", took " + duration + " ms");
				currentlyAnalysing.eval = currentEval;
				currentlyAnalysing.bestmove = parts[bestMoveIndex+1];
				nextPos();
			}
		});
		/*
		console.log("------");
		console.log(msg);
		console.log("------");
		*/

	});
	//setTimeout(nextPos, 600);
	nextPos();

}

function runStockfishOnFen(fen, cb, depth) {
	// Depth between 16 and 24, default is 22
	depth = (Number.isInteger(depth) && depth > 15 && depth < 25) ? depth : 22;
	var stockfish = spawn('./Stockfish2/src/stockfish');
	var lastStartTime;
	var currentEval = '?';

	// This should be abstracted so that pgn and fen can use one listening function.
	stockfish.stdout.on('data', function(data) {

		var msg = data.toString('utf8');
		//console.log(msg);
		

		var nparts = msg.split('\n');

		_.each(nparts, function(part) {

			if (part.trim() === '') return;

			//console.log(part);

			var parts = part.split(" ");

			// check for score info
			var scoreIndex = parts.indexOf('score');
			if (scoreIndex !== -1) {
				//console.log("Changing eval: " + currentEval);
				currentEval = parts[scoreIndex+2];
			}

			// check for bestmove info
			var bestMoveIndex = parts.indexOf('bestmove');
			if (bestMoveIndex !== -1) {
				analysisDone(currentEval, parts[bestMoveIndex+1]);
			}
		});
		/*
		console.log("------");
		console.log(msg);
		console.log("------");
		*/

	});

	function analysisDone(evaluation, bestmove) {
		console.log("Fen analysis over");
		stockfish.stdin.end();
		setTimeout(function() {
			cb({
				fen: fen,
				eval: evaluation,
				bestmove: bestmove,
				depth: depth
			});
		}, 0)
	}

	function launch() {
		stockfish.stdin.write('ucinewgame\n');
		stockfish.stdin.write('position fen ' + fen + '\n');
		stockfish.stdin.write('go depth ' + depth + '\n');			
	}

	setTimeout(launch, 0);

}

//runStockfish();
exports.handler = runStockfish; // For direct AWS test call
exports.pgnHandler = runStockfish;
exports.fenHandler = runStockfishOnFen;

