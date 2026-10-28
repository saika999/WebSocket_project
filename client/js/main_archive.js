'use strict';

const socket = new WebSocket(`ws://${location.hostname}:3000`);
const btnSend = document.getElementById('btn-send');
const input = document.getElementById('input');
const statusText = document.getElementById('status');
const messagesContainer = document.getElementById('messages');
const authPanel = document.getElementById('auth-panel');
const authForm = document.getElementById('auth-form');
const usernameInpt = document.getElementById('username');
const passwordInpt = document.getElementById('password');
const authError = document.getElementById('auth-error');
const btnRegister = document.getElementById('btn-register');
const btnSignIn = document.getElementById('btn-sign-in');
const chatPanel = document.getElementById('chat-panel');
const currentUser = document.getElementById('current-user');
const btnLogout = document.getElementById('btn-logout');
let signedInUser = null;


socket.addEventListener('open', () => {
    statusText.textContent = 'Connected';
    statusText.classList.add('status-connected');
});


socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'delete') {
        messagesContainer.querySelector(`[data-message-id="${data.id}"]`)?.remove();
        return;
    }
    if (data.type === 'error') {
        alert(data.message);
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
    if (data.type === 'message') renderMessage(data);

    const message = document.createElement('div');
    const text = document.createElement('p');
    const time = document.createElement('span');
    const deleteBtn = document.createElement('button');

    message.classList.add('message');
    message.dataset.messageId = data.id;

    text.textContent = data.message;
    time.textContent = data.date;
    deleteBtn.type = ('button');
    deleteBtn.classList.add('message-delete');
    deleteBtn.textContent = '❌';
    deleteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (socket.readyState !== WebSocket.OPEN) {
            alert('Нет подключения к серверу!');
            return;
        }
        deleteBtn.disabled = true;
        socket.send(JSON.stringify({ type: 'delete', id: data.id }));
    });


    message.append(text);
    message.append(time);
    message.append(deleteBtn);

    messagesContainer.append(message);
});

socket.addEventListener('close', () => {
    statusText.textContent = 'Disconnected';
    statusText.classList.add('status-disconnected');
})

btnSend.addEventListener('click', sendMessage);

// ---------------- 19.09.2026 --------------------------------

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    };
});

function sendMessage() {
    const message = input.value;

    if (message.trim().length === 0) {
        alert('Пустое сообщение, введите текст');
        return;
    }

    socket.send(JSON.stringify({
        type: 'message',
        message
    }));

    input.value = '';
}