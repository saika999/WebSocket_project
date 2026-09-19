const Websocket = require('ws');

const server = new Websocket.Server({
    port: 3000
})

console.log('Websokcet server started on port 3000');


server.on('connection', (socket) => {
    console.log('Connected');

    socket.on('message', (message) => {
        console.log('Message:', message.toString());

        server.clients.forEach((client) => {
            if (client.readyState === Websocket.OPEN) {
                client.send(message.toString())
            }
        })
    })

    socket.on('close', () => {
        console.log(`Client disconnected!`);

    })

})