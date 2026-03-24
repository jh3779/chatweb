const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. IP 추출 로직 (서버 주소 확인용)
const interfaces = os.networkInterfaces();
let localIp = '127.0.0.1';
for (let dev in interfaces) {
    interfaces[dev].forEach((details) => {
        if (details.family === 'IPv4' && !details.internal) {
            localIp = details.address;
        }
    });
}

// 2. HTTP 서버 생성 및 HTML 서빙
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('index.html 파일을 찾을 수 없습니다.');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
});

// 3. Socket.io 설정 (중요: 서버 객체를 전달)
const io = require('socket.io')(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 4. 채팅 로직
// server.js의 io.on('connection') 부분을 아래와 같이 수정하세요.

io.on('connection', (socket) => {
    // 1. 접속자의 IP 주소를 가져옵니다. (IPv6일 경우 IPv4로 변환 처리 포함)
    let clientIp = socket.handshake.address;
    if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.split(':').pop();
    }

    // 2. IP의 앞 세 마디를 추출하여 '방 이름'으로 만듭니다.
    // 예: 192.168.115.57 -> 'room-192.168.115'
    const ipParts = clientIp.split('.');
    const roomName = ipParts.length === 4 
        ? `room-${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`
        : 'room-external'; // 로컬 IP가 아닐 경우 예외 처리

    // 3. 해당 방에 자동으로 입장시킵니다.
    socket.join(roomName);
    socket.currentRoom = roomName; // 소켓 객체에 현재 방 이름을 저장해둡니다.

    console.log(`[입장] ${clientIp} -> ${roomName} 배정 완료`);

    // 닉네임 설정 로직
    socket.on('set_nickname', (requestedName) => {
        const defaultName = `익명 ${Math.floor(Math.random() * 1000)}`;
        socket.userName = requestedName.trim() || defaultName;

        socket.emit('user_info', { name: socket.userName, room: roomName });
        
        // 같은 방(같은 IP 대역) 사람들에게만 입장 알림을 보냅니다.
        io.to(roomName).emit('receive_message', { 
            user: '시스템', 
            text: `${socket.userName}님이 이 네트워크 채팅방에 합류했습니다.` 
        });
    });

    // 메시지 전송 로직
    socket.on('send_message', (text) => {
        if (!socket.userName) return;
        
        // 중요: io.emit 대신 io.to(roomName).emit을 사용하여 방 격리를 구현합니다.
        io.to(socket.currentRoom).emit('receive_message', {
            user: socket.userName,
            text: text,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('disconnect', () => {
        if (socket.userName) {
            io.to(socket.currentRoom).emit('receive_message', { 
                user: '시스템', 
                text: `${socket.userName}님이 나갔습니다.` 
            });
        }
    });
});

// 5. 서버 실행 (반드시 io.on 바깥에 있어야 합니다!)
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 서버 실행 중: http://${localIp}:${PORT}`);
    console.log(`📄 같은 폴더에 index.html이 있는지 확인하세요.`);
    console.log(`=========================================`);
});