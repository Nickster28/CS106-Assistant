var request = require('request');
var fs = require('fs');

submit = function(req, res) {
	if (!validRequest(req.body.team_id)) {
		console.log("Invalid team ID");
		return res.status(400).send("Invalid team ID");
	} else {
		// Make a new empty promise
		var promise = new Promise(function(resolve, reject) {
			resolve();
		});

		var className = ("106" + req.body.classLetter).toLowerCase();
		var numHWs = parseInt(req.body.numHWs);

		// Keep track of the IDs of the created channels for inviting later
		var channelIds = [];
		getChannelNames(className, numHWs).forEach(function(channel) {
			promise = promise.then(function() {
				return createChannel(channel, req.body.token).then(function(channelId) {
					channelIds.push(channelId);
				});
			});
		});

		// Invite each user to these channels
		req.body.sunets.split(' ').forEach(function(sunet) {
			promise = promise.then(function() {
				return inviteUser(sunet, channelIds, req.body.token);
			});
		});

		return promise.then(function() {
			res.status(200).send("Done.");
		}, function(error) {
			console.log("Error: " + error);
			res.status(500).send(error);
		});
	}
}

function inviteUser(sunet, channels, token) {
	url = "https://slack.com/api/users.admin.invite?token=" + token;
	url += "&email=" + sunet + "@stanford.edu";
	allChannels = channels.concat(JSON.parse(process.env.CHANNELS));
	console.log("Inviting user " + sunet + " to " + allChannels);
	url += "&channels=" + allChannels.join(",");
	return requestPromise({
		url: url
	}).then(function(body) {
		console.log(body);
	});
}

/* FUNCTION: getChannelNames
----------------------------
Parameters:
	- className: the name of the CS106 class, e.g. "cs106a".  MUST be lowercase.
	- numHWs: the number of homeworks for the class.

Returns: a list of channel names for the given class.  Includes standard
channels such as "cs106?_announcements", "cs106?_general" and "cs106?_section"
as well as a channel for each assignment, "cs106?_assignmentX".
----------------------------
*/
function getChannelNames(className, numHWs) {
	var channelNames = [
		"announcements",
		"general",
		"section"
	]

	for (var i = 0; i < numHWs; i++) {
		channelNames.push("assignment" + (i+1));
	}

	return channelNames.map(function(channelName) {
	   return className + "_" + channelName;
	});
}

/* FUNCTION: createChannel
---------------------------
Parameters:
	name - the name of the channel to create

Returns: a promise that sends a request to Slack to create a new channel with
the given name.  The promise also returns the Channel ID of the new channel.
---------------------------
*/
function createChannel(name, token) {
	return requestPromise({
		url: "https://slack.com/api/channels.create?token=" + token + "&name=" + name
	}).then(function(body) {
		return JSON.parse(body).channel.id;
	});
}

/* FUNCTION: requestPromise
---------------------------
Parameters:
	params - any parameters to pass to the request() method

Returns: a Promise-ified version of the request function to send an HTTP
request.  If the promise is resolved (no error from the request), it returns the
response  body.  Otherwise, it returns an error object.

Thanks to https://coderwall.com/p/9cifuw/scraping-web-pages-using-node-js-using-request-promise
for help promise-ifying this function.
---------------------------
*/
function requestPromise(params) {
	return new Promise(function(resolve, reject) {
		request(params, function(error, res, body) {
			if (error) {
				return reject(error);
			} else if (res.statusCode !== 200) {
				err = new Error("Unexpected status code: " + res.statusCode);
				err.res = res;
				return reject(err);
			}
			resolve(body);
		});
	});
}

// Returns whether the Slack team is ok
function validRequest(team_id) {
	var teamIds = JSON.parse(process.env.TEAM_IDS);
	return teamIds.includes(team_id);
}

var login = function(req, res) {
	fs.readFile('./login.html', 'utf8', function(err, data) {
		if (err) {
			res.status(500).send(err);
		} else {
			res.status(200).send(data);
		}
	});
}

var home = function(req, res) {
	fs.readFile('./index.html', 'utf8', function(err, data) {
		if (err) {
		  res.status(500).send(err);
		} else {
			var url = "https://slack.com/api/oauth.access?client_id="
			url += process.env.CLIENT_ID + "&client_secret=" + process.env.CLIENT_SECRET
			url += "&code=" + req.query.code;
			requestPromise({
				url: url
			}).then(function(body) {
				data = data.replace("TOKEN_PLACEHOLDER", JSON.parse(body).access_token)
				data = data.replace("TEAM_ID_PLACEHOLDER", JSON.parse(body).team_id);
				res.status(200).send(data);
			}, function(error) {
				res.status(500).send(error);
			});
		}
	});
}

module.exports = {
	initialize: function(app) {
		console.log("Initializing setup...");
		app.get('/', login);
		app.get('/home', home);
		app.post('/submit', submit);
	}
}