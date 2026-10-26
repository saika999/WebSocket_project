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
                type: 'message',
                id: row.id,
                message: row.message,
                date: row.date

            }
            socket.send(JSON.stringify(data_message));
        })

    })

    socket.on('message', (message) => {

        let data;
        try {
            data = JSON.parse(message.toString());
        } catch {
            socket.send(JSON.stringify({ type: 'error', message: 'Некорректный запрос' }));
            return;
        }
        if (data?.type === 'delete') {
            if (!Number.isSafeInteger(data.id) || data.id <= 0) return;
            db.run('DELETE FROM messages WHERE id = ?', [data.id], function (error) {
                if (error) {
                    console.error('Delete error:', error);
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'error', message: 'Не удалось удалить сообщение' }));
                    }
                    return;
                }
                server.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'delete', id: data.id }));
                    }
                });
            });
            return;
        }

        if (data?.type !== 'message' || typeof data.message !== 'string' || !data.message.trim()) return;
        const text = data.message;

        console.log('Message:', text);
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
                            type: 'message',
                            id: row.id,
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
    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });

});