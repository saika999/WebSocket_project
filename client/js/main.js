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
    //     const data = JSON.parse(event.data);
    //     const message = document.createElement('p');
    //     message.textContent = new Date(data.date).toLocaleString() + ' ' + data.message;
    //     messagesContainer.append(message);
    const data = JSON.parse(event.data);
    if (data.type === 'delete') {
        messagesContainer.querySelector(`[data-message-id="${data.id}"]`)?.remove();
        return;
    }
    if (data.type === 'error') {
        alert(data.message);
        return;
    }

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

        if(socket.readyState !== WebSocket.OPEN) {
            alert('Нет подключения к серверу!');
            return;
        }
        deleteBtn.disabled = true;
        socket.send(JSON.stringify({type:'delete', id:data.id}));
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

    socket.send(message);
    input.value = '';
}
