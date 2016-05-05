//var request = require('request');
var static = require('node-static'); // For returning test.html, nothing else
var fs = require('fs');
var _ = require('lodash');
var Promise = require('bluebird');
var request = require('request');
var uuid = require('node-uuid');
var server = require('http').createServer();
var io = require('socket.io')(server);

var fileServer = new static.Server('./public');
require('http').createServer(function (request, response) {
    request.addListener('end', function () {
    	fileServer.serve(request, response);
        //fileServer.serveFile('/index.html', 200, {}, request, response);
    }).resume();
}).listen(8080);


server.listen(3210);

// Own deps
var analyseController = require('./index');
var positionalize = require('./positionsFromSinglePGN');  // Function
var pgnize        = require('./evaluatedPositionsToPGN'); // Function

// AWS data (must be kept private)
var LAMBDA_URL = 'https://pyitkzd2t5.execute-api.eu-central-1.amazonaws.com/prod/StockfishNative';
var API_KEY    = 'HwINjCJPSe5sSIcFZUZKX3zAGWFy5dNY3g9Hrxjj';
/*
// Test file read and processing
var pgnFile = fs.readFileSync('smallgame2.pgn', 'utf8');
var positions = positionalize(pgnFile);
var positionPairs = _.chunk(positions, 2);
var analysingReqs = _.map(positionPairs, function(pair) {
	return {
		"fens": pair,
	  	"token": uuid.v1(),
	  	"type": "multiple",
	  	"depth": 16
	}
});
// Test file stuff ends
*/
function startUp() {
	// Register socket listener for accepting new web surfers
	io.on('connection', function(socket){
	  console.log("SOCKET CONNECTION IN");
	  socket.on('analyzepgn', function(data){
	  	if (socket.currentlyAnalysing) {
	  		return socket.emit('analysisrequest', {outcome: false, reason: 'Previous analysis running.'});
	  	}
	  	var pgnString = data.pgn;
	  	// 10 kb pgn text limit
	  	if (!pgnString || pgnString.length > (10 * 1000)) {
	  		console.error("Client sent too big file");
	  		socket.disconnect(); // Force the fucker to fuck the fuck out
	  	}
	  	try {
		  	var analysisRequests = prepareAnalysis(pgnString);
	  	} catch (e) {
	  		console.error("----");
	  		console.error("Pgn parsing failed");
	  		console.error(pgnString);
	  		console.error(e);
	  		console.error("----");
	  		return socket.emit('analysisrequest', {outcome: false, reason: 'Pgn could not be parsed - check its validity.'});
	  	}
	  	var numberOfPositions = positionCount(analysisRequests);
	  	var analysisToken = uuid.v4();
	  	socket.currentlyAnalysing = true;
	  	doLocalAnalysis(analysisRequests, function(positions) {
	  		// Route analysis results of positions to user so he can see
	  		// them right away while other positions are still being analysed.
	  		console.log("Routing intermediary results to " + analysisToken);
	  		socket.emit('positions', {'positions': positions, 'token': analysisToken});
	  	}, function(finalPgn) {
	  		console.log("Routing final pgn to " + analysisToken);
	  		socket.emit('pgn', {'pgn': finalPgn, 'token': analysisToken});
	  		socket.currentlyAnalysing = false;
	  	});
	  	socket.emit('analysisrequest', {
	  		outcome: true, 
	  		token: analysisToken, 
	  		numofpositions: numberOfPositions
	  	});

	  });
	  socket.on('disconnect', function(){

	  });
	});

}

function positionCount(analysisRequests) {
	console.log(analysisRequests)
	return _.reduce(analysisRequests, function(sum, req) {
		return sum + req.fens.length;
	}, 0);
}

function prepareAnalysis(pgnString) {
	var positions = positionalize(pgnString);
	var positionPairs = _.chunk(positions, 2);


	return _.map(positionPairs, function(pair) {
		return {
			"fens": pair,
		  	"token": uuid.v4(),
		  	"type": "multiple",
		  	"depth": 16
		}
	});

}

