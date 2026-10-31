'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const server = new WebSocket.Server({ port: 3000 });
const db = new sqlite3.Database('./chat.db');
const scrypt = promisify(crypto.scrypt);
let schemaReady = false;

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id)
    )`);

    db.all('PRAGMA table_info(messages)', [], (error, columns) => {
        if (error) {
            console.error('Database setup error:', error);
            return;
        }

        if (!columns.some(column => column.name === 'user_id')) {
            db.run('ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id)', (alterError) => {
                if (alterError) {
                    console.error('Database migration error:', alterError);
                    return;
                }
                schemaReady = true;
                console.log('Database is ready');
            });
            return;
        }

        schemaReady = true;
        console.log('Database is ready');
    });
});

function send(socket, data) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function sendError(socket, message) {
    send(socket, { type: 'error', message });
}

function loadHistory(socket) {
    db.all(
        `SELECT messages.id, messages.message, messages.date, messages.user_id AS userId,
                COALESCE(users.username, 'Гость') AS username
         FROM messages LEFT JOIN users ON users.id = messages.user_id
         ORDER BY messages.id ASC`,
        [],
        (error, rows) => {
            if (error) {
                console.error('History read error:', error);
                sendError(socket, 'Не удалось загрузить историю сообщений');
                return;
            }
            send(socket, { type: 'history', messages: rows });
        }
    );
}

function authenticate(socket, user) {
    socket.authenticatedUser = { id: user.id, username: user.username };
    send(socket, { type: 'auth', success: true, user: socket.authenticatedUser });
    loadHistory(socket);
}

function broadcast(data) {
    server.clients.forEach(client => {
        if (client.authenticatedUser) send(client, data);
    });
}

async function register(socket, data) {
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)) {
        sendError(socket, 'Имя: 3–24 символа, только буквы, цифры, _ и -');
        return;
    }
    if (password.length < 8 || password.length > 128) {
        sendError(socket, 'Пароль должен содержать от 8 до 128 символов');
        return;
    }

    try {
        const salt = crypto.randomBytes(16);
        const passwordHash = await scrypt(password, salt, 64);
        db.run(
            'INSERT INTO users (username, password_salt, password_hash) VALUES (?, ?, ?)',
            [username, salt.toString('hex'), passwordHash.toString('hex')],
            function (error) {
                if (error) {
                    if (error.code === 'SQLITE_CONSTRAINT') {
                        sendError(socket, 'Это имя пользователя уже занято');
                    } else {
                        console.error('Registration error:', error);
                        sendError(socket, 'Не удалось создать аккаунт');
                    }
                    return;
                }
                authenticate(socket, { id: this.lastID, username });
            }
        );
    } catch (error) {
        console.error('Password hashing error:', error);
        sendError(socket, 'Не удалось создать аккаунт');
    }
}

async function login(socket, data) {
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';

    db.get(
        'SELECT id, username, password_salt, password_hash FROM users WHERE username = ? COLLATE NOCASE',
        [username],
        async (error, user) => {
            if (error) {
                console.error('Login lookup error:', error);
                sendError(socket, 'Не удалось выполнить вход');
                return;
            }
            if (!user) {
                sendError(socket, 'Неверное имя пользователя или пароль');
                return;
            }

            try {
                const actualHash = await scrypt(password, Buffer.from(user.password_salt, 'hex'), 64);
                const expectedHash = Buffer.from(user.password_hash, 'hex');
                if (actualHash.length !== expectedHash.length || !crypto.timingSafeEqual(actualHash, expectedHash)) {
                    sendError(socket, 'Неверное имя пользователя или пароль');
                    return;
                }
                authenticate(socket, user);
            } catch (hashError) {
                console.error('Password verification error:', hashError);
                sendError(socket, 'Не удалось выполнить вход');
            }
        }
    );
}

server.on('connection', (socket) => {
    socket.authenticatedUser = null;

    socket.on('message', (rawMessage) => {
        let data;
        try {
            data = JSON.parse(rawMessage.toString());
        } catch {
            sendError(socket, 'Некорректный запрос');
            return;
        }
        if (!data || typeof data !== 'object') {
            sendError(socket, 'Некорректный запрос');
            return;
        }
        if (!schemaReady) {
            sendError(socket, 'База данных ещё запускается, попробуйте снова');
            return;
        }

        if (data.type === 'register') {
            register(socket, data);
            return;
        }
        if (data.type === 'login') {
            login(socket, data);
            return;
        }
        if (data.type === 'logout') {
            socket.authenticatedUser = null;
            send(socket, { type: 'auth', success: false });
            return;
        }
        if (!socket.authenticatedUser) {
            sendError(socket, 'Сначала войдите в аккаунт');
            return;
        }

        if (data.type === 'delete') {
            if (!Number.isSafeInteger(data.id) || data.id <= 0) return;
            db.run(
                'DELETE FROM messages WHERE id = ? AND user_id = ?',
                [data.id, socket.authenticatedUser.id],
                function (error) {
                    if (error) {
                        console.error('Delete error:', error);
                        sendError(socket, 'Не удалось удалить сообщение');
                        return;
                    }
                    if (this.changes > 0) broadcast({ type: 'delete', id: data.id });
                    else sendError(socket, 'Можно удалять только свои сообщения');
                }
            );
            return;
        }

        if (data.type !== 'message' || typeof data.message !== 'string' || !data.message.trim()) return;
        const text = data.message.trim();
        if (text.length > 2000) {
            sendError(socket, 'Сообщение слишком длинное (максимум 2000 символов)');
            return;
        }

        db.run(
            'INSERT INTO messages (message, user_id) VALUES (?, ?)',
            [text, socket.authenticatedUser.id],
            function (error) {
                if (error) {
                    console.error('Save error:', error);
                    sendError(socket, 'Не удалось сохранить сообщение');
                    return;
                }
                db.get(
                    `SELECT messages.id, messages.message, messages.date, messages.user_id AS userId,
                            users.username
                     FROM messages JOIN users ON users.id = messages.user_id WHERE messages.id = ?`,
                    [this.lastID],
                    (readError, row) => {
                        if (readError || !row) {
                            console.error('Message read error:', readError);
                            sendError(socket, 'Сообщение сохранено, но не удалось его прочитать');
                            return;
                        }
                        broadcast({ type: 'message', ...row });
                    }
                );
            }
        );
    });
});

console.log('WebSocket server started on port 3000');