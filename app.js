var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Objeto usado para armazenar os usuários conectados
let users = [];
// Objeto usado para armazenar as salas criadas pelos usuários
let rooms = [];
// Objeto usado para armazenar os jogos que estão em execução
let games = [];


/*
    Função utilizada para checar se algum dos dois jogadores ganhou a partida.
    @input Obj game
    @return 1 = Jogador X ganhou a rodada
    @return 2 = Jogador O ganhou a rodada
 */
function victoryPattern(game){
    let x = [],o = [];
    //padrões de vitória
    let victory = [
        [1,2,3],[1,4,7],[1,5,9],[7,8,9],[4,5,6],[9,6,3],[3,5,7],[8,5,2]
    ];
    // Loop para armazenar as jogadas de cada jogador.
    for(i in game.moves){
        game.moves[i].player === "X" ? x.push(parseInt(game.moves[i].space)) : o.push(parseInt(game.moves[i].space));
    };
    console.log(x)
    console.log(o)
    // Loop para todos os padrões de vitórias (Linha 17 ~ 19)
    for(i in victory){
        let countX = 0;
        let countO = 0;
        // Loop para saber se os jogadores tem um padrão de vitória
        // O loop sempre vai ter 3 posições, pois o padrão de vitória também são 3 posicoes
        for(k in victory[i]){
            // se o jogador "X" tiver marcado a posição do padrão de vitória, é incrementado 1 ponto pra ele
            if(x.indexOf(victory[i][k]) >= 0){
                countX++
            }
            // se o jogador "O" tiver marcado a posição do padrão de vitória, é incrementado 1 ponto pra ele
            if(o.indexOf(victory[i][k]) >= 0){
                countO++;
            }
        }
        // Se o jogador que detém a letra X fez 3 pontos, ele irá ganhar. 
        if(countX === 3){
            return 1;
        }else if(countO === 3){
            return 2;
        }else{
            // nada acontece feijoada
       }
    }
}

// Inclui o diretório de arquivos para você poder acessar no projeto
app.use(express.static(__dirname + '/public'));
// Chama o index.html
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});
// Inicia o servidor na porta determinada
http.listen(3000, function () {
    console.log('Servidor iniciado na porta *:3000');
});

/*
    Função utilizada para retornar o segundo jogador da sala
    @Input Obj Socket
*/
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
/*
    Função utilizada pra pegar o numero de players numa sala.
 */

