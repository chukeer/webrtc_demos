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
let stream

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
  
  signalChannel = new SignalChannel(roomId, "client", onRemoteSdp, onRemoteCandidate)

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  const video = document.querySelector('video');
  const videoTracks = stream.getVideoTracks();
  console.log('Got stream with constraints:', constraints);
  console.log(`Using video device: ${videoTracks[0].label}`);
  window.stream = stream; // make variable available to browser console
  video.srcObject = stream;
  e.target.disabled = true;

  const configuration = {};
  console.log('RTCPeerConnection configuration:', configuration);
  pc = new RTCPeerConnection(configuration);
  pc.addEventListener('icecandidate', e => onIceCandidate(pc, e));
  pc.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc, e));

  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  console.log('Added local stream to pc');

  try {
    const offer = await pc.createOffer()
    await onCreateOfferSuccess(offer)
  } catch (e) {
    console.log(`Failed to set session description: ${e.toString()}`);
  }
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc\n${desc.sdp}`);
  console.log('pc setLocalDescription start');
  try {
    await pc.setLocalDescription(desc);
    console.log(`setLocalDescription complete`);
    signalChannel.sendSdp(desc.sdp)
  } catch (e) {
    console.log(`Failed to set session description: ${e.toString()}`);
  }
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

async function onRemoteSdp(sdp) {
    console.log("onRemoteSdp:" + sdp)
    try {
        let answer = new RTCSessionDescription({ sdp: sdp, type: 'answer' });
        await pc.setRemoteDescription(answer);
        console.log(`setRemoteDescription complete`);
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

document.querySelector('#showVideo').addEventListener('click', e => start(e));
