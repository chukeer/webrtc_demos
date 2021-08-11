import SignalChannel from "./signal_channel.js"

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if(pair[0] == variable){return pair[1];}
  }
  return(false);
}

let signalChannel = null
let pc
const remoteVideo = document.getElementById('remoteVideo');

const constraints = window.constraints = {
  audio: false,
  video: true
};

async function start(e) {
  let roomId = getQueryVariable("room_id");
  console.log("room_id:" + roomId)
  if (!roomId) {
    alert("room_id not specified")
    return 
  }
  
  signalChannel = new SignalChannel(roomId, "server", onRemoteSdp, onRemoteCandidate)

  const configuration = {};
  console.log('RTCPeerConnection configuration:', configuration);
  pc = new RTCPeerConnection(configuration);
  pc.addEventListener('icecandidate', e => onIceCandidate(pc, e));
  pc.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc, e));
  pc.addEventListener('track', gotRemoteStream);

  e.target.disabled = true;
}

async function onIceCandidate(pc, event) {
  console.log(`ICE candidate:\n${event.candidate ? JSON.stringify(event.candidate) : '(null)'}`);
  if (event.candidate) {
      signalChannel.sendCandidate(JSON.stringify(event.candidate))
  }
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

async function onCreateAnswerSuccess(desc) {
  console.log(`Answer from pc:\n${desc.sdp}`);
  console.log('setLocalDescription start');
  try {
    await pc.setLocalDescription(desc);
    console.log(`setLocalDescription complete`);
    signalChannel.sendSdp(desc.sdp)
  } catch (e) {
    console.log(`Failed to set session description: ${e.toString()}`);
  }
}

async function onRemoteSdp(sdp) {
    console.log("onRemoteSdp:" + sdp)
    try {
        let offer = new RTCSessionDescription({ sdp: sdp, type: 'offer' });
        await pc.setRemoteDescription(offer);
        console.log(`setRemoteDescription complete`);

        console.log('createAnswer start');
        const answer = await pc.createAnswer();
        await onCreateAnswerSuccess(answer)
    } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
    }
}

async function onRemoteCandidate(msg) {
    console.log("onRemoteCandidate:" + msg)
    try {
        let remoteCandidate = JSON.parse(msg)
        await pc.addIceCandidate(new RTCIceCandidate(remoteCandidate));
        console.log(`addIceCandidate success`);
    } catch (e) {
        console.log(`failed to add ICE Candidate: ${e.toString()}`);
    }
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('pc received remote stream');
  }
}

document.querySelector('#showVideo').addEventListener('click', e => start(e));