function getPlayers(socket){
    for (i in rooms) {
        if (rooms[i].name === socket.room) {
            return rooms[i].players.length;
        }
    }
}
/*
    Função utilizada para retornar o ID do jogo no qual o socket está conectado.
*/
function getGameId(socket){
    for(i in games){
        if(games[i].room === socket.room){
            return i;
        }
    }
    return false;
}
// Ao receber uma nova conexão, poderá ser executado todos os pacotes que o cliente enviar sendo eles descritos abaixo
io.on('connection', function (socket) {
    socket.name = "Jogador";
    socket.status = false;
    // Quando conectado, o usuário é salvo no Objeto "users" para poder ser usado posteriormente
    users[socket.id] = socket;
    socket.on('nova sala', function (data) {
        // Se existe alguma sala no nosso objeto Rooms
        if (rooms.length === 0) {
            socket.room = data.name;
            rooms.push({name: data.name, players: [{id: socket.id, name: socket.name}]});
            socket.join(`${data.name}`);
            socket.status = true;
            let numPlayers = getPlayers(socket);
            io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
            return false;
        } else if (socket.room) {
            socket.emit('erro sala', {message:  "Você já tem uma sala"})
            return false;
        } else {
            // Checa todas as salas para saber se já existe uma sala com aquele nome.
            for (i in rooms) {
                let room = rooms[i];
                if (room.name === data.name) {
                    socket.emit('erro sala', {message: "Este nome de sala já está sendo usado."});
                    return false;
                }
            }
            // =========================
        }
        
        socket.room = data.name;
        socket.status = true;
        socket.join(`${data.name}`);
        rooms.push({name: data.name, players: [{id: socket.id, name: socket.name}]});
        let numPlayers = getPlayers(socket);
        io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
        
        console.log(rooms)
    });
    // Quando recebido o pacote "entrar sals" irá ser executado a função abaixo
    socket.on('entrar sala', function (data) {
        if (socket.room) {
            socket.emit('erro sala', {message: "Você já está em uma sala."});
        } else {
            // Checa todas as salas para saber se a sala que o socket está tentando entrar já está cheia.
            for (i in rooms) {
                var room = rooms[i];
                if (data.name === room.name) {
                    // Se na sala em questão já tiver 2 jogadores, é retornado a mensagem para o socket e a função retorna falso.
                    if (rooms[i].players.length >= 2) {
                        socket.emit('erro sala', {message: "Esta sala já está cheia"});
                        return false;
                    }
                    // Adição do jogador na sala, caso tenha uma vaga.
                    rooms[i].players.push({id: socket.id,name: socket.name});
                }
            }
            socket.room = data.name;
            socket.join(`${data.name}`);
            socket.status = true;
            let numPlayers = getPlayers(socket);
            io.in(socket.room).emit('info sala',{status: true,players: numPlayers})
        }
        console.log(rooms)
    });
    // Quando recebido o pacote "iniciar jogo", irá ser executada a função abaixo
    socket.on('iniciar jogo',function(){
        // Checa se o socket em questão está em alguma sala.
        if(!socket.room){
            socket.emit('erro sala',{message: "Você não está em uma sala, por isso não poderá iniciar o jogo."});
            return false;
        }
        let x,o;
        for(i in games){
            // Se já houver um jogo nessa sala (com o mesmo nome), ele irá ser deletado e recomeçado.
            if(games[i].room === socket.room){
                games.splice(i,1);
                break;
            }
        }
        
        let IdSegundoJogador = get2ndPlayer(socket)
        // É gerado randomicamente um numero entre 1 e 2 para setar quem irá ser o X e quem irá ser o O
        // sendo que quem inicia o jogo é o X
        if(Math.floor(Math.random() * (3- 1) + 1) === 1){
            x = IdSegundoJogador;
            o = socket.id;
        }else{
            o = IdSegundoJogador;
            x = socket.id;
        }
        // Objeto padrão do jogo
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
    // Quando recebido o pacote "jogada", irá ser executada a função abaixo
    socket.on("jogada",function(data){
        // Retorna o jogo do socket que fez a jogada.
        let game = games[getGameId(socket)];
        // Checa se foi feita alguma jogada
        if(game.moves){
            // Faz o loop nas jogadas
            for(i in game.moves){
                // Checa se a jogada em questão já foi feita.
                if(game.moves[i].space === data.posicao){
                    socket.emit('erro sala',{message: "O outro jogador já preencheu essa posição"});
                    return false;
                }
            }
        }
        // Se for a vez do "X" jogar, irá ser executado o trecho abaixo.
        // Se não, faz a checagem para o jogador "O"
        if(game.turn === "X"){
            // Checa se o X é igual ao jogador que está fazendo a movimentação
            // Se não, avisa que não é a vez dele jogar.
            if(game.x === socket.id){
                game.moves.push({
                    player: "X",
                    space: data.posicao
                });
                // Troca o turno do jogo.
                game.turn = "O"
            }else{
                socket.emit('erro sala',{message: "Não é a sua vez de jogar."})
                return false;
            }
        }else{
            // Checa se o O é igual ao jogador que está fazendo a movimentação
            // Se não, avisa que não é a vez dele jogar.
            if(game.o === socket.id){
                game.moves.push({
                    player: "O",
                    space: data.posicao
                });
                // Troca o turno do jogo.
                game.turn = "X"
            }else{
                socket.emit('erro sala',{message: "Não é a sua vez de jogar."})
                return false;
            }
        }
        // A linha abaixo sinaliza todos na sala que a jogada foi feita e o turno trocado.
        io.in(socket.room).emit('resposta sala', game);
        // Se a quantidade de jogadas forem = 9, é declarado empate e a partida é reiniciada.
        if(game.moves.length === 9){
            io.in(socket.room).emit('erro sala', {message: "Vocês empataram."});
            io.in(socket.room).emit('reiniciar');
            return false;
        }
        // Função de vitória, com retorno 1 (X) e 2 (O)
        let victory = victoryPattern(game);
        if(victory === 1){
            io.in(socket.room).emit('erro sala', {message: "O Jogador " + io.sockets.sockets[game.x].name + " ganhou"});
            io.in(socket.room).emit('reiniciar');
        }else if(victory === 2){
            io.in(socket.room).emit('erro sala', {message: "O Jogador "+ io.sockets.sockets[game.o].name +" ganhou"});
            io.in(socket.room).emit('reiniciar');
        }else{
            
        }

    });
    // Quando recebido o pacote "sair", irá ser executada a função abaixo
    socket.on("sair", function () {
        // Loop em todas as salas para saber em qual o socket se encontra.
        for (i in rooms) {
            // Checa se o socket está naquela sala.
            if (rooms[i].name === socket.room) {
                // Loop para saber qual dos players da sala é o socket.
                for(k in rooms[i].players){
                    // Se o jogador é encontrado na sala, é removido
                    if(rooms[i].players[k].name === socket.name){
                        rooms[i].players.splice(k,1);
                    }
                }
                // Se a sala tiver 0 jogadores, é removida.
                if (rooms[i].players.length === 0) {
                    rooms.splice(i, 1);
                }
            }
        }
        socket.status = false;
        socket.leave(socket.room);
        let numPlayers = getPlayers(socket);
        // Avisa os jogadores da sala.
        io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
        delete socket.room;
        console.log(rooms)

    });
    socket.on('disconnect', function () {
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
        let numPlayers = getPlayers(socket);
        io.in(socket.room).emit('info sala',{status: true,players: numPlayers});
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