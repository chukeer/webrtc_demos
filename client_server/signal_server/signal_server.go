package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var addr = flag.String("addr", "0.0.0.0:8080", "http service address")
var crtFile = flag.String("crt-file", "/etc/apache2/server.crt", "crt file path")
var keyFile = flag.String("key-file", "/etc/apache2/server.key", "key file path")

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }} // use default options

type Request struct {
	UserName string `json:"user_name"`
	RoomId   string `json:"room_id"`
	Type     string `json:"type"`
	Msg      string `json:"msg"`
}

func (r Request) String() string {
	return fmt.Sprintf("UserName=%s, RoomId=%s, Type=%s, Msg=%s", r.UserName, r.RoomId, r.Type, r.Msg)
}

type User struct {
	UserName string
	Conn     *websocket.Conn
	Room     *Room
	Msgs     [][]byte
}

type Room struct {
	RoomId string
	Users  map[string]*User
}

var mutex sync.Mutex
var Rooms map[string]*Room = make(map[string]*Room)

func findUser(req *Request, c *websocket.Conn) *User {
	mutex.Lock()
	defer mutex.Unlock()
	room, ok := Rooms[req.RoomId]
	if ok {
		user, ok := room.Users[req.UserName]
		if ok {
			return user
		}
	} else {
		room = &Room{RoomId: req.RoomId, Users: make(map[string]*User)}
		Rooms[req.RoomId] = room
	}
	user := &User{UserName: req.UserName, Conn: c, Room: room, Msgs: make([][]byte, 0)}
	room.Users[req.UserName] = user
	log.Printf("create user:%s int room:%s", user.UserName, user.Room.RoomId)
	return user
}

func removeUser(user *User) {
	mutex.Lock()
	defer mutex.Unlock()
	log.Printf("delete user:%s in room:%s", user.UserName, user.Room.RoomId)
	delete(user.Room.Users, user.UserName)
	if len(user.Room.Users) == 0 {
		log.Printf("delete room:%s", user.Room.RoomId)
		delete(Rooms, user.Room.RoomId)
	}
}

func handler(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()
	var curUser *User
	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			if curUser != nil {
				removeUser(curUser)
			}
			break
		}
		log.Printf("recv: %s", message)
		req := &Request{}
		if err = json.Unmarshal(message, req); err != nil {
			log.Println("unmarshal failed:", err)
			continue
		}
		log.Printf("req:%s\n", req)

		if curUser == nil {
			curUser = findUser(req, c)
		}
		if req.Type != "login" {
			curUser.Msgs = append(curUser.Msgs, message)
		}
		for userName, user := range curUser.Room.Users {
			if userName == req.UserName {
				continue
			}
			if req.Type == "login" {
				for _, msg := range user.Msgs {
					log.Printf("send cached msg to current user:%s, messge:%s\n", curUser.UserName, msg)
					c.WriteMessage(websocket.TextMessage, msg)
				}
			} else {
				log.Printf("send currrent msg to user:%s, message:%s\n", userName, message)
				user.Conn.WriteMessage(websocket.TextMessage, message)
			}
		}
	}
}

func main() {
	flag.Parse()
	log.SetFlags(0)
	http.HandleFunc("/", handler)
	log.Fatal(http.ListenAndServeTLS(*addr, *crtFile, *keyFile, nil))
}
