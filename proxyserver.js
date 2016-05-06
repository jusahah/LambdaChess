// Require enviroment data, which automatically binds variables to process.env
require('dotenv').config();

var static = require('node-static'); // For static files (like public/index.html)
var fs = require('fs');
var _ = require('lodash');
var Promise = require('bluebird'); // Promise library
var request = require('request'); // HTTP requests to AWS Lambda
var uuid = require('node-uuid'); // Generation of globally unique ids
var server = require('http').createServer();
var io = require('socket.io')(server);

var fileServer = new static.Server('./public');
require('http').createServer(function (request, response) {
    request.addListener('end', function () {
    	fileServer.serve(request, response);
    }).resume();
}).listen(process.env.FILESERVER_PORT);

// Start file server listener
server.listen(process.env.SOCKET_PORT);

// Own deps
var analyseController = require('./index');
var positionalize = require('./positionsFromSinglePGN');  // Function
var pgnize        = require('./evaluatedPositionsToPGN'); // Function
var getHeadersIfPresent = require('./getHeadersIfPresent');  // Function

// AWS data saved locally for easier access
// Note to self - always use enviroment file for AWS credentials
var LAMBDA_URL = process.env.LAMBDA_URL;
var API_KEY    = process.env.API_KEY;

// App launch function
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
	  		return;
	  	}
	  	try {
	  		// Parsing is CPU-expensive
	  		// This has potential to clog the event loop
	  		// Move to separate thread later if needed
		  	var analysisRequests = prepareAnalysis(pgnString);
	  	} catch (e) {
	  		console.error("----");
	  		console.error("Pgn parsing failed");
	  		console.error(pgnString);
	  		console.error(e);
	  		console.error("----");
	  		return socket.emit('analysisrequest', {outcome: false, reason: 'Pgn could not be parsed - check its validity.'});
	  	}
	  	var headers = getHeadersIfPresent(pgnString);
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
	  		socket.emit('pgn', {'headers': headers, 'pgn': finalPgn, 'token': analysisToken});
	  		socket.currentlyAnalysing = false;
	  	});
	  	socket.emit('analysisrequest', {
	  		outcome: true, 
	  		token: analysisToken, 
	  		numofpositions: numberOfPositions
	  	});

	  });
	  socket.on('disconnect', function(){
	  	// Do nothing, socket.io handles all relevant stuff
	  });
	});

}
// Returns how many positions a array of requests has
// Each array item (=req) can have multiple positions
function positionCount(analysisRequests) {
	//console.log(analysisRequests)
	return _.reduce(analysisRequests, function(sum, req) {
		return sum + req.fens.length;
	}, 0);
}

function prepareAnalysis(pgnString) {
	var positions = positionalize(pgnString);

	if (positions.length > 200) throw "Too many positions";
	var chunkSize = 4;
	if (positions < 40) chunkSize = 2;
	else if (positions < 80) chunkSize = 3; 
	var positionPairs = _.chunk(positions, chunkSize);

	console.log("POSITION PAIRS: " + positionPairs.length);

	return _.map(positionPairs, function(pair) {
		return {
			"fens": pair,
		  	"token": uuid.v4(),
		  	"type": "multiple",
		  	"depth": 16,
		  	"eval": "?", // Placeholder
		  	"bestmove": "?" // Placeholder
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

// PRODUCTION ANALYSIS FUNCTION
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
		var positionsWithEvals = _.orderBy(_.flatten(gatheredResults), 'movenum', 'asc');
		var finalPgn = pgnize(positionsWithEvals);
		cb(finalPgn); // Return to original caller
	}).catch(function(err) {
		console.log("PROMISE ALL CAUGHT");
		console.log(err);
	});

}

// LOCAL / TESTING ANALYSIS FUNCTION
function doLocalAnalysis(analysingReqs, progressCb, cb) {
	console.log("DO ANALYSIS WITH REQS NUM: " + analysingReqs.length);
	if (analysingReqs.length > 60) {
		// Game has more than 120 moves
		console.error("Too many analysing requests -> bailing: " + analysingReqs.length);
		throw "TOO_MANY_ANALYSIS_REQS";
	}
	var gatheredResults = [];

	var proms = _.map(analysingReqs, function(req) {
		console.log("Sending req to analysis");
		return new Promise(function(resolve, reject) {
			// We need to assign new object so that in local testing
			// we dont accidentally change properties of our req object in analysis layer
			analysisProxy(req, {done: function(err, res) {
				//console.log(res);
				//if (Math.random() < 0.3) return reject();
				gatheredResults.push(res);
				return resolve(res); // Resolve promise
			}});
			/*
			analyseController.handler(Object.assign({}, req), {done: function(err, res) {
				//console.log(res);
				if (Math.random() < 0.3) return reject();
				gatheredResults.push(res);
				return resolve(res); // Resolve promise
			}})
			*/
		}).then(progressCb).catch(function(err) {
				console.error("ANALYSIS REQUEST FAIL");
				console.error(err);
				// We have no choice but to push the positions with no analysises
				gatheredResults.push(req.fens);
		});
		
	});

	Promise.all(proms.map(function(prom) {
		return prom.reflect(); // Return promise thats fulfilled even on rejection of prom!
	})).then(function() {
		// All request promises have now EITHER been fulfilled or rejected!
		// If there's a rejection, some of the positions were left unanalysed.
		console.log("ALL POSITION REQUESTS ARRIVED BACK!");
		// First flatten then order by movenum
		//console.log(gatheredResults);
		var positionsWithEvals = _.orderBy(_.flatten(gatheredResults), 'movenum', 'asc');
		var finalPgn = pgnize(positionsWithEvals);
		console.log(finalPgn);
		cb(finalPgn); // Return to original caller
	});
}

function analysisProxy(req, context) {
	// Later do this switch using separate required modules
	// For now this is fine
	if (process.env.PRODUCTIONENV === 'true') {
		
		// PRODUCTION IMPLEMENTATION
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
					throw err;
				}
				if (res.statusCode == 200) {
					console.log("200 back");
					//console.log(body);
					var r = body;
					return context.done(null, r);
				}
				throw "Non-200 HTTP response: " + res.statusCode;
		});
	} else {
		// LOCAL TESTING IMPLEMENTATION
		analyseController.handler(Object.assign({}, req), context);	
	}
}



// Kick off socket listening thus allowing end-users to send in pgn games for analysis
startUp();

/*
.catch(function() {
			// Analysis of the position batch failed
			// We still need to add them to gatheredResults so pgn can be produced

		})
		*/