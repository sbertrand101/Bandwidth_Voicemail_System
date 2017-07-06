# Bandwidth_Voicemail_System
Using Bandwidth's communications API to create a voicemail system that calls a collection of numbers sequentially. If no one answers, the call gets sent to voicemail which then gets transcribed.  The transcription gets sent via email using Sendgrid's API

## The Logic 
When the app receives an inbound call to the Bandwidth number, it needs to forward the call to the designated person. To do this, it creates a new call from the Bandwidth phone to the designated receiver of the call. The app then bridges the two calls so that the inbound caller is connected to the receiver of the call. The two can then talk as if it was one call all along. If the first receiver does not answer, the app will create calls one at a time to all the designated receivers in a predetermined order. Separate calls are necessary here so that the incoming caller is not disconnected when one receiver does not answer. When a receiver answers, the two calls are bridged and the inbound caller can talk to the receiver. If no one picks up, the caller is sent to a recorded message and the caller can leave a message. This voicemail is then emailed to all the receivers on the list. 

## Coding the App 
1. Follow the Prerequisite for Creating an App and Setup to Create an App guides. 
2. Create a method to get the URL from the incoming call.
```
const getBaseUrlFromReq = (req) => {
    return 'http://' + req.hostname;
};
```
3. Create a database of receiving numbers. This is the list of numbers that the program will call through. This is an example of an easy database we will use for this example app: 

```
let listOfNumbers = [+1##########, +1##########, +1##########];
```
4. Create an index to loop through the list of numbers. This number will keep track of who has been called to ensure that no one is called twice. 
```
var index = 0;
```
5. Create the call function. Any time the program wants to make an outbound call, it will call this function. The call is made a call from the Bandwidth number to the correct number in the call list. The call times out after 10 seconds in order to move on to the next caller in the list. It also has a callback URL to track what is happening on the call and the tag will track the incoming call call id. After the function makes the call, it will increment the index to go to the next number on the list. Finally, it will catch any errors that are thrown. 
```
var createCallWithCallback = function(FromBWnumber, this_url, tag){	
    return client.Call.create({
 		from: FromBWnumber,
        to: listOfNumbers[index],
        callTimeout: 10,
        callbackUrl: this_url + '/out-call',
        tag: tag
    })
    .then(function (call) {
    	index++;
        console.log("Outgoing call Id: " + call.callId);
        console.log(call);
        console.log("----Outbound call has been created----");
    })
    .catch(function(err){
    	console.log(err);
    	console.log("---Outbound call could not be created---");
    })
};
```
6. Create the function that receives the incoming call. When the function receives a call, it creates an outbound call to the first number on the list. 
```
app.post('/in-call', function (req, res) {				//INBOUND CALLS
	if (req.body.eventType === "incomingcall"){
   		console.log("Incoming callId: " + req.body.callId);  
		var this_url1 = getBaseUrlFromReq(req);
		createCallWithCallback(req.body.to, this_url1, req.body.callId);
	}
});
```
7. Create the function to handle the outbound calls. When the outbound call is made, this method will be notified of any events that occur on the call and allow us to interact with the call. If the call is answered by one of the receivers, the call will be bridged. This will allow the incoming caller to talk to the receiver. If the call is not answered, the program will call the next receiver on the list. Each time a new call is created this method will start over by first checking if the call was answered and if it was, it will bridge. If everyone on the list has been called and no one has answered, the call will go to voicemail. Our voicemail will begin by speaking the prerecorded message into the phone. 
```
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
    else if (req.body.eventType === "timeout" && !(index === listOfNumbers.length)){
    	createCallWithCallback(req.body.from, this_url2, req.body.tag);
		console.log(req.body);
		console.log("-----The phone call has timed out-----");
	}
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
```
8. Record the incoming caller's voicemail. The post /in-call method should look like the following:  
```
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
}
```
9. Transcribe the incoming caller’s voicemail. When the caller finishes the recording, the program will transcribe the recording. Add the following to the post in-call method: 
```

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

```
10. Email the transcription to the designated receiver using Sendgrid’s API 
    1. Sign up for a sendgrid API in order to receive your API credentials. 
    2. Follow the getting started guide to setup your developer guide. 
    3. Add the following code to the post in-call method. 
    ```
   else if (req.body.eventType === "transcription" && req.body.state === "completed"){
		console.log(req.body);
		//SENDGRID
		// using SendGrid's v3 Node.js Library
		// https://github.com/sendgrid/sendgrid-nodejs
		var helper = require('sendgrid').mail;
		var fromEmail = new helper.Email('fromemail@example.com');
		var toEmail = new helper.Email('toemail@example.com');
		var subject = 'Voicemail email test';
		var content = new helper.Content('text/plain', req.body.text);
		var mail = new helper.Mail(fromEmail, subject, toEmail, content);

		var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
		var request = sg.emptyRequest({
		  method: 'POST',
		  path: '/v3/mail/send',
		  body: mail.toJSON()
		});

		sg.API(request, function (error, response) {
  		if (error) {
    		console.log('Error response received');
  		}
  		console.log(response.statusCode);
  		console.log(response.body);
  		console.log(response.headers);
		});
	}
	else{
		console.log(req.body);
	}
    ```
11. Make the program listen for any incoming activity.
```
http.listen(app.get('port'), function(){
    console.log('listening on *: ' + app.get('port'));
});
```
12. Login to dev.bandwidth.com
13. Choose the My Apps tab 
14. Select create new 
15. Choose post 
16. Choose voice 
17. In the message callback box, enter the web address /message-callback (ex. http://2ab58988.ngrok.io/message-callback). If you are using ngrok, this is your ngrok forwarding address. See the setup guide step 12 for more information. 
18. save 
19. Add number by checking the box next to the number you want to use and choose add numbers. 
20. Run the code. Start the application from the terminal. Test by calling the ‘from’ number. 












