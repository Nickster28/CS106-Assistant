var node_ssh = require('node-ssh');
var ssh = new node_ssh();

/* ENDPOINT: /confirm-inject-all
 * ------------------------------
 * SSHs into myth (if the user clicked "YES" to confirm they want to inject all
 * submissions) and runs the inject autograder script for all students.  The
 * assignment to inject for is determined by the channel id passed in the payload
 * parameter of the request body.
 *
 * See https://api.slack.com/docs/message-buttons for the accepted request format.
 * ------------------------------
 */
confirmInjectAll = function(req, res) {
	console.log("Received inject all request.");
	var payload = JSON.parse(req.body.payload);

	if (!validRequest(payload.token, payload.team.id)
		|| payload.callback_id != "confirm_inject_all") {
		console.log("Invalid token, team ID or callback ID");
		return res.status(400).send("Invalid token, team ID or callback ID");
	} else if (payload.actions[0].value == "yes") {
		// Send back an interim confirmation to inject for this student
		res.status(200).send("Injecting autograder for all students...");

		// Inject and send a delayed message once it's done	
		return injectAutograder(payload.channel.name, null).then(function(output) {
			request({
				url: payload.response_url,
				method: 'POST',
				json: true,
				body: {
					'text': output
				}
			}, function (error, response, body) {
				console.log("Status code: " + response.statusCode);
				console.log("Body: " + body);
			});
		});
	} else {
		return res.status(200).send("Ok, I won't inject the autograder.");
	}
}

/* ENDPOINT: /inject
 * -------------------
 * SSHs into myth and runs the inject autograder script for a
 * single student.  The specific action is determined by the following
 * parameters received from Slack:
 * 		- channel_name: we inject the autograder for the assignment
 *						corresponding to the channel the user was in when
 *						running the app command.  E.g. if the channel is
 *						"106a-assignment4" then we will inject the autograder
 *						for this student's 106A HW4 submission.
 *
 *		- text: 		this is the SUNET of the student for which to inject the
 *						autograder.  If none, means they want to inject all.
 *
 * For the accepted request format, see https://api.slack.com/slash-commands.
 * If no text is included, this endpoint sends back a Slack prompt with a yes/no
 * button pair to confirm that they want to inject for all students.
 * -------------------
 */
inject = function(req, res) {
	console.log("Received inject request.");

	if (!validRequest(req.body.token, req.body.team_id)) {
				console.log("Invalid token or team ID");
		return res.status(400).send("Invalid token or team ID");
	} else if (req.body.text.length  > 0 && validChannel(req.body.channel_name)) {
		// Send back an interim confirmation to inject for this student
		res.status(200).send("Injecting autograder for " + req.body.text + "...");

		// Inject and send a delayed message once it's done	
		return injectAutograder(req.body.channel_name, req.body.text).then(function(output) {
			var url = req.body.response_url;
			console.log("Sending response POST to \"" + url + "\"");
			request({
				url: url,
				method: 'POST',
				json: true,
				body: {
					'text': output
				}
			}, function (error, response, body) {
				console.log("Error: " + error);
				console.log("Status code: " + response.statusCode);
				console.log("Body: " + body);
			});
		});
	} else if (validChannel(req.body.channel_name)) {
		// If no name is provided, confirm they want to inject all
		return res.status(200).send({
			"attachments": [
				{
					text: "Are you sure you want to inject for all students?",
					callback_id: "confirm_inject_all",
					"actions": [
						{
							"name": "yes",
							"text": "Yes",
							"type": "button",
							"value": "yes",
							"style": "danger"
						},
						{
							"name": "no",
							"text": "No",
							"type": "button",
							"value": "no"
						}
					]
				}
			]
		});
	} else {
		return res.status(200).send("Error: you must inject from within an assignment channel!");
	}
}

// Returns whether or not the given request token and Slack team this request is coming from are ok
function validRequest(token, team_id) {
	var teamIds = JSON.parse(process.env.TEAM_IDS);
	return token == process.env.VER_TOKEN && teamIds.includes(team_id);
}

// Checks whether the channel name contains both "106" and "assignment"
function validChannel(channelName) {
	return channelName.indexOf("106") != -1
		&& channelName.indexOf("assignment") != -1;
}


/* FUNCTION: injectAutograder
 * ---------------------------
 * Injects the autograder into the submission for the given homework channel for
 * the given student.  Returns a promise containing the last output line from
 * the injection script running.  If sunet is null, injects for all students.
 * Assumes a valid channel name (e.g. 106b-assignment4 or 106a-assignment3).
 * ---------------------------
 */
function injectAutograder(channelName, sunet) {
	console.log("Injecting autograder for channel \"" + channelName + "\" for sunet \"" + sunet + "\".");

	// Get the class (A, B, X, etc.) the request is for
	var classLetterIndex = channelName.indexOf("106") + "106".length;
	var classLetter = channelName[classLetterIndex].toLowerCase();

	// Get the assignment number this request is for
	var assignmentNumberIndex = channelName.indexOf("assignment") + "assignment".length;
	var assignmentNumber = parseInt(channelName[assignmentNumberIndex]);

	var credentials = JSON.parse(process.env.CREDENTIALS);
	var classes = JSON.parse(process.env.GRADER_CLASSES);
	if (!classes.includes(classLetter.toUpperCase())) {
		return new Promise(function(resolve, reject) {
			resolve("Error: unknown class CS106" + classLetter.toUpperCase());
		});
	}

	var username = credentials.username;
	var password = credentials.password;

	return ssh.connect({
	  host: process.env.HOST,
	  username: username,
	  password: password
	}).then(function() {
		console.log("Connected to host.");
		return ssh.execCommand('cd ' + process.env.DIR_PATH + classLetter + '/submissions && ./run-autograder ' + 
			assignmentNumber + (sunet ? ' ' + sunet : ''));
	}).then(function(result) {
		ssh.dispose();
		var result = result.stdout.substring(result.stdout.lastIndexOf("\n") + 1);
		console.log("Ran autograder command with result \"" + result + "\".");
		return result;
	});
}

module.exports = {
	initialize: function(app) {
		console.log("Initializing autograder...");
		app.post('/confirm-inject-all', confirmInjectAll);
		app.post('/inject', inject);
	}
}