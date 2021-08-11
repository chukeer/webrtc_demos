export default class SignalChannel {
    onSdp
    onCandidate
    constructor(roomId, userName) {
        this.roomId = roomId
        this.userName = userName
        this.ws = new WebSocket("wss://192.168.3.205:8080")
        this.ws.onmessage = event => this.onmessage(event)
        this.ws.onopen = event => this.login()
    }

    login() {
        let msg = {room_id: this.roomId, user_name: this.userName, type: "login"}
        let str = JSON.stringify(msg)
        console.log(`[${this.userName}] login: ${str}`)
        this.ws.send(str)
    }

    sendSdp(desc) {
        let msg = {room_id: this.roomId, user_name: this.userName, type: "sdp", msg: desc}
        let str = JSON.stringify(msg)
        console.log(`[${this.userName}] sendSdp: ${str}`)
        this.ws.send(str)
    }

    sendCandidate(candidate) {
        let msg = {room_id: this.roomId, user_name: this.userName, type: "candidate", msg: candidate}
        let str = JSON.stringify(msg)
        console.log(`[${this.userName}] sendCandidate: ${str}`)
        this.ws.send(str)
    }

    onmessage(event) {
        console.log(`[${this.userName}] recv message: ${event.data}`)
        var msg = JSON.parse(event.data)
        if (msg.type == "sdp") {
            if (this.onSdp) {
                this.onSdp(msg.msg)
            }
        } else if (msg.type == "candidate") {
            if (this.onCandidate) {
                this.onCandidate(msg.msg)
            }
        }
    }
}
