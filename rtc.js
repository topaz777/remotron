const { desktopCapturer, screen, ipcRenderer, clipboard } = require('electron')

var logging = true;
let primaryDisplayId = 0;
var localStream, localPeer, receiveChannel;
var receiveBuffer = [], receivedSize = 0;
var offerOptions = { offerToReceiveAudio: 0, offerToReceiveVideo: 1 };

var ws = new WebSocket("ws://remotron.lacy.kr/ws");
// var ws = new WebSocket("ws://192.168.1.19:8080/remotron/ws");

// ------------------------------------------- File Event ---------------------------------------------

// document.on("dragover dragenter dragleave", function(event){
// 	event.stopPropagation();
// 	event.preventDefault();
// 	return false;
// }, false);

document.body.addEventListener("dragover", function(e){
	e.stopPropagation();
	e.preventDefault();
	return false;
}, false);

// document.on("drop", function(event){
// 	event.stopPropagation();
// 	event.preventDefault();
//
// 	for (const file of event.dataTransfer.files) {
// 		console.log('File(s) you dragged here: ', file.path)
// 	}
//
// 	sendFile(file);
// });

document.body.addEventListener("drop", function(e){
	e.stopPropagation();
	e.preventDefault();

	for (const file of e.dataTransfer.files) {
		console.log('File(s) you dragged here: ', file.path)
		sendFile(file);
	}

});

// ------------------------------------------- WebSocket Event ---------------------------------------------

ws.onopen = function(message){
	if(logging) console.log("WS Open");
	SendClientName();
};

ws.onmessage = function(message){
	var data = JSON.parse(message.data);
	if(logging) console.log("[SSM] " + data.type);

	if(data.type == "getScreenReady") {
		getScreen();
	} else if(data.type == "video-offer") {
		getOffer(data.desc);
	} else if(data.type == "new-ice-candidate") {
		getIceCandidate(data.candidate);
	}
}

ws.onerror = function(message){
	if(logging) console.log(message)
}

ws.onclose = function(message){
	if(logging) console.log(message)
}

// --------------------------------------------- SendClientName ------------------------------------------------

function SendClientName() {
	var data = {
		"type" : "clientName",
		"species" : "remotron",
		"desc" : "testDevice1"
	}
	ws.send(JSON.stringify(data));
}

// --------------------------------------------- getScreen ------------------------------------------------

function getScreen() {
	// var displayMediaOptions = {
	//   video: {
	//     cursor: "never"
	//   },
	//   audio: false
	// };
	//
	// navigator.mediaDevices.getDisplayMedia(displayMediaOptions).then((stream) => gotStream(stream))

	// -------------

	let options = { types: ['window', 'screen'] };

	desktopCapturer.getSources(options).then(async sources => {
		// let size = screen.getPrimaryDisplay().size
		let devicePixelRatio = window.devicePixelRatio

		if(logging) console.log(sources);

	  for (const source of sources) {
			// if(source.name === 'Entire Screen') {
			// if(source.name === 'Screen 1') {
			if(source.display_id == primaryDisplayId) {
				if(logging) console.log(source);
	      try {
	        const stream = await navigator.mediaDevices.getUserMedia({
						audio: false,
	          video: {
							cursor: "never",
	            mandatory: {
	              chromeMediaSource: 'desktop',
	              chromeMediaSourceId: source.id,
								minWidth: window.screen.width * devicePixelRatio,
								minHeight: window.screen.height * devicePixelRatio,
								minFrameRate: 30
	            }
	          }
	        })
	        gotStream(stream)
	      } catch (e) {
	        handleError(e)
	      }
	      return
	    } else {
				console.log("No matching DisplayId");
			}
	  }
	})

	// desktopCapturer.getSources(options, function (error, sources) {
	// 		let size = screen.getPrimaryDisplay().size
  //   	let devicePixelRatio = window.devicePixelRatio
	//
  //   	if(error) if(logging) console.log(error)
	//
  //   	sources.forEach(function (source) {
  //   		if(source.name === 'Entire screen') {
	//     		navigator.mediaDevices.getUserMedia({
	// 				audio: false,
	// 				video: {
	// 					mandatory: {
	// 						chromeMediaSource: 'desktop',
	// 				        chromeMediaSourceId: source.id,
	// 				        minWidth: size.width * devicePixelRatio,
	// 				        minHeight: size.height * devicePixelRatio,
	// 				        minFrameRate: 30
	// 				        // minAspectRatio: devicePixelRatio
	// 				    }
	// 				}
	// 				// video: {
	// 				// 		width: { max: 1920 },
	// 				// 		height: { max: 1080 },
	// 				// 		frameRate: { ideal: 10, max: 15 },
	// 				// 		mediaSourceId: { exact: [source.id] },
	// 				// 		mediaStreamSource: { exact: ['desktop'] }
	// 				// }
	//     		})
	//     		.then((stream) => gotStream(stream))
	// 	        .catch((e) => handleError(e))
	// 	        return
	//     	}
	//     })
	// })
}

