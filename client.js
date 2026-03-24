const mdns = require('multicast-dns')();
const { io } = require("socket.io-client");

let socket;

console.log("네트워크에서 채팅 서버를 찾는 중...");
mdns.query('anon-chat.local', 'A');

mdns.on('response', (response) => {
    const answer = response.answers.find(a => a.name === 'anon-chat.local');
    
    if (answer && !socket) {
        const serverUrl = `http://${answer.data}:3000`;
        console.log(`서버 발견: ${serverUrl}. 연결 시도 중...`);

        // 자동 연결 로직입니다.
        socket = io(serverUrl);

        socket.on('connect', () => {
            console.log("연결 완료! 메시지를 입력하세요.");
            // 터미널 입력을 위한 간단한 로직 예시 (실제로는 UI에서 호출)
            process.stdin.on('data', (data) => {
                socket.emit('send_message', data.toString().trim());
            });
        });

        socket.on('receive_message', (data) => {
            console.log(`[${data.user}]: ${data.text} (${data.time || ''})`);
        });
    }
});