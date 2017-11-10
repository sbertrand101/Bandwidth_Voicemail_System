//----Bandwidth Number to call: +17042662707-----

var Bandwidth = require("node-bandwidth");
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var http = require("http").Server(app);


var client = new Bandwidth({
    // uses my environment variables. Go to dev.bandwidth.com, look under Account -> API Information -> Credentials OR .zsrh file
    userId    : process.env.BANDWIDTH_USER_ID, // <-- note, this is not the same as the username you used to login to the portal
    apiToken  : process.env.BANDWIDTH_API_TOKEN,
    apiSecret : process.env.BANDWIDTH_API_SECRET
});



//BANDWIDTH
app.use(bodyParser.json());
//use a json body parser
app.set('port', (process.env.PORT || 4000));
//set port to an environment variable port or 4000

const getBaseUrlFromReq = (req) => {
    return 'http://' + req.hostname;
};

app.get("/", function (req, res) {
    console.log(req); 
    res.send("Bandwdith_Simple_Voicemail_System");
    //res.send(can be a website);
});

let toNumber = "+19197891146";


//+19198251930 conference room number


app.post('/out-call', function (req, res) {			//OUTBOUND CALLS
    var this_url2 = getBaseUrlFromReq(req);
    if (req.body.eventType === 'answer') {
        console.log("Incoming CallId: " + req.body.tag);
        console.log("Outgoing CallId: " + req.body.callId);
        console.log(req);
        client.Bridge.create({
        	bridgeAudio: true,
            callIds : [req.body.tag, req.body.callId]
        })
        .then(function (bridge) {
            console.log("BridgeId: " + bridge.id);
            console.log("---Call has been bridged----");
        })
        .catch(function(err){
        	console.log(err);
        	console.log("----Could not bridge the call----");
        });
    }
 //    else if (req.body.eventType === "timeout" && !(index === listOfNumbers.length)){
 //    	createCallWithCallback(req.body.from, this_url2, req.body.tag);
	// 	console.log(req.body);
	// 	console.log("-----The phone call has timed out-----");
	// }
	else if (req.body.eventType === "timeout"){
		console.log("Tag: " + req.body.tag)
		client.Call.speakSentence(req.body.tag, "You have reached Bandwidth. Sorry we can't get to the phone right now, please leave your message after the beep. BEEP.")
		.then(function(res){
			console.log("---Voicemail message spoken---");
		})
		.catch(function(err){
			console.log(err);
			console.log("Could not speak the voicemail intro sentence");
		})
	}
	else if (req.body.eventType === "hangup"){					//should automatically stop recording here
		console.log(req.body);
		console.log("----Your call has hungup----");
	}
    else{
    	console.log(req.body);
    }
});

app.post('/in-call', function (req, res) {				//INBOUND CALLS
	if (req.body.eventType === "incomingcall"){
   		console.log("Incoming callId: " + req.body.callId);  
		var this_url1 = getBaseUrlFromReq(req);
		createCallWithCallback(req.body.to, this_url1, req.body.callId);
	}
	else if (req.body.eventType === "speak" && req.body.state === "PLAYBACK_STOP"){
		console.log("CallId for the recording: " + req.body.callId);
		client.Call.enableRecording(req.body.callId)
		.then(function (res) {
			console.log("---Recording has started----");
		})
		.catch(function(err){
			console.log(err);
			console.log("Could not record");
		});
	}
	else if (req.body.eventType === "recording" && req.body.state === "complete"){
		console.log("---The original inbound call has been hungup---");
		client.Recording.createTranscription(req.body.recordingId)
		.then(function(transcription){
			console.log("-----Transcribing-----");
		})
		.catch(function(err){
			console.log(err);
			console.log("Sorry, something went wrong with the transcription");
		});
	}
	else if (req.body.eventType === "transcription" && req.body.state === "completed"){
		console.log(req.body);
		console.log("Transcribed");
	}
	else{
		console.log(req.body);
	}
});


var createCallWithCallback = function(FromBWnumber, this_url, tag){	
    return client.Call.create({
 		from: FromBWnumber,
        to: toNumber,
        callTimeout: 10,
        callbackUrl: this_url + '/out-call',
        tag: tag
    })
    .then(function (call) {
        console.log("Outgoing call Id: " + call.callId);
        console.log(call);
        console.log("----Outbound call has been created----");
    })
    .catch(function(err){
    	console.log(err);
    	console.log("---Outbound call could not be created---");
    })
};


http.listen(app.get('port'), function(){
	console.log('listening on *: ' + app.get('port'));
});

