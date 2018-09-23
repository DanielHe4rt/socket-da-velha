var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

let users = [];
let rooms = [];
let games = [];
function victoryPattern(game){
    let x = [],o = [];
    let victory = [
        [1,2,3],[1,4,7],[1,5,9],[7,8,9],[4,5,6],[9,6,3],[3,5,7],[8,5,2]
    ];
    for(i in game.moves){
        game.moves[i].player === "X" ? x.push(parseInt(game.moves[i].space)) : o.push(parseInt(game.moves[i].space));
    };
    for(i in victory){
        let pattern = victory[i];
        let countX = 0;
        let countO = 0;
        for(k in pattern){
            x.indexOf(pattern[k]) >= 0 ? countX++ : 'null';
            o.indexOf(pattern[k]) >= 0 ? countO++ : 'null';
        }
       if(countX === 3){
           return 1;
       }else if(countO === 3){
           return 2;
       }else{

       }
    }
}

app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});
http.listen(3000, function () {
    console.log('Servidor iniciado na porta *:3000');
});

function get2ndPlayer(socket){
    for (i in rooms) {
        if (rooms[i].name === socket.room) {
            if(rooms[i].players.length === 1){
                return false;
            }
            return rooms[i].players[0].id === socket.id ?  rooms[i].players[1].id : rooms[i].players[0].id;
        }
    }
}
function getPlayers(socket){
    for (i in rooms) {
        if (rooms[i].name === socket.room) {
            return rooms[i].players.length;
        }
    }
}
function getGameId(socket){
    for(i in games){
        if(games[i].room === socket.room){
            return i;
        }
    }
    return false;
}
io.on('connection', function (socket) {
    socket.name = "Daniel" + Math.random().toString();
    socket.status = false;
    users[socket.id] = socket;
    socket.on('nova sala', function (data) {
        let msg;
        if (rooms.length === 0) {
            socket.room = data.name;
            rooms.push({name: data.name, players: [{id: socket.id, name: socket.name}]});
            socket.join(`${data.name}`);
            socket.status = true;
            let numPlayers = getPlayers(socket);
            io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
            return false;
        } else if (socket.room) {
            msg = "Você já tem uma sala";
        } else {
            for (i in rooms) {
                let room = rooms[i];
                if (room.name === data.name) {
                    msg = "Este nome de sala já está sendo usado.";
                }
            }
        }
        if (msg) {
            socket.emit('erro sala', {message: msg});
        } else {
            socket.room = data.name;
            socket.status = true;
            socket.join(`${data.name}`);
            rooms.push({name: data.name, players: [{id: socket.id, name: socket.name}]});
            let numPlayers = getPlayers(socket);
            io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
        }
    });
    socket.on('entrar sala', function (data) {
        if (socket.room) {
            socket.emit('erro sala', {message: "Você já está em uma sala."});
        } else {
            for (i in rooms) {
                var room = rooms[i];
                if (data.name === room.name) {
                    if (rooms[i].players.length >= 2) {
                        socket.emit('erro sala', {message: "Esta sala já está cheia"});
                        return false;
                    }
                    rooms[i].players.push({id: socket.id,name: socket.name});
                }
            }
            socket.room = data.name;
            socket.join(`${data.name}`);
            socket.status = true;
            let numPlayers = getPlayers(socket);
            io.in(socket.room).emit('info sala',{status: true,players: numPlayers})
        }
    });
    socket.on('iniciar jogo',function(res){
        !socket.room ?  socket.emit('erro sala',{message: "Você não está em um jogo."}) : '';
        let x,o;
        for(i in games){
            if(games[i].room === socket.room){
                games.splice(i,1);
                break;
            }
        }
        let sec = get2ndPlayer(socket)
        if(Math.floor(Math.random() * (3- 1) + 1) === 1){
            x = sec;
            o = socket.id;
        }else{
            o = sec;
            x = socket.id;
        }
        let data = {
            "room" : socket.room,
            "x" : x,
            "o" : o,
            "turn" : 'X',
            "moves" : []

        };
        games.push(data);
        io.in(socket.room).emit('info jogo',data);
    });
    socket.on('nickname',function(data){
        socket.name = data.nick;
    });
    socket.on("jogada",function(data){
        let game = games[getGameId(socket)];
        if(game.moves){
            for(i in game.moves){
                if(game.moves[i].space === data.posicao){
                    socket.emit('erro sala',{message: "O outro jogador já preencheu essa posição"});
                    return false;
                }
            }
        }
        if(game.turn === "X"){
            if(game.x === socket.id){
                game.moves.push({
                    player: "X",
                    space: data.posicao
                });
                game.turn = "O"
            }else{
                socket.emit('erro sala',{message: "Não é a sua vez de jogar."})
                return false;
            }
        }else{
            if(game.o === socket.id){
                game.moves.push({
                    player: "O",
                    space: data.posicao
                });
                game.turn = "X"
            }else{
                socket.emit('erro sala',{message: "Não é a sua vez de jogar."})
                return false;
            }
        }
        io.in(socket.room).emit('resposta sala', game);
        let victory = victoryPattern(game);
        if(victory === 1){
            io.in(socket.room).emit('erro sala', {message: "O Jogador " + io.sockets.sockets[game.x].name + " ganhou"});
        }else if(victory === 2){
            io.in(socket.room).emit('erro sala', {message: "O Jogador "+ io.sockets.sockets[game.x].name +" ganhou"});
        }else{
            io.in(socket.room).emit('resposta sala', game);
        }

    });
    socket.on("sair", function (data) {
        for (i in rooms) {
            if (rooms[i].name === socket.room) {
                for(k in rooms[i].players){
                    if(rooms[i].players[k].name === socket.name){
                        rooms[i].players.splice(k,1);
                    }
                }
                if (rooms[i].players.length === 0) {
                    rooms.splice(i, 1);
                }
            }
        }
        socket.status = false;
        socket.leave(socket.room);
        let numPlayers = getPlayers(socket);
        io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
        delete socket.room;

    });
    socket.on('disconnect', function () {
        for (i in rooms) {
            if (rooms[i].name === socket.room) {
                rooms[i].players--;
            }
        }
        delete users[socket.id];
    })
});
setInterval(function () {
    var pacote = [];
    var salas = [];
    for (var i in users) {
        var socket = users[i];
        pacote.push({
            name: socket.name,
            status: socket.status
        });
    }
    for (i in rooms) {
        let room = rooms[i];
        if(!room.players){
            rooms.splice(i, 1);
            continue;
        }
        salas.push({
            name: room.name,
            owner: room.players[0].name,
            players: room.players.length
        })
    }
    io.emit('rooms', salas);
    io.emit('users', pacote);

}, 1000);