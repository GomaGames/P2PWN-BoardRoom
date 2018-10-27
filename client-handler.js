const OP = require('./public/js/OP');

// "username" => client
const players = new Map();

const clientConnected = client => {
  client.username = null;
  client.sendOp = sendOp;
  client.receiveOp = receiveOp;

  client.on('message', receiveMessage.bind(client));
  client.on('close', disconnect.bind(client));
};

// handles errors
const sendOp = function(op, payload){
  this.send(OP.create(op, payload), error => {
    if( error !== undefined ){
      console.error(`Error writing to client socket`, error);
      disconnect.call(this);
    }
  });
}

const receiveOp = function(msg){
  let error;

  switch( msg.OP ){
    case OP.REGISTER:
      error = `You are already registered as: '${this.username}'`;
      this.sendOp(OP.ERROR, { error });
      break;
    case OP.CHAT:
      players.forEach((player, playerUsername) => {
        if(playerUsername === this.username) return;

        let message = msg.payload.message;
        player.sendOp(OP.CHAT, { username : this.username, message });
      });
      break;
    case OP.ENTER_WORLD:
      // give current player initial state of the game, no coords
      let playerUsernamesAvatars = [];
      for (let { username, avatarId } of players.values()) {
        playerUsernamesAvatars.push({username, avatarId});
      }
      this.sendOp(OP.ENTER_WORLD_ACK, playerUsernamesAvatars);

      // broadcast new player
      players.forEach( (player, playerUsername, map) => {
        if(player !== this){
          player.sendOp(OP.NEW_PLAYER, { username : this.username, avatarId : this.avatarId });
        }
      });
      break;
    case OP.MOVE_TO:
      let position = msg.payload;
      players.forEach( (player, playerUsername, map) => {
        if(player !== this){
          player.sendOp(OP.MOVE_TO, { username: player.username, position });
        }
      });
      break;
    case OP.STOP_MOVING:
      players.forEach( (player) => {
        if(player !== this){
          player.sendOp(OP.STOP_MOVING, msg.payload);
        }
      });
      break;
    default:
      error = `Unknown OP received. Server does not understand: '${msg.OP}'`;
      console.warn(error);
      this.sendOp(OP.ERROR, { error });
      return;
  }
}

const receiveMessage = function(message){
  let msg;
  try{
    msg = OP.parse(message);
  }catch(error){
    console.error(error);
    return this.sendOp(OP.ERROR, { error });
  }

  // trap unregistered users
  if( this.username === null ){
    // wait for OP:REGISTER
    if( msg.OP === OP.REGISTER ){
      // add the player to players
      if( players.has(msg.payload.username) ){
        // player name is taken
        const error = `username: '${msg.payload.username}' is not available.`;
        this.sendOp(OP.ERROR, { error });
      } else {
        // username is available, register the player
        this.username = msg.payload.username;
        players.set(this.username, this);
        this.sendOp(OP.REGISTERACK);
      }
    } else {
      const error = `You are not registered yet. Register with OP:REGISTER first.`;
      this.sendOp(OP.ERROR, { error });
    }
    return; // trap
  }

  this.receiveOp(msg);
}

const disconnect = function(){
  if( this.username !== null ){
    if( players.has(this.username) ){
      players.delete(this.username);
    }
  }
  console.info(`Client username:'${this.username}' has disconnected.`);
}

module.exports = {
  clientConnected
};
