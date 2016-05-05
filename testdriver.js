var analyseController = require('./index');

var printFen = {
	done: function(err, res) {
		console.log("---------\nPRINTING\n----------");
		console.log(res);
	}
}
/*
analyseController.handler({
	depth: 117,
	pgn: '[test]\n\n1. e4 c6 2. d4 d5 3. Nc3 Na6 4. g3 e5',
	token: 'skrkrsUI43jrUja'
}, printFen);
*/


setTimeout(function() {
	analyseController.handler({
	  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNB1KBNR b KQkq e3 0 1",
	  "token": "esj5BBjuuJ4w",
	  "type": "position",
	  "pgn": "[testi]\n\n1. e4 e5 Nf3 a6 Nxe5 Ke7",
	  "depth": 18
	}, printFen);
}, 1600);





