var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var redisClient = require('redis').createClient;
var redis = redisClient(6379, 'localhost');
const mongo = require('mongodb').MongoClient;
const client = require('socket.io').listen(4000).sockets;

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


// Connect to mongo
mongo.connect('mongodb://127.0.0.1/docChat', function(err, database){
    if(err){
        throw err;
    }

    console.log('MongoDB connected...');
    var db = database.db('chatApp');
    

    // Connect to Socket.io
    client.on('connection', function(socket){
      let chat = db.collection('chats');
        

        // Create function to send status
        sendStatus = function(s){
            socket.emit('status', s);
        }

        // Get last saved message from redis
        redis.get('msgData' ,function(err, reply){
          if(err){
            console.log(err);
          }
          else{
            socket.emit('output', [JSON.parse(reply)]);
          }

        })
        // get a max 100 messages from mongodb

        // chat.find().limit(100).sort({_id:1}).toArray(function(err, res){
        //     if(err){
        //         throw err;
        //     }

        //     // Emit the messages
        //     socket.emit('output', res);
        // });

        // Handle input events
        socket.on('input', function(data){
            let name = data.name;
            let message = data.message;

            // Check for name and message
            if(name == '' || message == ''){
                // Send error status
                sendStatus('Please enter a name and message');
            } else {
                // Insert message
                redis.set('msgData', JSON.stringify(data), function () {
                  console.log(data);

                  chat.insert({name: name, message: message});
                  redis.get('msgData', function(err, reply){
                    client.emit('output', [JSON.parse(reply)]);
                  });
                  

                  // Send status object
                  sendStatus({
                      message: 'Message sent',
                      clear: true
                  });

              });

            }
        });

        // Handle clear
        socket.on('clear', function(data){
            // Remove all chats from collection
            chat.remove({}, function(){
                // Emit cleared
                socket.emit('cleared');
            });
        });
    });
});

module.exports = app;
