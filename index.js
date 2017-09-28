var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var autograder = require('./autograder');
var setup = require('./setup');
var app = express();

// Use a parser for POST body params
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

autograder.initialize(app);
setup.initialize(app);

app.get("/auth", function(req, res) {
	console.log(req);
	res.status(200).end();
});

app.post("/test", function(req, res) {
	console.log(req.body);
	if (!validRequest(req.body.token, req.body.team_id)) {
				console.log("Invalid token or team ID");
		return res.status(400).send("Invalid token or team ID");
	} else {
		res.status(200).send("OK.");
	}
});

// Returns whether or not the given request token and Slack team this request is coming from are ok
function validRequest(token, team_id) {
	var teamIds = JSON.parse(process.env.TEAM_IDS);
	return token == process.env.VER_TOKEN && teamIds.includes(team_id);
}

// Start the server
app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

