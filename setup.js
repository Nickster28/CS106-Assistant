var request = require('request');

/* ENDPOINT: /setup
 * -------------------
 * Creates standard channels for a single CS106 class, and invites specified
 * SLs to those (and other default) channels.  The specific action is determined
 * by the text entered by the user.  The format should be:
 *
 *		[A/B/X/J] [# HWs] [SUNET1, SUNET2, ...]
 * 
 * E.g. the user would type
 *
 *		/setup A 7 sunet1 sunet2 sunet3
 * 
 * This command will create default channels for the specified class [A/B/X/J]
 * including (where ? = [A/B/X/J]:
 *		- cs106?_announcements
 *		- cs106?_general
 *		- cs106?_section
 *		- cs106?_assignmentX for X in [1...#HWs]
 *
 * Then, it invites all provided SUNETs to Slack, and auto-addes them to these
 * created channels.
 * -------------------
 */
setup = function(req, res) {
	if (!validRequest(req.body.token, req.body.team_id)) {
		console.log("Invalid token or team ID");
		return res.status(400).send("Invalid token or team ID");
	} else {	
		console.log("Received setup request.");	
		res.status(200).send("Working on it...");
		var responseURL = req.body.response_url;

		// Make a new empty promise
		var promise = new Promise(function(resolve, reject) {
			resolve();
		});

		// Text should be [A/B/X/J] [# HWs] [SUNET1, SUNET2, ...]
		// e.g. "A 7 sunet1 sunet2 sunet3"
		var textElems = req.body.text.split(" ");
		var className = ("106" + textElems.shift()).toLowerCase();
		var numHWs = parseInt(textElems.shift());

		// Keep track of the IDs of the created channels for inviting later
		var channelIds = [];
		getChannelNames(className, numHWs).forEach(function(channel) {
			promise = promise.then(function() {
				return createChannel(channel).then(function(channelId) {
					channelIds.push(channelId);
				});
			});
		});

		// Send a message that we created channels
		promise = promise.then(function() {
			return sendResponseMessage(responseURL, "Created channels.");
		});

		// Invite each user to these channels
		textElems.forEach(function(sunet) {
			promise = promise.then(function() {
				return inviteUser(sunet, channelIds);
			});
		});

		// Send final messages
		return promise.then(function() {
			return sendResponseMessage(responseURL, "Invited users.");
		}).then(function() {
			return sendResponseMessage(responseURL, "Done!");
		}, function(error) {
			console.log("Error: " + error);
			res.status(500).send(error);
		});
	}
}

/* FUNCTION: sendResponseMessage
--------------------------------
Parameters:
	- url: the callback URL to post the Slack message to
	- text: the text of the message to post

Returns: a promise that sends the given message back to Slack to the user.
--------------------------------
*/
function sendResponseMessage(url, text) {
	return requestPromise({
		url: url,
		method: 'POST',
		json: true,
		body: {
			'text': text
		}
	});
}

function inviteUser(sunet, channels) {
	url = "https://slack.com/api/users.admin.invite?token=" + process.env.TOKEN;
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
function createChannel(name) {
	return requestPromise({
		url: "https://slack.com/api/channels.create?token=" + process.env.TOKEN + "&name=" + name
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

// Returns whether the request token and Slack team are ok
function validRequest(token, team_id) {
	var teamIds = JSON.parse(process.env.TEAM_IDS);
	return token == process.env.VER_TOKEN && teamIds.includes(team_id);
}

var login = function(req, res) {
	fs.readFile('./login.html', 'utf8', function(err, data) {
		if (err) {
			return console.log(err);
		}
		res.status(200).send(data);
	})
}

var home = function(req, res) {
	console.log(req.params.code);
	fs.readFile('./index.html', 'utf8', function(err, data) {
		if (err) {
		  return console.log(err);
		}
		
		res.status(200).send(data.replace("TOKEN_PLACEHOLDER", "Nick"));
	});
}

module.exports = {
	initialize: function(app) {
		console.log("Initializing setup...");
		app.post('/setup', setup);
		app.get('/login', login);
		app.get('/home', home);
	}
}