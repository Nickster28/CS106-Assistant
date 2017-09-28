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

// Start the server
app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

