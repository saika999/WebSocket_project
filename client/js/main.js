'use strict';

const socket = new WebSocket('ws://localhost:3000');
const btnSend = document.getElementById('btn-send');
const input = document.getElementById('input');
const statusText = document.getElementById('status');
const messagesContainer = document.getElementById('messages');

// const output = document.createElement('p');
// output.id = 'output';
// document.querySelector('.inpt-text').appendChild(output);

socket.addEventListener('open', () => {
    // console.log('Connection established!');
    statusText.textContent = 'Connected';
    statusText.classList.add('status-connected');
    // socket.send('Hello, David!');
});


socket.addEventListener('message', (event) => {
    const message = document.createElement('p');
    messagesContainer.append(message)
    // console.log('Message from server:', event.data);
    message.textContent = event.data;
});

socket.addEventListener('close', () => {
    statusText.textContent = 'Disconnected';
    statusText.classList.add('status-disconnected');
})

btnSend.addEventListener('click', () => {
    const message = input.value;

    if (message.trim().length === 0) {
        alert('Пустое сообщение, введите текст');
        return;
    }

    socket.send(message);
    input.value = '';
})
// ---------------- 17.09.2026 --------------------------------
