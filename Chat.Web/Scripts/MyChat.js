﻿$(function () {

    var chatHub = $.connection.chatHub;
    $.connection.hub.start().done(function () {
        console.log("SignalR started");
        model.roomList();
        model.userList();
        model.userRoomList();
        model.userAllList();
        model.joinedRoom = "Lobby";
        model.joinRoom();
    });



    // Client Operations
    chatHub.client.newMessage = function (messageView) {
        var isMine = messageView.From === model.myName();
        var message = new ChatMessage(messageView.Content,
            messageView.Timestamp,
            messageView.From,
            isMine,
            messageView.Avatar);
        model.chatMessages.push(message);
        $(".chat-body").animate({ scrollTop: $(".chat-body")[0].scrollHeight }, 1000);
    };

    chatHub.client.getProfileInfo = function (userId, displayName, avatar) {
        model.myUserId(userId);
        model.myName(displayName);
        model.myAvatar(avatar);
    };

    chatHub.client.addUser = function (user) {
        model.userAdded(new ChatUser(
            null, 
            user.Username,
            user.DisplayName,
            user.Avatar,
            user.CurrentRoom,
            user.Device));
    };

    chatHub.client.removeUser = function (user) {
        model.userRemoved(user.Username);
    };

    $('#create-room').on('click', function () {
        var self = this;
        model.userCreateRoom.removeAll();
        for (var i = 0; i < model.allUsers.length; i++) {
            model.userCreateRoom.push(model.allUsers[i]);
        }
    });

    $('ul#room-list').on('click', 'a', function () {
        var roomName = $(this).text();
        model.joinedRoom = roomName;
        model.joinRoom();
        model.chatMessages.removeAll();
        $("input#iRoom").val(roomName);
        $("#joinedRoom").html("<b>" + roomName + "</b>" + "{<span id='userRoom'></span>}");
        $('#room-list a').removeClass('active');
        $(this).addClass('active');
    });

    chatHub.client.addChatRoom = function (room) {
        model.roomAdded(new ChatRoom(room.Id, room.Name));
    };

    chatHub.client.removeChatRoom = function (room) {
        model.roomDeleted(room.Id);
    };

    chatHub.client.onError = function (message) {
        model.serverInfoMessage(message);

        $("#errorAlert").removeClass("hidden").show().delay(5000).fadeOut(500);
    };

    chatHub.client.onRoomDeleted = function (message) {
        model.serverInfoMessage(message);
        $("#errorAlert").removeClass("hidden").show().delay(5000).fadeOut(500);

        // Join to the first room in list
        $("ul#room-list li a")[0].click();
    };

    var Model = function () {
        var self = this;
        self.message = ko.observable("");
        self.chatRooms = ko.observableArray([]);
        self.chatUsers = ko.observableArray([]);
        self.chatUserRooms = ko.observableArray([]);
        self.allUsers = ko.observableArray([]);
        self.userSelected = ko.observableArray([]);
        self.userCreateRoom = ko.observableArray([]);
        self.chatMessages = ko.observableArray([]);
        self.joinedRoom = ko.observable("");
        self.serverInfoMessage = ko.observable("");
        self.myName = ko.observable("");
        self.myAvatar = ko.observable("");
        self.myUserId = ko.observable("");
        self.onEnter = function (d, e) {
            if (e.keyCode === 13) {
                self.sendNewMessage();
            }
            return true;
        }
        self.filter = ko.observable("");
        self.filteredChatUsers = ko.computed(function () {
            if (!self.filter()) {
                return self.chatUsers();
            } else {
                return ko.utils.arrayFilter(self.chatUsers(), function (user) {
                    var displayName = user.displayName().toLowerCase();
                    return displayName.includes(self.filter().toLowerCase());
                });
            }
        });
    };

    Model.prototype = {

        // Server Operations
        sendNewMessage: function () {
            var self = this;
            chatHub.server.send(self.joinedRoom, self.message());
            self.message("");
        },

        joinRoom: function (room) {
            let roomId;
            if (room) {
                roomId = room.roomId();
            }
            var self = this;
            chatHub.server.join(self.joinedRoom).done(function () {
                self.userList();
                self.userRoomList(roomId);
                self.messageHistory();
            });
        },

        roomList: function () {
            var self = this;
            console.log(self.myUserId());
            chatHub.server.getRooms(self.myUserId()).done(function (result) {
                self.chatRooms.removeAll();
                for (var i = 0; i < result.length; i++) {
                    self.chatRooms.push(new ChatRoom(result[i].RoomId, result[i].RoomName));
                }
            });
        },
      
        userList: function () {
            var self = this;
            console.log(self.joinedRoom);
            chatHub.server.getUsers(self.joinedRoom).done(function (result) {
                self.chatUsers.removeAll();
                for (var i = 0; i < result.length; i++) {
                    self.chatUsers.push(new ChatUser(
                        null, 
                        result[i].Username,
                        result[i].DisplayName,
                        result[i].Avatar,
                        result[i].CurrentRoom,
                        result[i].Device))
                }
            });

        },

        userRoomList: function (roomId) {
            var self = this; 

            chatHub.server.getUsersRoom(roomId).done(function (result) {
                self.chatUserRooms.removeAll();
                for (var i = 0; i < result.length; i++) {
                    $("#userRoom").append(result[i].DisplayName + ",");
                    self.chatUserRooms.push(new ChatUser(
                        result[i].Id,
                        result[i].Username,
                        result[i].DisplayName,
                        result[i].DisplayName,
                        result[i].Avatar,
                        null,
                        null))
                }
            });

        },

        userAllList: function () {
            var self = this;
            chatHub.server.getAllUsers().done(function (result) {
                self.allUsers.removeAll();
                for (var i = 0; i < result.length; i++) {
                    self.allUsers.push(new ChatUser(
                        result[i].Id,
                        result[i].Username,
                        result[i].DisplayName,
                        result[i].Avatar,
                        result[i].CurrentRoom,
                        result[i].Device))
                }
            });

        },

        createRoom: function () {
            var self = this;
            var name = $("#roomName").val();
            var roomId;
            chatHub.server.createRoom(name).done(function (result) {
                roomId = result;
                for (var i = 0; i < self.userSelected().length; i++) {
                    let userId = self.userSelected()[i].id();
                    chatHub.server.addUserToRoom(userId, roomId).done(function (result) {
      
                    });
                }
                console.log(self.myUserId());
                chatHub.server.addUserToRoom(self.myUserId(), roomId).done(function (result) {
                    chatHub.server.getAllUsers().done(function (result) {
                        self.allUsers.removeAll();
                        self.userSelected.removeAll();
                        for (var i = 0; i < result.length; i++) {
                            self.allUsers.push(new ChatUser(
                                result[i].Id,
                                result[i].Username,
                                result[i].DisplayName,
                                result[i].Avatar,
                                result[i].CurrentRoom,
                                result[i].Device))
                        }
                    });
                });
            });
        },

        closeRoom: function () {
            //var self = this;
            //var name = $("#roomName").val();
            //var roomId;
            //chatHub.server.createRoom(name).done(function (result) {
            //    roomId = result;
            //    for (var i = 0; i < self.allTempSelected().length; i++) {
            //        let userId = self.allTempSelected()[i].id();

            //        chatHub.server.addUserToRoom(userId, roomId).done(function (result) {
            //            console.log(result);
            //        });
            //    }
            //});
        },

        deleteRoom: function () {
            var self = this;
            chatHub.server.deleteRoom(self.joinedRoom);
        },

        messageHistory: function () {
            var self = this;
            chatHub.server.getMessageHistory(self.joinedRoom).done(function (result) {
                self.chatMessages.removeAll();
                for (var i = 0; i < result.length; i++) {
                    var isMine = result[i].From == self.myName();
                    self.chatMessages.push(new ChatMessage(result[i].Content,
                                                     result[i].Timestamp,
                                                     result[i].From,
                                                     isMine,
                                                     result[i].Avatar))
                }

                $(".chat-body").animate({ scrollTop: $(".chat-body")[0].scrollHeight }, 1000);

            });
        },

        roomAdded: function (room) {
            var self = this;
            self.chatRooms.push(room);
        },

        roomDeleted: function(id){
            var self = this;
            var temp;
            ko.utils.arrayForEach(self.chatRooms(), function (room) {
                if (room.roomId() == id)
                    temp = room;
            });
            self.chatRooms.remove(temp);
        },

        userAdded: function (user) {
            var self = this;
            self.chatUsers.push(user)
        },

        userRemoved: function (id) {
            var self = this;
            var temp;
            ko.utils.arrayForEach(self.chatUsers(), function (user) {
                if (user.userName() == id)
                    temp = user;
            });
            self.chatUsers.remove(temp);
        },
        addUserToRoom: function (user) {
            var self = this;
            self.allUsers.remove(user);
            self.userSelected.push(user);
            //ko.utils.arrayForEach(self.allTempSelected(), function (user) {
            //    temp = user;
            //    console.log(user);
            //});
            // console.log(JSON.stringify(self.allTempSelected));
        },
    };

    
    // Represent server data
    function ChatRoom(roomId, name) {
        var self = this;
        self.roomId = ko.observable(roomId);
        self.name = ko.observable(name);
    }

    function ChatUser(id = null, userName, displayName, avatar, currentRoom, device) {
        var self = this;
        self.id = ko.observable(id);
        self.userName = ko.observable(userName);
        self.displayName = ko.observable(displayName);
        self.avatar = ko.observable(avatar);
        self.currentRoom = ko.observable(currentRoom);
        self.device = ko.observable(device);
    }

    function ChatMessage(content, timestamp, from, isMine, avatar) {
        var self = this;
        self.content = ko.observable(content);
        self.timestamp = ko.observable(timestamp);
        self.from = ko.observable(from);
        self.isMine = ko.observable(isMine);
        self.avatar = ko.observable(avatar);
    }

    var model = new Model();
    ko.applyBindings(model);

});