function handleError (e) {
	if(logging) console.log(e)
}

function gotStream (stream) {
	if(logging) console.log('Received local stream');
	localStream = stream;

	var data = {
		"type" : "getScreenOk",
		"target" : "targetId",
	}
	ws.send(JSON.stringify(data));
	// ipcRenderer.send("nomousy", "show");
	// ipcRenderer.send("nomousy", "hide");
}

// -------------------------------------------------- Signaling  --------------------------------------------------

function getOffer(desc) {
	var servers = {url:'stun:stun.l.google.com:19302'};

	localPeer = new RTCPeerConnection(servers, {optional: [{RtpDataChannels: false}]});
	if(logging) console.log('Created remote peer connection object localPeer');

	localPeer.ondatachannel = receiveChannelCallback;

	localPeer.addStream(localStream);
	if(logging) console.log('Added localStream to localPeer');

	var desc = new RTCSessionDescription(desc);

	if(logging) console.log('localPeer setRemoteDescription start');
	localPeer.setRemoteDescription(desc).then(
		function() {
			onSetRemoteSuccess();
		},
		onSetSessionDescriptionError
	);

	if(logging) console.log('localPeer createAnswer start');
	localPeer.createAnswer().then(
		onCreateAnswerSuccess,
		onCreateSessionDescriptionError
	);

	localPeer.onicecandidate = function(e) {
		sendIceCandidate(e);
	};

	localPeer.oniceconnectionstatechange = function(e) {
		onIceStateChange(localPeer, e);
	};
}

function sendAnswer(desc) {
	var data = {
		"type" : "video-answer",
		"target" : "targetId",
		"desc" : desc
	}
	ws.send(JSON.stringify(data));
	if(logging) console.log('SendAnswer complete');
}

function sendIceCandidate(event) {
	if (event.candidate) {
		var data = {
			"type" : "new-ice-candidate",
			"target" : "targetId",
			"candidate" : event.candidate
		}
		ws.send(JSON.stringify(data));
	}
}

function getIceCandidate(msg) {
	var candidate = new RTCIceCandidate(msg);
	localPeer.addIceCandidate(candidate).then(
		function() {
			onAddIceCandidateSuccess();
		},
		function(err) {
			onAddIceCandidateError(err);
		}
	);
	// if(logging) console.log('localPeer ICE candidate: \n' + (msg ? msg.candidate : '(null)'));
}

// ------------------------------------------------- Signaling Event  -----------------------------------------------

function onCreateAnswerSuccess(desc) {
	if(logging) {
		console.log('localPeer setLocalDescription start');
	}
	localPeer.setLocalDescription(desc).then(
		function() {
			onSetLocalSuccess();
		},
		onSetSessionDescriptionError
	);
	sendAnswer(desc);
}

