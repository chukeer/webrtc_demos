import SignalChannel from "./signal_channel.js"

let clientName = "client"
let serverName = "server"
let roomId = Date.now()
console.log(`roomId:${roomId}`)

const constraints = window.constraints = {
  audio: false,
  video: true
};

function createCtx(userName) {
  let ctx = new Object()

  let signalChannel = new SignalChannel(roomId, userName)
  signalChannel.onSdp = msg => onRemoteSdp(ctx, msg)
  signalChannel.onCandidate = msg => onRemoteCandidate(ctx, msg)

  const configuration = {};
  let pc = new RTCPeerConnection(configuration);

  ctx.userName = userName
  ctx.signalChannel = signalChannel
  ctx.pc = pc

  return ctx
}

async function startClient(e) {
  e.target.disabled = true;
  let ctx = createCtx(clientName)

  let stream = await navigator.mediaDevices.getUserMedia(constraints);
  const video = document.querySelector('#localVideo');
  const videoTracks = stream.getVideoTracks();
  console.log(`[${ctx.userName}] Got stream with constraints:${constraints}`);
  console.log(`[${ctx.userName}] Using video device: ${videoTracks[0].label}`);

  video.srcObject = stream;

  ctx.pc.addEventListener('icecandidate', e => onIceCandidate(ctx, e));
  ctx.pc.addEventListener('iceconnectionstatechange', e => onIceStateChange(ctx, e));

  stream.getTracks().forEach(track => ctx.pc.addTrack(track, stream));
  console.log(`[${ctx.userName}] Added local stream to pc`);

  try {
    const offer = await ctx.pc.createOffer()
    await onCreateOfferSuccess(ctx, offer)
  } catch (e) {
    console.log(`[${ctx.userName}] Failed to set session description: ${e.toString()}`);
  }
}

async function startServer(e) {
  e.target.disabled = true;
  let ctx = createCtx(serverName)

  ctx.pc.addEventListener('icecandidate', e => onIceCandidate(ctx, e));
  ctx.pc.addEventListener('iceconnectionstatechange', e => onIceStateChange(ctx, e));
  ctx.pc.addEventListener('track', e => gotRemoteStream(ctx, e));
}

async function onCreateOfferSuccess(ctx, desc) {
  console.log(`[${ctx.userName}] pc setLocalDescription start, sdp:\n${desc.sdp}`);
  try {
    await ctx.pc.setLocalDescription(desc);
    console.log(`[${ctx.userName}] setLocalDescription complete`);
    ctx.signalChannel.sendSdp(JSON.stringify(desc))
  } catch (e) {
    console.log(`[${ctx.userName}] Failed to set session description: ${e.toString()}`);
  }
}

function onIceCandidate(ctx, event) {
  console.log(`[${ctx.userName}] ICE candidate:\n${event.candidate ? JSON.stringify(event.candidate) : '(null)'}`);
  if (event.candidate) {
    ctx.signalChannel.sendCandidate(JSON.stringify(event.candidate))
  }
}

function onIceStateChange(ctx, event) {
  console.log(`[${ctx.userName}] ICE state: ${ctx.pc.iceConnectionState}`);
  console.log(`[${ctx.userName}] ICE state change event:`, event);
}

async function onRemoteSdp(ctx, msg) {
  console.log(`[${ctx.userName}] onRemoteSdp:${msg}`)
  try {
    let remoteSdp = JSON.parse(msg) 
    await ctx.pc.setRemoteDescription(remoteSdp);
    console.log(`[${ctx.userName}] setRemoteDescription complete`);

    if (ctx.userName == serverName) {
      console.log(`[${ctx.userName}] createAnswer start`);
      const answer = await ctx.pc.createAnswer();
      await onCreateAnswerSuccess(ctx, answer)
    }
  } catch (e) {
    console.log(`[${ctx.userName}] Failed to set session description: ${e.toString()}`);
  }
}

async function onCreateAnswerSuccess(ctx, desc) {
  console.log(`[${ctx.userName}] Answer from pc:\n${desc.sdp}`);
  console.log(`[${ctx.userName}] setLocalDescription start`);
  try {
    await ctx.pc.setLocalDescription(desc);
    console.log(`[${ctx.userName}] setLocalDescription complete`);
    ctx.signalChannel.sendSdp(JSON.stringify(desc))
  } catch (e) {
    console.log(`[${ctx.userName}] Failed to set session description: ${e.toString()}`);
  }
}

async function onRemoteCandidate(ctx, msg) {
  console.log(`[${ctx.userName}] onRemoteCandidate: ${msg}`)
  try {
    let remoteCandidate = JSON.parse(msg)
    await ctx.pc.addIceCandidate(new RTCIceCandidate(remoteCandidate));
    console.log(`[${ctx.userName}] addIceCandidate success`);
  } catch (e) {
    console.log(`[${ctx.userName}] failed to add ICE Candidate: ${e.toString()}`);
  }
}

function gotRemoteStream(ctx, e) {
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log(`[${ctx.userName}] received remote stream`);
  }
}

document.querySelector('#startClient').addEventListener('click', e => startClient(e));
document.querySelector('#startServer').addEventListener('click', e => startServer(e));
