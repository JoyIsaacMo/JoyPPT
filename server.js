const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let currentState = {
    currentSongListFile: '',
    currentTrackIndex: 0,
    currentSlideIndex: 0
};

console.log(123123);

wss.on('connection', (ws) => {
    console.log('2123123');
    ws.send(JSON.stringify({
        type: 'init',
        state: currentState
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'update') {
            currentState = {
                ...currentState,
                ...data.state
            };

            // 广播更新消息给所有客户端
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'update',
                        state: currentState
                    }));
                }
            });
        } else if (data.type === 'init') {
            currentState = {
                ...currentState,
                ...data.state
            };

            // 广播初始化消息给所有客户端
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'init',
                        state: currentState
                    }));
                }
            });
        }
    });
});