/*
doLocalAnalysis(analysingReqs, function(positionObject) {
	// Received one analyzed position - analysis still going on for other positions
	console.log("---ONE PROGRESS OBJECT BACK---");
	if (Array.isArray(positionObject)) {
		// PositionObject is array
		console.log(_.map(positionObject, function(position) { return position.movenum}));
	} else {
		console.log(positionObject.movenum);
	}
}, function(pgn) {
	// Received final pgn - analysis has completed
	console.log("-------CB PGN------");
	console.log(pgn);
});
/*
var testReqs = _.take(analysingReqs, 5);

var gatheredResults = [];

var proms = _.map(analysingReqs, function(req) {
	console.log("Sending req to analysis");
	return new Promise(function(resolve, reject) {
		analyseController.handler(req, {done: function(err, res) {
			gatheredResults.push(res);
			resolve(); // Resolve promise
		}});
	});
	
});

Promise.all(proms).then(function() {
	console.log("ALL POSITIONS DONE!!!")
	// First flatten then order by movenum
	var positionsWithEvals = _.orderBy(_.flatten(gatheredResults), 'movenum', 'asc');
	console.log(pgnize(positionsWithEvals));


})

*/
//analyseController.handler(testPost, printFen);

function doAnalysis(analysingReqs, progressCb, cb) {
	console.log("DO ANALYSIS WITH REQS NUM: " + analysingReqs.length);
	return;
	var gatheredResults = [];
	var i = 0;
	console.log(analysingReqs);
	console.log("--------------------");
	console.log("--------------------");

	console.log("STARTING TO AWS LAMBDA POST PROCESS");
	var proms = _.map(analysingReqs, function(req) {
		
		if (i > 100) return;
		i++;
		return new Promise(function(resolve, reject) {
			var j = i;
			request({
				url: LAMBDA_URL,
				headers: {
					'x-api-key': API_KEY
				},
				timeout: 60 * 1000,
				method: 'POST',
				json: req,
			}, function(err, res, body) {
				
				if (err) {
					console.log(err);
					return reject(err);
				}
				if (res.statusCode == 200) {
					console.log("200 back: " + j);
					var r = body;
					gatheredResults.push(r);
					return resolve(r);
				}
				console.log("WILL REJECT");
				console.log(err);
				console.log(body);
				

				return reject(err);
			});
		});
	});

	_.each(proms, function(prom) {
		prom.then(progressCb);
	});

	Promise.all(proms).then(function() {
		console.log("ALL POSITIONS RECEIVED BACK!!!")
		// First flatten then order by movenum
		console.log(gatheredResults);
		var positionsWithEvals = _.orderBy(_.flatten(gatheredResults), 'movenum', 'asc');
		var finalPgn = pgnize(positionsWithEvals);
		cb(finalPgn); // Return to original caller
	}).catch(function(err) {
		console.log("PROMISE ALL CAUGHT");
		console.log(err);
	});

}

function doLocalAnalysis(analysingReqs, progressCb, cb) {
	console.log("DO LOCAL ANALYSIS WITH REQS NUM: " + analysingReqs.length);
	var gatheredResults = [];

	var proms = _.map(analysingReqs, function(req) {
		console.log("Sending req to analysis");
		return new Promise(function(resolve, reject) {
			analyseController.handler(req, {done: function(err, res) {
				gatheredResults.push(res);
				return resolve(res); // Resolve promise
			}});
		});
		
	});

	_.each(proms, function(prom) {
		prom.then(progressCb);
	});

	Promise.all(proms).then(function() {
		console.log("ALL POSITIONS DONE!!!")
		// First flatten then order by movenum
		var positionsWithEvals = _.orderBy(_.flatten(gatheredResults), 'movenum', 'asc');
		var finalPgn = pgnize(positionsWithEvals);
		console.log(finalPgn);
		cb(finalPgn); // Return to original caller
	});
}



// Kick off socket listening
startUp();

/*
client.post({url : '', timeout: 100}, testPost, function(err, res, body) {
	if (err) {
		console.log(err);
	}
	if (res.statusCode == 200) {
		console.log(body);
	}
});
*/