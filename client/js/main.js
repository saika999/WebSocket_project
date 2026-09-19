'use strict';

const socket = new WebSocket(`ws://${location.hostname}:3000`);
const btnSend = document.getElementById('btn-send');
const input = document.getElementById('input');
const statusText = document.getElementById('status');
const messagesContainer = document.getElementById('messages');


socket.addEventListener('open', () => {
    statusText.textContent = 'Connected';
    statusText.classList.add('status-connected');
});


socket.addEventListener('message', (event) => {
    const message = document.createElement('p');
    messagesContainer.append(message)
    message.textContent = event.data;
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

    socket.send(message);
    input.value = '';
}