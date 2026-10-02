const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const server = new WebSocket.Server({
    port: 3000
});
const db = new sqlite3.Database('./chat.db');

db.run(`CREATE TABLE IF NOT EXISTS messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    (error) => {
        if (error) { console.error('Database error:', error); return; } console.log('Messages table is ready')
    });
console.log('Database connected');

console.log('WebSocket server started on port 3000');

server.on('connection', (socket) => {

    console.log('Client connected');

    socket.on('message', (message) => {

        const text = message.toString();

        console.log('Message:', text);

        db.run('INSERT INTO messages (message) VALUES (?)', [text], (error) => { if (error) { console.error('Save error:', error); return; } console.log('Message saved:', text); });

        server.clients.forEach((client) => {

            if (client.readyState === WebSocket.OPEN) {
                client.send(text);
            }

        });

    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });

});



