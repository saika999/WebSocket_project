const socket = new WebSocket(`ws://${location.hostname}:3000`);
const statusText = document.getElementById('status');
const authPanel = document.getElementById('auth-panel');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const registerButton = document.getElementById('btn-register');
const chatPanel = document.getElementById('chat-panel');
const currentUser = document.getElementById('current-user');
const logoutButton = document.getElementById('btn-logout');
const btnSend = document.getElementById('btn-send');
const input = document.getElementById('input');
const messagesContainer = document.getElementById('messages');
let signedInUser = null;

socket.addEventListener('open', () => {
    statusText.textContent = 'Подключено';
    statusText.classList.add('status-connected');
});

socket.addEventListener('message', (event) => {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch {
        showError('Сервер прислал некорректный ответ');
        return;
    }

    if (data.type === 'error') {
        showError(data.message);
        return;
    }
    if (data.type === 'auth') {
        setAuthenticated(data.success ? data.user : null);
        return;
    }
    if (data.type === 'history') {
        messagesContainer.replaceChildren();
        data.messages.forEach(renderMessage);
        scrollToLatest();
        return;
    }
    if (data.type === 'delete') {
        messagesContainer.querySelector(`[data - message - id="${data.id}"]`)?.remove();
        return;
    }
    if (data.type === 'message') renderMessage(data);
});

socket.addEventListener('close', () => {
    statusText.textContent = 'Соединение потеряно';
    statusText.classList.remove('status-connected');
    statusText.classList.add('status-disconnected');
});

authForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendAuthRequest('login');
});

registerButton.addEventListener('click', () => sendAuthRequest('register'));
logoutButton.addEventListener('click', () => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'logout' }));
    }
});
btnSend.addEventListener('click', sendMessage);
input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendMessage();
});

function sendAuthRequest(type) {
    authError.textContent = '';
    if (socket.readyState !== WebSocket.OPEN) {
        showError('Нет подключения к серверу');
        return;
    }

    socket.send(JSON.stringify({
        type,
        username: usernameInput.value,
        password: passwordInput.value
    }));
}

function setAuthenticated(user) {
    signedInUser = user;
    const authenticated = Boolean(user);
    authPanel.hidden = authenticated;
    chatPanel.hidden = !authenticated;
    currentUser.hidden = !authenticated;
    logoutButton.hidden = !authenticated;

    if (user) {
        currentUser.textContent = `Вы вошли как ${ user.username }`;
        authError.textContent = '';
        passwordInput.value = '';
    } else {
        messagesContainer.replaceChildren();
        usernameInput.value = '';
        passwordInput.value = '';
        authError.textContent = '';
    }
}

function showError(message) {
    if (!signedInUser) {
        authError.textContent = message;
    } else {
        statusText.textContent = message;
    }
}

function renderMessage(data) {
    const message = document.createElement('article');
    const author = document.createElement('strong');
    const text = document.createElement('p');
    const footer = document.createElement('div');
    const time = document.createElement('time');

    message.classList.add('message');
    message.dataset.messageId = data.id;
    author.classList.add('message-author');
    author.textContent = data.username || 'Гость';
    text.textContent = data.message;
    footer.classList.add('message-footer');
    time.textContent = data.date;
    footer.append(time);

    if (signedInUser && data.userId === signedInUser.id) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.classList.add('message-delete');
        deleteButton.textContent = 'Удалить';
        deleteButton.setAttribute('aria-label', 'Удалить своё сообщение');
        deleteButton.addEventListener('click', () => {
            if (socket.readyState !== WebSocket.OPEN) {
                showError('Нет подключения к серверу');
                return;
            }
            deleteButton.disabled = true;
            socket.send(JSON.stringify({ type: 'delete', id: data.id }));
        });
        footer.append(deleteButton);
    }

    message.append(author, text, footer);
    messagesContainer.append(message);
    scrollToLatest();
}

function scrollToLatest() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
    if (socket.readyState !== WebSocket.OPEN) {
        showError('Нет подключения к серверу');
        return;
    }

    const message = input.value.trim();
    if (!message) return;

    socket.send(JSON.stringify({ type: 'message', message }));
    input.value = '';
}