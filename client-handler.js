const OP = require('./public/js/OP');

// "username" => client
const players = new Map();

const clientConnected = client => {
  client.username = null; // unregistered
  client.sendOp = sendOp;
  client.receiveOp = receiveOp;
  client.register = register;

  client.on('message', receiveMessage.bind(client));
  client.on('close', disconnect.bind(client));
};

const register = function({ username, avatarId }){
  this.username = username;
  this.avatarId = avatarId;
  this.position = { x: 0, y: 0 };
  players.set(this.username, this);
}

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
      let { message } = msg.payload;
      players.forEach((player, playerUsername) => {
        player.sendOp(OP.CHAT, { username : this.username, message });
      });
      break;
    case OP.ENTER_WORLD:
      // give current player initial state of the game
      this.sendOp(OP.ENTER_WORLD_ACK,
        [ ...players.values() ].map(({
          username,
          avatarId,
          position
        }) => ({
          username,
          avatarId,
          position
        }))
      );

      // broadcast new player to all existing players
      players.forEach( (player, playerUsername, map) => {
        if(player === this) return;
        player.sendOp(OP.NEW_PLAYER, {
          username : this.username,
          avatarId : this.avatarId,
          position : this.position
        });
      });
      break;
    case OP.MOVE_TO:
      let position = msg.payload;
      this.position = position;
      players.forEach( (player, playerUsername, map) => {
        if(player === this) return;
        player.sendOp(OP.MOVE_TO, { username: this.username, position });
      });
      break;
    case OP.STOP_MOVING:
      players.forEach( (player) => {
        if(player === this) return
        player.sendOp(OP.STOP_MOVING, msg.payload);
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

  if( msg.OP === OP.PING) return this.sendOp(OP.PONG);

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
        this.register(msg.payload);
        this.sendOp(OP.REGISTERACK);
        console.info(`Client username:'${this.username}' has joined.`);
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
    console.info(`Client username:'${this.username}' has disconnected.`);
  } else console.debug(`Client <anonymous> has disconnected.`);
}

module.exports = {
  clientConnected
};