function onCreateSessionDescriptionError(error) {
	if(logging) console.log('Failed to create session description: ' + error.toString());
}

function onSetLocalSuccess() {
	if(logging) console.log('localPeer setLocalDescription complete');
}

function onSetRemoteSuccess() {
	if(logging) console.log('localPeer setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
	if(logging) console.log('Failed to set session description: ' + error.toString());
}

function onAddIceCandidateSuccess() {
	if(logging) console.log('localPeer addIceCandidate success');
	ipcRenderer.send('rtcConnection', "on");
}

function onAddIceCandidateError(error) {
	if(logging) console.log('localPeer failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(peer, event) {
	if(peer) {
		if(logging) {
			console.log('Remote ICE state: ' + peer.iceConnectionState);
			console.log('ICE state change event: ', event);
		}
	}
}

//------------------------------------------------- DataChannel - String  -----------------------------------------------

function sendData(type, action, value) {
	var readyState = receiveChannel.readyState;
	var data = {
		"type" : type,
		"action" : action,
		"value" : value
	}
	if(readyState == "open") receiveChannel.send(JSON.stringify(data));
}

function receiveChannelCallback(event) {
	if(logging) console.log('Receive Channel Callback');
	receiveChannel = event.channel;
	receiveChannel.onmessage = onReceiveMessageCallback;
	receiveChannel.onopen = onReceiveChannelStateChange;
	receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveMessageCallback(event) {
	if(typeof event.data != "object") {
		var data = JSON.parse(event.data);
		if(data.type == "clipboard") {
			clipboard.writeText(data.value);
			ipcRenderer.send('clipboard', data.value);
		} else if(data.type == "controls") {
			ipcRenderer.send('controls', data.action + "[:]" + data.value);
		} else if(data.type == "fileSend") {
			receivedFileName = data.filename;
			receivedFileSize = data.filesize;
			console.log(receivedFileName, receivedFileSize);
		}
	} else {							// File Desc
		receiveBuffer.push(event.data);
		receivedSize += event.data.byteLength;

		if (receivedSize == receivedFileSize) {
			var received = new window.Blob(receiveBuffer);
			receiveBuffer = [];

			var downloadAnchor = document.createElement("a");
			var objURL = URL.createObjectURL(received);
			downloadAnchor.href = objURL
			downloadAnchor.download = receivedFileName;
			downloadAnchor.click();
			URL.revokeObjectURL(objURL);
			receivedSize = 0;
		}
	}
}

function onReceiveChannelStateChange() {
	var readyState = receiveChannel.readyState;
	if(logging) console.log('Receive channel state is: ' + readyState);
}

//------------------------------------------------- DataChannel - File  -----------------------------------------------

function sendFile(file) {
	if(logging) console.log('File is ' + [file.name, file.size, file.type, file.lastModifiedDate].join(' '));

	var fileInfo = {
		"type" : "fileSend",
		"filesize" : file.size,
		"filename" : file.name
	}
	receiveChannel.send(JSON.stringify(fileInfo));

	if (file.size === 0) {
		closeDataChannels();
		return;
	}

	var chunkSize = 16384;
	var sliceFile = function(offset) {
		var reader = new window.FileReader();
		reader.onload = (function() {
			return function(e) {
				receiveChannel.send(e.target.result);

				if(file.size > offset + e.target.result.byteLength) {
					window.setTimeout(sliceFile, 0, offset + chunkSize);
				}

			};
		})(file);

		var slice = file.slice(offset, offset + chunkSize);
		reader.readAsArrayBuffer(slice);
	};
	sliceFile(0);
}

// ------------------------------------------------- ipcRenderer Event  -----------------------------------------------

ipcRenderer.on('clipboard', function (event, arg) {
	sendData("clipboard", "write", arg);
})

ipcRenderer.on('primaryDisplayId', function (event, arg) {
	primaryDisplayId = arg;
	console.log("getPrimaryDisplay.id", arg);
})
