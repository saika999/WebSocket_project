const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const server = new WebSocket.Server({
    port: 3000
});
const db = new sqlite3.Database('./chat.db');

db.run(`CREATE TABLE IF NOT EXISTS messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, date DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    (error) => {
        if (error) { console.error('Database error:', error); return; } console.log('Messages table is ready')
    });
console.log('Database connected');

console.log('WebSocket server started on port 3000');

server.on('connection', (socket) => {

    console.log('Client connected');
    db.all('SELECT * FROM messages ORDER BY id ASC', [], (error, rows) => {

        if (error) {
            console.error('Read error:', error);
            return;
        }

        console.log('History:', rows);
        rows.forEach(row => {
            const data_message = {
                message: row.message,
                date: row.date

            }
            socket.send(JSON.stringify(data_message));
        })

    })

    socket.on('message', (message) => {

        const text = message.toString();
        const date = new Date().toISOString();

        console.log('Message:', text);
        // -----------------------
        db.run(
            'INSERT INTO messages (message) VALUES (?)',
            [text],
            function (error) {

                if (error) {
                    console.error('Save error:', error);
                    return;
                }

                const messageId = this.lastID;

                console.log('Message saved:', text);

                db.get(
                    'SELECT * FROM messages WHERE id = ?',
                    [messageId],
                    (error, row) => {

                        if (error) {
                            console.error('Read error:', error);
                            return;
                        }

                        const data_message = {
                            message: row.message,
                            date: row.date
                        };

                        server.clients.forEach(client => {

                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(data_message));
                            }

                        });
                    }
                );
            }
        );
        // ----------------------------------------
        // server.clients.forEach((client) => {
        //     if (client.readyState === WebSocket.OPEN) {
        //         client.send(JSON.stringify({ message: text, date: date }));
        //     }
        // });

    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });

});



